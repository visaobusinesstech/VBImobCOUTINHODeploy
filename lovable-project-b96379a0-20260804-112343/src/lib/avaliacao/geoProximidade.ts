/**
 * Geocodificação leve + cálculo de distância para refinar referências por proximidade.
 * Usa ViaCEP (quando o texto é um CEP) e Nominatim/OpenStreetMap como geocoder aberto.
 */

export interface Coordenada {
  lat: number;
  lon: number;
  label?: string;
}

const cacheGeocode = new Map<string, Coordenada | null>();

const RAIO_TERRA_KM = 6371;

export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Monta a chave textual usada para geocodificar uma localidade. */
export function chaveLocalidade(partes: (string | null | undefined)[]): string {
  return partes
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Geocodifica um endereço livre (ou CEP) retornando lat/lon, com cache em memória. */
export async function geocodificar(texto: string): Promise<Coordenada | null> {
  const chave = chaveLocalidade([texto]);
  if (!chave) return null;
  if (cacheGeocode.has(chave)) return cacheGeocode.get(chave) ?? null;

  let resultado: Coordenada | null = null;
  try {
    const somenteDigitos = texto.replace(/\D/g, "");
    let consulta = texto;

    // CEP: resolve endereço textual antes de geocodificar
    if (somenteDigitos.length === 8 && /^\d[\d\-.\s]*$/.test(texto.trim())) {
      const res = await fetch(`https://viacep.com.br/ws/${somenteDigitos}/json/`);
      const json = await res.json();
      if (!json?.erro) {
        consulta = [json.logradouro, json.bairro, json.localidade, json.uf, "Brasil"]
          .filter(Boolean)
          .join(", ");
      }
    } else if (!/brasil/i.test(consulta)) {
      consulta = `${consulta}, Brasil`;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const arr = await res.json();
    if (Array.isArray(arr) && arr.length) {
      resultado = {
        lat: Number(arr[0].lat),
        lon: Number(arr[0].lon),
        label: arr[0].display_name as string,
      };
    }
  } catch {
    resultado = null;
  }

  cacheGeocode.set(chave, resultado);
  return resultado;
}

/**
 * Geocodifica várias localidades respeitando o limite de 1 req/s do Nominatim.
 * Retorna um mapa chave -> coordenada (ou null quando não encontrada).
 */
export async function geocodificarLote(
  chaves: string[],
  opcoes: { limite?: number; intervaloMs?: number } = {},
): Promise<Map<string, Coordenada | null>> {
  const { limite = 18, intervaloMs = 1100 } = opcoes;
  const unicas = Array.from(new Set(chaves.map((c) => c.trim()).filter(Boolean))).slice(0, limite);
  const mapa = new Map<string, Coordenada | null>();

  for (let i = 0; i < unicas.length; i++) {
    const chave = unicas[i];
    const cacheKey = chaveLocalidade([chave]);
    if (cacheGeocode.has(cacheKey)) {
      mapa.set(chave, cacheGeocode.get(cacheKey) ?? null);
      continue;
    }
    mapa.set(chave, await geocodificar(chave));
    if (i < unicas.length - 1) await esperar(intervaloMs);
  }
  return mapa;
}

export const formatarDistancia = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
