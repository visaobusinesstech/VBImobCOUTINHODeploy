/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Página de Proprietários — paridade funcional Lovable + design VBSolution.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Building2,
  Briefcase,
  FileSignature,
  FileText,
  Home,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Maximize,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  Edit,
} from "lucide-react";
import MainContainer from "../../components/MainContainer";
import ProprietarioFormDialog from "../../components/proprietarios/ProprietarioFormDialog";
import OwnerDiligenceDialog from "../../components/proprietarios/OwnerDiligenceDialog";
import realtyService from "../../services/realtyService";
import {
  PROPRIETARIO_TIPO_LABEL,
  filterProprietariosByTipo,
  rankCaptacaoByCanal,
  searchProprietariosMatch,
} from "../../helpers/proprietarioCrm";
import { mediaUrl } from "../../helpers/realtyCrm";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const TAB_KEY = "proprietarios_active_tab";
const DIALOG_STATE_KEY = "proprietarios_dialog_state";

const persistProprietarioDialogState = (isOpen, editId) => {
  try {
    if (isOpen) {
      localStorage.setItem(DIALOG_STATE_KEY, JSON.stringify({ open: true, editId: editId || null }));
    } else {
      localStorage.removeItem(DIALOG_STATE_KEY);
    }
  } catch {
    /* ignore */
  }
};

const Proprietarios = () => {
  const history = useHistory();
  const [proprietarios, setProprietarios] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [propTab, setPropTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) || "todos";
    } catch {
      return "todos";
    }
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const restoredRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [propsData, contratosData] = await Promise.all([
        realtyService.listProprietarios({ pageSize: 200 }),
        realtyService.listContratos({ pageSize: 200 }).catch(() => ({ contratos: [] })),
      ]);
      setProprietarios(propsData.proprietarios || []);
      setContratos(contratosData.contratos || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, propTab);
    } catch {
      /* ignore */
    }
  }, [propTab]);

  // Restaura dialog aberto após reload (paridade Lovable)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DIALOG_STATE_KEY);
      if (!saved) return;
      const state = JSON.parse(saved);
      if (!state.open) return;
      setFormOpen(true);
      if (state.editId && proprietarios.length > 0 && !restoredRef.current) {
        const found = proprietarios.find((p) => String(p.id) === String(state.editId));
        if (found) {
          setEditItem(found);
          restoredRef.current = true;
        }
      }
    } catch {
      /* ignore */
    }
  }, [proprietarios]);

  useEffect(() => {
    persistProprietarioDialogState(formOpen, editItem?.id || null);
  }, [formOpen, editItem]);

  const openCreate = () => {
    setEditItem(null);
    persistProprietarioDialogState(true, null);
    setFormOpen(true);
  };

  const openEdit = (p) => {
    setEditItem(p);
    persistProprietarioDialogState(true, p.id);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open) => {
    setFormOpen(open);
    if (!open) {
      setEditItem(null);
      persistProprietarioDialogState(false);
    }
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editItem) {
        await realtyService.updateProprietario(editItem.id, data);
        toast.success("Proprietário atualizado");
      } else {
        await realtyService.createProprietario(data);
        toast.success("Proprietário cadastrado");
      }
      setFormOpen(false);
      setEditItem(null);
      persistProprietarioDialogState(false);
      await load();
    } catch (err) {
      const status = err?.response?.status;
      const warnings = err?.response?.data?.warnings;
      if (status === 409 && Array.isArray(warnings) && warnings.length) {
        warnings.forEach((w) => toast.error(w));
      } else {
        toastError(err);
      }
      // Mantém o formulário aberto em caso de erro/duplicado (paridade Lovable bloqueia insert)
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await realtyService.deleteProprietario(deleteItem.id);
      toast.success("Excluído");
      setDeleteItem(null);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const contratosByProprietario = useMemo(() => {
    const map = new Map();
    contratos.forEach((c) => {
      if (c.proprietarioId) {
        map.set(c.proprietarioId, (map.get(c.proprietarioId) || 0) + 1);
      }
    });
    return map;
  }, [contratos]);

  const filteredProprietarios = useMemo(
    () => proprietarios.filter((p) => searchProprietariosMatch(p, searchQuery)),
    [proprietarios, searchQuery]
  );

  const vendaProps = filterProprietariosByTipo(filteredProprietarios, "venda");
  const aluguelProps = filterProprietariosByTipo(filteredProprietarios, "aluguel");

  const rankingCaptacaoVenda = useMemo(
    () => rankCaptacaoByCanal(proprietarios, "venda"),
    [proprietarios]
  );
  const rankingCaptacaoAluguel = useMemo(
    () => rankCaptacaoByCanal(proprietarios, "aluguel"),
    [proprietarios]
  );

  const openFile = (url) => {
    if (!url) return;
    window.open(mediaUrl(url), "_blank", "noopener,noreferrer");
  };

  const initials = (name) =>
    String(name || "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const renderRanking = (data, title) => {
    if (!data.length) return null;
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    return (
      <div className="realty-card realty-prop-ranking">
        <h4>{title}</h4>
        <div className="realty-prop-ranking__list">
          {data.slice(0, 8).map((item, i) => (
            <div key={item.canal} className="realty-prop-ranking__row">
              <span className="realty-prop-ranking__pos">{i + 1}.</span>
              <div className="realty-prop-ranking__bar-wrap">
                <div className="realty-prop-ranking__labels">
                  <span>{item.canal}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="realty-prop-ranking__track">
                  <div
                    className="realty-prop-ranking__fill"
                    style={{ width: `${(item.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCard = (p) => (
    <article key={p.id} className="realty-card realty-prop-card" onClick={() => openEdit(p)}>
      <div className="realty-prop-card__top">
        <div className="realty-prop-card__identity">
          <div className="realty-prop-avatar">{initials(p.name)}</div>
          <div>
            <h3>{p.name}</h3>
            {p.document ? <p className="realty-prop-muted">{p.document}</p> : null}
          </div>
        </div>
        <div className="realty-prop-card__actions">
          <span className={`realty-prop-tipo realty-prop-tipo--${p.tipo || "ambos"}`}>
            {PROPRIETARIO_TIPO_LABEL[p.tipo] || "Ambos"}
          </span>
          <button
            type="button"
            className="realty-prop-icon-btn"
            title="Diligência com IA"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent("open-owner-research", { detail: p }));
            }}
          >
            <Search size={14} />
          </button>
          <button
            type="button"
            className="realty-prop-icon-btn"
            title="Editar"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(p);
            }}
          >
            <Edit size={14} />
          </button>
          <button
            type="button"
            className="realty-prop-icon-btn realty-prop-icon-btn--danger"
            title="Excluir"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteItem(p);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="realty-prop-card__meta">
        {p.phone ? (
          <a
            href={`https://wa.me/55${String(p.phone).replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="realty-prop-link-row"
          >
            <Phone size={14} /> {p.phone}
          </a>
        ) : null}
        {p.email ? (
          <a
            href={`mailto:${p.email}`}
            onClick={(e) => e.stopPropagation()}
            className="realty-prop-link-row"
          >
            <Mail size={14} /> {p.email}
          </a>
        ) : null}
        {p.address ? (
          <div className="realty-prop-link-row">
            <Home size={14} />
            {p.address}
            {p.city ? `, ${p.city}` : ""}
          </div>
        ) : null}
        {p.bank || p.pix ? (
          <div className="realty-prop-link-row">
            <Landmark size={14} />
            {p.pix ? `PIX: ${p.pix}` : `${p.bank} Ag:${p.agency} Cc:${p.account}`}
          </div>
        ) : null}
        {p.dadosImovelEndereco ? (
          <div className="realty-prop-link-row realty-prop-link-row--accent">
            <MapPin size={14} /> {p.dadosImovelEndereco}
          </div>
        ) : null}
        {(p.dadosImovelTipo || (p.dadosImovelArea && Number(p.dadosImovelArea) > 0)) && (
          <div className="realty-prop-tags">
            {p.dadosImovelTipo ? <span className="realty-prop-chip">{p.dadosImovelTipo}</span> : null}
            {p.dadosImovelArea && Number(p.dadosImovelArea) > 0 ? (
              <span className="realty-prop-chip">
                <Maximize size={12} /> {p.dadosImovelArea}m²
              </span>
            ) : null}
          </div>
        )}
        <div className="realty-prop-tags">
          {p.contratoAdministracao ? <span className="realty-prop-chip">Administração</span> : null}
          {p.exclusividade ? <span className="realty-prop-chip realty-prop-chip--warn">Exclusividade</span> : null}
          {Number(p.comissaoAcordada) > 0 ? (
            <span className="realty-prop-chip realty-prop-chip--ok">{p.comissaoAcordada}%</span>
          ) : null}
          {p.quitado ? <span className="realty-prop-chip realty-prop-chip--ok">Quitado</span> : null}
          {p.averbacao ? <span className="realty-prop-chip">Averbação</span> : null}
          {p.saldoDevedor ? <span className="realty-prop-chip realty-prop-chip--warn">Saldo Devedor</span> : null}
          {p.parcelaAtrasoFinanciamento ? (
            <span className="realty-prop-chip realty-prop-chip--danger">Atraso Financ.</span>
          ) : null}
          {p.parcelaAtrasoCondominio ? (
            <span className="realty-prop-chip realty-prop-chip--danger">Atraso Cond.</span>
          ) : null}
          {p.parcelaAtrasoIptu ? (
            <span className="realty-prop-chip realty-prop-chip--danger">Atraso IPTU</span>
          ) : null}
          {p.exclusividadeContratoUrl ? (
            <button
              type="button"
              className="realty-prop-chip realty-prop-chip--btn"
              onClick={(e) => {
                e.stopPropagation();
                openFile(p.exclusividadeContratoUrl);
              }}
            >
              <FileText size={12} /> Contrato
            </button>
          ) : null}
          {p.canalOrigem ? <span className="realty-prop-chip">{p.canalOrigem}</span> : null}
        </div>
        {(contratosByProprietario.get(p.id) || 0) > 0 ? (
          <button
            type="button"
            className="realty-prop-chip realty-prop-chip--btn"
            onClick={(e) => {
              e.stopPropagation();
              history.push(`/contratos?proprietario=${p.id}`);
            }}
          >
            <FileSignature size={12} />
            {contratosByProprietario.get(p.id)} contrato
            {(contratosByProprietario.get(p.id) || 0) > 1 ? "s" : ""}
          </button>
        ) : null}
      </div>
    </article>
  );

  const listForTab =
    propTab === "venda" ? vendaProps : propTab === "aluguel" ? aluguelProps : filteredProprietarios;

  return (
    <MainContainer autoHeight>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Proprietários</h1>
            <p className="realty-page__subtitle">{proprietarios.length} proprietários</p>
          </div>
          <button type="button" className="realty-page__btn" onClick={openCreate}>
            <Plus size={16} /> Novo Proprietário
          </button>
        </div>

        {proprietarios.length > 0 && (
          <div className="realty-prop-rankings">
            {renderRanking(rankingCaptacaoVenda, "Ranking Captação — Venda")}
            {renderRanking(rankingCaptacaoAluguel, "Ranking Captação — Aluguel")}
          </div>
        )}

        <div className="realty-page__toolbar">
          <div className="realty-prop-search-wrap">
            <Search size={16} className="realty-prop-search-icon" />
            <input
              className="realty-page__search"
              placeholder="Buscar por nome, telefone, e-mail, CPF/CNPJ ou endereço do imóvel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button type="button" className="realty-prop-search-clear" onClick={() => setSearchQuery("")}>
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="realty-tabs">
          <button
            type="button"
            className={`realty-tab${propTab === "todos" ? " realty-tab--active" : ""}`}
            onClick={() => setPropTab("todos")}
          >
            <Users size={14} /> Todos ({filteredProprietarios.length})
          </button>
          <button
            type="button"
            className={`realty-tab${propTab === "venda" ? " realty-tab--active" : ""}`}
            onClick={() => setPropTab("venda")}
          >
            <Briefcase size={14} /> Venda ({vendaProps.length})
          </button>
          <button
            type="button"
            className={`realty-tab${propTab === "aluguel" ? " realty-tab--active" : ""}`}
            onClick={() => setPropTab("aluguel")}
          >
            <Building2 size={14} /> Aluguel ({aluguelProps.length})
          </button>
        </div>

        {loading ? (
          <div className="realty-empty">
            <Loader2 size={28} className="realty-spin" />
          </div>
        ) : proprietarios.length === 0 ? (
          <div className="realty-empty">
            <Users size={40} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p>Nenhum proprietário cadastrado.</p>
            <button type="button" className="realty-page__btn" onClick={openCreate} style={{ marginTop: 12 }}>
              Cadastrar primeiro
            </button>
          </div>
        ) : listForTab.length === 0 ? (
          <div className="realty-empty">Nenhum resultado para a busca/filtro.</div>
        ) : (
          <div className="realty-page__grid">{listForTab.map(renderCard)}</div>
        )}
      </div>

      <ProprietarioFormDialog
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        proprietario={editItem}
        onSave={handleSave}
        saving={saving}
      />

      <OwnerDiligenceDialog />

      {deleteItem ? (
        <div className="realty-modal-backdrop" onClick={() => setDeleteItem(null)} role="presentation">
          <div className="realty-modal realty-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>Excluir proprietário?</h3>
            <p>Tem certeza que deseja excluir &quot;{deleteItem.name}&quot;?</p>
            <div className="realty-card__actions">
              <button type="button" className="realty-page__btn realty-page__btn--danger" onClick={handleDelete}>
                Excluir
              </button>
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={() => setDeleteItem(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainContainer>
  );
};

export default Proprietarios;
