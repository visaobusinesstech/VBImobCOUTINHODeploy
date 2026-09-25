/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Avaliação Imobiliária — paridade de inputs/opções/fluxo com Lovable /avaliacao.
 * Design: realty-theme VBSolution (fonte/padrão do CRM).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import realtyIntelService from "../../services/realtyIntelService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { formatBRL, estimateAvaliacao } from "../../helpers/realtyCrm";
import {
  OPERACOES_MANUAL,
  PHOTO_ACCEPT,
  PHOTO_MAX_BYTES,
  TIPOS_LINK,
  TIPOS_MANUAL,
  createEmptyManualState,
  mapSasToManual,
} from "../../helpers/avaliacaoConstants";
import {
  DESCRICAO_MIN,
  DESCRICAO_TEXTAREA_ID,
  contadorEmAlerta,
  formatarContador,
  focusDescricaoTextarea,
  truncarDescricao,
  validarDescricaoAvaliacao,
  validarDescricaoBackendShape,
  descricaoParaPersistencia,
} from "../../helpers/avaliacaoDescricao";
import {
  getMissingCriticalFields,
  isChecklistItemMissing,
  CHECKLIST_KEYS,
} from "../../helpers/avaliacaoCamposCriticos";
import SasForm from "./SasForm";
import WizardNbr from "./Wizard";

const MODE_CARTEIRA = "carteira";
const MODE_MANUAL = "manual";
const MODE_LINK = "link";

function collectFotos(manual, uploadedPhotos) {
  const fromUrls = String(manual.fotos_url || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  return [...uploadedPhotos, ...fromUrls];
}

const Avaliacao = () => {
  const [imoveis, setImoveis] = useState([]);
  const [modo, setModo] = useState(MODE_CARTEIRA);
  const [selectedImovelId, setSelectedImovelId] = useState("");
  const [manual, setManual] = useState(createEmptyManualState);
  const [linkUrl, setLinkUrl] = useState("");
  const [dadosExtraidos, setDadosExtraidos] = useState(null);
  const [extraindo, setExtraindo] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [avaliando, setAvaliando] = useState(false);
  const [avaliacao, setAvaliacao] = useState(null);
  const [resultMeta, setResultMeta] = useState(null);
  const [descricaoErro, setDescricaoErro] = useState(null);
  const [missingWarning, setMissingWarning] = useState([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [showWizard, setShowWizard] = useState(true);
  const [showSas, setShowSas] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    realtyService
      .listImoveis({ pageSize: 200 })
      .then((d) => setImoveis(d.imoveis || []))
      .catch(toastError);
  }, []);

  const imoveisAtivos = useMemo(
    () =>
      (imoveis || []).filter((i) => {
        const s = String(i.status || "").toLowerCase();
        return !s || s === "disponivel" || s === "captacao" || s === "reservado";
      }),
    [imoveis]
  );

  const selectedFromCarteira = useMemo(() => {
    if (modo !== MODE_CARTEIRA || !selectedImovelId) return null;
    return imoveis.find((i) => String(i.id) === String(selectedImovelId)) || null;
  }, [modo, selectedImovelId, imoveis]);

  const buildImovelPayload = useCallback(() => {
    if (modo === MODE_CARTEIRA && selectedFromCarteira) {
      const im = selectedFromCarteira;
      const fotos = Array.isArray(im.images)
        ? im.images
        : Array.isArray(im.fotos)
          ? im.fotos
          : [];
      return {
        imovelId: im.id,
        titulo: im.title || im.titulo || "",
        tipo: im.type || im.tipo || "Apartamento",
        operacao: im.purpose === "aluguel" ? "Aluguel" : "Venda",
        area: im.areaM2 != null ? String(im.areaM2) : "",
        quartos: im.bedrooms != null ? String(im.bedrooms) : "",
        suites: im.suites != null ? String(im.suites) : "",
        banheiros: im.bathrooms != null ? String(im.bathrooms) : "",
        vagas: im.parkingSpots != null ? String(im.parkingSpots) : "",
        bairro: im.neighborhood || "",
        cidade: im.city || "",
        estado: im.state || "DF",
        preco: im.price != null ? String(im.price) : "",
        descricao: im.description || im.descricao || "",
        fotos,
      };
    }
    const fotos = collectFotos(manual, uploadedPhotos);
    return {
      ...manual,
      fotos,
      descricao:
        modo === MODE_LINK && !String(manual.descricao || "").trim()
          ? dadosExtraidos?.descricao || ""
          : manual.descricao,
    };
  }, [modo, selectedFromCarteira, manual, uploadedPhotos, dadosExtraidos]);

  const setField = (name, value) => setManual((f) => ({ ...f, [name]: value }));

  const resetAll = () => {
    setManual(createEmptyManualState());
    setSelectedImovelId("");
    setLinkUrl("");
    setDadosExtraidos(null);
    setUploadedPhotos([]);
    setAvaliacao(null);
    setResultMeta(null);
    setDescricaoErro(null);
    setMissingWarning([]);
  };

  const handlePhotoFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const accepted = [];
    for (const f of files) {
      if (!/image\/(jpeg|png|webp)/i.test(f.type)) {
        toast.error(`Formato inválido: ${f.name} (use jpeg/png/webp)`);
        continue;
      }
      if (f.size > PHOTO_MAX_BYTES) {
        toast.error(`${f.name} excede 20MB`);
        continue;
      }
      accepted.push(f);
    }
    if (!accepted.length) return;
    try {
      const { urls } = await realtyService.uploadImovelMedia(accepted);
      setUploadedPhotos((p) => [...p, ...(urls || [])]);
      toast.success(`${(urls || []).length} foto(s) adicionada(s)`);
    } catch (err) {
      // fallback: object URLs locais
      const locals = accepted.map((f) => URL.createObjectURL(f));
      setUploadedPhotos((p) => [...p, ...locals]);
      toastError(err);
    }
  };

  const handleExtrairLink = async (urlOverride) => {
    const url = String(urlOverride || linkUrl || "").trim();
    if (!url) {
      toast.error("Cole o link do anúncio");
      return;
    }
    setExtraindo(true);
    try {
      const res = await realtyIntelService.extrairLinkAvaliacao({ url });
      const dados = res.dados || {};
      setDadosExtraidos(dados);
      setManual((prev) => ({
        ...prev,
        titulo: dados.titulo || prev.titulo,
        tipo: dados.tipo || prev.tipo,
        operacao: dados.operacao || prev.operacao,
        area: dados.area || prev.area,
        quartos: dados.quartos || prev.quartos,
        bairro: dados.bairro || prev.bairro,
        cidade: dados.cidade || prev.cidade,
        preco: dados.preco || prev.preco,
        descricao: dados.descricao || prev.descricao,
        link_imovel: dados.link_imovel || url,
      }));
      if (Array.isArray(dados.fotos) && dados.fotos.length) {
        setUploadedPhotos((p) => [...p, ...dados.fotos]);
      }
      toast.success("Dados extraídos — revise e avalie");
    } catch (err) {
      toastError(err);
    } finally {
      setExtraindo(false);
    }
  };

  const fetchHistorico = async () => {
    try {
      const data = await realtyIntelService.listAvaliacoesHistorico();
      setHistorico(data.historico || []);
    } catch (err) {
      toastError(err);
    }
  };

  const handleAvaliar = async () => {
    const imovel = buildImovelPayload();
    if (modo !== MODE_CARTEIRA) {
      if (!(Number(imovel.area) > 0)) {
        toast.error("Informe a área (m²)");
        return;
      }
      const gate = validarDescricaoBackendShape(imovel.descricao);
      if (gate) {
        setDescricaoErro(validarDescricaoAvaliacao(imovel.descricao).erro);
        setMissingWarning(getMissingCriticalFields(imovel));
        await focusDescricaoTextarea();
        toast.error(gate.error);
        return;
      }
    }

    const missing = getMissingCriticalFields(imovel);
    if (missing.length && modo !== MODE_CARTEIRA) {
      setMissingWarning(missing);
      const ok = window.confirm(
        `Campos críticos incompletos:\n\n${missing.join("\n")}\n\nDeseja continuar mesmo assim?`
      );
      if (!ok) return;
    } else {
      setMissingWarning(missing);
    }

    setAvaliando(true);
    try {
      const payload = {
        modo,
        imovelId: imovel.imovelId || undefined,
        preco: imovel.preco ? Number(imovel.preco) : undefined,
        area: imovel.area ? Number(imovel.area) : undefined,
        tipo: imovel.tipo,
        operacao: imovel.operacao,
        quartos: imovel.quartos ? Number(imovel.quartos) : undefined,
        suites: imovel.suites ? Number(imovel.suites) : undefined,
        banheiros: imovel.banheiros ? Number(imovel.banheiros) : undefined,
        vagas: imovel.vagas ? Number(imovel.vagas) : undefined,
        bairro: imovel.bairro || undefined,
        cidade: imovel.cidade || undefined,
        descricao: imovel.descricao || undefined,
      };
      const data = await realtyIntelService.avaliar(payload);
      setAvaliacao(data.avaliacao || null);
      setResultMeta({ ...data, imovel });
      setDescricaoErro(null);
      toast.success("Avaliação calculada");
    } catch (err) {
      const local = estimateAvaliacao(
        Number(imovel.preco),
        Number(imovel.area),
        Number(imovel.precoM2Mercado)
      );
      const valorIdeal = local.valorJusto || Number(imovel.preco) || 0;
      setAvaliacao({
        valor_minimo: Math.round(valorIdeal * 0.92),
        valor_ideal: valorIdeal,
        valor_maximo: Math.round(valorIdeal * 1.08),
        preco_m2_estimado: local.precoM2,
        preco_m2_regiao: 0,
        score_liquidez: 50,
        classificacao_liquidez: "media",
        analise_resumo: `Cálculo local (API indisponível). Parecer: ${local.parecer}.`,
        pontos_fortes: [],
        pontos_atencao: ["Avaliação offline — conecte a API para laudo completo"],
        estrategia_venda: "",
        portais_recomendados: [],
        sugestao_preco_inicial: valorIdeal,
        probabilidade_venda_30dias: 0,
        probabilidade_venda_60dias: 0,
        probabilidade_venda_90dias: 0,
        preco_competitivo: local.desvio <= 5,
      });
      setResultMeta({ ...local, imovel, offline: true });
      toastError(err);
    } finally {
      setAvaliando(false);
    }
  };

  const handleSalvarHistorico = async () => {
    if (!avaliacao || !resultMeta?.imovel) {
      toast.error("Execute uma avaliação antes de salvar");
      return;
    }
    const im = resultMeta.imovel;
    setSaving(true);
    try {
      await realtyIntelService.salvarAvaliacaoHistorico({
        imovelId: im.imovelId || null,
        titulo: im.titulo || `${im.tipo} em ${im.bairro || im.cidade || ""}`,
        tipo: im.tipo,
        operacao: im.operacao,
        area: Number(im.area) || 0,
        quartos: Number(im.quartos) || 0,
        bairro: im.bairro,
        cidade: im.cidade,
        estado: im.estado,
        precoInformado: Number(im.preco) || 0,
        valorMinimo: avaliacao.valor_minimo,
        valorIdeal: avaliacao.valor_ideal,
        valorMaximo: avaliacao.valor_maximo,
        precoM2Estimado: avaliacao.preco_m2_estimado,
        precoM2Regiao: avaliacao.preco_m2_regiao,
        scoreLiquidez: avaliacao.score_liquidez,
        classificacaoLiquidez: avaliacao.classificacao_liquidez,
        analiseResumo: avaliacao.analise_resumo,
        pontosFortes: avaliacao.pontos_fortes,
        pontosAtencao: avaliacao.pontos_atencao,
        estrategiaVenda: avaliacao.estrategia_venda,
        portaisRecomendados: avaliacao.portais_recomendados,
        sugestaoPrecoInicial: avaliacao.sugestao_preco_inicial,
        probabilidadeVenda30dias: avaliacao.probabilidade_venda_30dias,
        probabilidadeVenda60dias: avaliacao.probabilidade_venda_60dias,
        probabilidadeVenda90dias: avaliacao.probabilidade_venda_90dias,
        precoCompetitivo: avaliacao.preco_competitivo,
        modo,
        comparaveisCount: resultMeta.inputs?.comparaveisCount || 0,
        descricao: descricaoParaPersistencia(im.descricao),
        dadosCompletos: { manual: im, avaliacao, meta: resultMeta },
      });
      toast.success("Avaliação salva no histórico");
      if (showHistorico) fetchHistorico();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const loadHistoricoItem = (item) => {
    const dados = item.dadosCompletos?.manual || {};
    setModo(item.modo === "carteira" ? MODE_CARTEIRA : item.modo === "link" ? MODE_LINK : MODE_MANUAL);
    setManual({
      ...createEmptyManualState(),
      titulo: item.titulo || dados.titulo || "",
      tipo: item.tipo || "Apartamento",
      operacao: item.operacao || "Venda",
      area: item.area != null ? String(item.area) : "",
      quartos: item.quartos != null ? String(item.quartos) : "",
      bairro: item.bairro || "",
      cidade: item.cidade || "",
      estado: item.estado || "DF",
      preco: item.precoInformado != null ? String(item.precoInformado) : "",
      descricao: item.descricao || "",
      ...dados,
    });
    setAvaliacao({
      valor_minimo: Number(item.valorMinimo),
      valor_ideal: Number(item.valorIdeal),
      valor_maximo: Number(item.valorMaximo),
      preco_m2_estimado: Number(item.precoM2Estimado),
      preco_m2_regiao: Number(item.precoM2Regiao),
      score_liquidez: item.scoreLiquidez,
      classificacao_liquidez: item.classificacaoLiquidez,
      analise_resumo: item.analiseResumo,
      pontos_fortes: item.pontosFortes || [],
      pontos_atencao: item.pontosAtencao || [],
      estrategia_venda: item.estrategiaVenda,
      portais_recomendados: item.portaisRecomendados || [],
      sugestao_preco_inicial: Number(item.sugestaoPrecoInicial),
      probabilidade_venda_30dias: item.probabilidadeVenda30dias,
      probabilidade_venda_60dias: item.probabilidadeVenda60dias,
      probabilidade_venda_90dias: item.probabilidadeVenda90dias,
      preco_competitivo: item.precoCompetitivo,
    });
    setShowHistorico(false);
    toast.info("Avaliação carregada do histórico");
  };

  const applyWizard = (wizardState, resultado) => {
    const im = wizardState.imovel;
    setModo(MODE_MANUAL);
    setManual({
      ...createEmptyManualState(),
      tipo: im.tipo,
      operacao: /loca/i.test(im.finalidade) ? "Aluguel" : "Venda",
      area: im.area_construida,
      quartos: im.quartos,
      suites: im.suites,
      banheiros: im.banheiros,
      vagas: im.garagens,
      bairro: im.bairro,
      cidade: im.cidade,
      estado: im.estado,
      cep: im.cep,
      endereco: im.endereco,
      latitude: im.latitude,
      longitude: im.longitude,
      estado_conservacao: im.estado_conservacao,
      descricao: im.caracteristicas,
      preco: String(resultado.valorFinal.sugerido || ""),
    });
    setAvaliacao({
      valor_minimo: resultado.valorFinal.minimo,
      valor_ideal: resultado.valorFinal.sugerido,
      valor_maximo: resultado.valorFinal.maximo,
      preco_m2_estimado: resultado.precoM2.mediana,
      preco_m2_regiao: resultado.precoM2.media,
      score_liquidez: resultado.qualidade.nivel === "rigoroso" ? 85 : 60,
      classificacao_liquidez: resultado.qualidade.nivel === "rigoroso" ? "alta" : "media",
      analise_resumo: resultado.qualidade.mensagem,
      pontos_fortes: [`Amostra ${resultado.qualidade.nivel}`, `${resultado.amostraValida} comparáveis`],
      pontos_atencao: resultado.qualidade.alertas || [],
      estrategia_venda: "Utilizar faixa NBR e anunciar nos portais principais.",
      portais_recomendados: ["ZAP Imóveis", "VivaReal", "OLX"],
      sugestao_preco_inicial: resultado.valorFinal.sugerido,
      probabilidade_venda_30dias: 25,
      probabilidade_venda_60dias: 45,
      probabilidade_venda_90dias: 65,
      preco_competitivo: true,
    });
    setResultMeta({
      imovel: { ...im, preco: resultado.valorFinal.sugerido },
      wizard: true,
      inputs: { comparaveisCount: resultado.amostraValida },
    });
    toast.success("Resultado do wizard aplicado");
  };

  const manualAreaFilled = Number(manual.area) > 0;

  return (
    <MainContainer autoHeight>
      <div className="realty-page realty-avaliacao">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Avaliação Imobiliária</h1>
            <p className="realty-page__subtitle">
              Carteira, Manual (SAS), Link e Wizard NBR 14.653 — mesmos campos e opções do módulo
              Lovable, com visual VBSolution.
            </p>
          </div>
          <div className="realty-avaliacao__header-actions">
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={resetAll}>
              Limpar
            </button>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={() => {
                const next = !showHistorico;
                setShowHistorico(next);
                if (next) fetchHistorico();
              }}
            >
              {showHistorico ? "Fechar Histórico" : "Ver Histórico"}
            </button>
          </div>
        </div>

        {showHistorico ? (
          <div className="realty-card">
            <h3>Histórico de avaliações</h3>
            {!historico.length && <p>Nenhuma avaliação salva ainda.</p>}
            <div className="realty-avaliacao__historico-list">
              {historico.map((item) => (
                <div key={item.id} className="realty-avaliacao__historico-item">
                  <div>
                    <strong>{item.titulo || item.tipo}</strong>
                    <p>
                      {item.bairro}, {item.cidade} · {formatBRL(item.valorIdeal)} ·{" "}
                      <span className="realty-chip">{item.modo}</span>
                    </p>
                  </div>
                  <div className="realty-avaliacao__actions">
                    <button
                      type="button"
                      className="realty-page__btn realty-page__btn--ghost"
                      onClick={() => loadHistoricoItem(item)}
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      className="realty-page__btn realty-page__btn--ghost"
                      onClick={async () => {
                        if (!window.confirm("Remover do histórico?")) return;
                        try {
                          await realtyIntelService.deleteAvaliacaoHistorico(item.id);
                          fetchHistorico();
                        } catch (err) {
                          toastError(err);
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="realty-card">
              <div className="realty-avaliacao__modes">
                <button
                  type="button"
                  className={`realty-page__btn ${
                    modo === MODE_CARTEIRA ? "" : "realty-page__btn--ghost"
                  }`}
                  onClick={() => {
                    setModo(MODE_CARTEIRA);
                    setDadosExtraidos(null);
                  }}
                >
                  Selecionar da Carteira
                </button>
                <button
                  type="button"
                  className={`realty-page__btn ${
                    modo === MODE_MANUAL ? "" : "realty-page__btn--ghost"
                  }`}
                  onClick={() => {
                    setModo(MODE_MANUAL);
                    setDadosExtraidos(null);
                  }}
                >
                  Avaliação Manual (SAS)
                </button>
                <button
                  type="button"
                  className={`realty-page__btn ${
                    modo === MODE_LINK ? "" : "realty-page__btn--ghost"
                  }`}
                  onClick={() => {
                    setModo(MODE_LINK);
                  }}
                >
                  Avaliação via Link
                </button>
              </div>

              {modo === MODE_LINK && (
                <div className="realty-form" style={{ marginTop: 16 }}>
                  <label>
                    Cole o link do anúncio do imóvel
                    <input
                      placeholder="https://www.olx.com.br/..., https://www.zapimoveis.com.br/..."
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                    />
                    <span className="realty-page__subtitle">
                      Suporta OLX, ZAP, VivaReal, DFImóveis, WImóveis, Mercado Livre e outros
                    </span>
                  </label>
                  <button
                    type="button"
                    className="realty-page__btn"
                    disabled={extraindo || !linkUrl.trim()}
                    onClick={() => handleExtrairLink()}
                  >
                    {extraindo ? "Extraindo…" : "Extrair Dados"}
                  </button>

                  {dadosExtraidos && (
                    <div className="realty-avaliacao__extracted">
                      <span className="realty-chip">Dados extraídos — revise e avalie</span>
                      {dadosExtraidos.descricao && (
                        <p className="realty-page__subtitle">{dadosExtraidos.descricao}</p>
                      )}
                    </div>
                  )}

                  <label>
                    Adicionar fotos do imóvel
                    <input
                      type="file"
                      accept={PHOTO_ACCEPT}
                      multiple
                      onChange={handlePhotoFiles}
                    />
                  </label>
                  {uploadedPhotos.length > 0 && (
                    <div className="realty-avaliacao__photos">
                      {uploadedPhotos.map((url, i) => (
                        <div key={`${url}-${i}`} className="realty-avaliacao__photo">
                          <img src={url} alt={`Foto ${i + 1}`} />
                          <button
                            type="button"
                            onClick={() =>
                              setUploadedPhotos((p) => p.filter((_, idx) => idx !== i))
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label>
                    <span className="realty-avaliacao__label-row">
                      Descrição do imóvel (para a avaliação)
                      <span className={contadorEmAlerta(manual.descricao) ? "is-alert" : ""}>
                        {formatarContador(manual.descricao)}
                      </span>
                    </span>
                    <textarea
                      id={DESCRICAO_TEXTAREA_ID}
                      rows={4}
                      value={manual.descricao}
                      onChange={(e) => {
                        const next = truncarDescricao(e.target.value);
                        setField("descricao", next);
                        if (descricaoErro) {
                          const v = validarDescricaoAvaliacao(next);
                          setDescricaoErro(v.valid ? null : v.erro);
                        }
                      }}
                      placeholder="Descreva o imóvel: acabamento, reformas, vista, diferenciais…"
                    />
                    {descricaoErro ? (
                      <span className="realty-avaliacao__error">{descricaoErro}</span>
                    ) : (
                      <span className="realty-page__subtitle">
                        Mínimo {DESCRICAO_MIN} caracteres.
                      </span>
                    )}
                  </label>

                  <p className="realty-avaliacao__section-title">Dados do Imóvel (edite se necessário)</p>
                  <div className="realty-avaliacao__grid">
                    <label>
                      Título
                      <input value={manual.titulo} onChange={(e) => setField("titulo", e.target.value)} />
                    </label>
                    <label>
                      Tipo
                      <select value={manual.tipo} onChange={(e) => setField("tipo", e.target.value)}>
                        {TIPOS_LINK.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Operação
                      <select
                        value={manual.operacao}
                        onChange={(e) => setField("operacao", e.target.value)}
                      >
                        {OPERACOES_MANUAL.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Área (m²)
                      <input
                        type="number"
                        value={manual.area}
                        onChange={(e) => setField("area", e.target.value)}
                      />
                    </label>
                    <label>
                      Quartos
                      <input
                        type="number"
                        value={manual.quartos}
                        onChange={(e) => setField("quartos", e.target.value)}
                      />
                    </label>
                    <label>
                      Bairro
                      <input value={manual.bairro} onChange={(e) => setField("bairro", e.target.value)} />
                    </label>
                    <label>
                      Cidade
                      <input value={manual.cidade} onChange={(e) => setField("cidade", e.target.value)} />
                    </label>
                    <label>
                      Preço (R$)
                      <input
                        type="number"
                        value={manual.preco}
                        onChange={(e) => setField("preco", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="realty-avaliacao__actions">
                    <button
                      type="button"
                      className="realty-page__btn"
                      disabled={avaliando || !manualAreaFilled}
                      onClick={handleAvaliar}
                    >
                      {avaliando ? "Avaliando…" : "Avaliar com IA"}
                    </button>
                  </div>
                </div>
              )}

              {modo === MODE_CARTEIRA && (
                <div className="realty-form" style={{ marginTop: 16 }}>
                  <label>
                    Selecione um imóvel da carteira
                    <select
                      value={selectedImovelId}
                      onChange={(e) => setSelectedImovelId(e.target.value)}
                    >
                      <option value="">Escolha um imóvel para avaliar…</option>
                      {imoveisAtivos.map((im) => (
                        <option key={im.id} value={im.id}>
                          {im.title} — {im.neighborhood || im.city || "Sem localização"} —{" "}
                          {formatBRL(im.price)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="realty-page__btn"
                    disabled={!selectedImovelId || avaliando}
                    onClick={handleAvaliar}
                  >
                    {avaliando ? "Avaliando…" : "Avaliar com IA"}
                  </button>
                </div>
              )}

              {modo === MODE_MANUAL && (
                <div style={{ marginTop: 16 }}>
                  <details
                    open={showWizard}
                    onToggle={(e) => setShowWizard(e.target.open)}
                    className="realty-avaliacao__details"
                  >
                    <summary>
                      Wizard Profissional NBR 14.653 — pesquisa, homogeneização e laudo
                      <span className="realty-chip">NOVO</span>
                    </summary>
                    <WizardNbr onApplyResult={applyWizard} />
                  </details>

                  <details
                    open={showSas}
                    onToggle={(e) => setShowSas(e.target.open)}
                    className="realty-avaliacao__details"
                  >
                    <summary>Formulário Completo SAS — preenchimento guiado (modo clássico)</summary>
                    <SasForm
                      onSubmit={(data) => {
                        setManual(mapSasToManual(data));
                        toast.success("Dados aplicados — revise e clique em Avaliar com IA");
                      }}
                    />
                  </details>

                  <div className="realty-form" style={{ marginTop: 16 }}>
                    <div className="realty-avaliacao__grid">
                      <label>
                        Título / Descrição
                        <input
                          placeholder="Ex: Apt 3Q Águas Claras"
                          value={manual.titulo}
                          onChange={(e) => setField("titulo", e.target.value)}
                        />
                      </label>
                      <label>
                        Tipo
                        <select value={manual.tipo} onChange={(e) => setField("tipo", e.target.value)}>
                          {TIPOS_MANUAL.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Operação
                        <select
                          value={manual.operacao}
                          onChange={(e) => setField("operacao", e.target.value)}
                        >
                          {OPERACOES_MANUAL.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Área (m²) *
                        <input
                          type="number"
                          placeholder="80"
                          value={manual.area}
                          onChange={(e) => setField("area", e.target.value)}
                        />
                      </label>
                      <label>
                        Quartos
                        <input
                          type="number"
                          placeholder="3"
                          value={manual.quartos}
                          onChange={(e) => setField("quartos", e.target.value)}
                        />
                      </label>
                      <label>
                        Suítes
                        <input
                          type="number"
                          placeholder="1"
                          value={manual.suites}
                          onChange={(e) => setField("suites", e.target.value)}
                        />
                      </label>
                      <label>
                        Banheiros
                        <input
                          type="number"
                          placeholder="2"
                          value={manual.banheiros}
                          onChange={(e) => setField("banheiros", e.target.value)}
                        />
                      </label>
                      <label>
                        Vagas
                        <input
                          type="number"
                          placeholder="2"
                          value={manual.vagas}
                          onChange={(e) => setField("vagas", e.target.value)}
                        />
                      </label>
                      <label>
                        Bairro
                        <input
                          placeholder="Águas Claras"
                          value={manual.bairro}
                          onChange={(e) => setField("bairro", e.target.value)}
                        />
                      </label>
                      <label>
                        Cidade
                        <input
                          placeholder="Brasília"
                          value={manual.cidade}
                          onChange={(e) => setField("cidade", e.target.value)}
                        />
                      </label>
                      <label>
                        Estado
                        <input
                          placeholder="DF"
                          value={manual.estado}
                          onChange={(e) => setField("estado", e.target.value)}
                        />
                      </label>
                      <label>
                        Preço pretendido (R$)
                        <input
                          type="number"
                          placeholder="500000"
                          value={manual.preco}
                          onChange={(e) => setField("preco", e.target.value)}
                        />
                      </label>
                      <label>
                        Condomínio (R$)
                        <input
                          type="number"
                          placeholder="800"
                          value={manual.valor_condominio}
                          onChange={(e) => setField("valor_condominio", e.target.value)}
                        />
                      </label>
                      <label>
                        IPTU (R$)
                        <input
                          type="number"
                          placeholder="300"
                          value={manual.valor_iptu}
                          onChange={(e) => setField("valor_iptu", e.target.value)}
                        />
                      </label>
                      <label>
                        Andar
                        <input
                          placeholder="8º"
                          value={manual.andar}
                          onChange={(e) => setField("andar", e.target.value)}
                        />
                      </label>
                      <label>
                        Posição Solar
                        <input
                          placeholder="Nascente"
                          value={manual.posicao_solar}
                          onChange={(e) => setField("posicao_solar", e.target.value)}
                        />
                      </label>
                    </div>

                    <p className="realty-avaliacao__section-title">Dados do Corretor / Imobiliária</p>
                    <div className="realty-avaliacao__grid">
                      <label>
                        Nome do Corretor
                        <input
                          placeholder="Ex: João Silva"
                          value={manual.corretor_nome}
                          onChange={(e) => setField("corretor_nome", e.target.value)}
                        />
                      </label>
                      <label>
                        CRECI
                        <input
                          placeholder="Ex: 12345-F"
                          value={manual.corretor_creci}
                          onChange={(e) => setField("corretor_creci", e.target.value)}
                        />
                      </label>
                      <label>
                        Link do Imóvel
                        <input
                          placeholder="https://..."
                          value={manual.link_imovel}
                          onChange={(e) => setField("link_imovel", e.target.value)}
                        />
                      </label>
                      <label>
                        URLs de Fotos (separadas por vírgula)
                        <input
                          placeholder="https://foto1.jpg, https://foto2.jpg"
                          value={manual.fotos_url}
                          onChange={(e) => setField("fotos_url", e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="realty-avaliacao__checks">
                      {[
                        ["exclusivo", "Exclusivo"],
                        ["aceita_permuta", "Aceita Permuta"],
                        ["aceita_financiamento", "Aceita Financiamento"],
                        ["tem_escritura", "Tem Escritura"],
                      ].map(([key, label]) => (
                        <label key={key} className="realty-avaliacao__check">
                          <input
                            type="checkbox"
                            checked={!!manual[key]}
                            onChange={(e) => setField(key, e.target.checked)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    <label>
                      Adicionar fotos do imóvel
                      <input
                        type="file"
                        accept={PHOTO_ACCEPT}
                        multiple
                        onChange={handlePhotoFiles}
                      />
                    </label>
                    {uploadedPhotos.length > 0 && uploadedPhotos.length < 4 && (
                      <p className="realty-avaliacao__warn">
                        Recomendado: pelo menos 4 fotos ({uploadedPhotos.length}/4).
                      </p>
                    )}
                    {uploadedPhotos.length > 0 && (
                      <div className="realty-avaliacao__photos">
                        {uploadedPhotos.map((url, i) => (
                          <div key={`${url}-${i}`} className="realty-avaliacao__photo">
                            <img src={url} alt={`Upload ${i + 1}`} />
                            <button
                              type="button"
                              onClick={() =>
                                setUploadedPhotos((p) => p.filter((_, idx) => idx !== i))
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label>
                      <span className="realty-avaliacao__label-row">
                        Descrição do imóvel (para a avaliação)
                        <span className={contadorEmAlerta(manual.descricao) ? "is-alert" : ""}>
                          {formatarContador(manual.descricao)}
                        </span>
                      </span>
                      <textarea
                        id={DESCRICAO_TEXTAREA_ID}
                        rows={4}
                        value={manual.descricao}
                        onChange={(e) => {
                          const next = truncarDescricao(e.target.value);
                          setField("descricao", next);
                          if (descricaoErro) {
                            const v = validarDescricaoAvaliacao(next);
                            setDescricaoErro(v.valid ? null : v.erro);
                          }
                        }}
                        placeholder="Descreva o imóvel: acabamento, reformas, vista, diferenciais…"
                      />
                      {descricaoErro ? (
                        <span className="realty-avaliacao__error">{descricaoErro}</span>
                      ) : (
                        <span className="realty-page__subtitle">
                          Quanto mais detalhes, mais precisa fica a avaliação (mínimo{" "}
                          {DESCRICAO_MIN}).
                        </span>
                      )}
                    </label>

                    {missingWarning.length > 0 && (
                      <div className="realty-avaliacao__warning-box">
                        <strong>Campos que precisam de atenção</strong>
                        <ul>
                          {CHECKLIST_KEYS.map((k) => (
                            <li key={k}>
                              {isChecklistItemMissing(missingWarning, k) ? "✗" : "✓"} {k}
                            </li>
                          ))}
                        </ul>
                        <p className="realty-page__subtitle">{missingWarning.join(" · ")}</p>
                      </div>
                    )}

                    <div className="realty-avaliacao__actions">
                      <button
                        type="button"
                        className="realty-page__btn"
                        disabled={avaliando || !manualAreaFilled}
                        onClick={handleAvaliar}
                      >
                        {avaliando ? "Avaliando…" : "Avaliar com IA"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {avaliacao && (
              <div className="realty-card" style={{ marginTop: 16 }}>
                <div className="realty-avaliacao__result-header">
                  <h3>Resultado da avaliação</h3>
                  <button
                    type="button"
                    className="realty-page__btn"
                    disabled={saving}
                    onClick={handleSalvarHistorico}
                  >
                    {saving ? "Salvando…" : "Salvar no histórico"}
                  </button>
                </div>
                {resultMeta?.offline && (
                  <p className="realty-avaliacao__warn">Cálculo local (API indisponível).</p>
                )}
                <div className="realty-avaliacao__valores">
                  <div>
                    <span>Mínimo</span>
                    <strong>{formatBRL(avaliacao.valor_minimo)}</strong>
                  </div>
                  <div className="is-ideal">
                    <span>Ideal</span>
                    <strong>{formatBRL(avaliacao.valor_ideal)}</strong>
                  </div>
                  <div>
                    <span>Máximo</span>
                    <strong>{formatBRL(avaliacao.valor_maximo)}</strong>
                  </div>
                </div>
                <p>
                  m² estimado: {formatBRL(avaliacao.preco_m2_estimado)} · m² região:{" "}
                  {formatBRL(avaliacao.preco_m2_regiao)}
                </p>
                <p>
                  Liquidez:{" "}
                  <span className="realty-chip">{avaliacao.classificacao_liquidez}</span> score{" "}
                  {avaliacao.score_liquidez}
                </p>
                <p>{avaliacao.analise_resumo}</p>
                <div className="realty-avaliacao__lists">
                  <div>
                    <h4>Pontos fortes</h4>
                    <ul>
                      {(avaliacao.pontos_fortes || []).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Pontos de atenção</h4>
                    <ul>
                      {(avaliacao.pontos_atencao || []).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {avaliacao.estrategia_venda && (
                  <p>
                    <strong>Estratégia:</strong> {avaliacao.estrategia_venda}
                  </p>
                )}
                {(avaliacao.portais_recomendados || []).length > 0 && (
                  <p>
                    Portais:{" "}
                    {avaliacao.portais_recomendados.map((p) => (
                      <span key={p} className="realty-chip">
                        {p}
                      </span>
                    ))}
                  </p>
                )}
                <p>
                  Prob. venda 30/60/90 dias: {avaliacao.probabilidade_venda_30dias}% /{" "}
                  {avaliacao.probabilidade_venda_60dias}% /{" "}
                  {avaliacao.probabilidade_venda_90dias}%
                </p>
                <p>Sugestão preço inicial: {formatBRL(avaliacao.sugestao_preco_inicial)}</p>
              </div>
            )}
          </>
        )}
      </div>
    </MainContainer>
  );
};

export default Avaliacao;
