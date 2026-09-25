// Popula/atualiza a base pública de condomínios do DF a partir de fontes públicas:
// - OpenStreetMap (Overpass API) — sem autenticação
// - Google Places (New) via connector gateway — se o conector Google Maps estiver linkado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

// Bounding box aproximada do DF: (S,W,N,E)
const DF_BBOX = "-16.05,-48.30,-15.50,-47.30";

// RAs / bairros usados nas buscas
const BAIRROS_DF = [
  "Águas Claras", "Sudoeste", "Noroeste", "Asa Sul", "Asa Norte",
  "Lago Sul", "Lago Norte", "Park Sul", "Guará", "Taguatinga",
  "Ceilândia", "Samambaia", "Sobradinho", "Planaltina", "Gama",
  "Santa Maria", "Recanto das Emas", "Vicente Pires", "Jardim Botânico",
  "São Sebastião", "Cruzeiro", "Octogonal", "Núcleo Bandeirante",
];

type Cond = {
  nome: string;
  bairro?: string | null;
  cep?: string | null;
  endereco?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  telefone?: string | null;
  website?: string | null;
  source: "osm" | "google_places";
  external_id: string;
  raw_data?: unknown;
};

async function fetchOSM(): Promise<Cond[]> {
  // Overpass: apartamentos, condomínios residenciais e residentials com "name"
  const query = `
    [out:json][timeout:60];
    (
      way["building"~"apartments|residential"]["name"](${DF_BBOX});
      relation["building"~"apartments|residential"]["name"](${DF_BBOX});
      node["place"="neighbourhood"]["name"~"condom",i](${DF_BBOX});
      way["landuse"="residential"]["name"~"condom|residencial|alphaville",i](${DF_BBOX});
    );
    out center tags 800;
  `;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const els = (data.elements ?? []) as Array<any>;
  const out: Cond[] = [];
  for (const el of els) {
    const tags = el.tags ?? {};
    const nome = tags.name?.trim();
    if (!nome || nome.length < 4) continue;
    const cep = tags["addr:postcode"] ?? null;
    const bairro = tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? null;
    const rua = tags["addr:street"] ?? null;
    const numero = tags["addr:housenumber"] ?? null;
    const endereco = [rua, numero].filter(Boolean).join(", ") || null;
    const lat = el.lat ?? el.center?.lat ?? null;
    const lon = el.lon ?? el.center?.lon ?? null;
    out.push({
      nome,
      bairro,
      cep: cep ? cep.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
      endereco,
      latitude: lat,
      longitude: lon,
      telefone: tags["contact:phone"] ?? tags.phone ?? null,
      website: tags["contact:website"] ?? tags.website ?? null,
      source: "osm",
      external_id: `${el.type}/${el.id}`,
      raw_data: tags,
    });
  }
  return out;
}

async function fetchGooglePlacesBairro(bairro: string): Promise<Cond[]> {
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) return [];
  const url = "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.websiteUri,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: `Condomínio residencial em ${bairro}, Distrito Federal`,
      regionCode: "BR",
      languageCode: "pt-BR",
      maxResultCount: 20,
    }),
  });
  if (!res.ok) {
    console.warn(`Google Places falhou ${bairro}: ${res.status} ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  const places = (data.places ?? []) as Array<any>;
  return places.map((p) => {
    const comps = (p.addressComponents ?? []) as Array<any>;
    const findComp = (t: string) =>
      comps.find((c) => (c.types ?? []).includes(t))?.longText ?? null;
    const cepRaw = findComp("postal_code");
    return {
      nome: p.displayName?.text ?? "Condomínio",
      bairro: findComp("sublocality") ?? findComp("neighborhood") ?? bairro,
      cep: cepRaw ? cepRaw.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
      endereco: p.formattedAddress ?? null,
      latitude: p.location?.latitude ?? null,
      longitude: p.location?.longitude ?? null,
      telefone: p.internationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      source: "google_places" as const,
      external_id: p.id,
      raw_data: p,
    };
  });
}

async function upsertBatch(sb: ReturnType<typeof createClient>, rows: Cond[]) {
  if (!rows.length) return 0;
  const { error, count } = await sb
    .from("condominios_df")
    .upsert(rows, { onConflict: "source,external_id", count: "exact" });
  if (error) throw new Error(`upsert: ${error.message}`);
  return count ?? rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    const useGoogle = url.searchParams.get("google") !== "false";
    const useOsm = url.searchParams.get("osm") !== "false";

    let totalOsm = 0;
    let totalGoogle = 0;
    const errors: string[] = [];

    if (useOsm) {
      try {
        const osm = await fetchOSM();
        // dedup por external_id no lote
        const seen = new Set<string>();
        const dedup = osm.filter((c) => {
          const k = `${c.source}:${c.external_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        // upsert em lotes de 200
        for (let i = 0; i < dedup.length; i += 200) {
          totalOsm += await upsertBatch(sb, dedup.slice(i, i + 200));
        }
      } catch (e) {
        errors.push(`osm: ${(e as Error).message}`);
      }
    }

    if (useGoogle && LOVABLE_API_KEY && GOOGLE_MAPS_API_KEY) {
      for (const bairro of BAIRROS_DF) {
        try {
          const rows = await fetchGooglePlacesBairro(bairro);
          totalGoogle += await upsertBatch(sb, rows);
        } catch (e) {
          errors.push(`google:${bairro}: ${(e as Error).message}`);
        }
      }
    }

    const { count: totalBase } = await sb
      .from("condominios_df")
      .select("*", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        ok: true,
        inseridos_osm: totalOsm,
        inseridos_google: totalGoogle,
        total_base: totalBase,
        google_disponivel: Boolean(LOVABLE_API_KEY && GOOGLE_MAPS_API_KEY),
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
