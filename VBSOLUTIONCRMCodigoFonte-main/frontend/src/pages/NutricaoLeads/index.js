/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Nutrição e reengajamento — 10 abas alinhadas ao Radarimobtech / Lovable,
 * envio via WhatsApp nativo do VBSolution e API /realty-nutricao/*.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { CATEGORIAS_MODELO, MODELOS_NUTRICAO } from "./nutricaoTemplates";
import { resumoSegmentacao } from "./nutricaoSegmentacao";
import { TIPOS_EVENTO } from "./nutricaoMetricas";
import { FluxoNutricaoDialog } from "./FluxoNutricaoDialog";
import { channelLabel } from "./canalOptions";
import { MetricasFluxosPanel } from "./MetricasFluxosPanel";
import { TesteABPanel } from "./TesteABPanel";
import { TimelineLeadPanel } from "./TimelineLeadPanel";
import { CoorteNutricaoPanel } from "./CoorteNutricaoPanel";
import { ComparativoCanalVariantePanel } from "./ComparativoCanalVariantePanel";
import { AlertasMetasPanel } from "./AlertasMetasPanel";

const TABS = [
  { id: "fluxos", label: "Fluxos" },
  { id: "sugestoes", label: "Sugestões prontas" },
  { id: "inscricoes", label: "Leads em nutrição" },
  { id: "envios", label: "Mensagens" },
  { id: "metricas", label: "Métricas e relatórios" },
  { id: "abtest", label: "Teste A/B" },
  { id: "timeline", label: "Linha do tempo" },
  { id: "coorte", label: "Coortes" },
  { id: "comparativo", label: "Comparativo" },
  { id: "alertas", label: "Metas e alertas" },
];

const CAT_FILTERS = [
  "todas",
  "jornada",
  "segmentado",
  "reativacao",
  "sem_resposta",
  "valor",
  "relacionamento",
];

const statusLabel = {
  ativa: "Em andamento",
  concluida: "Concluída",
  encerrada: "Encerrada",
};

const canalLabel = (c, whatsapps = []) => {
  if (!c) return "—";
  if (String(c).startsWith("conn:")) {
    const id = Number(String(c).slice(5));
    const w = whatsapps.find((x) => Number(x.id) === id);
    if (w) {
      const nome = w.name || w.nome || `#${w.id}`;
      return `${nome} · ${channelLabel(w.channel)}`;
    }
    return `Conexão #${String(c).slice(5)}`;
  }
  if (c === "email") return "E-mail";
  if (c === "heranca") return "Padrão do fluxo";
  return channelLabel(c);
};

function formatData(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function filterEventosPorDias(eventos, dias) {
  const desde = Date.now() - dias * 86400000;
  return (eventos || []).filter((e) => {
    const t = new Date(e.createdAt || e.ocorridoEm || 0).getTime();
    return Number.isFinite(t) && t >= desde;
  });
}

const NutricaoLeads = () => {
  const [tab, setTab] = useState("fluxos");
  const [fluxos, setFluxos] = useState([]);
  const [etapas, setEtapas] = useState([]);
  const [inscricoes, setInscricoes] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [metasConfig, setMetasConfig] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [whatsapps, setWhatsapps] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [enviandoId, setEnviandoId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [aplicando, setAplicando] = useState(null);
  const [diasMetricas, setDiasMetricas] = useState(90);
  const [verificandoMetas, setVerificandoMetas] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [dash, waRes, promptRes] = await Promise.all([
        realtyService.listNutricaoDashboard(),
        api.get("/whatsapp/", { params: { session: 0 } }).catch(() => ({ data: [] })),
        api.get("/prompt", { params: { pageNumber: "1" } }).catch(() => ({ data: {} })),
      ]);
      setFluxos(dash.fluxos || []);
      setEtapas(dash.etapas || []);
      setInscricoes(dash.inscricoes || []);
      setEnvios(dash.envios || []);
      setEventos(dash.eventos || []);
      setMetasConfig(dash.metasConfig || dash.metas || []);
      setAlertas(dash.alertas || []);

      const waList = Array.isArray(waRes.data)
        ? waRes.data
        : waRes.data?.whatsapps || waRes.data?.records || [];
      setWhatsapps(Array.isArray(waList) ? waList : []);

      const pList =
        promptRes.data?.prompts || promptRes.data?.records || promptRes.data || [];
      setPrompts(Array.isArray(pList) ? pList : []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const eventosFiltrados = useMemo(
    () => filterEventosPorDias(eventos, diasMetricas),
    [eventos, diasMetricas]
  );

  const inscricoesAtivas = useMemo(
    () => inscricoes.filter((i) => i.status === "ativa"),
    [inscricoes]
  );
  const enviosPendentes = useMemo(
    () => envios.filter((e) => e.status === "pendente"),
    [envios]
  );

  const fluxoEditando = useMemo(
    () => fluxos.find((f) => f.id === editando) || null,
    [fluxos, editando]
  );
  const etapasDoFluxo = useMemo(
    () => etapas.filter((e) => e.fluxoId === editando),
    [etapas, editando]
  );

  const modelosFiltrados = MODELOS_NUTRICAO.filter(
    (m) => categoria === "todas" || m.categoria === categoria
  );
  const nomesExistentes = new Set(fluxos.map((f) => f.nome));

  const filtradosEnvios = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return envios;
    return envios.filter(
      (e) =>
        String(e.titulo || "")
          .toLowerCase()
          .includes(q) ||
        String(e.destino || "")
          .toLowerCase()
          .includes(q) ||
        String(e.mensagem || "")
          .toLowerCase()
          .includes(q)
    );
  }, [envios, busca]);

  const salvarFluxo = async (fluxoPayload, etapasPayload, id) => {
    try {
      const body = { ...fluxoPayload, etapas: etapasPayload };
      if (id) {
        await realtyService.updateNutricaoFluxo(id, body);
        toast.success("Fluxo atualizado");
      } else {
        await realtyService.createNutricaoFluxo(body);
        toast.success("Fluxo criado");
      }
      await load();
      return true;
    } catch (err) {
      toastError(err);
      return false;
    }
  };

  const handleDialogSave = async (fluxoPayload, etapasPayload) => {
    const ok = await salvarFluxo(fluxoPayload, etapasPayload, editando || undefined);
    if (ok) {
      setDialogOpen(false);
      setEditando(null);
    }
    return ok;
  };

  const toggleFluxo = async (id, ativo) => {
    try {
      await realtyService.toggleNutricaoFluxo(id, ativo);
      setFluxos((prev) => prev.map((f) => (f.id === id ? { ...f, ativo } : f)));
    } catch (err) {
      toastError(err);
    }
  };

  const excluirFluxo = async (id) => {
    if (!window.confirm("Excluir este fluxo e suas etapas?")) return;
    try {
      await realtyService.deleteNutricaoFluxo(id);
      toast.success("Fluxo excluído");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const processarAgora = async () => {
    try {
      setProcessando(true);
      const res = await realtyService.processNutricao({ autoSend: true });
      const parts = [
        res?.inscritos != null ? `${res.inscritos} novos inscritos` : null,
        res?.envios != null ? `${res.envios} mensagens geradas` : null,
        res?.enviados != null ? `${res.enviados} enviadas no WhatsApp` : null,
        res?.encerrados != null ? `${res.encerrados} encerrados` : null,
      ].filter(Boolean);
      toast.success(
        parts.length
          ? `Nutrição processada: ${parts.join(" · ")}`
          : res?.message || "Nutrição processada"
      );
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setProcessando(false);
    }
  };

  const criarModelos = async () => {
    try {
      setProcessando(true);
      const basicos = MODELOS_NUTRICAO.filter((m) => m.fluxo.ativo).slice(0, 5);
      for (const modelo of basicos) {
        if (nomesExistentes.has(modelo.fluxo.nome)) continue;
        await realtyService.createNutricaoFluxo({
          ...modelo.fluxo,
          etapas: modelo.etapas,
        });
      }
      toast.success("Fluxos modelo criados");
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setProcessando(false);
    }
  };

  const aplicarModelo = async (modelo) => {
    setAplicando(modelo.id);
    const ok = await salvarFluxo(modelo.fluxo, modelo.etapas);
    setAplicando(null);
    if (ok) {
      toast.success(`${modelo.fluxo.nome} adicionado na aba Fluxos`);
      setTab("fluxos");
    }
  };

  const enviarWhatsApp = async (envio) => {
    try {
      setEnviandoId(envio.id);
      await realtyService.enviarNutricaoEnvio(envio.id);
      toast.success("Mensagem enviada via WhatsApp do CRM");
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setEnviandoId(null);
    }
  };

  const marcarEnvio = async (id, status) => {
    try {
      await realtyService.updateNutricaoEnvioStatus(id, status);
      toast.success(status === "enviado" ? "Marcada como enviada" : `Status: ${status}`);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const encerrarInscricao = async (id) => {
    try {
      await realtyService.encerrarNutricaoInscricao(id);
      toast.success("Inscrição encerrada");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const fluxoDoEnvio = (inscricaoId) =>
    inscricoes.find((i) => i.id === inscricaoId)?.fluxoId ?? null;

  const marcarEvento = async (envio, tipo) => {
    const fluxoId = fluxoDoEnvio(envio.inscricaoId);
    if (!fluxoId) {
      toast.error("Fluxo não encontrado para esta mensagem");
      return;
    }
    let valor = null;
    if (tipo === "fechamento") {
      const entrada = window.prompt("Valor do negócio fechado (opcional, em R$):", "");
      if (entrada) valor = Number(entrada.replace(/\./g, "").replace(",", ".")) || null;
    }
    try {
      await realtyService.registrarNutricaoEvento({
        fluxoId,
        tipo,
        envioId: envio.id,
        inscricaoId: envio.inscricaoId,
        etapaId: envio.etapaId,
        leadSaleId: envio.leadSaleId,
        canal: envio.canal,
        valor,
      });
      toast.success(`Evento registrado: ${tipo}`);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const aplicarVencedorAB = async (etapaId, vencedor) => {
    try {
      await realtyService.aplicarAbVencedor(etapaId, vencedor);
      toast.success(`Variante ${vencedor} aplicada`);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const reabrirTesteAB = async (etapaId) => {
    try {
      await realtyService.reabrirAb(etapaId);
      toast.success("Teste A/B reaberto");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const salvarMetas = async (form) => {
    try {
      const payload = {
        ...form,
        fluxoId:
          form.fluxoId === null || form.fluxoId === undefined || form.fluxoId === ""
            ? null
            : Number(form.fluxoId),
      };
      await realtyService.saveNutricaoMetas(payload);
      toast.success("Metas salvas");
      const metas = await realtyService.getNutricaoMetas();
      setMetasConfig(metas.configs || []);
      setAlertas(metas.alertas || []);
    } catch (err) {
      toastError(err);
    }
  };

  const verificarMetas = async () => {
    try {
      setVerificandoMetas(true);
      const res = await realtyService.verificarNutricaoMetas();
      const total = res?.alertas ?? 0;
      toast.success(
        total > 0 ? `${total} alerta(s) gerado(s)` : "Tudo dentro das metas"
      );
      const metas = await realtyService.getNutricaoMetas();
      setMetasConfig(metas.configs || []);
      setAlertas(metas.alertas || []);
    } catch (err) {
      toastError(err);
    } finally {
      setVerificandoMetas(false);
    }
  };

  const resolverAlerta = async (id) => {
    try {
      await realtyService.resolverNutricaoAlerta(id);
      setAlertas((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolvido: true } : a))
      );
      toast.success("Alerta resolvido");
    } catch (err) {
      toastError(err);
    }
  };

  const abrirWhatsappExterno = (destino, mensagem) => {
    if (!destino) return;
    const fone = String(destino).replace(/\D/g, "");
    const numero = fone.length <= 11 ? `55${fone}` : fone;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank");
  };

  const abrirEmail = (destino, titulo, mensagem) => {
    if (!destino) return;
    window.open(
      `mailto:${destino}?subject=${encodeURIComponent(titulo || "Novidades")}&body=${encodeURIComponent(mensagem)}`,
      "_blank"
    );
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page nutricao-page">
        <div className="realty-page__header nutricao-page__header">
          <div className="nutricao-page__heading">
            <h1 className="realty-page__title">Nutrição e reengajamento</h1>
            <p className="realty-page__subtitle">
              Sequências automáticas que reativam leads inativos e mantêm o relacionamento
              vivo nos momentos-chave.
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button
              type="button"
              className="realty-page__btn"
              onClick={() => {
                setEditando(null);
                setDialogOpen(true);
              }}
            >
              Novo fluxo
            </button>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              disabled={processando}
              onClick={processarAgora}
            >
              {processando ? "Processando…" : "Processar agora"}
            </button>
            {fluxos.length === 0 && (
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                disabled={processando}
                onClick={criarModelos}
              >
                Criar fluxos modelo
              </button>
            )}
          </div>
        </div>

        <div className="nutricao-kpis nutricao-kpis--3">
          <article className="realty-card nutricao-kpi">
            <span className="nutricao-muted">Fluxos ativos</span>
            <strong>{fluxos.filter((f) => f.ativo).length}</strong>
          </article>
          <article className="realty-card nutricao-kpi">
            <span className="nutricao-muted">Leads em nutrição</span>
            <strong>{inscricoesAtivas.length}</strong>
          </article>
          <article className="realty-card nutricao-kpi">
            <span className="nutricao-muted">Mensagens a enviar</span>
            <strong>{enviosPendentes.length}</strong>
          </article>
        </div>

        <div className="realty-tabs nutricao-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`realty-tab${tab === t.id ? " realty-tab--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="nutricao-page__panel" role="tabpanel">
        {loading && tab !== "sugestoes" ? (
          <div className="realty-empty">Carregando…</div>
        ) : null}

        {!loading && tab === "fluxos" && (
          <div className="nutricao-stack">
            {fluxos.length === 0 && (
              <div className="realty-empty">
                Nenhum fluxo criado. Use &quot;Criar fluxos modelo&quot; ou a aba Sugestões
                prontas.
              </div>
            )}
            {fluxos.map((fluxo) => {
              const etapasFluxo = etapas.filter((e) => e.fluxoId === fluxo.id);
              const emNutricao = inscricoes.filter(
                (i) => i.fluxoId === fluxo.id && i.status === "ativa"
              ).length;
              return (
                <article key={fluxo.id} className="realty-card">
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <h3>{fluxo.nome}</h3>
                      {fluxo.descricao && <p>{fluxo.descricao}</p>}
                      <div className="nutricao-chips" style={{ marginTop: 8 }}>
                        <span className="realty-chip">
                          {fluxo.publicoAlvo === "lead_sem_resposta"
                            ? "Sem resposta"
                            : "Inativos"}{" "}
                          · {fluxo.diasInatividade} dias
                        </span>
                        <span className="realty-chip">{etapasFluxo.length} etapas</span>
                        <span className="realty-chip">{emNutricao} em nutrição</span>
                        <span className="realty-chip">
                          {fluxo.whatsappId
                            ? canalLabel(`conn:${fluxo.whatsappId}`, whatsapps)
                            : canalLabel(fluxo.canal, whatsapps)}
                        </span>
                        {fluxo.encerrarAoResponder && (
                          <span className="realty-chip">Para ao responder</span>
                        )}
                        {resumoSegmentacao(fluxo).map((t) => (
                          <span key={t} className="realty-chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="realty-card__actions">
                      <label className="nutricao-switch">
                        <input
                          type="checkbox"
                          checked={!!fluxo.ativo}
                          onChange={(e) => toggleFluxo(fluxo.id, e.target.checked)}
                        />
                        {fluxo.ativo ? "Ativo" : "Pausado"}
                      </label>
                      <button
                        type="button"
                        className="realty-page__btn realty-page__btn--ghost"
                        onClick={() => {
                          setEditando(fluxo.id);
                          setDialogOpen(true);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="realty-page__btn realty-page__btn--ghost"
                        onClick={() => excluirFluxo(fluxo.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                  <div className="nutricao-stack" style={{ marginTop: 12 }}>
                    {etapasFluxo.map((e) => (
                      <div key={e.id} className="nutricao-etapa-card">
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {e.ordem}. {e.titulo}{" "}
                          <span className="nutricao-muted">+{e.diasApos}d</span>
                          <span className="realty-chip" style={{ marginLeft: 8 }}>
                            {canalLabel(e.canal, whatsapps)}
                          </span>
                          {e.abAtivo && (
                            <span className="realty-chip" style={{ marginLeft: 4 }}>
                              A/B
                            </span>
                          )}
                        </div>
                        <p
                          className="nutricao-muted nutricao-clamp"
                          style={{ marginTop: 4, WebkitLineClamp: 2 }}
                        >
                          {e.mensagem}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {tab === "sugestoes" && (
          <div className="nutricao-stack">
            <div className="nutricao-chips">
              {CAT_FILTERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`realty-page__btn${
                    categoria === c ? "" : " realty-page__btn--ghost"
                  }`}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => setCategoria(c)}
                >
                  {c === "todas" ? "Todas" : CATEGORIAS_MODELO[c]}
                </button>
              ))}
            </div>
            <div className="realty-page__grid">
              {modelosFiltrados.map((modelo) => {
                const jaExiste = nomesExistentes.has(modelo.fluxo.nome);
                return (
                  <article key={modelo.id} className="realty-card">
                    <h3>{modelo.fluxo.nome}</h3>
                    <p>{modelo.resumo}</p>
                    <div className="nutricao-chips" style={{ marginTop: 8 }}>
                      <span className="realty-chip">
                        {CATEGORIAS_MODELO[modelo.categoria]}
                      </span>
                      <span className="realty-chip">
                        {modelo.fluxo.publicoAlvo === "lead_sem_resposta"
                          ? "Sem resposta"
                          : "Inativos"}{" "}
                        · {modelo.fluxo.diasInatividade} dias
                      </span>
                      <span className="realty-chip">{modelo.etapas.length} etapas</span>
                      {resumoSegmentacao(modelo.fluxo).map((t) => (
                        <span key={t} className="realty-chip">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="nutricao-stack" style={{ marginTop: 10 }}>
                      {modelo.etapas.map((e) => (
                        <div key={e.ordem} className="nutricao-etapa-card">
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {e.ordem}. {e.titulo}{" "}
                            <span className="nutricao-muted">+{e.diasApos}d</span>
                          </div>
                          <p
                            className="nutricao-muted"
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {e.mensagem}
                          </p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="realty-page__btn"
                      style={{ marginTop: 12 }}
                      disabled={aplicando === modelo.id || jaExiste}
                      onClick={() => aplicarModelo(modelo)}
                    >
                      {aplicando === modelo.id
                        ? "Adicionando…"
                        : jaExiste
                          ? "Já adicionado"
                          : "Usar esta sugestão"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {!loading && tab === "inscricoes" && (
          <div className="nutricao-stack">
            {inscricoes.length === 0 && (
              <div className="realty-empty">
                Nenhum lead inscrito ainda. Clique em &quot;Processar agora&quot;.
              </div>
            )}
            {inscricoes.map((i) => {
              const fluxo = fluxos.find((f) => f.id === i.fluxoId);
              return (
                <article key={i.id} className="realty-card">
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <h3>{i.nome || "Contato"}</h3>
                      <p className="nutricao-muted">
                        {fluxo?.nome} · etapa {i.etapaAtual} · próxima ação{" "}
                        {formatData(i.proximaExecucao)}
                        {i.motivoEncerramento ? ` · ${i.motivoEncerramento}` : ""}
                      </p>
                    </div>
                    <div className="realty-card__actions">
                      <span className="realty-chip">
                        {statusLabel[i.status] || i.status}
                      </span>
                      {i.status === "ativa" && (
                        <button
                          type="button"
                          className="realty-page__btn realty-page__btn--ghost"
                          onClick={() => encerrarInscricao(i.id)}
                        >
                          Encerrar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && tab === "envios" && (
          <div className="nutricao-stack">
            <div className="realty-page__toolbar">
              <input
                className="realty-page__search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por título, contato ou texto"
              />
            </div>
            {filtradosEnvios.length === 0 && (
              <div className="realty-empty">Nenhuma mensagem gerada.</div>
            )}
            {filtradosEnvios.map((e) => {
              const isWa =
                e.canal === "whatsapp" ||
                e.canal === "whatsapp_oficial" ||
                !e.canal ||
                e.canal === "heranca";
              return (
                <article key={e.id} className="realty-card">
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {e.titulo || "Mensagem"}{" "}
                      <span className="nutricao-muted">{e.destino || "sem contato"}</span>
                    </div>
                    <div className="nutricao-chips">
                      <span className="realty-chip">{canalLabel(e.canal, whatsapps)}</span>
                      {e.variante && (
                        <span className="realty-chip">Variante {e.variante}</span>
                      )}
                      <span className="realty-chip">{e.status}</span>
                    </div>
                  </div>
                  <p style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 13 }}>
                    {e.mensagem}
                  </p>
                  {e.erro && (
                    <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{e.erro}</p>
                  )}
                  <div className="realty-card__actions" style={{ flexWrap: "wrap", marginTop: 10 }}>
                    {isWa ? (
                      <>
                        <button
                          type="button"
                          className="realty-page__btn"
                          disabled={!e.destino || enviandoId === e.id || e.status === "enviado"}
                          onClick={() => enviarWhatsApp(e)}
                        >
                          {enviandoId === e.id ? "Enviando…" : "Enviar WhatsApp"}
                        </button>
                        <button
                          type="button"
                          className="realty-page__btn realty-page__btn--ghost"
                          disabled={!e.destino}
                          onClick={() => abrirWhatsappExterno(e.destino, e.mensagem)}
                        >
                          Abrir no WhatsApp Web externo
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="realty-page__btn realty-page__btn--ghost"
                        disabled={!e.destino}
                        onClick={() => abrirEmail(e.destino, e.titulo, e.mensagem)}
                      >
                        Abrir e-mail
                      </button>
                    )}
                    {e.status !== "enviado" && (
                      <button
                        type="button"
                        className="realty-page__btn realty-page__btn--ghost"
                        onClick={() => marcarEnvio(e.id, "enviado")}
                      >
                        Marcar como enviada
                      </button>
                    )}
                    <span className="nutricao-muted">{formatData(e.createdAt)}</span>
                  </div>
                  <div
                    className="nutricao-chips"
                    style={{ marginTop: 10, borderTop: "1px solid #e2e6ee", paddingTop: 10 }}
                  >
                    <span className="nutricao-muted">Registrar:</span>
                    {TIPOS_EVENTO.map((t) => {
                      const jaTem = eventos.some(
                        (ev) => ev.envioId === e.id && ev.tipo === t.tipo
                      );
                      return (
                        <button
                          key={t.tipo}
                          type="button"
                          className={`realty-page__btn${
                            jaTem ? "" : " realty-page__btn--ghost"
                          }`}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          disabled={jaTem}
                          onClick={() => marcarEvento(e, t.tipo)}
                        >
                          {jaTem ? "✓ " : ""}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && tab === "metricas" && (
          <MetricasFluxosPanel
            fluxos={fluxos}
            inscricoes={inscricoes}
            envios={envios}
            eventos={eventosFiltrados}
            dias={diasMetricas}
            onDiasChange={setDiasMetricas}
            loading={loading}
          />
        )}

        {!loading && tab === "abtest" && (
          <TesteABPanel
            fluxos={fluxos}
            etapas={etapas}
            envios={envios}
            eventos={eventos}
            onAplicarVencedor={aplicarVencedorAB}
            onReabrir={reabrirTesteAB}
          />
        )}

        {!loading && tab === "timeline" && (
          <TimelineLeadPanel
            fluxos={fluxos}
            etapas={etapas}
            inscricoes={inscricoes}
            envios={envios}
            eventos={eventos}
            loading={loading}
          />
        )}

        {!loading && tab === "coorte" && (
          <CoorteNutricaoPanel
            fluxos={fluxos}
            inscricoes={inscricoes}
            eventos={eventos}
            loading={loading}
          />
        )}

        {!loading && tab === "comparativo" && (
          <ComparativoCanalVariantePanel
            fluxos={fluxos}
            etapas={etapas}
            envios={envios}
            eventos={eventos}
            loading={loading}
          />
        )}

        {!loading && tab === "alertas" && (
          <AlertasMetasPanel
            fluxos={fluxos}
            metasConfig={metasConfig}
            alertas={alertas}
            onSalvar={salvarMetas}
            onVerificar={verificarMetas}
            onResolver={resolverAlerta}
            loading={loading}
            verificando={verificandoMetas}
          />
        )}
        </div>

        <FluxoNutricaoDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setEditando(null);
          }}
          fluxo={fluxoEditando}
          etapas={etapasDoFluxo}
          onSave={handleDialogSave}
          whatsapps={whatsapps}
          prompts={prompts}
        />
      </div>
    </MainContainer>
  );
};

export default NutricaoLeads;
