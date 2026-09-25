import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { Switch } from "@/components/ui/switch";
import {
  chaveLocalidade,
  distanciaKm,
  formatarDistancia,
  geocodificar,
  geocodificarLote,
} from "@/lib/avaliacao/geoProximidade";
import { Wand2, Search, CheckCircle2, AlertCircle, MapPin, Loader2, Building2, ExternalLink, Calculator, Navigation } from "lucide-react";

export interface AssistenteReferencia {
  id: string;
  origem: "carteira" | "mercado";
  titulo: string;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  tipo: string | null;
  operacao: string | null;
  area: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  preco: number | null;
  url: string | null;
  portal: string | null;
  endereco?: string | null;
  distancia_km?: number | null;
  /** Referência incluída manualmente mesmo tendo sido descartada pelos filtros. */
  forcada?: boolean;
  /** Motivo original do descarte, preservado quando o uso é forçado. */
  motivoDescarte?: string;
}

export interface AssistenteDescartada extends AssistenteReferencia {
  criterio: "raio" | "sem_localizacao" | "limite";
  motivo: string;
}




export interface AssistenteCampos {
  tipo: string;
  operacao: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  area_privativa: string;
  area_construida: string;
  area_terreno: string;
  quartos: string;
  banheiros: string;
  vagas: string;
  preco: string;
  descricao: string;
}

interface Props {
  dados: AssistenteCampos;
  onAplicar: (patch: Partial<AssistenteCampos>) => void;
  /** Notifica as referências forçadas (inclusive as restauradas do localStorage após recarregar). */
  onForcadasChange?: (refs: AssistenteReferencia[]) => void;
}

const numeroOuVazio = (v: string) => (v && !isNaN(Number(v)) ? Number(v) : 0);

const valoresValidos = (valores: number[]) =>
  valores.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);

const mediana = (valores: number[]) => {
  const arr = valoresValidos(valores);
  if (!arr.length) return 0;
  const meio = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[meio] : (arr[meio - 1] + arr[meio]) / 2;
};

/** Explica passo a passo como a mediana de um atributo foi obtida. */
const explicarMediana = (label: string, valores: number[], total: number, formatar: (n: number) => string) => {
  const arr = valoresValidos(valores);
  const med = mediana(valores);
  const meio = Math.floor(arr.length / 2);
  const formula = !arr.length
    ? "sem valores válidos"
    : arr.length % 2
      ? `valor central de ${arr.length} valor(es) ordenados`
      : `média dos 2 centrais: (${formatar(arr[meio - 1])} + ${formatar(arr[meio])}) ÷ 2`;
  return {
    label,
    usados: arr.length,
    ignorados: total - arr.length,
    serie: arr.map(formatar),
    formula,
    resultado: med,
    resultadoFmt: med > 0 ? formatar(med) : "—",
  };
};

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Chave de persistência dos filtros/última busca do assistente. */
const ASSISTENTE_STORAGE_KEY = "avaliacao:assistente-filtros";

type AssistentePersistido = {
  cepBusca: string;
  proximidadeAtiva: boolean;
  enderecoCentro: string;
  raioKm: number;
  centroInfo: { texto: string; label: string; raio: number } | null;
  referencias: AssistenteReferencia[] | null;
  descartadas: AssistenteDescartada[];
  criteriosAplicados: string[];
  mostrarDescartadas: boolean;
  ultimoPreenchimento: { quando: string; campos: string[]; linhaFonte: string } | null;
};

const lerPersistido = (): Partial<AssistentePersistido> => {
  try {
    const raw = localStorage.getItem(ASSISTENTE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};




export function AssistenteManualPanel({ dados, onAplicar, onForcadasChange }: Props) {
  const { imobiliariaId, user } = useAuth();
  const { toast } = useToast();

  /** Log detalhado de cada ação do assistente (CEP, referências, preenchimento). */
  const logAssistente = useCallback(
    (action: string, message: string, metadata?: Record<string, any>, level: "info" | "warn" | "error" = "info") => {
      logger.log({
        module: "Avaliacao",
        action,
        message,
        level,
        userId: user?.id,
        metadata: {
          origem: "assistente-manual-sas",
          imobiliaria_id: imobiliariaId,
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });
    },
    [imobiliariaId, user?.id],
  );

  const persistidoRef = useRef<Partial<AssistentePersistido>>(lerPersistido());
  const persistido = persistidoRef.current;

  const [buscando, setBuscando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [referencias, setReferencias] = useState<AssistenteReferencia[] | null>(persistido.referencias ?? null);
  const [cepBusca, setCepBusca] = useState(persistido.cepBusca ?? "");
  const [proximidadeAtiva, setProximidadeAtiva] = useState(persistido.proximidadeAtiva ?? false);
  const [enderecoCentro, setEnderecoCentro] = useState(persistido.enderecoCentro ?? "");
  const [raioKm, setRaioKm] = useState(persistido.raioKm ?? 3);
  const [centroInfo, setCentroInfo] = useState<{ texto: string; label: string; raio: number } | null>(persistido.centroInfo ?? null);
  const [descartadas, setDescartadas] = useState<AssistenteDescartada[]>(persistido.descartadas ?? []);
  const [criteriosAplicados, setCriteriosAplicados] = useState<string[]>(persistido.criteriosAplicados ?? []);
  const [mostrarDescartadas, setMostrarDescartadas] = useState(persistido.mostrarDescartadas ?? true);
  const [ultimoPreenchimento, setUltimoPreenchimento] = useState<{
    quando: string;
    campos: string[];
    linhaFonte: string;
  } | null>(persistido.ultimoPreenchimento ?? null);

  /** Persiste filtros e último resultado para reapresentar a mesma busca após recarregar. */
  useEffect(() => {
    try {
      localStorage.setItem(
        ASSISTENTE_STORAGE_KEY,
        JSON.stringify({
          cepBusca,
          proximidadeAtiva,
          enderecoCentro,
          raioKm,
          centroInfo,
          referencias,
          descartadas,
          criteriosAplicados,
          mostrarDescartadas,
          ultimoPreenchimento,
        } satisfies AssistentePersistido),
      );
    } catch {
      /* ignore */
    }
  }, [
    cepBusca,
    proximidadeAtiva,
    enderecoCentro,
    raioKm,
    centroInfo,
    referencias,
    descartadas,
    criteriosAplicados,
    mostrarDescartadas,
    ultimoPreenchimento,
  ]);

  /** Mantém o consumidor sincronizado com as referências forçadas (persistidas em localStorage). */
  useEffect(() => {
    onForcadasChange?.((referencias || []).filter((r) => r.forcada));
  }, [referencias, onForcadasChange]);

  /** Força o uso de uma referência descartada pelos filtros (inclusão manual). */
  const forcarUsoDescartada = useCallback(
    (item: AssistenteDescartada) => {
      const { criterio, motivo, ...ref } = item;
      const forcada: AssistenteReferencia = { ...ref, forcada: true, motivoDescarte: motivo };
      setReferencias((prev) => {
        const base = prev || [];
        if (base.some((r) => r.origem === forcada.origem && r.id === forcada.id)) return base;
        return [...base, forcada];
      });
      setDescartadas((prev) => prev.filter((d) => !(d.origem === item.origem && d.id === item.id)));
      logAssistente(
        "assistente-forcar-referencia",
        `Referência descartada incluída manualmente no laudo: ${item.titulo}`,
        {
          referencia: { id: item.id, origem: item.origem, titulo: item.titulo, url: item.url },
          criterio_original: criterio,
          motivo_original: motivo,
          distancia_km: item.distancia_km ?? null,
          criterios_aplicados: criteriosAplicados,
        },
        "warn",
      );
      toast({
        title: "Referência forçada",
        description: `${item.titulo} passou a compor as medianas mesmo tendo sido descartada (${motivo}).`,
      });
    },
    [criteriosAplicados, logAssistente, toast],
  );

  /** Remove uma referência que havia sido forçada, devolvendo-a aos descartados. */
  const desfazerForcada = useCallback(
    (ref: AssistenteReferencia) => {
      setReferencias((prev) => (prev || []).filter((r) => !(r.origem === ref.origem && r.id === ref.id)));
      setDescartadas((prev) => [
        ...prev,
        {
          ...ref,
          forcada: false,
          criterio: "raio",
          motivo: ref.motivoDescarte || "Descartada pelos filtros da busca",
        } as AssistenteDescartada,
      ]);
      logAssistente("assistente-desfazer-forcada", `Referência forçada removida do laudo: ${ref.titulo}`, {
        referencia: { id: ref.id, origem: ref.origem, titulo: ref.titulo },
      });
    },
    [logAssistente],
  );


  /** Memória de cálculo: como cada mediana é obtida a partir das referências. */
  const memoriaCalculo = useMemo(() => {
    const refs = referencias || [];
    if (!refs.length) return null;
    const total = refs.length;
    const inteiro = (n: number) => String(Math.round(n));
    return {
      total,
      carteira: refs.filter((r) => r.origem === "carteira").length,
      mercado: refs.filter((r) => r.origem === "mercado").length,
      portais: Array.from(new Set(refs.map((r) => r.portal).filter(Boolean))) as string[],
      itens: [
        explicarMediana("Área (m²)", refs.map((r) => Number(r.area || 0)), total, (n) => `${Math.round(n)} m²`),
        explicarMediana("Quartos", refs.map((r) => Number(r.quartos || 0)), total, inteiro),
        explicarMediana("Banheiros", refs.map((r) => Number(r.banheiros || 0)), total, inteiro),
        explicarMediana("Vagas", refs.map((r) => Number(r.vagas || 0)), total, inteiro),
        explicarMediana("Preço", refs.map((r) => Number(r.preco || 0)), total, moeda),
      ],
    };
  }, [referencias]);


  const isTerreno = dados.tipo === "Terreno";

  const checklist = useMemo(() => {
    const areaOk = isTerreno
      ? numeroOuVazio(dados.area_terreno) > 0
      : numeroOuVazio(dados.area_privativa) > 0 || numeroOuVazio(dados.area_construida) > 0;
    return [
      { label: "Tipo do imóvel", ok: Boolean(dados.tipo) },
      { label: "Operação (Venda/Locação)", ok: Boolean(dados.operacao) },
      { label: "Bairro / região", ok: Boolean(dados.bairro?.trim()) },
      { label: "Cidade", ok: Boolean(dados.cidade?.trim()) },
      { label: "UF", ok: (dados.estado || "").trim().length === 2 },
      { label: isTerreno ? "Área do terreno" : "Área privativa ou construída", ok: areaOk },
      { label: "Quartos", ok: isTerreno || numeroOuVazio(dados.quartos) > 0 },
      { label: "Preço de referência", ok: numeroOuVazio(dados.preco) > 0 },
      { label: "Descrição (mín. 40 caracteres)", ok: (dados.descricao || "").trim().length >= 40 },
    ];
  }, [dados, isTerreno]);

  const pendentes = checklist.filter((c) => !c.ok);

  const buscarCep = useCallback(async () => {
    const cep = (cepBusca || dados.cep || "").replace(/\D/g, "");
    const inicio = Date.now();
    if (cep.length !== 8) {
      toast({ title: "CEP inválido", description: "Informe um CEP com 8 dígitos.", variant: "destructive" });
      logAssistente("assistente-cep-invalido", "CEP informado é inválido", {
        cep_digitado: cep, digitos: cep.length,
      }, "warn");
      return;
    }
    setBuscandoCep(true);
    logAssistente("assistente-cep-busca", `Busca de CEP iniciada (${cep})`, { cep, fonte: "viacep" });
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const json = await res.json();
      if (json?.erro) throw new Error("CEP não encontrado");
      const patch = {
        cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
        bairro: json.bairro || dados.bairro,
        cidade: json.localidade || dados.cidade,
        estado: json.uf || dados.estado,
      };
      onAplicar(patch);
      logAssistente("assistente-cep-aplicado", `Região preenchida pelo CEP ${cep}`, {
        cep,
        fonte: "viacep",
        duracao_ms: Date.now() - inicio,
        resposta: { bairro: json.bairro, localidade: json.localidade, uf: json.uf, logradouro: json.logradouro },
        antes: { bairro: dados.bairro, cidade: dados.cidade, estado: dados.estado, cep: dados.cep },
        depois: patch,
        campos_alterados: Object.keys(patch),
      });
      toast({ title: "Região preenchida", description: `${json.bairro || "-"} · ${json.localidade}/${json.uf}` });
    } catch (err: any) {
      toast({ title: "Não foi possível buscar o CEP", description: err?.message || "Tente novamente.", variant: "destructive" });
      logAssistente("assistente-cep-erro", `Falha na busca de CEP ${cep}`, {
        cep, erro: err?.message, duracao_ms: Date.now() - inicio,
      }, "error");
    } finally {
      setBuscandoCep(false);
    }
  }, [cepBusca, dados, logAssistente, onAplicar, toast]);


  const buscarReferencias = useCallback(async () => {
    const inicio = Date.now();
    const usarProximidade = proximidadeAtiva;
    const centroTexto = (enderecoCentro || dados.cep || "").trim();

    if (usarProximidade && !centroTexto) {
      toast({ title: "Informe o endereço ou CEP central", description: "Preciso de um ponto de partida para medir o raio.", variant: "destructive" });
      logAssistente("assistente-proximidade-sem-centro", "Busca por proximidade bloqueada: centro não informado", { raio_km: raioKm }, "warn");
      return;
    }
    if (!usarProximidade && !dados.cidade?.trim() && !dados.bairro?.trim()) {
      toast({ title: "Informe bairro ou cidade", description: "Preciso de ao menos a região para buscar referências.", variant: "destructive" });
      logAssistente("assistente-referencias-sem-regiao", "Busca de referências bloqueada: região não informada", {
        tipo: dados.tipo, operacao: dados.operacao,
      }, "warn");
      return;
    }
    setBuscando(true);
    setCentroInfo(null);
    setDescartadas([]);
    setCriteriosAplicados(
      [
        dados.tipo ? `Tipo = ${dados.tipo}` : null,
        usarProximidade
          ? `Raio de ${raioKm} km a partir de "${centroTexto}" (bairro ignorado)`
          : dados.bairro?.trim()
            ? `Bairro = ${dados.bairro.trim()}`
            : null,
        dados.cidade?.trim() ? `Cidade = ${dados.cidade.trim()}` : null,
        usarProximidade ? "Máximo de 24 referências mais próximas" : "Máximo de 12 por fonte",
      ].filter(Boolean) as string[],
    );
    logAssistente("assistente-referencias-busca", "Busca de referências iniciada", {
      modo: usarProximidade ? "proximidade" : "regiao",
      raio_km: usarProximidade ? raioKm : null,
      centro: usarProximidade ? centroTexto : null,
      filtros: { tipo: dados.tipo, operacao: dados.operacao, bairro: dados.bairro, cidade: dados.cidade },
      fontes: ["imoveis", "imoveis_mercado"],
    });
    try {
      let encontrados: AssistenteReferencia[] = [];
      const limiteBusca = usarProximidade ? 60 : 12;

      let qCarteira = supabase
        .from("imoveis")
        .select("id, titulo, bairro, cidade, estado, endereco, tipo, operacao, area, quartos, suites, banheiros, vagas, preco, url_anuncio")
        .limit(limiteBusca);
      if (imobiliariaId) qCarteira = qCarteira.eq("imobiliaria_id", imobiliariaId);
      if (dados.tipo) qCarteira = qCarteira.ilike("tipo", dados.tipo);
      if (usarProximidade) {
        // Raio ignora o bairro: filtra apenas pela cidade e depois pela distância real
        if (dados.cidade?.trim()) qCarteira = qCarteira.ilike("cidade", `%${dados.cidade.trim()}%`);
      } else if (dados.bairro?.trim()) qCarteira = qCarteira.ilike("bairro", `%${dados.bairro.trim()}%`);
      else if (dados.cidade?.trim()) qCarteira = qCarteira.ilike("cidade", `%${dados.cidade.trim()}%`);

      const { data: carteira, error: carteiraError } = await qCarteira;
      if (carteiraError) throw carteiraError;
      (carteira || []).forEach((i: any) =>
        encontrados.push({
          id: i.id,
          origem: "carteira",
          titulo: i.titulo,
          bairro: i.bairro,
          cidade: i.cidade,
          estado: i.estado,
          endereco: i.endereco,
          tipo: i.tipo,
          operacao: i.operacao,
          area: i.area,
          quartos: i.quartos,
          suites: i.suites,
          banheiros: i.banheiros,
          vagas: i.vagas,
          preco: i.preco,
          url: i.url_anuncio,
          portal: null,
        }),
      );

      let qMercado = supabase
        .from("imoveis_mercado")
        .select("id, titulo, bairro, cidade, estado, tipo, operacao, area, quartos, banheiros, vagas, preco, url_anuncio, portal")
        .limit(limiteBusca);
      if (imobiliariaId) qMercado = qMercado.eq("imobiliaria_id", imobiliariaId);
      if (dados.tipo) qMercado = qMercado.ilike("tipo", `%${dados.tipo}%`);
      if (usarProximidade) {
        if (dados.cidade?.trim()) qMercado = qMercado.ilike("cidade", `%${dados.cidade.trim()}%`);
      } else if (dados.bairro?.trim()) qMercado = qMercado.ilike("bairro", `%${dados.bairro.trim()}%`);
      else if (dados.cidade?.trim()) qMercado = qMercado.ilike("cidade", `%${dados.cidade.trim()}%`);

      const { data: mercado, error: mercadoError } = await qMercado;
      if (mercadoError) throw mercadoError;
      (mercado || []).forEach((i: any) =>
        encontrados.push({
          id: i.id,
          origem: "mercado",
          titulo: i.titulo,
          bairro: i.bairro,
          cidade: i.cidade,
          estado: i.estado,
          endereco: null,
          tipo: i.tipo,
          operacao: i.operacao,
          area: i.area,
          quartos: i.quartos,
          suites: null,
          banheiros: i.banheiros,
          vagas: i.vagas,
          preco: i.preco,
          url: i.url_anuncio,
          portal: i.portal,
        }),
      );

      let descartadosRaio = 0;
      let semCoordenada = 0;
      let descartes: AssistenteDescartada[] = [];

      if (usarProximidade) {
        const centro = await geocodificar(centroTexto);
        if (!centro) {
          toast({ title: "Endereço não localizado", description: "Não consegui geolocalizar o endereço/CEP informado.", variant: "destructive" });
          logAssistente("assistente-proximidade-centro-nao-encontrado", "Centro não geolocalizado", { centro: centroTexto }, "warn");
          setBuscando(false);
          return;
        }
        setCentroInfo({ texto: centroTexto, label: centro.label || centroTexto, raio: raioKm });

        const chaves = encontrados.map((r) =>
          chaveLocalidade([r.endereco, r.bairro, r.cidade, r.estado]),
        );
        const mapa = await geocodificarLote(chaves);

        const comDistancia = encontrados.map((r) => {
          const chave = chaveLocalidade([r.endereco, r.bairro, r.cidade, r.estado]);
          const coord = mapa.get(chave) || null;
          return { ...r, distancia_km: coord ? distanciaKm(centro, coord) : null };
        });

        semCoordenada = comDistancia.filter((r) => r.distancia_km == null).length;
        const dentro = comDistancia.filter(
          (r) => r.distancia_km != null && (r.distancia_km as number) <= raioKm,
        );
        descartadosRaio = comDistancia.length - dentro.length - semCoordenada;

        const ordenados = dentro.sort((a, b) => (a.distancia_km as number) - (b.distancia_km as number));
        const acimaLimite = ordenados.slice(24);
        encontrados = ordenados.slice(0, 24);

        descartes = [
          ...comDistancia
            .filter((r) => r.distancia_km == null)
            .map((r) => ({
              ...r,
              criterio: "sem_localizacao" as const,
              motivo: "Sem localização: não foi possível geolocalizar endereço/bairro para medir a distância",
            })),
          ...comDistancia
            .filter((r) => r.distancia_km != null && (r.distancia_km as number) > raioKm)
            .sort((a, b) => (a.distancia_km as number) - (b.distancia_km as number))
            .map((r) => ({
              ...r,
              criterio: "raio" as const,
              motivo: `Fora do raio: a ${formatarDistancia(r.distancia_km as number)} do centro (limite ${raioKm} km)`,
            })),
          ...acimaLimite.map((r) => ({
            ...r,
            criterio: "limite" as const,
            motivo: `Dentro do raio, mas fora das 24 mais próximas (a ${formatarDistancia(r.distancia_km as number)})`,
          })),
        ];
      }

      setDescartadas(descartes);
      setReferencias(encontrados);
      logAssistente(
        "assistente-referencias-resultado",
        `Busca de referências concluída: ${encontrados.length} encontrada(s)`,
        {
          modo: usarProximidade ? "proximidade" : "regiao",
          raio_km: usarProximidade ? raioKm : null,
          centro: usarProximidade ? centroTexto : null,
          descartados_fora_do_raio: descartadosRaio,
          sem_coordenada: semCoordenada,
          duracao_ms: Date.now() - inicio,
          total: encontrados.length,
          carteira: encontrados.filter((r) => r.origem === "carteira").length,
          mercado: encontrados.filter((r) => r.origem === "mercado").length,
          filtros: { tipo: dados.tipo, bairro: dados.bairro, cidade: dados.cidade },
          referencias: encontrados.map((r) => ({
            id: r.id, origem: r.origem, titulo: r.titulo, bairro: r.bairro,
            area: r.area, preco: r.preco, portal: r.portal, url: r.url,
            distancia_km: r.distancia_km ?? null,
          })),
          descartadas_total: descartes.length,
          descartadas: descartes.map((r) => ({
            id: r.id, origem: r.origem, titulo: r.titulo, bairro: r.bairro, cidade: r.cidade,
            url: r.url, distancia_km: r.distancia_km ?? null, criterio: r.criterio, motivo: r.motivo,
          })),
        },
        encontrados.length ? "info" : "warn",
      );
      toast({
        title: encontrados.length ? "Referências encontradas" : "Nenhuma referência real encontrada",
        description: encontrados.length
          ? usarProximidade
            ? `${encontrados.length} imóveis num raio de ${raioKm} km (${descartadosRaio} fora do raio, ${semCoordenada} sem localização).`
            : `${encontrados.length} imóveis reais (carteira + mercado) na região informada.`
          : usarProximidade
            ? "Nenhum imóvel dentro do raio. Aumente o raio ou use a busca por bairro."
            : "Tente ampliar a região ou cadastrar imóveis comparáveis.",
        variant: encontrados.length ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Erro ao buscar referências", description: err?.message || "Tente novamente.", variant: "destructive" });
      logAssistente("assistente-referencias-erro", "Falha ao buscar referências", {
        erro: err?.message, duracao_ms: Date.now() - inicio,
        filtros: { tipo: dados.tipo, bairro: dados.bairro, cidade: dados.cidade },
      }, "error");
    } finally {
      setBuscando(false);
    }
  }, [dados, enderecoCentro, imobiliariaId, logAssistente, proximidadeAtiva, raioKm, toast]);


  const aplicarSugestoes = useCallback(() => {
    const refs = referencias || [];
    if (!refs.length) return;

    const patch: Partial<AssistenteCampos> = {};
    const base = refs[0];

    // Região
    if (!dados.bairro?.trim() && base.bairro) patch.bairro = base.bairro;
    if (!dados.cidade?.trim() && base.cidade) patch.cidade = base.cidade;
    if ((dados.estado || "").length !== 2 && base.estado) patch.estado = base.estado.slice(0, 2).toUpperCase();

    // Características (medianas das referências reais)
    const medArea = mediana(refs.map((r) => Number(r.area || 0)));
    const medQuartos = Math.round(mediana(refs.map((r) => Number(r.quartos || 0))));
    const medBanheiros = Math.round(mediana(refs.map((r) => Number(r.banheiros || 0))));
    const medVagas = Math.round(mediana(refs.map((r) => Number(r.vagas || 0))));
    const medPreco = mediana(refs.map((r) => Number(r.preco || 0)));

    if (!numeroOuVazio(dados.area_privativa) && !numeroOuVazio(dados.area_construida) && medArea > 0 && !isTerreno) {
      patch.area_privativa = String(Math.round(medArea));
    }
    if (!numeroOuVazio(dados.quartos) && medQuartos > 0) patch.quartos = String(medQuartos);
    if (!numeroOuVazio(dados.banheiros) && medBanheiros > 0) patch.banheiros = String(medBanheiros);
    if (!numeroOuVazio(dados.vagas) && medVagas > 0) patch.vagas = String(medVagas);
    if (!numeroOuVazio(dados.preco) && medPreco > 0) patch.preco = String(Math.round(medPreco));

    // Fonte das referências (rastreabilidade no laudo)
    const carteiraQtd = refs.filter((r) => r.origem === "carteira").length;
    const mercadoQtd = refs.filter((r) => r.origem === "mercado").length;
    const portais = Array.from(new Set(refs.map((r) => r.portal).filter(Boolean))) as string[];
    const criterioProximidade = centroInfo
      ? ` Critério de proximidade: raio de ${centroInfo.raio} km a partir de "${centroInfo.texto}".`
      : "";
    const linhaFonte = `Fonte das referências: ${carteiraQtd} imóvel(is) da carteira própria e ${mercadoQtd} de mercado${portais.length ? ` (${portais.join(", ")})` : ""} em ${base.bairro || dados.bairro || "-"} / ${base.cidade || dados.cidade || "-"}${medPreco > 0 ? `, preço mediano ${moeda(medPreco)}` : ""}. Coleta em ${new Date().toLocaleDateString("pt-BR")}.${criterioProximidade}`;

    const descricaoAtual = (dados.descricao || "").trim();
    if (!descricaoAtual.includes("Fonte das referências:")) {
      patch.descricao = descricaoAtual ? `${descricaoAtual}\n\n${linhaFonte}` : linhaFonte;
    }

    if (!Object.keys(patch).length) {
      toast({ title: "Nada a preencher", description: "Os campos sugeridos já estão preenchidos." });
      logAssistente("assistente-preenchimento-vazio", "Assistente não alterou campos (já preenchidos)", {
        referencias_usadas: refs.length,
      }, "warn");
      return;
    }

    onAplicar(patch);
    setUltimoPreenchimento({
      quando: new Date().toLocaleString("pt-BR"),
      campos: Object.keys(patch),
      linhaFonte,
    });

    logAssistente("assistente-preenchimento-aplicado", `Assistente preencheu ${Object.keys(patch).length} campo(s) do laudo`, {
      campos_alterados: Object.keys(patch),
      antes: Object.fromEntries(Object.keys(patch).map((k) => [k, (dados as any)[k] ?? null])),
      depois: patch,
      medianas: { area: medArea, quartos: medQuartos, banheiros: medBanheiros, vagas: medVagas, preco: medPreco },
      referencias_usadas: {
        total: refs.length, carteira: carteiraQtd, mercado: mercadoQtd, portais,
        ids: refs.map((r) => r.id),
      },
      linha_fonte: linhaFonte,
    });
    toast({
      title: "Assistente aplicou os dados",
      description: `Campos preenchidos: ${Object.keys(patch).join(", ")}.`,
    });
  }, [referencias, dados, centroInfo, isTerreno, logAssistente, onAplicar, toast]);

  return (
    <Card className="border-primary/25 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          Assistente de preenchimento
          {pendentes.length === 0 ? (
            <Badge variant="outline" className="ml-auto border-emerald-500/40 text-emerald-600">Dados completos</Badge>
          ) : (
            <Badge variant="outline" className="ml-auto border-amber-500/40 text-amber-600">
              {pendentes.length} pendência{pendentes.length > 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {checklist.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-xs">
              {c.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span className={c.ok ? "text-muted-foreground" : "text-foreground font-medium"}>{c.label}</span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Região por CEP */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[130px]">
            <MapPin className="w-3.5 h-3.5" /> Preencher região
          </div>
          <Input
            value={cepBusca}
            onChange={(e) => setCepBusca(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={dados.cep || "CEP (somente números)"}
            className="h-9 sm:max-w-[180px]"
            inputMode="numeric"
          />
          <Button size="sm" variant="outline" onClick={buscarCep} disabled={buscandoCep} className="gap-2">
            {buscandoCep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
            Buscar CEP
          </Button>
        </div>

        {/* Refino por proximidade */}
        <div className="rounded-md border bg-background p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold flex-1">Refinar por proximidade (raio)</span>
            <Switch checked={proximidadeAtiva} onCheckedChange={setProximidadeAtiva} />
          </div>
          {proximidadeAtiva && (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={enderecoCentro}
                  onChange={(e) => setEnderecoCentro(e.target.value)}
                  placeholder={dados.cep ? `Endereço ou CEP (padrão: ${dados.cep})` : "Endereço completo ou CEP do imóvel"}
                  className="h-9 flex-1"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={raioKm}
                    onChange={(e) => setRaioKm(Math.max(0.5, Number(e.target.value) || 0.5))}
                    className="h-9 w-24"
                    inputMode="decimal"
                  />
                  <span className="text-xs text-muted-foreground">km</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 5, 10].map((km) => (
                  <Button
                    key={km}
                    size="sm"
                    variant={raioKm === km ? "default" : "outline"}
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setRaioKm(km)}
                  >
                    {km} km
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Com o raio ativo o bairro é ignorado: busco na cidade inteira, geolocalizo cada imóvel
                (endereço/bairro) e mantenho apenas os que estão dentro do raio, ordenados do mais próximo.
              </p>
              {centroInfo && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Centro: {centroInfo.label} · raio {centroInfo.raio} km
                </p>
              )}
            </div>
          )}
        </div>

        {/* Referências */}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={buscarReferencias} disabled={buscando} className="gap-2">
            {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Buscar referências reais
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={aplicarSugestoes}
            disabled={!referencias?.length}
            className="gap-2"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Preencher fonte, região e características
          </Button>
        </div>

        {criteriosAplicados.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-2.5">
            <p className="text-[11px] font-semibold mb-1">Critérios aplicados na busca</p>
            <div className="flex flex-wrap gap-1.5">
              {criteriosAplicados.map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px] font-normal">{c}</Badge>
              ))}
            </div>
          </div>
        )}

        {referencias && referencias.length > 0 && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold mb-1.5">
                Imóveis de referência usados ({referencias.length})
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-md border bg-background p-2">
                {referencias.map((r, idx) => (
                  <div key={`${r.origem}-${r.id}`} className="flex items-start gap-2 text-xs border-b last:border-0 pb-1.5 last:pb-0">
                    <span className="text-[10px] font-mono text-muted-foreground mt-0.5 w-5 shrink-0">#{idx + 1}</span>
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.titulo}</p>
                      <p className="text-muted-foreground truncate">
                        {[r.bairro, r.cidade].filter(Boolean).join(" · ")}
                        {r.area ? ` · ${r.area} m²` : ""}
                        {r.quartos ? ` · ${r.quartos}q` : ""}
                        {r.preco ? ` · ${moeda(Number(r.preco))}` : ""}
                        {r.distancia_km != null ? ` · a ${formatarDistancia(r.distancia_km)}` : ""}
                      </p>

                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> ver anúncio
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {r.origem === "carteira" ? "Carteira" : r.portal || "Mercado"}
                      </Badge>
                      {r.forcada && (
                        <>
                          <Badge className="text-[10px] bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 border-amber-500/40" variant="outline">
                            Forçada
                          </Badge>
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={() => desfazerForcada(r)}>
                            desfazer
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {descartadas.length > 0 && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Descartados pelos filtros ({descartadas.length})
                  </p>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setMostrarDescartadas((v) => !v)}>
                    {mostrarDescartadas ? "ocultar" : "mostrar"}
                  </Button>
                </div>
                {mostrarDescartadas && (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-md border border-amber-200 bg-amber-50/50 p-2">
                    {descartadas.map((r, idx) => (
                      <div key={`desc-${r.origem}-${r.id}-${idx}`} className="flex items-start gap-2 text-xs border-b last:border-0 pb-1.5 last:pb-0">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.titulo}</p>
                          <p className="text-muted-foreground truncate">
                            {[r.bairro, r.cidade].filter(Boolean).join(" · ")}
                            {r.area ? ` · ${r.area} m²` : ""}
                            {r.preco ? ` · ${moeda(Number(r.preco))}` : ""}
                            {r.distancia_km != null ? ` · a ${formatarDistancia(r.distancia_km)}` : " · distância indisponível"}
                          </p>
                          <p className="text-[10px] text-amber-700">{r.motivo}</p>
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> ver anúncio
                            </a>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            {r.criterio === "raio" ? "Fora do raio" : r.criterio === "limite" ? "Acima do limite" : "Sem localização"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => forcarUsoDescartada(r)}
                          >
                            Forçar uso
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}



            {memoriaCalculo && (
              <div className="rounded-md border bg-background p-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-primary" />
                  Memória de cálculo das medianas
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Base: {memoriaCalculo.total} referência(s) — {memoriaCalculo.carteira} da carteira e{" "}
                  {memoriaCalculo.mercado} de mercado
                  {memoriaCalculo.portais.length ? ` (${memoriaCalculo.portais.join(", ")})` : ""}
                  {centroInfo ? ` · filtradas por raio de ${centroInfo.raio} km a partir de "${centroInfo.texto}"` : ""}. A mediana usa
                  apenas valores maiores que zero, ordenados do menor para o maior.
                </p>

                <div className="space-y-1.5">
                  {memoriaCalculo.itens.map((it) => (
                    <div key={it.label} className="text-[11px] border-b last:border-0 pb-1.5 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{it.label}</span>
                        <span className="font-semibold text-primary">{it.resultadoFmt}</span>
                      </div>
                      <p className="text-muted-foreground break-words">
                        {it.usados} usado(s) · {it.ignorados} sem valor · {it.formula}
                      </p>
                      {it.serie.length > 0 && (
                        <p className="text-muted-foreground font-mono text-[10px] break-words">
                          [{it.serie.join(", ")}]
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Região (bairro/cidade/UF) vem da referência #1 quando o campo está vazio. Quartos, banheiros e
                  vagas são arredondados; área e preço são arredondados para inteiro.
                </p>
              </div>
            )}

            {ultimoPreenchimento && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-3 space-y-1">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Preenchido em {ultimoPreenchimento.quando}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Campos alterados: {ultimoPreenchimento.campos.join(", ")}
                </p>
                <p className="text-[11px] text-muted-foreground italic break-words">
                  {ultimoPreenchimento.linhaFonte}
                </p>
              </div>
            )}
          </div>
        )}


        {referencias && referencias.length === 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/[0.08] p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Nenhuma referência real encontrada — laudo ficará sem comparáveis
            </p>

            <p className="text-[11px] text-muted-foreground">
              {descartadas.length > 0
                ? `Foram levantados ${descartadas.length} imóvel(is), mas todos foram descartados pelos filtros abaixo.`
                : "Nenhum imóvel da carteira ou de mercado atendeu aos filtros aplicados nesta busca."}
            </p>

            {criteriosAplicados.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold mb-1">Filtros que restringiram a busca</p>
                <div className="flex flex-wrap gap-1.5">
                  {criteriosAplicados.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px] font-normal">{c}</Badge>
                  ))}
                </div>
              </div>
            )}

            {descartadas.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border bg-background p-2">
                <p className="text-[10px] font-semibold">
                  Você pode forçar o uso de qualquer item abaixo mesmo tendo sido excluído pelos filtros:
                </p>
                {descartadas.slice(0, 10).map((r, idx) => (
                  <div key={`vazio-${r.origem}-${r.id}-${idx}`} className="flex items-center gap-2">
                    <p className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">
                      <span className="font-medium text-foreground">{r.titulo}</span>
                      {r.distancia_km != null ? ` · a ${formatarDistancia(r.distancia_km)}` : ""} — {r.motivo}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] shrink-0"
                      onClick={() => forcarUsoDescartada(r)}
                    >
                      Forçar uso
                    </Button>
                  </div>
                ))}
                {descartadas.length > 10 && (
                  <p className="text-[10px] text-muted-foreground">+ {descartadas.length - 10} outro(s) descartado(s)</p>
                )}
              </div>
            )}

            <div className="rounded-md border bg-background p-2">
              <p className="text-[11px] font-semibold mb-0.5">O que foi usado para preencher o laudo</p>
              {ultimoPreenchimento ? (
                <>
                  <p className="text-[10px] text-muted-foreground">
                    Última aplicação em {ultimoPreenchimento.quando} — campos: {ultimoPreenchimento.campos.join(", ")}
                  </p>
                  <p className="text-[10px] text-muted-foreground italic break-words">{ultimoPreenchimento.linhaFonte}</p>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Nada foi preenchido automaticamente: os campos em branco continuam dependendo de digitação manual
                  {dados.cep?.trim() ? " (a região veio da busca por CEP, quando executada)" : ""}.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {proximidadeAtiva && raioKm < 10 && (
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setRaioKm(Math.min(10, raioKm * 2))}>
                  Ampliar raio para {Math.min(10, raioKm * 2)} km
                </Button>
              )}
              {proximidadeAtiva && (
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setProximidadeAtiva(false)}>
                  Buscar sem raio (por bairro/cidade)
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={buscarReferencias} disabled={buscando}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
