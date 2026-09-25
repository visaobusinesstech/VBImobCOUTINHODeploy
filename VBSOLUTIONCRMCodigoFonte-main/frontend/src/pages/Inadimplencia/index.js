/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 *
 * Inadimplência — paridade funcional Lovable /inadimplencia + design VBSolution.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  DollarSign,
  Clock,
  TrendingDown,
  Loader2,
  RefreshCw,
  FileText,
  Phone,
  MessageCircle,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { exportInadimplenciaPDF } from "../../lib/exportInadimplenciaPDF";
import {
  GRAVIDADE_OPTIONS,
  GRAVIDADE_CONFIG,
  INADIMPLENCIA_TABS,
  PIE_COLORS,
  formatCurrency,
  filterByGravidade,
  chartGravidadeData,
  chartValorPorGravidade,
  openWhatsApp,
  persistTab,
  loadTab,
} from "../../helpers/inadimplenciaCrm";

const Inadimplencia = () => {
  const [inadimplentes, setInadimplentes] = useState([]);
  const [contratosAtivos, setContratosAtivos] = useState(0);
  const [metrics, setMetrics] = useState({
    totalDivida: 0,
    totalInadimplentes: 0,
    taxaInadimplencia: "0",
    mediaAtraso: 0,
  });
  const [brand, setBrand] = useState({});
  const [loading, setLoading] = useState(true);
  const [filtroGravidade, setFiltroGravidade] = useState("todos");
  const [inadTab, setInadTab] = useState(() => loadTab("inadimplencia_active_tab", "lista"));
  const [gerandoAlertas, setGerandoAlertas] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await realtyService.getInadimplencia();
      setInadimplentes(data.inadimplentes || []);
      setContratosAtivos(data.contratosAtivos ?? data.metrics?.contratosAtivos ?? 0);
      setMetrics({
        totalDivida: data.metrics?.totalDivida ?? 0,
        totalInadimplentes: data.metrics?.totalInadimplentes ?? 0,
        taxaInadimplencia: data.metrics?.taxaInadimplencia ?? "0",
        mediaAtraso: data.metrics?.mediaAtraso ?? 0,
      });
      setBrand(data.brand || {});
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setTab = (id) => {
    setInadTab(id);
    persistTab("inadimplencia_active_tab", id);
  };

  const filtrados = useMemo(
    () => filterByGravidade(inadimplentes, filtroGravidade),
    [inadimplentes, filtroGravidade]
  );

  const gravidadeData = useMemo(() => chartGravidadeData(inadimplentes), [inadimplentes]);
  const valorPorGravidade = useMemo(() => chartValorPorGravidade(inadimplentes), [inadimplentes]);

  const handleExportPdf = () => {
    const ok = exportInadimplenciaPDF({
      inadimplentes,
      contratosAtivos,
      brandName: brand.nome_empresa,
      brandCreci: brand.creci,
      brandCnpj: brand.cnpj,
      brandTelefone: brand.telefone,
    });
    if (!ok) toast.error("Nenhum contrato inadimplente para exportar");
  };

  const handleGerarAlertas = async () => {
    setGerandoAlertas(true);
    try {
      const data = await realtyService.gerarAlertasInadimplencia();
      toast.success(`${data?.alertas_gerados ?? 0} alerta(s) de inadimplência gerado(s)!`);
    } catch (err) {
      toastError(err);
    } finally {
      setGerandoAlertas(false);
    }
  };

  const kpis = [
    {
      label: "Total em Atraso",
      value: formatCurrency(metrics.totalDivida),
      icon: DollarSign,
      color: "#dc2626",
    },
    {
      label: "Contratos Inadimplentes",
      value: (
        <>
          {metrics.totalInadimplentes}{" "}
          <span style={{ fontSize: 13, fontWeight: 500, color: "#737d8c" }}>
            de {contratosAtivos}
          </span>
        </>
      ),
      icon: FileText,
      color: "#f97316",
    },
    {
      label: "Taxa de Inadimplência",
      value: `${metrics.taxaInadimplencia}%`,
      icon: TrendingDown,
      color: "#ca8a04",
    },
    {
      label: "Média de Atraso",
      value: (
        <>
          {metrics.mediaAtraso}{" "}
          <span style={{ fontSize: 13, fontWeight: 500, color: "#737d8c" }}>dias</span>
        </>
      ),
      icon: Clock,
      color: "#ef4444",
    },
  ];

  return (
    <MainContainer>
      <div className="realty-page inad-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={22} color="#dc2626" />
              Relatório de Inadimplência
            </h1>
            <p className="realty-page__subtitle">
              Monitoramento de aluguéis atrasados e gestão de cobranças
            </p>
          </div>
          <div className="realty-page__toolbar" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className="realty-page__btn realty-page__btn--ghost"
              onClick={handleExportPdf}
              disabled={inadimplentes.length === 0}
            >
              <Download size={16} />
              Exportar PDF
            </button>
            <button
              type="button"
              className="realty-page__btn inad-btn--danger"
              onClick={handleGerarAlertas}
              disabled={gerandoAlertas}
            >
              {gerandoAlertas ? <Loader2 size={16} className="realty-spin" /> : <RefreshCw size={16} />}
              Gerar Alertas Automáticos
            </button>
          </div>
        </div>

        <div className="followup-kpi-grid">
          {kpis.map((item, i) => (
            <motion.div
              key={item.label}
              className="followup-kpi"
              style={{ cursor: "default" }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="followup-kpi__head">
                <item.icon size={16} style={{ color: item.color }} />
                {item.label}
              </div>
              <strong>{item.value}</strong>
            </motion.div>
          ))}
        </div>

        <div className="realty-tabs">
          {INADIMPLENCIA_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`realty-tab${inadTab === t.id ? " realty-tab--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {inadTab === "lista" && (
          <div className="inad-lista">
            <div className="inad-lista__filters">
              <label className="realty-filter-field">
                Gravidade
                <select
                  value={filtroGravidade}
                  onChange={(e) => setFiltroGravidade(e.target.value)}
                >
                  {GRAVIDADE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="inad-lista__count">{filtrados.length} registro(s)</span>
            </div>

            {loading ? (
              <div className="inad-empty" style={{ padding: 80 }}>
                <Loader2 className="realty-spin" size={32} />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="realty-card inad-empty">
                <div className="inad-empty__icon">
                  <DollarSign size={28} color="#22c55e" />
                </div>
                <h3>Tudo em dia!</h3>
                <p>Nenhum contrato de locação com atraso detectado.</p>
              </div>
            ) : (
              <div className="realty-list-card" style={{ overflowX: "auto" }}>
                <table className="inad-table">
                  <thead>
                    <tr>
                      <th>Gravidade</th>
                      <th>Contrato</th>
                      <th>Inquilino</th>
                      <th>Proprietário</th>
                      <th className="is-right">Aluguel</th>
                      <th className="is-center">Meses</th>
                      <th className="is-right">Dívida Total</th>
                      <th className="is-center">Dias Atraso</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((item) => {
                      const cfg = GRAVIDADE_CONFIG[item.status_gravidade] || GRAVIDADE_CONFIG.leve;
                      return (
                        <tr key={item.contrato_id}>
                          <td>
                            <span className={`inad-badge ${cfg.className}`}>{cfg.label}</span>
                          </td>
                          <td className="inad-table__titulo" title={item.titulo}>
                            {item.titulo}
                          </td>
                          <td>{item.inquilino}</td>
                          <td className="is-muted">{item.proprietario || "—"}</td>
                          <td className="is-right is-strong">{formatCurrency(item.valor_aluguel)}</td>
                          <td className="is-center">
                            <span className="inad-badge inad-badge--meses">{item.meses_atrasados}x</span>
                          </td>
                          <td className="is-right inad-table__divida">
                            {formatCurrency(item.valor_total_divida)}
                          </td>
                          <td className="is-center is-strong">{item.dias_atraso}d</td>
                          <td>
                            {item.inquilino_telefone ? (
                              <div className="inad-actions">
                                <button
                                  type="button"
                                  className="inad-action-btn"
                                  title="WhatsApp"
                                  onClick={() => openWhatsApp(item)}
                                >
                                  <MessageCircle size={16} color="#16a34a" />
                                </button>
                                <button
                                  type="button"
                                  className="inad-action-btn"
                                  title="Ligar"
                                  onClick={() =>
                                    window.open(`tel:${item.inquilino_telefone}`, "_blank")
                                  }
                                >
                                  <Phone size={16} color="#3b82f6" />
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {inadTab === "graficos" && (
          <div className="inad-charts">
            <div className="realty-card inad-chart-card">
              <h3>Distribuição por Gravidade</h3>
              {gravidadeData.length === 0 ? (
                <p className="inad-charts__empty">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={gravidadeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {gravidadeData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="realty-card inad-chart-card">
              <h3>Valor em Atraso por Gravidade</h3>
              {valorPorGravidade.length === 0 ? (
                <p className="inad-charts__empty">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={valorPorGravidade}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ee" />
                    <XAxis dataKey="name" tick={{ fill: "#737d8c", fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: "#737d8c", fontSize: 12 }}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), "Valor"]}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e2e6ee",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="valor" fill="#dc2626" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Inadimplencia;
