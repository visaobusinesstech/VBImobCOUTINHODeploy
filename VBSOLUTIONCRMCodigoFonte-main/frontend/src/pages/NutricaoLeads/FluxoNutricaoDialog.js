/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Modal de fluxo de nutrição — inputs alinhados ao Lovable + canais
 * conectados da página Integrações (nome da conexão).
 */

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import realtyService from "../../services/realtyService";
import { PIPELINE_ESTAGIOS } from "../../constants/pipelineCrm";
import { PERFIS_CLIENTE, MOTIVOS_PERDA_PADRAO } from "./nutricaoSegmentacao";
import { CONTEXTO_EXEMPLO } from "./nutricaoVariaveis";
import { validarMensagemNutricao } from "./nutricaoValidacaoMensagem";
import { GeradorMensagem } from "./GeradorMensagem";
import DestinatariosPicker from "../../components/DestinatariosPicker";
import {
  buildCanalOptions,
  canalValueFromRecord,
  channelLabel,
  groupCanalOptions,
  isConnected,
  parseCanalValue,
} from "./canalOptions";

const etapaVazia = (ordem) => ({
  ordem,
  diasApos: ordem === 1 ? 0 : 5,
  canalKey: "heranca",
  titulo: "",
  mensagem: "",
  ativo: true,
  abAtivo: false,
  abTituloB: "",
  abMensagemB: "",
  abSplit: 50,
  abAutoEscolher: true,
  abMinEnvios: 20,
});

function ChipToggle({ ativo, onClick, children, title }) {
  return (
    <button
      type="button"
      className={`realty-chip nutricao-chip-toggle${ativo ? " nutricao-chip-toggle--on" : ""}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

function AvisosValidacao({ resultado, rotulo }) {
  if (!resultado || (!resultado.erros.length && !resultado.avisos.length)) return null;
  return (
    <div className="nutricao-validacao">
      {resultado.erros.map((p, i) => (
        <p key={`e${i}`} className="nutricao-validacao__erro">
          ⚠ {rotulo ? `${rotulo}: ` : ""}
          {p.mensagem}
        </p>
      ))}
      {resultado.avisos.map((p, i) => (
        <p key={`a${i}`} className="nutricao-validacao__aviso">
          ℹ {rotulo ? `${rotulo}: ` : ""}
          {p.mensagem}
        </p>
      ))}
    </div>
  );
}

export function FluxoNutricaoDialog({
  open,
  onClose,
  fluxo,
  etapas = [],
  onSave,
  whatsapps: whatsappsProp = [],
  prompts: promptsProp = [],
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("lead_inativo");
  const [diasInatividade, setDiasInatividade] = useState(30);
  const [canalKey, setCanalKey] = useState("");
  const [encerrarAoResponder, setEncerrarAoResponder] = useState(true);
  const [ativo, setAtivo] = useState(true);
  const [promptId, setPromptId] = useState("");
  const [lista, setLista] = useState([etapaVazia(1)]);
  const [segEstagios, setSegEstagios] = useState([]);
  const [segPerfis, setSegPerfis] = useState([]);
  const [segMotivos, setSegMotivos] = useState([]);
  const [motivosLead, setMotivosLead] = useState([]);
  const [leadsCatalog, setLeadsCatalog] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [iaLoading, setIaLoading] = useState(null);
  const [whatsapps, setWhatsapps] = useState(whatsappsProp);
  const [prompts, setPrompts] = useState(promptsProp);
  const [loadingCanais, setLoadingCanais] = useState(false);

  // Carrega conexões da Integração ao abrir o modal
  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoadingCanais(true);
      try {
        const [waRes, promptRes, leadsRes] = await Promise.all([
          api.get("/whatsapp/", { params: { session: 0, _t: Date.now() } }).catch(() => ({ data: [] })),
          api.get("/prompt", { params: { pageNumber: "1" } }).catch(() => ({ data: {} })),
          api.get("/leads-sales", { params: { pageSize: 200, pageNumber: 1 } }).catch(() => ({ data: {} })),
        ]);

        if (cancel) return;

        const waList = Array.isArray(waRes.data)
          ? waRes.data
          : waRes.data?.whatsapps || waRes.data?.records || whatsappsProp || [];
        setWhatsapps(Array.isArray(waList) ? waList : []);

        const pList =
          promptRes.data?.prompts || promptRes.data?.records || promptRes.data || promptsProp || [];
        setPrompts(Array.isArray(pList) ? pList : []);

        const leads = leadsRes.data?.leads || leadsRes.data?.records || [];
        const leadsArr = Array.isArray(leads) ? leads : [];
        setLeadsCatalog(leadsArr);
        const vistos = new Set();
        leadsArr.forEach((l) => {
          const m = String(l.lossReason || l.motivoPerda || l.motivo_perda || "").trim();
          if (m) vistos.add(m);
        });
        setMotivosLead([...vistos]);
      } catch (err) {
        if (!cancel) toastError(err);
      } finally {
        if (!cancel) setLoadingCanais(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const canalOptionsFluxo = useMemo(
    () => buildCanalOptions(whatsapps, { includeHeranca: false, includeEmail: true }),
    [whatsapps]
  );

  const canalOptionsEtapa = useMemo(
    () => buildCanalOptions(whatsapps, { includeHeranca: true, includeEmail: true }),
    [whatsapps]
  );

  const canalGroupsFluxo = useMemo(
    () => groupCanalOptions(canalOptionsFluxo),
    [canalOptionsFluxo]
  );

  const canalGroupsEtapa = useMemo(
    () => groupCanalOptions(canalOptionsEtapa),
    [canalOptionsEtapa]
  );

  const connectedCount = useMemo(
    () => whatsapps.filter((w) => isConnected(w)).length,
    [whatsapps]
  );

  // Hidrata formulário ao abrir / trocar fluxo (não depende de whatsapps para evitar reset ao digitar)
  useEffect(() => {
    if (!open) return;
    setNome(fluxo?.nome ?? "");
    setDescricao(fluxo?.descricao ?? "");
    setPublicoAlvo(fluxo?.publicoAlvo ?? "lead_inativo");
    setDiasInatividade(fluxo?.diasInatividade ?? 30);
    setEncerrarAoResponder(fluxo?.encerrarAoResponder !== false);
    setAtivo(fluxo?.ativo !== false);
    setPromptId(fluxo?.promptId != null ? String(fluxo.promptId) : "");
    setSegEstagios(fluxo?.segmentoEstagios ?? []);
    setSegPerfis(fluxo?.segmentoPerfis ?? []);
    setSegMotivos(fluxo?.segmentoMotivosPerda ?? []);

    const leadIds = Array.isArray(fluxo?.destinatarioLeadSaleIds)
      ? fluxo.destinatarioLeadSaleIds.map(Number)
      : [];
    const contactIds = Array.isArray(fluxo?.destinatarioContactIds)
      ? fluxo.destinatarioContactIds.map(Number)
      : [];
    if (leadIds.length || contactIds.length) {
      // Hidrata seleção após leadsCatalog carregar (efeito abaixo)
      setSelectedRecipients(
        leadIds.map((id) => ({
          id,
          leadSaleId: id,
          contactId: null,
          name: `Lead #${id}`,
          number: "",
          email: "",
          tags: [],
          source: "lead",
        }))
      );
    } else {
      setSelectedRecipients([]);
    }

    setLista(
      etapas.length > 0
        ? etapas.map((e) => {
            let canalKeyEtapa = "heranca";
            if (e.canal === "email") canalKeyEtapa = "email";
            else if (String(e.canal || "").startsWith("conn:")) canalKeyEtapa = e.canal;
            else if (e.canal && e.canal !== "heranca") {
              canalKeyEtapa = e.canal;
            }
            return {
              id: e.id,
              ordem: e.ordem,
              diasApos: e.diasApos ?? 0,
              canalKey: canalKeyEtapa,
              titulo: e.titulo ?? "",
              mensagem: e.mensagem ?? "",
              ativo: e.ativo !== false,
              abAtivo: !!e.abAtivo,
              abTituloB: e.abTituloB ?? "",
              abMensagemB: e.abMensagemB ?? "",
              abSplit: e.abSplit ?? 50,
              abAutoEscolher: e.abAutoEscolher !== false,
              abMinEnvios: e.abMinEnvios ?? 20,
            };
          })
        : [etapaVazia(1)]
    );
  }, [open, fluxo, etapas]);

  // Enriquece destinatários salvos com dados dos leads quando o catálogo carrega
  useEffect(() => {
    if (!open || !leadsCatalog.length) return;
    const leadIds = Array.isArray(fluxo?.destinatarioLeadSaleIds)
      ? fluxo.destinatarioLeadSaleIds.map(Number)
      : [];
    const contactIds = Array.isArray(fluxo?.destinatarioContactIds)
      ? fluxo.destinatarioContactIds.map(Number)
      : [];
    if (!leadIds.length && !contactIds.length) return;

    const byId = new Map(leadsCatalog.map((l) => [Number(l.id), l]));
    const byContact = new Map(
      leadsCatalog.filter((l) => l.contactId != null).map((l) => [Number(l.contactId), l])
    );
    const next = [];
    leadIds.forEach((id) => {
      const l = byId.get(id);
      if (l) {
        next.push({
          id: l.contactId || l.id,
          leadSaleId: l.id,
          contactId: l.contactId || null,
          name: l.name || `Lead #${l.id}`,
          number: l.phone || "",
          email: l.email || "",
          tags: [],
          source: "lead",
        });
      } else {
        next.push({
          id,
          leadSaleId: id,
          contactId: null,
          name: `Lead #${id}`,
          number: "",
          email: "",
          tags: [],
          source: "lead",
        });
      }
    });
    contactIds.forEach((cid) => {
      if (next.some((r) => Number(r.contactId) === cid)) return;
      const l = byContact.get(cid);
      next.push({
        id: cid,
        leadSaleId: l?.id || null,
        contactId: cid,
        name: l?.name || `Contato #${cid}`,
        number: l?.phone || "",
        email: l?.email || "",
        tags: [],
        source: "contact",
      });
    });
    setSelectedRecipients(next);
  }, [open, fluxo?.id, fluxo?.destinatarioLeadSaleIds, fluxo?.destinatarioContactIds, leadsCatalog]);

  // Resolve canal padrão quando conexões carregam
  useEffect(() => {
    if (!open || !whatsapps.length) return;
    setCanalKey((prev) => {
      if (prev && (prev === "email" || String(prev).startsWith("conn:"))) {
        // Mantém se ainda existe na lista
        if (prev === "email") return prev;
        const still = whatsapps.some((w) => `conn:${w.id}` === prev);
        if (still) return prev;
      }
      const fromFluxo = canalValueFromRecord(
        { canal: fluxo?.canal, whatsappId: fluxo?.whatsappId },
        whatsapps
      );
      if (fromFluxo && fromFluxo !== "heranca") return fromFluxo;
      const firstConnected = buildCanalOptions(whatsapps, {
        includeHeranca: false,
        includeEmail: true,
      }).find((o) => o.value.startsWith("conn:") && o.connected);
      if (firstConnected) return firstConnected.value;
      const firstAny = buildCanalOptions(whatsapps, {
        includeHeranca: false,
        includeEmail: true,
      }).find((o) => o.value.startsWith("conn:"));
      return firstAny?.value || "email";
    });

    // Normaliza etapas legadas (whatsapp → conn:X ou heranca)
    setLista((prev) =>
      prev.map((e) => {
        if (e.canalKey === "heranca" || e.canalKey === "email" || String(e.canalKey).startsWith("conn:")) {
          return e;
        }
        const mapped = canalValueFromRecord({ canal: e.canalKey }, whatsapps);
        return {
          ...e,
          canalKey: mapped.startsWith("conn:") || mapped === "email" ? mapped : "heranca",
        };
      })
    );
  }, [open, whatsapps, fluxo?.id, fluxo?.canal, fluxo?.whatsappId]);

  const opcoesMotivos = useMemo(() => {
    const set = new Set([...MOTIVOS_PERDA_PADRAO, ...motivosLead, ...segMotivos]);
    return [...set];
  }, [motivosLead, segMotivos]);

  const canalFluxoResolvido = useMemo(
    () => parseCanalValue(canalKey, whatsapps),
    [canalKey, whatsapps]
  );

  const validacoes = useMemo(
    () =>
      lista.map((etapa) => {
        const parsed = parseCanalValue(
          etapa.canalKey === "heranca" ? canalKey : etapa.canalKey,
          whatsapps
        );
        const canalMsg = parsed.canal === "email" ? "email" : "whatsapp";
        return {
          a: validarMensagemNutricao(etapa.mensagem, {
            titulo: etapa.titulo,
            canal: canalMsg,
            contexto: CONTEXTO_EXEMPLO,
          }),
          b: etapa.abAtivo
            ? validarMensagemNutricao(etapa.abMensagemB || "", {
                titulo: etapa.abTituloB || etapa.titulo,
                canal: canalMsg,
                contexto: CONTEXTO_EXEMPLO,
              })
            : null,
        };
      }),
    [lista, canalKey, whatsapps]
  );

  const totalErros = useMemo(
    () => validacoes.reduce((s, v) => s + v.a.erros.length + (v.b?.erros.length || 0), 0),
    [validacoes]
  );

  if (!open) return null;

  const toggle = (setter, valor) =>
    setter((prev) => (prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]));

  const atualizarEtapa = (idx, patch) =>
    setLista((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  const melhorarComIa = async (idx, field) => {
    const etapa = lista[idx];
    if (!etapa) return;
    const mensagem = field === "abMensagemB" ? etapa.abMensagemB : etapa.mensagem;
    const titulo = field === "abMensagemB" ? etapa.abTituloB || etapa.titulo : etapa.titulo;
    const key = `${idx}-${field}`;
    setIaLoading(key);
    try {
      const data = await realtyService.sugerirMensagemNutricao({
        mensagem: mensagem || "",
        titulo: titulo || "",
        etapaTitulo: titulo || "",
        contexto:
          mensagem ||
          `Escreva uma mensagem de nutrição imobiliária para a etapa "${titulo || "follow-up"}". Tom consultivo, WhatsApp, pt-BR. Preserve {{variaveis}}.`,
        promptId: promptId ? Number(promptId) : null,
      });
      const sugerida = data?.mensagem || data?.texto || data?.suggestion || "";
      if (!sugerida) {
        toast.warn("A IA não retornou uma mensagem.");
        return;
      }
      atualizarEtapa(idx, { [field]: sugerida });
      toast.success("Mensagem melhorada com IA");
    } catch (err) {
      toastError(err);
    } finally {
      setIaLoading(null);
    }
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.warn("Informe o nome do fluxo");
      return;
    }
    if (!canalKey) {
      toast.warn("Selecione um canal / conexão");
      return;
    }
    if (totalErros > 0) {
      toast.warn("Corrija as pendências de validação das mensagens");
      return;
    }

    const parsedFluxo = parseCanalValue(canalKey, whatsapps);
    if (canalKey.startsWith("conn:") && !parsedFluxo.whatsappId) {
      toast.warn("Conexão inválida. Escolha outra na lista de Integrações.");
      return;
    }
    if (canalKey !== "email" && !parsedFluxo.whatsappId) {
      toast.warn(
        "Selecione uma conexão de Integrações (ex.: WhatsApp Web pelo nome da conexão)."
      );
      return;
    }

    setSalvando(true);
    try {
      const etapasValidas = lista
        .filter((et) => et.titulo.trim() && et.mensagem.trim())
        .map((et, i) => {
          const abOk = !!et.abAtivo && !!(et.abMensagemB || "").trim();
          let canalSalvo = "heranca";
          if (et.canalKey === "email") canalSalvo = "email";
          else if (et.canalKey && et.canalKey.startsWith("conn:")) canalSalvo = et.canalKey;
          else if (et.canalKey && et.canalKey !== "heranca") canalSalvo = et.canalKey;

          return {
            id: et.id,
            ordem: i + 1,
            diasApos: Number(et.diasApos) || 0,
            canal: canalSalvo,
            titulo: et.titulo.trim(),
            mensagem: et.mensagem.trim(),
            ativo: et.ativo !== false,
            abAtivo: abOk,
            abTituloB: abOk ? et.abTituloB || et.titulo : null,
            abMensagemB: abOk ? (et.abMensagemB || "").trim() : null,
            abSplit: Math.min(95, Math.max(5, Number(et.abSplit ?? 50))),
            abMinEnvios: Math.max(1, Number(et.abMinEnvios ?? 20)),
            abAutoEscolher: et.abAutoEscolher !== false,
          };
        });

      if (!etapasValidas.length) {
        toast.warn("Adicione ao menos uma etapa com título e mensagem");
        setSalvando(false);
        return;
      }

      const fluxoPayload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        publicoAlvo,
        diasInatividade: Number(diasInatividade) || 30,
        canal: parsedFluxo.canal || "whatsapp",
        encerrarAoResponder: !!encerrarAoResponder,
        ativo: !!ativo,
        whatsappId: parsedFluxo.whatsappId || null,
        promptId: promptId ? Number(promptId) : null,
        segmentoEstagios: segEstagios,
        segmentoPerfis: segPerfis,
        segmentoMotivosPerda: segMotivos,
        destinatarioLeadSaleIds: [
          ...new Set(
            selectedRecipients
              .map((r) => r.leadSaleId)
              .filter((id) => id != null && Number.isFinite(Number(id)))
              .map(Number)
          ),
        ],
        destinatarioContactIds: [
          ...new Set(
            selectedRecipients
              .map((r) => r.contactId)
              .filter((id) => id != null && Number.isFinite(Number(id)))
              .map(Number)
          ),
        ],
      };

      const ok = await onSave(fluxoPayload, etapasValidas);
      if (ok !== false && onClose) onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="realty-modal-backdrop" onClick={onClose} role="presentation">
      <form
        className="realty-card realty-modal realty-form nutricao-fluxo-modal"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={salvar}
      >
        <h3>{fluxo ? "Editar fluxo de nutrição" : "Novo fluxo de nutrição"}</h3>
        <p className="nutricao-muted">
          Defina o público, o gatilho de inatividade e a sequência de mensagens automáticas.
        </p>

        <label>
          Nome do fluxo
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Reativação 30 dias"
            required
          />
        </label>

        <label>
          Descrição
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
        </label>

        <div className="nutricao-destinatarios-box">
          <strong>Destinatários</strong>
          <p className="nutricao-muted">
            Mesmo modelo das campanhas: filtre por fila, lista de contatos, tag ou público-alvo
            (leads sem resposta / inativos). Sem filtro, lista todos os contatos — selecione todos
            ou um a um. Se não marcar ninguém, o fluxo usa o público-alvo automático por
            inatividade.
          </p>
          <DestinatariosPicker
            value={selectedRecipients}
            onChange={setSelectedRecipients}
            leads={leadsCatalog}
            initialPublicoAlvo=""
            onPublicoAlvoChange={(v) => {
              if (v) setPublicoAlvo(v);
            }}
          />
        </div>

        <div className="nutricao-grid-2">
          <label>
            Público-alvo (automático se nenhum contato marcado)
            <select value={publicoAlvo} onChange={(e) => setPublicoAlvo(e.target.value)}>
              <option value="lead_inativo">Leads inativos</option>
              <option value="lead_sem_resposta">Leads sem resposta</option>
            </select>
          </label>

          <label>
            Dias sem interação para entrar
            <input
              type="number"
              min={1}
              value={diasInatividade}
              onChange={(e) => setDiasInatividade(Number(e.target.value))}
            />
          </label>

          <label className="nutricao-canal-field">
            Canal padrão
            <select
              value={canalKey}
              onChange={(e) => setCanalKey(e.target.value)}
              required
              disabled={loadingCanais}
            >
              {loadingCanais && <option value="">Carregando conexões…</option>}
              {!loadingCanais && canalOptionsFluxo.filter((o) => o.value.startsWith("conn:")).length === 0 && (
                <option value="">Nenhuma conexão — cadastre em Integrações</option>
              )}
              {canalGroupsFluxo.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="nutricao-muted" style={{ display: "block", marginTop: 4 }}>
              {connectedCount > 0
                ? `${connectedCount} conexão(ões) conectada(s) em Integrações — o nome exibido é o da conexão criada.`
                : "Conecte WhatsApp Web, API Oficial ou outro canal em Integrações para enviar."}
              {canalFluxoResolvido.whatsappId
                ? ` · Usando ${canalFluxoResolvido.connectionName || channelLabel(canalFluxoResolvido.canal)}`
                : canalKey === "email"
                  ? " · Canal e-mail (sem conexão WhatsApp)"
                  : ""}
            </span>
          </label>

          <label>
            Prompt / Agente de IA (opcional)
            <select value={promptId} onChange={(e) => setPromptId(e.target.value)}>
              <option value="">Nenhum</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.nome || `Prompt #${p.id}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="nutricao-switch-row">
          <div>
            <p className="nutricao-switch-row__title">Encerrar ao responder</p>
            <p className="nutricao-muted">Para a sequência se o lead voltar a interagir</p>
          </div>
          <label className="nutricao-switch">
            <input
              type="checkbox"
              checked={encerrarAoResponder}
              onChange={(e) => setEncerrarAoResponder(e.target.checked)}
            />
            <span />
          </label>
        </div>

        <div className="nutricao-switch-row">
          <div>
            <p className="nutricao-switch-row__title">Fluxo ativo</p>
            <p className="nutricao-muted">Processa inscrições automaticamente</p>
          </div>
          <label className="nutricao-switch">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            <span />
          </label>
        </div>

        <div className="nutricao-seg-box">
          <strong>Segmentação avançada</strong>
          <p className="nutricao-muted">
            Sem seleção, o fluxo vale para todos os leads elegíveis. Cada filtro selecionado restringe a
            entrada.
          </p>

          <p className="nutricao-label-xs">Etapa do pipeline</p>
          <div className="nutricao-chips">
            {PIPELINE_ESTAGIOS.map((est) => (
              <ChipToggle
                key={est.id}
                ativo={segEstagios.includes(est.id)}
                onClick={() => toggle(setSegEstagios, est.id)}
              >
                {est.title}
              </ChipToggle>
            ))}
          </div>

          <p className="nutricao-label-xs">Perfil do cliente</p>
          <div className="nutricao-chips">
            {PERFIS_CLIENTE.map((p) => (
              <ChipToggle
                key={p.value}
                ativo={segPerfis.includes(p.value)}
                onClick={() => toggle(setSegPerfis, p.value)}
                title={p.descricao}
              >
                {p.label}
              </ChipToggle>
            ))}
          </div>

          <p className="nutricao-label-xs">Motivo da perda</p>
          <div className="nutricao-chips">
            {opcoesMotivos.map((m) => (
              <ChipToggle
                key={m}
                ativo={segMotivos.includes(m)}
                onClick={() => toggle(setSegMotivos, m)}
              >
                {m}
              </ChipToggle>
            ))}
          </div>
          <p className="nutricao-muted">
            Ao selecionar um motivo de perda, leads perdidos passam a entrar no fluxo.
          </p>
        </div>

        <div className="nutricao-ab-etapa__head">
          <div>
            <strong>Etapas da sequência</strong>
            <p className="nutricao-muted" style={{ margin: "4px 0 0" }}>
              Use o gerador para inserir variáveis (ex.: {"{{primeiro_nome}}"}, {"{{imovel_resumo}}"}) e
              pré-visualizar.
            </p>
          </div>
          <button
            type="button"
            className="realty-page__btn realty-page__btn--ghost"
            onClick={() => setLista((prev) => [...prev, etapaVazia(prev.length + 1)])}
          >
            + Etapa
          </button>
        </div>

        {lista.map((etapa, idx) => {
          const etapaCanalParsed = parseCanalValue(
            etapa.canalKey === "heranca" ? canalKey : etapa.canalKey,
            whatsapps
          );
          const canalMsg =
            etapaCanalParsed.canal === "email" ? "email" : "whatsapp";

          return (
            <div key={idx} className="realty-card nutricao-etapa-card">
              <div className="nutricao-chips" style={{ marginBottom: 8 }}>
                <span className="realty-chip">Etapa {idx + 1}</span>
                {lista.length > 1 && (
                  <button
                    type="button"
                    className="realty-page__btn realty-page__btn--ghost"
                    onClick={() => setLista((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remover
                  </button>
                )}
              </div>

              <div className="nutricao-grid-3">
                <label>
                  Dias após
                  <input
                    type="number"
                    min={0}
                    value={etapa.diasApos}
                    onChange={(e) => atualizarEtapa(idx, { diasApos: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Canal
                  <select
                    value={etapa.canalKey}
                    onChange={(e) => atualizarEtapa(idx, { canalKey: e.target.value })}
                  >
                    {canalGroupsEtapa.map((g) => (
                      <optgroup key={g.key} label={g.label}>
                        {g.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label>
                  Título
                  <input
                    value={etapa.titulo}
                    onChange={(e) => atualizarEtapa(idx, { titulo: e.target.value })}
                    placeholder="Retomada leve"
                  />
                </label>
              </div>

              {etapa.abAtivo && (
                <p className="nutricao-muted">
                  <strong>Variante A (original)</strong>
                </p>
              )}

              <GeradorMensagem
                value={etapa.mensagem}
                onChange={(v) => atualizarEtapa(idx, { mensagem: v })}
                canal={canalMsg}
                contexto={CONTEXTO_EXEMPLO}
              />
              <AvisosValidacao
                resultado={validacoes[idx]?.a}
                rotulo={etapa.abAtivo ? "Variante A" : undefined}
              />

              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                disabled={iaLoading === `${idx}-mensagem`}
                onClick={() => melhorarComIa(idx, "mensagem")}
                style={{ marginTop: 6 }}
              >
                {iaLoading === `${idx}-mensagem` ? "Gerando…" : "Melhorar com IA"}
              </button>

              <div className="nutricao-ab-box">
                <div className="nutricao-switch-row" style={{ border: 0, padding: 0 }}>
                  <div>
                    <p className="nutricao-switch-row__title">⚗ Teste A/B desta etapa</p>
                    <p className="nutricao-muted">
                      Duas versões da mensagem são sorteadas entre os leads e comparadas por taxa de
                      resposta.
                    </p>
                  </div>
                  <label className="nutricao-switch">
                    <input
                      type="checkbox"
                      checked={!!etapa.abAtivo}
                      onChange={(e) => atualizarEtapa(idx, { abAtivo: e.target.checked })}
                    />
                    <span />
                  </label>
                </div>

                {etapa.abAtivo && (
                  <>
                    <div className="nutricao-grid-3" style={{ marginTop: 10 }}>
                      <label>
                        % para variante A
                        <input
                          type="number"
                          min={5}
                          max={95}
                          value={etapa.abSplit ?? 50}
                          onChange={(e) =>
                            atualizarEtapa(idx, { abSplit: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Mín. envios por variante
                        <input
                          type="number"
                          min={1}
                          value={etapa.abMinEnvios ?? 20}
                          onChange={(e) =>
                            atualizarEtapa(idx, { abMinEnvios: Number(e.target.value) })
                          }
                        />
                      </label>
                      <div className="nutricao-switch-row" style={{ border: 0, padding: "8px 0" }}>
                        <span className="nutricao-muted" style={{ fontSize: 12 }}>
                          Escolher vencedor automaticamente
                        </span>
                        <label className="nutricao-switch">
                          <input
                            type="checkbox"
                            checked={etapa.abAutoEscolher !== false}
                            onChange={(e) =>
                              atualizarEtapa(idx, { abAutoEscolher: e.target.checked })
                            }
                          />
                          <span />
                        </label>
                      </div>
                    </div>

                    <label>
                      Título da variante B
                      <input
                        value={etapa.abTituloB ?? ""}
                        onChange={(e) => atualizarEtapa(idx, { abTituloB: e.target.value })}
                        placeholder={etapa.titulo || "Título alternativo"}
                      />
                    </label>

                    <p className="nutricao-muted">
                      <strong>Variante B (alternativa)</strong>
                    </p>
                    <GeradorMensagem
                      value={etapa.abMensagemB ?? ""}
                      onChange={(v) => atualizarEtapa(idx, { abMensagemB: v })}
                      canal={canalMsg}
                      contexto={CONTEXTO_EXEMPLO}
                    />
                    <AvisosValidacao resultado={validacoes[idx]?.b} rotulo="Variante B" />
                    <button
                      type="button"
                      className="realty-page__btn realty-page__btn--ghost"
                      disabled={iaLoading === `${idx}-abMensagemB`}
                      onClick={() => melhorarComIa(idx, "abMensagemB")}
                      style={{ marginTop: 6 }}
                    >
                      {iaLoading === `${idx}-abMensagemB` ? "Gerando…" : "Melhorar com IA"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        <div className="realty-card__actions" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          {totalErros > 0 && (
            <p className="nutricao-validacao__erro" style={{ marginRight: "auto" }}>
              ⚠ {totalErros} pendência(s) de validação impedem o salvamento.
            </p>
          )}
          <button type="button" className="realty-page__btn realty-page__btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="realty-page__btn"
            disabled={salvando || !nome.trim() || totalErros > 0 || !canalKey}
          >
            {salvando ? "Salvando…" : "Salvar fluxo"}
          </button>
        </div>
      </form>
    </div>
  );
}
