/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import RealtyCrudPage from "../../components/RealtyCrudPage";
import realtyIntelService from "../../services/realtyIntelService";
import realtyService from "../../services/realtyService";
import leadsSalesService from "../../services/leadsSalesService";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { estimateAvaliacao, formatBRL } from "../../helpers/realtyCrm";
import { KIND_FIELDS, kindCardMeta } from "../../helpers/realtyKindFields";

const kindPage = (kind, title, subtitle, options = {}) => {
  const fieldsExtra = options.fields || KIND_FIELDS[kind] || [];
  const skipMoney =
    options.skipMoney ||
    ["consulta_cpf", "lgpd", "consentimento", "wa_consentimentos", "config_ia", "seguranca"].includes(kind);
  const Page = () => (
    <RealtyCrudPage
      title={title}
      subtitle={subtitle}
      listKey="items"
      packPayload
      loader={() => realtyIntelService.listModulos(kind)}
      creator={(payload) => realtyIntelService.createModulo({ ...payload, kind })}
      updater={realtyIntelService.updateModulo}
      remover={realtyIntelService.deleteModulo}
      emptyHint="Nenhum registro ainda. Clique em Novo para cadastrar."
      cardTitle={(item) => item.title}
      cardMeta={(item, display) => kindCardMeta(kind, item, display)}
      headerActions={options.headerActions || null}
      fields={[
        {
          name: "title",
          label:
            kind === "consulta_cpf"
              ? "Referência da consulta"
              : kind === "corretor"
                ? "Nome do corretor"
                : "Título",
          required: true,
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          defaultValue: "aberto",
          options: [
            { value: "aberto", label: "Aberto" },
            { value: "ativo", label: "Ativo" },
            { value: "novo", label: "Novo" },
            { value: "concluido", label: "Concluído" },
            { value: "pausado", label: "Pausado" },
            { value: "cancelado", label: "Cancelado" },
          ],
        },
        ...(skipMoney
          ? []
          : [
              { name: "value", label: "Valor (R$)", type: "number", cast: "number" },
              { name: "dueDate", label: "Data", type: "date" },
            ]),
        ...fieldsExtra,
        { name: "notes", label: "Observações", type: "textarea" },
      ]}
    />
  );
  Page.displayName = title;
  return Page;
};

const radarZapBackLink = (
  <Link className="realty-page__btn realty-page__btn--ghost" to="/radarzap">
    ← RadarZAP
  </Link>
);

export const Condominios = kindPage(
  "condominio",
  "CRM Condomínios",
  "Síndicos, unidades e relacionamento condominial."
);
export const Relacionamento = kindPage(
  "relacionamento",
  "Relacionamento",
  "Histórico de relacionamento com clientes e proprietários."
);
export const Inadimplencia = kindPage(
  "inadimplencia",
  "Inadimplência",
  "Cobranças e contratos em atraso."
);
// Nutrição completa (Radar) — página dedicada com WhatsApp nativo
export { default as Nutricao } from "../NutricaoLeads";
export const ProspeccaoDiaria = () => {
  const history = useHistory();

  const openWhatsApp = async (item) => {
    if (!item?.leadSaleId) {
      toast.info("Vincule um ID de lead para abrir o WhatsApp.");
      return;
    }
    try {
      const data = await leadsSalesService.linkTicket(item.leadSaleId);
      if (data.ticket?.uuid) history.push(`/tickets/${data.ticket.uuid}`);
      else if (data.ticket?.id) history.push(`/tickets/${data.ticket.id}`);
      else toast.info("Nenhum ticket WhatsApp para este telefone ainda.");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <RealtyCrudPage
      title="Prospecção diária"
      subtitle="Meta do dia do corretor — quem ligar/escrever e status de execução."
      listKey="items"
      loader={realtyService.listProspeccao}
      creator={realtyService.createProspeccao}
      updater={realtyService.updateProspeccao}
      remover={realtyService.deleteProspeccao}
      cardTitle={(item) => item.title}
      cardMeta={(item) => (
        <>
          <span className="realty-chip">{item.status || "pendente"}</span>
          <span>
            {item.prospectDate || "sem data"} · {item.doneCount || 0}/{item.targetCount || 1} · {item.phone || ""}
          </span>
        </>
      )}
      cardActions={(item) =>
        item.leadSaleId ? (
          <button
            type="button"
            className="realty-page__btn realty-page__btn--ghost"
            onClick={() => openWhatsApp(item)}
          >
            WhatsApp
          </button>
        ) : null
      }
      fields={[
        { name: "title", label: "Título / meta", required: true },
        { name: "prospectDate", label: "Data", type: "date" },
        { name: "userId", label: "Corretor (ID user)", type: "number", cast: "number" },
        { name: "leadSaleId", label: "ID do Lead", type: "number", cast: "number" },
        { name: "phone", label: "Telefone / WhatsApp" },
        { name: "targetCount", label: "Meta (qtd)", type: "number", cast: "number", defaultValue: 10 },
        { name: "doneCount", label: "Feitos", type: "number", cast: "number", defaultValue: 0 },
        {
          name: "status",
          label: "Status",
          type: "select",
          defaultValue: "pendente",
          options: [
            { value: "pendente", label: "Pendente" },
            { value: "em_andamento", label: "Em andamento" },
            { value: "concluido", label: "Concluído" },
          ],
        },
        { name: "ticketId", label: "Ticket WhatsApp", type: "ticket" },
        { name: "notes", label: "Observações", type: "textarea" },
      ]}
    />
  );
};
export const RelatoriosAgendados = kindPage(
  "relatorio_agendado",
  "Relatórios agendados",
  "Envios periódicos de relatório comercial."
);
export const Monitoramento = kindPage(
  "monitoramento",
  "Monitoramento",
  "Alertas de mercado, portais e concorrência."
);
export const PipelineCaptacao = kindPage(
  "pipeline_captacao",
  "Pipeline de captação",
  "Funil de captação de imóveis (além do inventário)."
);
export const Feed = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsData, followupsData, visitasData, imoveisData, postsData] = await Promise.all([
        leadsSalesService.list({ pageSize: 50 }).catch(() => ({ leads: [] })),
        realtyService.listFollowups({ pageSize: 50 }).catch(() => ({ followups: [] })),
        realtyService.listVisitas({ pageSize: 50 }).catch(() => ({ visitas: [] })),
        realtyService.listImoveis({ pageSize: 30, status: "captacao" }).catch(() => ({ imoveis: [] })),
        realtyIntelService.listModulos("feed").catch(() => ({ items: [] })),
      ]);

      const feed = [];
      (leadsData.leads || []).forEach((l) => {
        feed.push({
          id: `lead-${l.id}`,
          kind: "lead",
          title: l.name || `Lead #${l.id}`,
          subtitle: `${l.status || "novo"}${l.temperature ? ` · ${l.temperature}` : ""}`,
          at: l.updatedAt || l.createdAt,
          href: "/pipeline",
        });
      });
      (followupsData.followups || []).forEach((f) => {
        feed.push({
          id: `fu-${f.id}`,
          kind: "followup",
          title: `Follow-up · ${f.type || "contato"}`,
          subtitle: `Lead #${f.leadSaleId} · ${f.status || "pendente"}`,
          at: f.scheduledAt || f.updatedAt || f.createdAt,
          href: "/followups",
        });
      });
      (visitasData.visitas || []).forEach((v) => {
        feed.push({
          id: `vi-${v.id}`,
          kind: "visita",
          title: `Visita · Lead #${v.leadSaleId}`,
          subtitle: `${v.status || "agendada"}${v.imovelId ? ` · imóvel #${v.imovelId}` : ""}`,
          at: v.scheduledAt || v.updatedAt || v.createdAt,
          href: "/agenda",
        });
      });
      (imoveisData.imoveis || []).forEach((i) => {
        feed.push({
          id: `cap-${i.id}`,
          kind: "captacao",
          title: i.title || `Imóvel #${i.id}`,
          subtitle: `${i.city || "—"} · ${formatBRL(i.price)}`,
          at: i.updatedAt || i.createdAt,
          href: "/captacao",
        });
      });
      (postsData.items || []).forEach((p) => {
        feed.push({
          id: `post-${p.id}`,
          kind: "post",
          title: p.title || "Publicação",
          subtitle: (p.payload && p.payload.canal) || p.status || "feed",
          at: p.dueDate || p.updatedAt || p.createdAt,
          href: "/feed",
        });
      });

      feed.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
      setItems(feed);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((it) => {
      if (filtro !== "todos" && it.kind !== filtro) return false;
      if (!q) return true;
      return (
        String(it.title || "")
          .toLowerCase()
          .includes(q) ||
        String(it.subtitle || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, filtro, busca]);

  const kindLabel = {
    lead: "Lead",
    followup: "Follow-up",
    visita: "Visita",
    captacao: "Captação",
    post: "Post",
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Feed da operação</h1>
            <p className="realty-page__subtitle">
              Atividades recentes: leads, follow-ups, visitas, captações e publicações.
            </p>
          </div>
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
        <div className="realty-page__toolbar realty-pipeline-toolbar">
          <input
            className="realty-page__search"
            placeholder="Buscar no feed…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="realty-tabs">
          {["todos", "lead", "followup", "visita", "captacao", "post"].map((k) => (
            <button
              key={k}
              type="button"
              className={`realty-tab${filtro === k ? " realty-tab--active" : ""}`}
              onClick={() => setFiltro(k)}
            >
              {k === "todos" ? "Todos" : kindLabel[k]}
            </button>
          ))}
        </div>
        {loading && <div className="realty-empty">Carregando feed…</div>}
        {!loading && filtered.length === 0 && (
          <div className="realty-empty">Nenhuma atividade recente neste filtro.</div>
        )}
        {filtered.map((it) => (
          <article key={it.id} className="realty-lead" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <span className="realty-chip">{kindLabel[it.kind] || it.kind}</span>
                <strong style={{ display: "inline", marginLeft: 4 }}>{it.title}</strong>
                <span style={{ display: "block", marginTop: 4 }}>{it.subtitle}</span>
                <span style={{ display: "block", marginTop: 4, fontSize: 11 }}>
                  {it.at ? new Date(it.at).toLocaleString("pt-BR") : "—"}
                </span>
              </div>
              {it.href ? (
                <Link className="realty-page__btn realty-page__btn--ghost" to={it.href}>
                  Abrir
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </MainContainer>
  );
};
export const CuradoriaViral = kindPage(
  "curadoria",
  "Curadoria viral",
  "Peças e criativos para redes."
);
export const AutomacoesFollowup = () => {
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      const data = await realtyService.runAutomacaoFollowup();
      toast.success(`${data.count || 0} follow-ups gerados automaticamente`);
    } catch (err) {
      toastError(err);
    } finally {
      setRunning(false);
    }
  };
  return (
    <RealtyCrudPage
      title="Automações de follow-up"
      subtitle="Regras: sem resposta, lead parado, pós-visita, pós-proposta. Execute agora para processar a fila."
      listKey="items"
      loader={realtyService.listAutomacaoFollowup}
      creator={realtyService.createAutomacaoFollowup}
      updater={realtyService.updateAutomacaoFollowup}
      remover={realtyService.deleteAutomacaoFollowup}
      headerActions={
        <button type="button" className="realty-page__btn" onClick={run} disabled={running}>
          {running ? "Executando…" : "Executar regras agora"}
        </button>
      }
      cardTitle={(item) => item.title}
      cardMeta={(item) => (
        <>
          <span className="realty-chip">{item.active === false ? "off" : "on"}</span>
          <span>
            {item.trigger} · {item.daysWithoutContact || 3}d · {item.action || "criar_followup"}
          </span>
        </>
      )}
      fields={[
        { name: "title", label: "Nome da regra", required: true },
        {
          name: "trigger",
          label: "Gatilho",
          type: "select",
          defaultValue: "sem_resposta",
          options: [
            { value: "sem_resposta", label: "Sem resposta" },
            { value: "parado", label: "Lead parado" },
            { value: "pos_visita", label: "Pós-visita" },
            { value: "pos_proposta", label: "Pós-proposta" },
          ],
        },
        {
          name: "daysWithoutContact",
          label: "Dias sem contato",
          type: "number",
          cast: "number",
          defaultValue: 3,
        },
        { name: "fromStatus", label: "Status origem (opcional)" },
        { name: "toStatus", label: "Mover para status (opcional)" },
        {
          name: "action",
          label: "Ação",
          type: "select",
          defaultValue: "criar_followup",
          options: [
            { value: "criar_followup", label: "Criar follow-up" },
            { value: "enviar_mensagem", label: "Preparar mensagem" },
          ],
        },
        {
          name: "active",
          label: "Ativa",
          type: "select",
          defaultValue: "true",
          cast: "boolean",
          options: [
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ],
        },
        { name: "messageTemplate", label: "Mensagem", type: "textarea" },
        { name: "notes", label: "Observações", type: "textarea" },
      ]}
    />
  );
};
export const RadarZapGrupos = kindPage(
  "radarzap_grupo",
  "RadarZAP — grupos",
  "Cadastro de grupos WhatsApp monitorados.",
  { headerActions: radarZapBackLink }
);

export const Avaliacao = () => {
  const [imoveis, setImoveis] = useState([]);
  const [imovelId, setImovelId] = useState("");
  const [form, setForm] = useState({
    tipo: "apartamento",
    area: "",
    quartos: "",
    bairro: "",
    cidade: "",
    preco: "",
    precoM2Mercado: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    realtyService
      .listImoveis({ pageSize: 100 })
      .then((d) => setImoveis(d.imoveis || []))
      .catch(toastError);
  }, []);

  const fillFromImovel = (id) => {
    setImovelId(id);
    const im = imoveis.find((i) => String(i.id) === String(id));
    if (!im) return;
    setForm((f) => ({
      ...f,
      tipo: im.type || f.tipo,
      area: im.areaM2 != null ? String(im.areaM2) : f.area,
      quartos: im.bedrooms != null ? String(im.bedrooms) : f.quartos,
      bairro: im.neighborhood || f.bairro,
      cidade: im.city || f.cidade,
      preco: im.price != null ? String(im.price) : f.preco,
    }));
  };

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const run = async (e) => {
    e.preventDefault();
    if (!form.preco && !imovelId) {
      toast.error("Informe o preço estimado ou selecione um imóvel");
      return;
    }
    if (!form.area && !imovelId) {
      toast.error("Informe a área (m²)");
      return;
    }
    setLoading(true);
    try {
      const data = await realtyIntelService.avaliar({
        imovelId: imovelId || undefined,
        preco: form.preco ? Number(form.preco) : undefined,
        area: form.area ? Number(form.area) : undefined,
        precoM2Mercado: form.precoM2Mercado ? Number(form.precoM2Mercado) : undefined,
        tipo: form.tipo,
        quartos: form.quartos ? Number(form.quartos) : undefined,
        bairro: form.bairro || undefined,
        cidade: form.cidade || undefined,
      });
      setResult({ ...data, meta: { ...form, imovelId } });
      toast.success("Avaliação calculada");
    } catch (err) {
      const local = estimateAvaliacao(Number(form.preco), Number(form.area), Number(form.precoM2Mercado));
      setResult({ ...local, meta: { ...form, imovelId }, offline: true });
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Avaliação</h1>
            <p className="realty-page__subtitle">
              Estime o valor justo com tipo, área, quartos, bairro, cidade e preço — comparado ao m² de
              mercado.
            </p>
          </div>
        </div>
        <form className="realty-card realty-form" onSubmit={run} style={{ maxWidth: 560 }}>
          <label>
            Imóvel da carteira (opcional)
            <select value={imovelId} onChange={(e) => fillFromImovel(e.target.value)}>
              <option value="">Entrada manual</option>
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title} · {formatBRL(i.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={form.tipo} onChange={(e) => setField("tipo", e.target.value)}>
              {["apartamento", "casa", "cobertura", "terreno", "sala", "loja", "galpao", "outro"].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                )
              )}
            </select>
          </label>
          <label>
            Área (m²) *
            <input
              type="number"
              value={form.area}
              onChange={(e) => setField("area", e.target.value)}
              required={!imovelId}
            />
          </label>
          <label>
            Quartos
            <input
              type="number"
              value={form.quartos}
              onChange={(e) => setField("quartos", e.target.value)}
              min={0}
            />
          </label>
          <label>
            Bairro
            <input value={form.bairro} onChange={(e) => setField("bairro", e.target.value)} />
          </label>
          <label>
            Cidade
            <input value={form.cidade} onChange={(e) => setField("cidade", e.target.value)} />
          </label>
          <label>
            Preço estimado (R$) *
            <input
              type="number"
              value={form.preco}
              onChange={(e) => setField("preco", e.target.value)}
              required={!imovelId}
            />
          </label>
          <label>
            m² de mercado (opcional — se vazio, usa média da base)
            <input
              type="number"
              value={form.precoM2Mercado}
              onChange={(e) => setField("precoM2Mercado", e.target.value)}
            />
          </label>
          <button type="submit" className="realty-page__btn" disabled={loading}>
            {loading ? "Avaliando…" : "Avaliar"}
          </button>
        </form>
        {result && (
          <div className="realty-card" style={{ marginTop: 16, maxWidth: 560 }}>
            <h3>Resultado</h3>
            {result.meta && (
              <p>
                {result.meta.tipo}
                {result.meta.quartos ? ` · ${result.meta.quartos} quartos` : ""}
                {result.meta.bairro || result.meta.cidade
                  ? ` · ${[result.meta.bairro, result.meta.cidade].filter(Boolean).join(", ")}`
                  : ""}
              </p>
            )}
            <p>m² do imóvel: {formatBRL(result.precoM2)}</p>
            <p>Valor justo: {formatBRL(result.valorJusto)}</p>
            <p>Desvio: {result.desvio}%</p>
            <span className="realty-chip">{result.parecer}</span>
            {result.offline ? (
              <p style={{ marginTop: 8 }}>Cálculo local (API indisponível).</p>
            ) : null}
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export const ComparativoImoveis = () => {
  const [imoveis, setImoveis] = useState([]);
  const [leads, setLeads] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [leadId, setLeadId] = useState("");

  useEffect(() => {
    realtyService.listImoveis({ pageSize: 200 }).then((d) => setImoveis(d.imoveis || [])).catch(toastError);
    leadsSalesService.list({ pageSize: 200 }).then((d) => setLeads(d.leads || [])).catch(toastError);
  }, []);

  const ia = imoveis.find((i) => String(i.id) === String(a));
  const ib = imoveis.find((i) => String(i.id) === String(b));
  const ic = imoveis.find((i) => String(i.id) === String(c));
  const col = (im) =>
    im ? (
      <div className="realty-card">
        <h3>{im.title}</h3>
        <p>{im.type} · {im.city} · {im.neighborhood}</p>
        <p>{im.bedrooms} quartos · {im.areaM2} m² · {im.parkingSpots || 0} vagas</p>
        <strong>{formatBRL(im.price)}</strong>
      </div>
    ) : (
      <div className="realty-empty">Selecione um imóvel</div>
    );

  const enviar = async () => {
    const ids = [a, b, c].map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (!leadId || ids.length < 2) {
      toast.error("Selecione um lead e ao menos 2 imóveis");
      return;
    }
    try {
      const data = await realtyService.sendComparativoWhatsApp(Number(leadId), ids);
      toast.success(data.sent ? "Comparativo enviado no WhatsApp" : "Comparativo registrado (abra o ticket)");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Comparativo de imóveis</h1>
            <p className="realty-page__subtitle">
              Selecione 2 ou 3 imóveis e um lead — envie o comparativo pelo WhatsApp do CRM.
            </p>
          </div>
        </div>
        <div className="realty-page__toolbar realty-pipeline-toolbar">
          <select className="realty-page__search" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Lead destinatário</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>#{l.id} · {l.name}</option>
            ))}
          </select>
          <select className="realty-page__search" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">Imóvel A</option>
            {imoveis.map((i) => (
              <option key={i.id} value={i.id}>{i.title}</option>
            ))}
          </select>
          <select className="realty-page__search" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">Imóvel B</option>
            {imoveis.map((i) => (
              <option key={i.id} value={i.id}>{i.title}</option>
            ))}
          </select>
          <select className="realty-page__search" value={c} onChange={(e) => setC(e.target.value)}>
            <option value="">Imóvel C (opcional)</option>
            {imoveis.map((i) => (
              <option key={`c-${i.id}`} value={i.id}>{i.title}</option>
            ))}
          </select>
          <button type="button" className="realty-page__btn" onClick={enviar}>
            Enviar no WhatsApp
          </button>
        </div>
        <div className="realty-page__grid">
          {col(ia)}
          {col(ib)}
          {c ? col(ic) : null}
        </div>
      </div>
    </MainContainer>
  );
};

export const JornadaCliente = () => {
  const [leads, setLeads] = useState([]);
  const [leadId, setLeadId] = useState("");
  const [busca, setBusca] = useState("");
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    leadsSalesService
      .list({ pageSize: 300 })
      .then((d) => setLeads(d.leads || []))
      .catch(toastError);
  }, []);

  const leadsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        String(l.name || "")
          .toLowerCase()
          .includes(q) ||
        String(l.phone || "").includes(q) ||
        String(l.id).includes(q)
    );
  }, [leads, busca]);

  const loadTimeline = async (id) => {
    setLeadId(id);
    if (!id) {
      setTimeline(null);
      return;
    }
    setLoading(true);
    try {
      const data = await realtyService.leadTimeline(id);
      setTimeline(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const events = useMemo(() => {
    if (!timeline) return [];
    const list = [];
    (timeline.followups || []).forEach((f) => {
      list.push({
        id: `f-${f.id}`,
        kind: "followup",
        label: `Follow-up · ${f.type || "contato"} · ${f.status}`,
        detail: f.result || f.notes || "",
        at: f.scheduledAt || f.completedAt || f.createdAt,
      });
    });
    (timeline.visitas || []).forEach((v) => {
      list.push({
        id: `v-${v.id}`,
        kind: "visita",
        label: `Visita · ${v.status}${v.imovelId ? ` · imóvel #${v.imovelId}` : ""}`,
        detail: v.result || v.location || v.notes || "",
        at: v.scheduledAt || v.createdAt,
      });
    });
    (timeline.propostas || []).forEach((p) => {
      list.push({
        id: `p-${p.id}`,
        kind: "proposta",
        label: `${p.title || `Proposta #${p.id}`} · ${p.status}`,
        detail: formatBRL(p.value),
        at: p.validUntil || p.updatedAt || p.createdAt,
      });
    });
    (timeline.envios || []).forEach((e) => {
      list.push({
        id: `e-${e.id}`,
        kind: "envio",
        label: `Imóvel #${e.imovelId} enviado no WhatsApp`,
        detail: "",
        at: e.sentAt || e.createdAt,
      });
    });
    (timeline.nutricao || []).forEach((n) => {
      list.push({
        id: `n-${n.id}`,
        kind: "nutricao",
        label: `Nutrição · ${n.title || "cadência"} · ${n.status || ""}`,
        detail: n.channel
          ? `${n.channel}${n.nextSendAt ? ` · próximo ${new Date(n.nextSendAt).toLocaleString("pt-BR")}` : ""}`
          : n.notes || "",
        at: n.nextSendAt || n.updatedAt || n.createdAt,
      });
    });
    list.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    return list;
  }, [timeline]);

  const kindChip = {
    followup: "Follow-up",
    visita: "Visita",
    proposta: "Proposta",
    envio: "WhatsApp",
    nutricao: "Nutrição",
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Jornada do cliente</h1>
            <p className="realty-page__subtitle">
              Timeline unificada: follow-ups, visitas, propostas, nutrição e imóveis enviados no WhatsApp.
            </p>
          </div>
        </div>
        <div className="realty-page__toolbar realty-pipeline-toolbar">
          <input
            className="realty-page__search"
            placeholder="Buscar lead por nome, telefone ou ID…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select
            className="realty-page__search realty-page__select"
            value={leadId}
            onChange={(e) => loadTimeline(e.target.value)}
          >
            <option value="">Selecione um lead</option>
            {leadsFiltrados.map((l) => (
              <option key={l.id} value={l.id}>
                #{l.id} · {l.name} · {l.status}
              </option>
            ))}
          </select>
          {timeline?.lead?.ticketId ? (
            <Link className="realty-page__btn" to={`/tickets/${timeline.lead.ticketId}`}>
              Abrir WhatsApp
            </Link>
          ) : null}
        </div>
        {!timeline && !loading && (
          <div className="realty-empty">Escolha um lead para ver a jornada completa.</div>
        )}
        {loading && <div className="realty-empty">Carregando jornada…</div>}
        {timeline && !loading && (
          <>
            <article className="realty-card" style={{ marginBottom: 16 }}>
              <h3>{timeline.lead.name}</h3>
              <p>
                <span className="realty-chip">{timeline.lead.status}</span>
                {timeline.lead.phone || "sem telefone"} · temp {timeline.lead.temperature || "—"}
              </p>
              <p style={{ marginTop: 8 }}>
                {events.length} evento(s) na timeline ·{" "}
                <Link to="/followups">Follow-ups</Link> · <Link to="/agenda">Agenda</Link> ·{" "}
                <Link to="/propostas">Propostas</Link>
              </p>
            </article>
            {events.length === 0 && (
              <div className="realty-empty">Ainda não há eventos registrados para este lead.</div>
            )}
            {events.map((ev) => (
              <article key={ev.id} className="realty-lead" style={{ marginBottom: 8 }}>
                <span className="realty-chip">{kindChip[ev.kind] || ev.kind}</span>
                <strong style={{ display: "inline", marginLeft: 4 }}>{ev.label}</strong>
                {ev.detail ? <span style={{ display: "block", marginTop: 4 }}>{ev.detail}</span> : null}
                <span style={{ display: "block", marginTop: 4, fontSize: 11 }}>
                  {ev.at ? new Date(ev.at).toLocaleString("pt-BR") : "—"}
                </span>
              </article>
            ))}
          </>
        )}
      </div>
    </MainContainer>
  );
};

export const Inteligencia = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    realtyIntelService.inteligencia().then(setData).catch(toastError);
  }, []);
  if (!data) return <MainContainer><div className="realty-page">Carregando…</div></MainContainer>;
  return (
    <MainContainer>
      <div className="realty-page">
        <h1 className="realty-page__title">Inteligência</h1>
        <div className="realty-page__grid">
          <article className="realty-card"><h3>Leads</h3><strong>{data.leads}</strong></article>
          <article className="realty-card"><h3>Imóveis</h3><strong>{data.imoveis}</strong></article>
          <article className="realty-card"><h3>Contratos</h3><strong>{data.contratos}</strong></article>
          <article className="realty-card"><h3>Mercado</h3><strong>{data.mercado}</strong></article>
        </div>
        <h2>Funil</h2>
        {Object.entries(data.funil || {}).map(([k, v]) => (
          <p key={k}>{k}: {v}</p>
        ))}
      </div>
    </MainContainer>
  );
};

export const Produtividade = () => {
  const [leads, setLeads] = useState([]);
  useEffect(() => {
    leadsSalesService.list({ pageSize: 300 }).then((d) => setLeads(d.leads || [])).catch(toastError);
  }, []);
  const byUser = {};
  leads.forEach((l) => {
    const k = l.responsibleId || "sem corretor";
    byUser[k] = (byUser[k] || 0) + 1;
  });
  return (
    <MainContainer>
      <div className="realty-page">
        <h1 className="realty-page__title">Produtividade</h1>
        <p className="realty-page__subtitle">Volume de leads por responsável.</p>
        {Object.entries(byUser).map(([k, v]) => (
          <article key={k} className="realty-card" style={{ marginBottom: 8 }}>
            <h3>Corretor {k}</h3>
            <strong>{v} leads</strong>
          </article>
        ))}
      </div>
    </MainContainer>
  );
};

export const FilaDistribuicao = () => {
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [l, u, f] = await Promise.all([
        leadsSalesService.list({ pageSize: 300 }),
        api.get("/users", { params: { searchParam: "" } }),
        realtyService.getFilaConfig(),
      ]);
      const userList = u.data.users || u.data || [];
      setUsers(Array.isArray(userList) ? userList : []);
      setLeads((l.leads || []).filter((x) => !x.responsibleId));
      setCfg(f);
      setActive(f?.active !== false);
      setSelectedIds(Array.isArray(f?.userIds) ? f.userIds.map(Number) : []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleUser = (id) => {
    const n = Number(id);
    setSelectedIds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const saveCfg = async () => {
    try {
      const data = await realtyService.saveFilaConfig({
        strategy: "round_robin",
        userIds: selectedIds,
        active,
      });
      setCfg(data);
      toast.success("Fila configurada");
    } catch (err) {
      toastError(err);
    }
  };

  const assign = async (leadId, responsibleId) => {
    try {
      if (responsibleId) {
        await realtyService.assignFilaLead(leadId, Number(responsibleId));
      } else {
        await realtyService.assignFilaLead(leadId);
      }
      toast.success("Lead distribuído");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const assignAll = async () => {
    if (!leads.length) {
      toast.info("Fila vazia");
      return;
    }
    let ok = 0;
    for (const lead of leads) {
      try {
        await realtyService.assignFilaLead(lead.id);
        ok += 1;
      } catch (_) {
        /* continua */
      }
    }
    toast.success(`${ok} lead(s) distribuído(s)`);
    await load();
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Fila de distribuição</h1>
            <p className="realty-page__subtitle">
              Round-robin entre corretores. Configure a equipe e atribua leads sem responsável.
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
            <button type="button" className="realty-page__btn" onClick={assignAll} disabled={!leads.length}>
              Distribuir todos
            </button>
          </div>
        </div>

        <div className="realty-page__grid" style={{ marginBottom: 16 }}>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Pendentes</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{leads.length}</h2>
          </article>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Corretores na fila</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>
              {selectedIds.length || users.length}
            </h2>
          </article>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Último atribuído</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>#{cfg?.lastUserId || "—"}</h2>
          </article>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Fila ativa</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>{active ? "Sim" : "Não"}</h2>
          </article>
        </div>

        <article className="realty-card" style={{ marginBottom: 16 }}>
          <h3>Configuração da fila</h3>
          <p style={{ marginBottom: 12 }}>
            Selecione os corretores (vazio = todos). Estratégia: round-robin.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {users.map((u) => {
              const checked = selectedIds.includes(Number(u.id));
              return (
                <label
                  key={u.id}
                  className="realty-chip"
                  style={{
                    cursor: "pointer",
                    background: checked ? "#2673d9" : "#e8f0fc",
                    color: checked ? "#fff" : "#1e4bb8",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleUser(u.id)}
                    style={{ marginRight: 6 }}
                  />
                  {u.name} (#{u.id})
                </label>
              );
            })}
            {users.length === 0 && <span>Nenhum usuário carregado.</span>}
          </div>
          <div className="realty-page__toolbar">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Fila ativa
            </label>
            <button type="button" className="realty-page__btn" onClick={saveCfg}>
              Salvar fila
            </button>
          </div>
        </article>

        {leads.length === 0 && !loading && <div className="realty-empty">Fila vazia — nenhum lead sem corretor.</div>}
        {leads.map((lead) => (
          <article key={lead.id} className="realty-lead" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <strong style={{ flex: 1 }}>
                #{lead.id} · {lead.name}
                <span style={{ display: "block", fontWeight: 400, marginTop: 2 }}>
                  {lead.status} · {lead.phone || "sem telefone"} · {lead.temperature || "—"}
                </span>
              </strong>
              <button type="button" className="realty-page__btn" onClick={() => assign(lead.id)}>
                Auto (round-robin)
              </button>
              <select
                className="realty-page__search"
                style={{ flex: "0 0 200px" }}
                defaultValue=""
                onChange={(e) => e.target.value && assign(lead.id, e.target.value)}
              >
                <option value="">Atribuir manual…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))}
      </div>
    </MainContainer>
  );
};

export const AgendaImobiliaria = () => {
  const [tab, setTab] = useState("todos");
  const [followups, setFollowups] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [formOpen, setFormOpen] = useState(null); // "visita" | "followup"
  const [visitaForm, setVisitaForm] = useState({
    leadSaleId: "",
    imovelId: "",
    scheduledAt: "",
    status: "agendada",
    location: "",
    result: "",
    notes: "",
  });
  const [followForm, setFollowForm] = useState({
    leadSaleId: "",
    type: "whatsapp",
    scheduledAt: "",
    status: "pendente",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, v] = await Promise.all([
        realtyService.listFollowups({ pageSize: 200 }),
        realtyService.listVisitas({ pageSize: 200 }),
      ]);
      setFollowups(f.followups || []);
      setVisitas(v.visitas || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => {
    const list = [];
    if (tab === "todos" || tab === "followups") {
      followups.forEach((f) => {
        list.push({
          id: `f-${f.id}`,
          source: "followup",
          raw: f,
          title: `Follow-up · ${f.type || "contato"} · Lead #${f.leadSaleId}`,
          status: f.status || "pendente",
          at: f.scheduledAt,
        });
      });
    }
    if (tab === "todos" || tab === "visitas") {
      visitas.forEach((v) => {
        list.push({
          id: `v-${v.id}`,
          source: "visita",
          raw: v,
          title: `Visita · Lead #${v.leadSaleId}${v.imovelId ? ` · Imóvel #${v.imovelId}` : ""}`,
          status: v.status || "agendada",
          at: v.scheduledAt,
        });
      });
    }
    list.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
    return list.filter((it) => {
      if (filtroStatus && it.status !== filtroStatus) return false;
      if (!busca.trim()) return true;
      const q = busca.trim().toLowerCase();
      return it.title.toLowerCase().includes(q) || String(it.status).includes(q);
    });
  }, [tab, followups, visitas, filtroStatus, busca]);

  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return items.filter((it) => {
      if (!it.at) return false;
      const t = new Date(it.at);
      return t >= d && t <= end;
    });
  }, [items]);

  const saveVisita = async (e) => {
    e.preventDefault();
    try {
      await realtyService.createVisita({
        ...visitaForm,
        leadSaleId: Number(visitaForm.leadSaleId),
        imovelId: visitaForm.imovelId ? Number(visitaForm.imovelId) : null,
        scheduledAt: new Date(visitaForm.scheduledAt).toISOString(),
      });
      toast.success("Visita agendada");
      setFormOpen(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const saveFollowup = async (e) => {
    e.preventDefault();
    try {
      await realtyService.createFollowup({
        ...followForm,
        leadSaleId: Number(followForm.leadSaleId),
        scheduledAt: new Date(followForm.scheduledAt).toISOString(),
      });
      toast.success("Follow-up agendado");
      setFormOpen(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const removeItem = async (it) => {
    if (!window.confirm("Remover este compromisso?")) return;
    try {
      if (it.source === "visita") await realtyService.deleteVisita(it.raw.id);
      else await realtyService.deleteFollowup(it.raw.id);
      toast.success("Removido");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Agenda imobiliária</h1>
            <p className="realty-page__subtitle">
              Follow-ups e visitas em uma só lista — filtre por tipo e status.
            </p>
          </div>
          <div className="realty-page__header-actions">
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => setFormOpen("followup")}>
              Novo follow-up
            </button>
            <button type="button" className="realty-page__btn" onClick={() => setFormOpen("visita")}>
              Nova visita
            </button>
          </div>
        </div>

        <div className="realty-page__grid" style={{ marginBottom: 16 }}>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Hoje</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{hoje.length}</h2>
          </article>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Follow-ups</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{followups.length}</h2>
          </article>
          <article className="realty-card">
            <p style={{ margin: 0, fontSize: 12 }}>Visitas</p>
            <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{visitas.length}</h2>
          </article>
        </div>

        <div className="realty-tabs">
          {[
            { id: "todos", label: "Todos" },
            { id: "visitas", label: "Visitas" },
            { id: "followups", label: "Follow-ups" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`realty-tab${tab === t.id ? " realty-tab--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="realty-filters-panel">
          <label className="realty-filter-field">
            Busca
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Lead, tipo…" />
          </label>
          <label className="realty-filter-field">
            Status
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="pendente">pendente</option>
              <option value="concluido">concluido</option>
              <option value="cancelado">cancelado</option>
              <option value="agendada">agendada</option>
              <option value="confirmada">confirmada</option>
              <option value="realizada">realizada</option>
              <option value="reagendada">reagendada</option>
            </select>
          </label>
        </div>

        {loading && <div className="realty-empty">Carregando agenda…</div>}
        {!loading && items.length === 0 && <div className="realty-empty">Nenhum compromisso neste filtro.</div>}

        {items.map((it) => (
          <article key={it.id} className="realty-lead" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span className="realty-chip">{it.source === "visita" ? "Visita" : "Follow-up"}</span>
                <span className="realty-chip">{it.status}</span>
                <strong style={{ display: "block", marginTop: 4 }}>{it.title}</strong>
                <span>
                  {it.at ? new Date(it.at).toLocaleString("pt-BR") : "sem data"}
                  {it.raw.location ? ` · ${it.raw.location}` : ""}
                  {it.raw.result ? ` · ${it.raw.result}` : ""}
                </span>
              </div>
              <div className="realty-card__actions" style={{ marginTop: 0 }}>
                <Link
                  className="realty-page__btn realty-page__btn--ghost"
                  to={it.source === "visita" ? "/agenda" : "/followups"}
                >
                  Detalhe
                </Link>
                <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => removeItem(it)}>
                  Remover
                </button>
              </div>
            </div>
          </article>
        ))}

        {formOpen === "visita" && (
          <div className="realty-modal-backdrop" onClick={() => setFormOpen(null)}>
            <form className="realty-card realty-modal realty-form" onClick={(e) => e.stopPropagation()} onSubmit={saveVisita}>
              <h3>Nova visita</h3>
              <label>
                ID do Lead *
                <input
                  type="number"
                  required
                  value={visitaForm.leadSaleId}
                  onChange={(e) => setVisitaForm({ ...visitaForm, leadSaleId: e.target.value })}
                />
              </label>
              <label>
                ID do Imóvel
                <input
                  type="number"
                  value={visitaForm.imovelId}
                  onChange={(e) => setVisitaForm({ ...visitaForm, imovelId: e.target.value })}
                />
              </label>
              <label>
                Data/hora *
                <input
                  type="datetime-local"
                  required
                  value={visitaForm.scheduledAt}
                  onChange={(e) => setVisitaForm({ ...visitaForm, scheduledAt: e.target.value })}
                />
              </label>
              <label>
                Status
                <select
                  value={visitaForm.status}
                  onChange={(e) => setVisitaForm({ ...visitaForm, status: e.target.value })}
                >
                  {["agendada", "confirmada", "realizada", "cancelada", "reagendada"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Local
                <input
                  value={visitaForm.location}
                  onChange={(e) => setVisitaForm({ ...visitaForm, location: e.target.value })}
                />
              </label>
              <label>
                Observações
                <textarea
                  rows={2}
                  value={visitaForm.notes}
                  onChange={(e) => setVisitaForm({ ...visitaForm, notes: e.target.value })}
                />
              </label>
              <div className="realty-card__actions">
                <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => setFormOpen(null)}>
                  Cancelar
                </button>
                <button type="submit" className="realty-page__btn">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        )}

        {formOpen === "followup" && (
          <div className="realty-modal-backdrop" onClick={() => setFormOpen(null)}>
            <form className="realty-card realty-modal realty-form" onClick={(e) => e.stopPropagation()} onSubmit={saveFollowup}>
              <h3>Novo follow-up</h3>
              <label>
                ID do Lead *
                <input
                  type="number"
                  required
                  value={followForm.leadSaleId}
                  onChange={(e) => setFollowForm({ ...followForm, leadSaleId: e.target.value })}
                />
              </label>
              <label>
                Tipo
                <select
                  value={followForm.type}
                  onChange={(e) => setFollowForm({ ...followForm, type: e.target.value })}
                >
                  {["whatsapp", "ligacao", "email", "visita", "reuniao", "outro"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data/hora *
                <input
                  type="datetime-local"
                  required
                  value={followForm.scheduledAt}
                  onChange={(e) => setFollowForm({ ...followForm, scheduledAt: e.target.value })}
                />
              </label>
              <label>
                Observações
                <textarea
                  rows={2}
                  value={followForm.notes}
                  onChange={(e) => setFollowForm({ ...followForm, notes: e.target.value })}
                />
              </label>
              <div className="realty-card__actions">
                <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={() => setFormOpen(null)}>
                  Cancelar
                </button>
                <button type="submit" className="realty-page__btn">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export const Corretores = kindPage(
  "corretor",
  "Corretores",
  "Equipe comercial com CRECI, capacidade e especialidades (legado Radar/Coutinho). Usuários do sistema: /users."
);

export const Automacoes = kindPage(
  "automacao",
  "Automações",
  "Regras gerais de automação da operação imobiliária."
);
export const Seguranca = kindPage(
  "seguranca",
  "Segurança",
  "Políticas, acessos e incidentes de segurança."
);
export const AuditoriaExtracao = kindPage(
  "auditoria_extracao",
  "Auditoria de extração",
  "Logs da extração de anúncios e RadarZAP."
);
export const MetricasExtracao = kindPage(
  "metricas_extracao",
  "Métricas de extração",
  "Volume e qualidade das extrações."
);
export const AuditoriaRequests = kindPage(
  "auditoria_requests",
  "Auditoria de requests",
  "Requisições de API e webhooks."
);
export const AuditoriaMonitoramento = kindPage(
  "auditoria_monitoramento",
  "Auditoria de monitoramento",
  "Histórico de alertas de mercado."
);
export const AuditoriaLeads = kindPage(
  "auditoria_leads",
  "Auditoria de leads",
  "Trilha de alterações nos leads."
);
export const ConfigurarIA = kindPage(
  "config_ia",
  "Configuração da IA",
  "Parâmetros da IA imobiliária. Chaves globais ficam em Configurações / Brain.AI."
);
export const DiagnosticoAvaliacao = kindPage(
  "diagnostico_avaliacao",
  "Diagnóstico de avaliação",
  "Casos e conferência do motor de avaliação."
);
export const LeadsLanding = kindPage(
  "leads_landing",
  "CRM Landing",
  "Leads capturados em landing pages."
);
export const WebhookMetrics = kindPage(
  "webhook_metrics",
  "Métricas de webhook",
  "Sucesso/falha de webhooks de captação."
);
export const WebhookAlerts = kindPage(
  "webhook_alerts",
  "Alertas de webhook",
  "Alertas operacionais de integração."
);
export const WhatsappTemplatesCaptacao = kindPage(
  "wa_templates_captacao",
  "Templates WhatsApp captação",
  "Modelos de mensagem para captação (além das respostas rápidas)."
);
export const WhatsappConsentimentos = kindPage(
  "wa_consentimentos",
  "Consentimentos WhatsApp",
  "Opt-in / opt-out de disparos."
);
export const LgpdSolicitacoes = kindPage(
  "lgpd",
  "Solicitações LGPD",
  "Pedidos de titulares (acesso, exclusão, portabilidade)."
);
export const BuscaAvancadaCaptacao = kindPage(
  "busca_captacao",
  "Busca avançada de captação",
  "Filtros avançados da carteira de captação."
);
export const SeoAuditoria = kindPage(
  "seo_auditoria",
  "Auditoria SEO",
  "Checklist SEO dos imóveis e conteúdos."
);
export const CaptacaoAllowlist = kindPage(
  "captacao_allowlist",
  "Allowlist de captação",
  "Fontes e portais autorizados para scrape."
);
export const ConsultaCPF = kindPage(
  "consulta_cpf",
  "Consulta CPF",
  "Consultas cadastrais vinculadas a proprietários/leads."
);
export const RadarZapScoring = kindPage(
  "radarzap_scoring",
  "RadarZAP — scoring",
  "Regras de pontuação das mensagens de grupos. Configure palavras-chave e categorias.",
  { headerActions: radarZapBackLink, skipMoney: true }
);
export const RadarZapOnboarding = kindPage(
  "radarzap_onboarding",
  "RadarZAP — onboarding",
  "Checklist: conectar WhatsApp → grupos → scoring → converter leads ao funil.",
  { headerActions: radarZapBackLink, skipMoney: true }
);
export const RadarZapStatusPage = kindPage(
  "radarzap_status",
  "RadarZAP — status",
  "Saúde da coleta, fila de mensagens e última sincronização.",
  { headerActions: radarZapBackLink, skipMoney: true }
);
export const RadarZapAcessos = kindPage(
  "radarzap_acessos",
  "RadarZAP — logs de acesso",
  "Quem acessou extrações e leads do RadarZAP.",
  { headerActions: radarZapBackLink, skipMoney: true }
);
export const DiagnosticoCaptacao = kindPage(
  "diagnostico_captacao",
  "Diagnóstico de captação",
  "Diagnóstico da origem e qualidade da captação."
);
export const CaptacaoAvaliacaoLp = kindPage(
  "lp_captacao_avaliacao",
  "LP Captação / Avaliação",
  "Landing de captação com avaliação (conteúdo e leads)."
);
export const VendaCrmLp = kindPage(
  "lp_venda_crm",
  "LP Venda CRM",
  "Landing comercial do CRM imobiliário."
);
export const PortalImoveisPublico = kindPage(
  "portal_imoveis",
  "Portal de imóveis",
  "Vitrine pública (anúncios publicados a partir do inventário)."
);
export const BlogImobiliario = kindPage(
  "blog",
  "Blog",
  "Posts do blog imobiliário (além do Conteúdo SEO)."
);
export const AnunciarImovel = kindPage(
  "anunciar_imovel",
  "Anunciar imóvel",
  "Hub de anúncio em portais e redes."
);
export const LgpdPortalTitular = kindPage(
  "lgpd_portal",
  "Portal do titular (LGPD)",
  "Atendimento a solicitações do titular."
);
export const Consentimentos = kindPage(
  "consentimento",
  "Consentimentos",
  "Tokens e confirmações de consentimento."
);
export const PagamentosPublicos = kindPage(
  "pagamento_publico",
  "Pagamento público",
  "Links de pagamento enviados a clientes."
);
export const RadarOportunidades = kindPage(
  "radar_oportunidades",
  "Radar de oportunidades",
  "Oportunidades de mercado (Q-Capture + Inteligência)."
);
export const ConfiguracoesImobiliaria = kindPage(
  "config_imobiliaria",
  "Configurações da imobiliária",
  "Marca, cidade padrão e módulos. Configurações gerais do sistema: /settings."
);
export const WhatsappImobiliario = () => (
  <MainContainer>
    <div className="realty-page">
      <h1 className="realty-page__title">WhatsApp imobiliário</h1>
      <p className="realty-page__subtitle">
        Hub do atendimento integrado ao funil: tickets, nutrição, pipeline, campanhas e captação RadarZAP.
      </p>
      <div className="realty-page__grid">
        <article className="realty-card">
          <h3>Tickets</h3>
          <p>Inbox canônico do WhatsApp. No drawer do contato, use o painel CRM (match + follow-up).</p>
          <Link className="realty-page__btn" to="/tickets">
            Abrir tickets
          </Link>
        </article>
        <article className="realty-card">
          <h3>Nutrição</h3>
          <p>Cadências e conteúdo para aquecer leads pelo WhatsApp.</p>
          <Link className="realty-page__btn" to="/nutricao">
            Abrir nutrição
          </Link>
        </article>
        <article className="realty-card">
          <h3>Pipeline + match</h3>
          <p>Envie imóveis compatíveis pelo botão “Enviar opções no WhatsApp”.</p>
          <Link className="realty-page__btn" to="/pipeline">
            Abrir pipeline
          </Link>
        </article>
        <article className="realty-card">
          <h3>Campanhas</h3>
          <p>Disparos e templates de campanha alinhados ao funil imobiliário.</p>
          <Link className="realty-page__btn" to="/campaigns">
            Abrir campanhas
          </Link>
        </article>
        <article className="realty-card">
          <h3>RadarZAP</h3>
          <p>Captação de grupos WhatsApp → lead.</p>
          <Link className="realty-page__btn" to="/radarzap">
            Abrir RadarZAP
          </Link>
        </article>
        <article className="realty-card">
          <h3>Follow-up</h3>
          <p>Fila de retornos (ligação, WA, visita) vinculada ao lead e ao ticket.</p>
          <Link className="realty-page__btn" to="/followups">
            Abrir follow-ups
          </Link>
        </article>
        <article className="realty-card">
          <h3>Conexões</h3>
          <p>Sessões WhatsApp da empresa.</p>
          <Link className="realty-page__btn" to="/connections">
            Abrir conexões
          </Link>
        </article>
      </div>
    </div>
  </MainContainer>
);

export const RealtyDashboard = () => {
  const emptyKpis = {
    totalLeads: 0,
    leadsMes: 0,
    leadsWon: 0,
    leadsQuentes: 0,
    leadsParados: 0,
    leadsSemCorretor: 0,
    conversao: 0,
    imoveis: 0,
    imoveisCaptacao: 0,
    imoveisDisponiveis: 0,
    contratos: 0,
    followupsPendentes: 0,
    followupsAtrasados: 0,
    visitasHoje: 0,
    propostasAbertas: 0,
    ticketsAbertos: 0,
    corretores: 0,
  };
  const [data, setData] = useState({ kpis: emptyKpis, funil: {}, recentLeads: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await realtyIntelService.dashboard();
      setData({
        kpis: { ...emptyKpis, ...(d.kpis || {}) },
        funil: d.funil || {},
        recentLeads: d.recentLeads || [],
      });
    } catch (_) {
      try {
        const intel = await realtyIntelService.inteligencia();
        setData({
          kpis: {
            ...emptyKpis,
            totalLeads: intel.leads || 0,
            imoveis: intel.imoveis || 0,
            contratos: intel.contratos || 0,
          },
          funil: intel.funil || {},
          recentLeads: [],
        });
      } catch (__) {
        setData({ kpis: emptyKpis, funil: {}, recentLeads: [] });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await realtyIntelService.seedDemo();
      } catch (_) {
        /* seed opcional — sem alerta */
      }
      await load();
    })();
  }, []);

  const seed = async () => {
    try {
      const r = await realtyIntelService.seedDemo();
      toast.success(r.message || `${r.created} registros criados`);
      await load();
    } catch (_) {
      toast.success("Sincronizado com o banco (sem novos registros)");
      await load();
    }
  };

  const k = data?.kpis || emptyKpis;
  const cards = [
    { label: "Leads totais", value: k.totalLeads ?? 0, to: "/leads-sales" },
    { label: "Leads no mês", value: k.leadsMes ?? 0, to: "/leads-sales" },
    { label: "Leads quentes", value: k.leadsQuentes ?? 0, to: "/pipeline" },
    { label: "Parados 3+ dias", value: k.leadsParados ?? 0, to: "/followups" },
    { label: "Conversão %", value: k.conversao ?? 0, to: "/pipeline" },
    { label: "Follow-ups pendentes", value: k.followupsPendentes ?? 0, to: "/followups" },
    { label: "Follow-ups atrasados", value: k.followupsAtrasados ?? 0, to: "/followups" },
    { label: "Visitas hoje", value: k.visitasHoje ?? 0, to: "/agenda" },
    { label: "Propostas abertas", value: k.propostasAbertas ?? 0, to: "/propostas" },
    { label: "Imóveis / disponíveis", value: `${k.imoveisDisponiveis ?? 0}/${k.imoveis ?? 0}`, to: "/imoveis" },
    { label: "Em captação", value: k.imoveisCaptacao ?? 0, to: "/captacao" },
    { label: "Tickets WA abertos", value: k.ticketsAbertos ?? 0, to: "/tickets" },
    { label: "Sem corretor", value: k.leadsSemCorretor ?? 0, to: "/fila-distribuicao" },
    { label: "Contratos", value: k.contratos ?? 0, to: "/contratos" },
    { label: "Corretores (users)", value: k.corretores ?? 0, to: "/corretores" },
  ];

  const funilEntries = Object.entries(data?.funil || {});

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Dashboard imobiliário</h1>
            <p className="realty-page__subtitle">
              Indicadores estratégicos (Radar + Coutinho) · Início WhatsApp em <Link to="/">Início</Link>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={load}>
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
            <button type="button" className="realty-page__btn" onClick={seed}>
              Carregar dados estratégicos
            </button>
          </div>
        </div>
        <div className="realty-page__grid">
          {cards.map((c) => (
            <Link key={c.label} to={c.to} className="realty-card" style={{ textDecoration: "none", color: "inherit" }}>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{c.label}</p>
              <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>{c.value}</h2>
            </Link>
          ))}
        </div>
        {funilEntries.length > 0 && (
          <div className="realty-card" style={{ marginTop: 16 }}>
            <h3>Funil por status</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {funilEntries.map(([status, count]) => (
                <span key={status} className="realty-chip">
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
        {(data?.recentLeads || []).length > 0 && (
          <div className="realty-card" style={{ marginTop: 16 }}>
            <h3>Leads recentes</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {data.recentLeads.map((l) => (
                <li key={l.id}>
                  #{l.id} {l.name} · {l.status}
                  {l.temperature ? ` · ${l.temperature}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </MainContainer>
  );
};
