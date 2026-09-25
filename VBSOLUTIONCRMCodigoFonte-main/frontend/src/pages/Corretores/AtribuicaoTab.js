/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Tab Atribuição — regras geográficas (paridade Lovable AtribuicaoRegrasTab).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Plus, Trash2, Users } from "lucide-react";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const emptyForm = () => ({
  corretor_id: "",
  cidade: "",
  bairro: "",
  prioridade: 100,
  peso: 1,
  ativo: true,
});

const AtribuicaoTab = () => {
  const [corretores, setCorretores] = useState([]);
  const [regras, setRegras] = useState([]);
  const [carga, setCarga] = useState({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await realtyService.listCorretoresAtribuicao();
      setCorretores(res.corretores || []);
      setRegras(res.regras || []);
      setCarga(res.carga || {});
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const porCorretor = useMemo(() => {
    const map = {};
    (regras || []).forEach((r) => {
      const key = String(r.corretor_id);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [regras]);

  const salvar = async () => {
    if (!form.corretor_id) {
      toast.error("Selecione um corretor");
      return;
    }
    setSaving(true);
    try {
      await realtyService.createCorretorAtribuicao({
        corretor_id: form.corretor_id,
        cidade: form.cidade,
        bairro: form.bairro,
        prioridade: Number(form.prioridade ?? 100),
        peso: Number(form.peso ?? 1),
        ativo: form.ativo !== false,
      });
      toast.success("Regra criada");
      setOpen(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r) => {
    try {
      await realtyService.updateCorretorAtribuicao(r.id, { ativo: !r.ativo });
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const remover = async (id) => {
    try {
      await realtyService.deleteCorretorAtribuicao(id);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  if (loading) {
    return (
      <div className="corretores-loading">
        <Loader2 className="realty-spin" size={22} />
      </div>
    );
  }

  return (
    <div className="corretores-atribuicao">
      <div className="corretores-atribuicao__head">
        <div>
          <h3>Regras de atribuição automática</h3>
          <p>
            Novos leads (RadarZAP e captação) são atribuídos ao corretor com regra
            mais específica (bairro &gt; cidade) e menor carga aberta.
          </p>
        </div>
        <button
          type="button"
          className="realty-page__btn"
          onClick={() => {
            setForm(emptyForm());
            setOpen(true);
          }}
        >
          <Plus size={16} /> Nova regra
        </button>
      </div>

      {corretores.length === 0 && (
        <div className="realty-card corretores-empty">
          Cadastre corretores ativos na aba <b>Equipe</b> antes de criar regras.
        </div>
      )}

      <div className="corretores-atribuicao__grid">
        {corretores.map((c) => {
          const rs = porCorretor[String(c.id)] || [];
          return (
            <article key={c.id} className="realty-card corretores-regra-card">
              <header>
                <span>
                  <Users size={16} /> {c.nome}
                </span>
                <span className="realty-chip">{carga[c.id] ?? 0} abertos</span>
              </header>
              {rs.length === 0 ? (
                <p className="corretores-muted">
                  Sem regras — só recebe por fallback (menor carga).
                </p>
              ) : (
                rs.map((r) => (
                  <div key={r.id} className="corretores-regra-row">
                    <div>
                      <div className="corretores-regra-row__title">
                        <MapPin size={12} />
                        {[r.bairro, r.cidade].filter(Boolean).join(" · ") ||
                          "Curinga (qualquer área)"}
                      </div>
                      <div className="corretores-muted">
                        Prio {r.prioridade} · Peso {r.peso}
                      </div>
                    </div>
                    <div className="corretores-regra-row__actions">
                      <label className="corretores-switch">
                        <input
                          type="checkbox"
                          checked={!!r.ativo}
                          onChange={() => toggle(r)}
                        />
                        <span />
                      </label>
                      <button
                        type="button"
                        className="realty-page__btn realty-page__btn--ghost"
                        onClick={() => remover(r.id)}
                        aria-label="Remover regra"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </article>
          );
        })}
      </div>

      {open && (
        <div className="corretores-modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="corretores-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <h3>Nova regra de atribuição</h3>
            <div className="realty-form">
              <label>
                Corretor
                <select
                  value={form.corretor_id}
                  onChange={(e) => setForm({ ...form, corretor_id: e.target.value })}
                >
                  <option value="">Selecione o corretor</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="corretores-form-grid">
                <label>
                  Cidade
                  <input
                    placeholder="Ex.: Brasília"
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  />
                </label>
                <label>
                  Bairro
                  <input
                    placeholder="Ex.: Águas Claras"
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  />
                </label>
              </div>
              <div className="corretores-form-grid">
                <label>
                  Prioridade (menor = maior)
                  <input
                    type="number"
                    value={form.prioridade}
                    onChange={(e) =>
                      setForm({ ...form, prioridade: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Peso
                  <input
                    type="number"
                    min={1}
                    value={form.peso}
                    onChange={(e) => setForm({ ...form, peso: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label className="corretores-switch-row">
                <span className="corretores-switch">
                  <input
                    type="checkbox"
                    checked={form.ativo !== false}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  />
                  <span />
                </span>
                Regra ativa
              </label>
              <p className="corretores-muted">
                Deixe cidade/bairro em branco para uma regra &quot;curinga&quot; (recebe
                qualquer lead).
              </p>
            </div>
            <div className="corretores-modal__footer">
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="realty-page__btn"
                disabled={saving}
                onClick={salvar}
              >
                {saving ? <Loader2 className="realty-spin" size={16} /> : null} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtribuicaoTab;
