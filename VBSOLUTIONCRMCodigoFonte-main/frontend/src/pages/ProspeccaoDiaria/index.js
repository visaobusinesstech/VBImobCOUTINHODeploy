/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 *
 * Prospecção Diária — paridade visual/funcional com Lovable
 * (indicadores 30 dias, Registrar / Histórico / Rendimento).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Save,
  Trash2,
  TrendingUp,
  Home,
  Users,
  MessageCircle,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatBR = (iso) => {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
};

const formatChartLabel = (iso) => {
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}`;
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

const ProspeccaoDiaria = () => {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("registrar");

  const [data, setData] = useState(todayISO());
  const [aluguel, setAluguel] = useState(0);
  const [venda, setVenda] = useState(0);
  const [proprietarios, setProprietarios] = useState(0);
  const [leads, setLeads] = useState(0);
  const [obs, setObs] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await realtyService.listProspeccaoDiaria();
      setRegistros(res.registros || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const existing = useMemo(
    () => registros.find((r) => String(r.data).slice(0, 10) === data),
    [registros, data]
  );

  const loadExisting = useCallback(() => {
    const row = registros.find((r) => String(r.data).slice(0, 10) === data);
    if (row) {
      setAluguel(num(row.prospeccoesAluguel));
      setVenda(num(row.prospeccoesVenda));
      setProprietarios(num(row.proprietariosContatados));
      setLeads(num(row.leadsConversados));
      setObs(row.observacoes || "");
    } else {
      setAluguel(0);
      setVenda(0);
      setProprietarios(0);
      setLeads(0);
      setObs("");
    }
  }, [registros, data]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await realtyService.upsertProspeccaoDiaria({
        data,
        prospeccoesAluguel: num(aluguel),
        prospeccoesVenda: num(venda),
        proprietariosContatados: num(proprietarios),
        leadsConversados: num(leads),
        observacoes: obs,
      });
      toast.success("Prospecção salva com sucesso!");
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm("Remover este registro?")) return;
    try {
      await realtyService.deleteProspeccaoDiaria(id);
      toast.success("Registro removido");
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const chartData = useMemo(() => {
    return [...registros]
      .sort((a, b) =>
        String(a.data).slice(0, 10).localeCompare(String(b.data).slice(0, 10))
      )
      .slice(-14)
      .map((r) => ({
        data: formatChartLabel(r.data),
        Aluguel: num(r.prospeccoesAluguel),
        Venda: num(r.prospeccoesVenda),
        Proprietários: num(r.proprietariosContatados),
        Leads: num(r.leadsConversados),
      }));
  }, [registros]);

  const totals = useMemo(() => {
    const now = new Date();
    const last30 = registros.filter((r) => {
      const d = new Date(`${String(r.data).slice(0, 10)}T12:00:00`);
      return (now.getTime() - d.getTime()) / 86400000 <= 30;
    });
    return {
      aluguel: last30.reduce((s, r) => s + num(r.prospeccoesAluguel), 0),
      venda: last30.reduce((s, r) => s + num(r.prospeccoesVenda), 0),
      proprietarios: last30.reduce((s, r) => s + num(r.proprietariosContatados), 0),
      leads: last30.reduce((s, r) => s + num(r.leadsConversados), 0),
      dias: last30.length,
    };
  }, [registros]);

  const kpis = [
    {
      label: "Prospecções Aluguel",
      value: totals.aluguel,
      icon: Home,
      color: "#3b82f6",
    },
    {
      label: "Prospecções Venda",
      value: totals.venda,
      icon: Building2,
      color: "#10b981",
    },
    {
      label: "Proprietários",
      value: totals.proprietarios,
      icon: Users,
      color: "#f59e0b",
    },
    {
      label: "Leads Conversados",
      value: totals.leads,
      icon: MessageCircle,
      color: "#a855f7",
    },
  ];

  if (loading) {
    return (
      <MainContainer>
        <div className="realty-page" style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Loader2 className="realty-spin" size={32} />
        </div>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <div className="realty-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Prospecção Diária</h1>
            <p className="realty-page__subtitle">
              Registre e acompanhe suas atividades de prospecção
            </p>
          </div>
        </div>

        <div className="followup-kpi-grid">
          {kpis.map((item, i) => (
            <motion.div
              key={item.label}
              className="followup-kpi"
              style={{ cursor: "default" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="followup-kpi__head">
                <item.icon size={16} style={{ color: item.color }} />
                {item.label}
              </div>
              <strong>{item.value}</strong>
              <span>
                últimos 30 dias ({totals.dias} registros)
              </span>
            </motion.div>
          ))}
        </div>

        <div className="realty-tabs">
          {[
            { id: "registrar", label: "Registrar" },
            { id: "historico", label: "Histórico" },
            { id: "rendimento", label: "Rendimento" },
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

        {tab === "registrar" && (
          <div className="realty-card" style={{ padding: 20 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>
              Registro do Dia
            </h2>
            <div className="realty-form">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                <label style={{ flex: 1 }}>
                  Data
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    onBlur={loadExisting}
                  />
                </label>
                {existing && (
                  <span className="realty-chip" style={{ marginBottom: 4 }}>
                    Já registrado — editar
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                }}
              >
                <label>
                  Prospecções Aluguel
                  <input
                    type="number"
                    min={0}
                    value={aluguel}
                    onChange={(e) => setAluguel(num(e.target.value))}
                  />
                </label>
                <label>
                  Prospecções Venda
                  <input
                    type="number"
                    min={0}
                    value={venda}
                    onChange={(e) => setVenda(num(e.target.value))}
                  />
                </label>
                <label>
                  Proprietários Contatados
                  <input
                    type="number"
                    min={0}
                    value={proprietarios}
                    onChange={(e) => setProprietarios(num(e.target.value))}
                  />
                </label>
                <label>
                  Leads Conversados
                  <input
                    type="number"
                    min={0}
                    value={leads}
                    onChange={(e) => setLeads(num(e.target.value))}
                  />
                </label>
              </div>

              <label>
                Observações
                <textarea
                  rows={3}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Anotações do dia..."
                />
              </label>

              <div>
                <button
                  type="button"
                  className="realty-page__btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 size={16} className="realty-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "historico" && (
          <div className="realty-card" style={{ padding: 0, overflow: "auto" }}>
            <table className="prospeccao-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="prospeccao-table__center">Aluguel</th>
                  <th className="prospeccao-table__center">Venda</th>
                  <th className="prospeccao-table__center">Proprietários</th>
                  <th className="prospeccao-table__center">Leads</th>
                  <th className="prospeccao-table__center">Total</th>
                  <th>Obs</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 && (
                  <tr>
                    <td colSpan={8} className="realty-empty">
                      Nenhum registro ainda
                    </td>
                  </tr>
                )}
                {registros.map((r) => {
                  const a = num(r.prospeccoesAluguel);
                  const v = num(r.prospeccoesVenda);
                  const p = num(r.proprietariosContatados);
                  const l = num(r.leadsConversados);
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{formatBR(r.data)}</td>
                      <td className="prospeccao-table__center">{a}</td>
                      <td className="prospeccao-table__center">{v}</td>
                      <td className="prospeccao-table__center">{p}</td>
                      <td className="prospeccao-table__center">{l}</td>
                      <td className="prospeccao-table__center" style={{ fontWeight: 700 }}>
                        {a + v + p + l}
                      </td>
                      <td
                        style={{
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 12,
                          color: "#737d8c",
                        }}
                      >
                        {r.observacoes || "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="realty-page__btn realty-page__btn--ghost"
                          style={{ padding: 6 }}
                          onClick={() => handleRemove(r.id)}
                          title="Remover"
                        >
                          <Trash2 size={14} style={{ color: "#dc2626" }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "rendimento" && (
          <div className="realty-card" style={{ padding: 20 }}>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: 17,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TrendingUp size={20} style={{ color: "#2673d9" }} />
              Rendimento — Últimos 14 dias
            </h2>
            {chartData.length === 0 ? (
              <p className="realty-empty">
                Registre prospecções para ver o gráfico
              </p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="data" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Aluguel" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Venda" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Proprietários" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Leads" fill="hsl(270, 70%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default ProspeccaoDiaria;
