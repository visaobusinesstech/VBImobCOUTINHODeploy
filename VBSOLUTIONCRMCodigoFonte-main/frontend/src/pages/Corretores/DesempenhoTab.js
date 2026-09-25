/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Tab Desempenho — ranking, KPIs e gráficos (paridade Lovable CorretorDesempenhoTab).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Medal,
  Star,
  Flame,
  Target,
  ChevronDown,
  ChevronUp,
  DollarSign,
  MapPin,
  Users,
  FileSignature,
  TrendingUp,
  BarChart3,
  Eye,
  Zap,
  Award,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import {
  CORRETOR_PONTOS,
  CORRETOR_METAS,
  CORRETOR_PERIODOS,
  fmtCur,
  initials,
} from "../../helpers/corretoresParity";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

const RANK_CONFIGS = [
  { icon: Trophy, color: "#eab308" },
  { icon: Medal, color: "#9ca3af" },
  { icon: Medal, color: "#b45309" },
];

const DesempenhoTab = () => {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30");
  const [corretorSelecionado, setCorretorSelecionado] = useState("todos");
  const [expanded, setExpanded] = useState(false);
  const [corretoresDesempenho, setCorretoresDesempenho] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await realtyService.getCorretoresDesempenho(periodo);
      setCorretoresDesempenho(res.corretores || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (corretorSelecionado === "todos") return corretoresDesempenho;
    return corretoresDesempenho.filter((c) => c.id === corretorSelecionado);
  }, [corretoresDesempenho, corretorSelecionado]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, c) => ({
          visitas: acc.visitas + c.visitas,
          reunioes: acc.reunioes + c.reunioes,
          leads: acc.leads + c.leadsAtribuidos,
          fechados: acc.fechados + c.leadsFechados,
          contratos: acc.contratos + c.contratos,
          valorContratos: acc.valorContratos + c.valorContratos,
          comissao: acc.comissao + c.comissaoAcumulada,
        }),
        {
          visitas: 0,
          reunioes: 0,
          leads: 0,
          fechados: 0,
          contratos: 0,
          valorContratos: 0,
          comissao: 0,
        }
      ),
    [filtered]
  );

  const taxaGeral =
    totals.leads > 0 ? ((totals.fechados / totals.leads) * 100).toFixed(1) : "0";
  const maxPts = Math.max(...corretoresDesempenho.map((r) => r.pontuacao), 1);
  const visible = expanded ? corretoresDesempenho : corretoresDesempenho.slice(0, 5);

  const barData = filtered.map((c) => ({
    nome: String(c.nome || "").split(" ")[0],
    Visitas: c.visitas,
    Reuniões: c.reunioes,
    Fechamentos: c.leadsFechados,
    Contratos: c.contratos,
  }));

  const comissaoData = filtered.map((c) => ({
    nome: String(c.nome || "").split(" ")[0],
    Comissão: c.comissaoAcumulada,
    "Valor Contratos": c.valorContratos,
  }));

  const radarData = corretoresDesempenho.slice(0, 5);
  const radarChartData = [
    {
      subject: "Visitas",
      ...Object.fromEntries(radarData.map((r) => [String(r.nome).split(" ")[0], r.visitas])),
    },
    {
      subject: "Reuniões",
      ...Object.fromEntries(radarData.map((r) => [String(r.nome).split(" ")[0], r.reunioes])),
    },
    {
      subject: "Contratos",
      ...Object.fromEntries(radarData.map((r) => [String(r.nome).split(" ")[0], r.contratos])),
    },
    {
      subject: "Conversão",
      ...Object.fromEntries(
        radarData.map((r) => [String(r.nome).split(" ")[0], Math.round(r.taxaConversao)])
      ),
    },
    {
      subject: "Leads",
      ...Object.fromEntries(
        radarData.map((r) => [String(r.nome).split(" ")[0], r.leadsAtribuidos])
      ),
    },
  ];

  if (loading) {
    return (
      <div className="corretores-loading">
        <Loader2 className="realty-spin" size={28} />
      </div>
    );
  }

  if (corretoresDesempenho.length === 0) {
    return (
      <div className="realty-card corretores-empty">
        <Users size={40} />
        <p>Nenhum corretor ativo encontrado.</p>
        <span>Cadastre corretores na aba &quot;Equipe&quot; para ver o desempenho.</span>
      </div>
    );
  }

  const selectedCorretor =
    corretorSelecionado !== "todos"
      ? corretoresDesempenho.find((c) => c.id === corretorSelecionado)
      : null;

  return (
    <div className="corretores-desempenho">
      <div className="corretores-filters">
        <select
          className="realty-page__select"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
        >
          {CORRETOR_PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          className="realty-page__select"
          value={corretorSelecionado}
          onChange={(e) => setCorretorSelecionado(e.target.value)}
        >
          <option value="todos">Todos os corretores</option>
          {corretoresDesempenho.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="followup-kpi-grid">
        {[
          { label: "Visitas Realizadas", value: totals.visitas, icon: MapPin },
          { label: "Leads Convertidos", value: totals.fechados, icon: Zap },
          { label: "Contratos Fechados", value: totals.contratos, icon: FileSignature },
          { label: "Taxa Conversão", value: `${taxaGeral}%`, icon: Target },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            className="followup-kpi"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <div className="followup-kpi__head">
              <item.icon size={14} /> {item.label}
            </div>
            <strong>{item.value}</strong>
          </motion.div>
        ))}
      </div>
      <div className="followup-kpi-grid" style={{ marginTop: 12 }}>
        {[
          { label: "Comissão Acumulada", value: fmtCur(totals.comissao), icon: DollarSign },
          { label: "Valor em Contratos", value: fmtCur(totals.valorContratos), icon: TrendingUp },
          { label: "Total de Leads", value: totals.leads, icon: Users },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            className="followup-kpi"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.04 }}
          >
            <div className="followup-kpi__head">
              <item.icon size={14} /> {item.label}
            </div>
            <strong>{item.value}</strong>
          </motion.div>
        ))}
      </div>

      {selectedCorretor && (
        <motion.div
          className="realty-card corretores-detail"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3>
            <Eye size={18} /> Detalhes — {selectedCorretor.nome}
          </h3>
          <div className="corretores-detail__grid">
            {[
              { label: "Leads Atribuídos", value: selectedCorretor.leadsAtribuidos },
              { label: "Leads Novos", value: selectedCorretor.leadsNovos },
              { label: "Leads Convertidos", value: selectedCorretor.leadsFechados },
              {
                label: "Taxa de Conversão",
                value: `${Number(selectedCorretor.taxaConversao || 0).toFixed(1)}%`,
              },
              { label: "Visitas", value: selectedCorretor.visitas },
              { label: "Reuniões", value: selectedCorretor.reunioes },
              { label: "Contratos", value: selectedCorretor.contratos },
              { label: "Comissão", value: fmtCur(selectedCorretor.comissaoAcumulada) },
            ].map((item) => (
              <div key={item.label} className="corretores-stat">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="corretores-metas">
            <p>Progresso de Metas</p>
            {[
              {
                label: "Visitas",
                current: selectedCorretor.visitas,
                goal: CORRETOR_METAS.visitas,
              },
              {
                label: "Conversões",
                current: selectedCorretor.leadsFechados,
                goal: CORRETOR_METAS.conversoes,
              },
              {
                label: "Contratos",
                current: selectedCorretor.contratos,
                goal: CORRETOR_METAS.contratos,
              },
            ].map((meta) => {
              const pct = Math.min(100, Math.round((meta.current / meta.goal) * 100));
              return (
                <div key={meta.label} className="corretores-meta">
                  <div className="corretores-meta__head">
                    <span>{meta.label}</span>
                    <span>
                      {meta.current}/{meta.goal} ({pct}%)
                    </span>
                  </div>
                  <div className="corretores-progress">
                    <div style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="realty-card corretores-ranking">
        <header>
          <h3>
            <Flame size={18} /> Ranking de Desempenho
            <span className="realty-chip">
              {periodo === "30"
                ? "Este mês"
                : periodo === "7"
                  ? "7 dias"
                  : periodo === "90"
                    ? "90 dias"
                    : "Ano"}
            </span>
          </h3>
          <span className="corretores-muted">
            Fech={CORRETOR_PONTOS.fechamento}pt · Contr={CORRETOR_PONTOS.contrato}pt ·
            Visita={CORRETOR_PONTOS.visita}pt
          </span>
        </header>
        <AnimatePresence>
          {visible.map((corretor, i) => {
            const progressPct = Math.max((corretor.pontuacao / maxPts) * 100, 5);
            const rankCfg = RANK_CONFIGS[i] || null;
            const RankIcon = rankCfg?.icon || Star;
            return (
              <motion.button
                type="button"
                key={corretor.id}
                className={`corretores-rank-row${
                  corretorSelecionado === corretor.id ? " is-active" : ""
                }`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() =>
                  setCorretorSelecionado(
                    corretorSelecionado === corretor.id ? "todos" : corretor.id
                  )
                }
              >
                <RankIcon size={18} style={{ color: rankCfg?.color || "#94a3b8" }} />
                <div className="corretores-rank-row__body">
                  <div className="corretores-rank-row__top">
                    <strong>{corretor.nome}</strong>
                    <span>{corretor.pontuacao}pts</span>
                  </div>
                  <div className="corretores-rank-row__meta">
                    <span>{corretor.visitas} visitas</span>
                    <span>{corretor.leadsFechados} conv.</span>
                    <span>{corretor.contratos} contr.</span>
                    {corretor.comissaoAcumulada > 0 && (
                      <span>{fmtCur(corretor.comissaoAcumulada)}</span>
                    )}
                    <span>{Number(corretor.taxaConversao || 0).toFixed(0)}%</span>
                  </div>
                  <div className="corretores-progress">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.6, delay: 0.05 + i * 0.05 }}
                    />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
        {corretoresDesempenho.length > 5 && (
          <button
            type="button"
            className="corretores-expand"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? "Ver menos" : `Ver todos (${corretoresDesempenho.length})`}
          </button>
        )}
      </div>

      <div className="corretores-charts">
        <div className="realty-card">
          <h3>
            <BarChart3 size={16} /> Atividades por Corretor
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Visitas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Reuniões" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Fechamentos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Contratos" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="corretores-empty-chart">Nenhuma atividade no período</div>
          )}
        </div>
        <div className="realty-card">
          <h3>
            <DollarSign size={16} /> Comissões Acumuladas
          </h3>
          {comissaoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={comissaoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v) => fmtCur(v)} />
                <Legend />
                <Bar dataKey="Comissão" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="Valor Contratos"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  opacity={0.5}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="corretores-empty-chart">Nenhuma comissão no período</div>
          )}
        </div>
      </div>

      {radarData.length > 1 && (
        <div className="realty-card">
          <h3>
            <Award size={16} /> Comparativo de Competências
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarChartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} />
              {radarData.map((r, i) => (
                <Radar
                  key={r.id}
                  name={String(r.nome).split(" ")[0]}
                  dataKey={String(r.nome).split(" ")[0]}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              ))}
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {corretorSelecionado === "todos" && (
        <div>
          <h3 className="corretores-section-title">
            <Users size={16} /> Fichas Individuais
          </h3>
          <div className="corretores-fichas">
            {corretoresDesempenho.map((c, i) => (
              <motion.button
                type="button"
                key={c.id}
                className="realty-card corretores-ficha"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setCorretorSelecionado(c.id)}
              >
                <div className="corretores-ficha__head">
                  <div className="corretores-avatar">{initials(c.nome)}</div>
                  <div>
                    <strong>
                      {c.nome} <span className="realty-chip">{i + 1}º</span>
                    </strong>
                    <span className="corretores-muted">{c.pontuacao} pts</span>
                  </div>
                </div>
                <div className="corretores-ficha__stats">
                  <div>
                    <strong>{c.visitas}</strong>
                    <span>Visitas</span>
                  </div>
                  <div>
                    <strong>{c.leadsFechados}</strong>
                    <span>Convertidos</span>
                  </div>
                  <div>
                    <strong>{c.contratos}</strong>
                    <span>Contratos</span>
                  </div>
                  <div>
                    <strong>{fmtCur(c.comissaoAcumulada)}</strong>
                    <span>Comissão</span>
                  </div>
                </div>
                <div className="corretores-meta">
                  <div className="corretores-meta__head">
                    <span>Conversão</span>
                    <span>{Number(c.taxaConversao || 0).toFixed(0)}%</span>
                  </div>
                  <div className="corretores-progress">
                    <div style={{ width: `${Math.min(c.taxaConversao, 100)}%` }} />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DesempenhoTab;
