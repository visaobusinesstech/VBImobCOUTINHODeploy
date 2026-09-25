import React, { useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Copy,
  Facebook,
  Instagram,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Workflow
} from "lucide-react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import ShimmerButton from "../../components/magic-ui/ShimmerButton";
import BorderBeam from "../../components/magic-ui/BorderBeam";
import {
  AUTOMATION_FONT,
  AUTOMATION_TEMPLATES,
  matchesChannel
} from "./automationTemplates";
import {
  AutomationsDialog,
  ConfirmDialog,
  ConnectionPicker,
  FieldLabel,
  GhostButton,
  NameDialog,
  PrimaryButton,
  TextArea,
  TextInput
} from "./AutomationsDialogs";
import "./automations.css";

const ChannelMark = ({ channels, large }) => {
  const key = channels.join("-");
  const cls =
    key === "instagram"
      ? "ig"
      : key === "facebook"
        ? "fb"
        : key === "whatsapp"
          ? "wa"
          : "mix";
  return (
    <span className={`automations-mark${large ? " automations-mark--lg" : ""} automations-mark--${cls}`}>
      {cls === "fb" ? (
        <Facebook size={large ? 26 : 22} />
      ) : cls === "wa" ? (
        <MessageCircle size={large ? 26 : 22} />
      ) : (
        <Instagram size={large ? 26 : 22} />
      )}
    </span>
  );
};

const FlowMenu = ({ onRename, onDuplicate, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <div className="automations-menu">
      <button
        type="button"
        className="automations-menu__trigger"
        aria-label="Mais ações"
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 6, left: rect.right - 168 });
          setOpen((value) => !value);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open
        ? createPortal(
            <div
              className="automations-menu__panel"
              style={{ top: pos.top, left: Math.max(12, pos.left) }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onRename();
                }}
              >
                <Pencil size={14} />
                Renomear
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDuplicate();
                }}
              >
                <Copy size={14} />
                Duplicar
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 size={14} />
                Excluir
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

const FlowBuilder = () => {
  const history = useHistory();
  const whatsContext = useContext(WhatsAppsContext) || {};
  const connections = Array.isArray(whatsContext.whatsApps)
    ? whatsContext.whatsApps
    : [];

  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParam, setSearchParam] = useState("");
  const [reloadData, setReloadData] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const [renameFlow, setRenameFlow] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const [confirmFlow, setConfirmFlow] = useState(null);
  const [confirmMode, setConfirmMode] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [template, setTemplate] = useState(null);
  const [templateMessage, setTemplateMessage] = useState("");
  const [templatePhrase, setTemplatePhrase] = useState("");
  const [templateIds, setTemplateIds] = useState([]);
  const [templateBusy, setTemplateBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/flowbuilder");
        if (!cancelled) setFlows(data.flows || []);
      } catch (err) {
        toastError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reloadData]);

  const term = searchParam.trim().toLowerCase();

  const visibleTemplates = useMemo(() => {
    if (!term) return AUTOMATION_TEMPLATES;
    return AUTOMATION_TEMPLATES.filter((item) =>
      `${item.name} ${item.action} ${item.description}`.toLowerCase().includes(term)
    );
  }, [term]);

  const featured = visibleTemplates.find((item) => item.featured);
  const recipes = visibleTemplates.filter((item) => !item.featured);

  const filteredFlows = useMemo(() => {
    if (!term) return flows;
    return flows.filter((flow) =>
      String(flow.name || "").toLowerCase().includes(term)
    );
  }, [flows, term]);

  const openTemplate = (item) => {
    const matching = connections.filter((connection) =>
      matchesChannel(connection, item.channels)
    );
    setTemplate(item);
    setTemplateMessage(item.defaultMessage);
    setTemplatePhrase(item.defaultPhrase || "");
    setTemplateIds(matching.map((connection) => connection.id));
  };

  const toggleConnection = (id) => {
    setTemplateIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const matchingConnections = template
    ? connections.filter((connection) =>
        matchesChannel(connection, template.channels)
      )
    : [];

  const handleCreateFlow = async () => {
    if (!createName.trim()) return;
    setCreateBusy(true);
    try {
      await api.post("/flowbuilder", { name: createName.trim() });
      toast.success("Fluxo criado");
      setCreateOpen(false);
      setCreateName("");
      setReloadData((value) => !value);
    } catch (err) {
      toastError(err);
    } finally {
      setCreateBusy(false);
    }
  };

  const handleRename = async () => {
    if (!renameFlow || !renameName.trim()) return;
    setRenameBusy(true);
    try {
      await api.put("/flowbuilder", {
        flowId: renameFlow.id,
        name: renameName.trim()
      });
      toast.success("Fluxo atualizado");
      setRenameFlow(null);
      setReloadData((value) => !value);
    } catch (err) {
      toastError(err);
    } finally {
      setRenameBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmFlow || !confirmMode) return;
    setConfirmBusy(true);
    try {
      if (confirmMode === "delete") {
        await api.delete(`/flowbuilder/${confirmFlow.id}`);
        toast.success("Fluxo excluído");
      } else {
        await api.post("/flowbuilder/duplicate", { flowId: confirmFlow.id });
        toast.success("Fluxo duplicado");
      }
      setConfirmFlow(null);
      setConfirmMode(null);
      setReloadData((value) => !value);
    } catch (err) {
      toastError(err);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleActivateTemplate = async () => {
    if (!template) return;
    setTemplateBusy(true);
    try {
      const { data } = await api.post("/flowbuilder/template", {
        templateId: template.id,
        message: templateMessage,
        phrase: templatePhrase,
        connectionIds: templateIds
      });
      if (data?.unboundReason) toast.info(data.unboundReason);
      else toast.success("Automação salva e ligada às conexões");
      setTemplate(null);
      setReloadData((value) => !value);
    } catch (err) {
      toastError(err);
    } finally {
      setTemplateBusy(false);
    }
  };

  return (
    <div className="automations-page" style={{ fontFamily: AUTOMATION_FONT }}>
      <div className="automations-page__inner">
        <header className="automations-page__header">
          <h1 className="automations-page__title">Automações</h1>
          <ShimmerButton
            className="automations-page__create"
            onClick={() => {
              setTemplate(null);
              setCreateOpen(true);
            }}
          >
            <Plus size={15} />
            Criar fluxo
          </ShimmerButton>
        </header>

        <div className="automations-page__search">
          <Search size={15} />
          <input
            value={searchParam}
            onChange={(event) => setSearchParam(event.target.value)}
            placeholder="Buscar automações e fluxos"
            aria-label="Buscar automações e fluxos"
          />
        </div>

        <p className="automations-page__label">Prontas para usar</p>

        {featured ? (
          <article className="automations-hero">
            <BorderBeam
              size={110}
              duration={16}
              colorFrom="rgba(225, 48, 108, 0.45)"
              colorTo="rgba(0, 113, 227, 0.2)"
            />
            <ChannelMark channels={featured.channels} large />
            <div className="automations-hero__copy">
              <p className="automations-hero__kicker">Instagram</p>
              <h2 className="automations-hero__title">{featured.name}</h2>
              <p className="automations-hero__action">{featured.action}</p>
              <p className="automations-hero__note">{featured.description}</p>
            </div>
            <button
              type="button"
              className="automations-btn automations-hero__cta"
              onClick={() => openTemplate(featured)}
            >
              Ativar
            </button>
          </article>
        ) : null}

        {recipes.length ? (
          <div className="automations-grid">
            {recipes.map((item) => (
              <article key={item.id} className="automations-tile">
                <ChannelMark channels={item.channels} />
                <h3 className="automations-tile__title">{item.name}</h3>
                <p className="automations-tile__desc">{item.description}</p>
                <button
                  type="button"
                  className="automations-btn"
                  onClick={() => openTemplate(item)}
                >
                  Ativar
                </button>
              </article>
            ))}
          </div>
        ) : featured ? null : (
          <div className="automations-empty" style={{ marginBottom: 40 }}>
            <p className="automations-empty__title">Nenhuma automação com esse termo</p>
          </div>
        )}

        <p className="automations-page__label">Seus fluxos</p>

        {loading ? (
          <>
            <div className="automations-skel" />
            <div className="automations-skel" />
          </>
        ) : filteredFlows.length === 0 ? (
          <div className="automations-empty">
            <p className="automations-empty__title">
              {term ? "Nenhum fluxo com esse nome" : "Nenhum fluxo ainda"}
            </p>
            <p className="automations-empty__hint">
              {term
                ? "Tente outro termo ou limpe a busca."
                : "Ative uma automação pronta ou crie um fluxo em branco."}
            </p>
          </div>
        ) : (
          <div className="automations-list">
            {filteredFlows.map((flow) => (
              <div
                key={flow.id}
                className="automations-flow"
                role="button"
                tabIndex={0}
                onClick={() => history.push(`/flowbuilder/${flow.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") history.push(`/flowbuilder/${flow.id}`);
                }}
              >
                <span className="automations-mark automations-mark--mix">
                  <Workflow size={18} />
                </span>
                <div className="automations-flow__body">
                  <p className="automations-flow__name">{flow.name}</p>
                </div>
                <span
                  className={
                    flow.active === false
                      ? "automations-pill automations-pill--off"
                      : "automations-pill"
                  }
                >
                  {flow.active === false ? "Pausado" : "Ativo"}
                </span>
                <FlowMenu
                  onRename={() => {
                    setRenameFlow(flow);
                    setRenameName(flow.name);
                  }}
                  onDuplicate={() => {
                    setConfirmFlow(flow);
                    setConfirmMode("duplicate");
                  }}
                  onDelete={() => {
                    setConfirmFlow(flow);
                    setConfirmMode("delete");
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <NameDialog
        open={createOpen}
        title="Novo fluxo"
        value={createName}
        busy={createBusy}
        onChange={setCreateName}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreateFlow}
      />

      <NameDialog
        open={Boolean(renameFlow)}
        title="Renomear fluxo"
        value={renameName}
        busy={renameBusy}
        onChange={setRenameName}
        onClose={() => setRenameFlow(null)}
        onSave={handleRename}
      />

      <ConfirmDialog
        open={Boolean(confirmFlow)}
        title={
          confirmMode === "delete"
            ? `Excluir “${confirmFlow?.name}”?`
            : `Duplicar “${confirmFlow?.name}”?`
        }
        body={
          confirmMode === "delete"
            ? "Esta ação não pode ser desfeita. Campanhas ligadas a este fluxo deixam de disparar."
            : "Uma cópia será criada para você editar."
        }
        confirmLabel={confirmMode === "delete" ? "Excluir" : "Duplicar"}
        danger={confirmMode === "delete"}
        busy={confirmBusy}
        onClose={() => {
          setConfirmFlow(null);
          setConfirmMode(null);
        }}
        onConfirm={handleConfirm}
      />

      <AutomationsDialog
        open={Boolean(template)}
        title={template?.name}
        onClose={() => setTemplate(null)}
        footer={
          <>
            <GhostButton onClick={() => setTemplate(null)}>Cancelar</GhostButton>
            <PrimaryButton disabled={templateBusy} onClick={handleActivateTemplate}>
              {templateBusy ? "Salvando…" : "Ativar automação"}
            </PrimaryButton>
          </>
        }
      >
        {template ? (
          <div style={{ display: "grid", gap: 16 }}>
            <p className="automations-hint" style={{ padding: 0, background: "transparent" }}>
              {template.description}
            </p>
            {template.needsCommentsPermission ? (
              <p
                className="automations-hint"
                style={{
                  margin: 0,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(225, 48, 108, 0.08)",
                  color: "#8a2a4a"
                }}
              >
                Esta automação já fica ligada no CRM. O envio real de resposta/DM a
                comentários só completa quando a Meta aprovar{" "}
                <strong>instagram_business_manage_comments</strong> (screencast).
              </p>
            ) : null}
            {template.bind === "keyword" || template.bind === "ig_comment_dm" ? (
              <div>
                <FieldLabel>Palavra-chave</FieldLabel>
                <TextInput
                  value={templatePhrase}
                  onChange={(event) => setTemplatePhrase(event.target.value)}
                  placeholder={
                    template.bind === "ig_comment_dm"
                      ? "Ex.: GUIA"
                      : "Ex.: oi, preço, quero"
                  }
                />
              </div>
            ) : null}
            <div>
              <FieldLabel>Mensagem enviada</FieldLabel>
              <TextArea
                value={templateMessage}
                onChange={(event) => setTemplateMessage(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Conexões</FieldLabel>
              <ConnectionPicker
                connections={matchingConnections}
                selectedIds={templateIds}
                onToggle={toggleConnection}
              />
            </div>
          </div>
        ) : null}
      </AutomationsDialog>
    </div>
  );
};

export default FlowBuilder;
