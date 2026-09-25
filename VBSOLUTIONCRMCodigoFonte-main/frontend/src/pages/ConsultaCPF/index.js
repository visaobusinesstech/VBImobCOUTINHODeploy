/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Página Consulta CPF — paridade funcional Lovable ConsultaCPFWidget + design VBSolution.
 */

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Gavel,
  Home,
  Loader2,
  MessageCircle,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  User,
  XCircle,
} from "lucide-react";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import {
  CONSULTA_CPF_UI,
  buildScoreTips,
  buildWhatsAppScoreMessage,
  formatCurrencyBRL,
  formatCpfMask,
  formatDateBR,
  isValidCpfDigits,
  normalizeRestrictions,
  providerIcon,
  riskLabel,
  scoreBarPercent,
  scoreTone,
  digitsOnly,
} from "../../helpers/consultaCpfParity";
import "./consulta-cpf.css";

const ScoreBar = ({ score, label }) => {
  const tone = scoreTone(score);
  const pct = scoreBarPercent(score);
  return (
    <div>
      <div className="consulta-cpf-score-row">
        <span>{label}</span>
        <span className={`tone-${tone}`}>{score}</span>
      </div>
      <div className="consulta-cpf-score-bar">
        <div
          className={`consulta-cpf-score-bar__fill consulta-cpf-score-bar__fill--${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const ConsultaCPF = () => {
  const [cpf, setCpf] = useState("");
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const cleanCpf = digitsOnly(cpf);
  const isValid = isValidCpfDigits(cleanCpf);

  const allRestrictions = useMemo(
    () => normalizeRestrictions(result?.restrictions),
    [result]
  );
  const hasRestrictions = allRestrictions.length > 0;
  const tips = useMemo(
    () => (result && !result.error && !hasRestrictions && result.score != null
      ? buildScoreTips(result.score)
      : []),
    [result, hasRestrictions]
  );

  const handleConsultar = async () => {
    if (!isValid) {
      toast.error("CPF inválido — digite um CPF com 11 dígitos.");
      return;
    }
    if (!lgpdConsent) {
      toast.error("Marque o consentimento antes de consultar.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await realtyService.creditCheckConsultaCpf({
        cpf: cleanCpf,
        lgpdConsent: true,
      });
      if (data?.error) {
        setResult({ error: data.error });
      } else {
        setResult(data);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Erro ao processar consulta de crédito.";
      setResult({ error: msg });
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!result || result.error) return;
    const { exportConsultaCPFPDF } = await import("../../helpers/exportConsultaCPFPDF");
    await exportConsultaCPFPDF(result);
  };

  const handleWhatsApp = () => {
    const phone = window.prompt("Telefone do cliente (com DDD):");
    if (!phone) return;
    const msg = buildWhatsAppScoreMessage(result.score);
    const cleanPhone = digitsOnly(phone);
    window.open(
      `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
    toast.success("WhatsApp aberto — mensagem com dicas de score preparada.");
  };

  const handleAgendar = () => {
    const dias = window.prompt("Reconsultar em quantos dias? (30, 60 ou 90)", "30");
    if (!dias) return;
    const numDias = parseInt(dias, 10) || 30;
    const dataReconsulta = new Date(Date.now() + numDias * 86400000);
    toast.success(
      `Reconsulta agendada: CPF ${result.cpfMasked} em ${dataReconsulta.toLocaleDateString(
        "pt-BR"
      )} (${numDias} dias).`
    );
  };

  return (
    <MainContainer>
      <div className="realty-page consulta-cpf-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title">Consulta de CPF</h1>
            <p className="realty-page__subtitle">
              Consulta cadastral SPC, Boa Vista e Serasa vinculada a proprietários e leads.
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="consulta-cpf-card"
        >
          <div className="consulta-cpf-card__head">
            <div className="consulta-cpf-card__icon">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="consulta-cpf-card__title">{CONSULTA_CPF_UI.title}</h3>
              <p className="consulta-cpf-card__sub">
                SPC Brasil • Boa Vista SCPC <span>• Serasa (em breve)</span>
              </p>
            </div>
          </div>

          <div className="consulta-cpf-form-row">
            <div className="consulta-cpf-input-wrap">
              <User size={16} />
              <input
                className="consulta-cpf-input"
                placeholder={CONSULTA_CPF_UI.cpfPlaceholder}
                value={cpf}
                onChange={(e) => setCpf(formatCpfMask(e.target.value))}
                maxLength={14}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="realty-page__btn"
              onClick={handleConsultar}
              disabled={loading || !isValid || !lgpdConsent}
            >
              {loading ? <Loader2 size={16} className="realty-spin" /> : <Search size={16} />}
              {CONSULTA_CPF_UI.consultButton}
            </button>
          </div>

          <label className="consulta-cpf-lgpd">
            <input
              type="checkbox"
              checked={lgpdConsent}
              onChange={(e) => setLgpdConsent(e.target.checked)}
            />
            <span>{CONSULTA_CPF_UI.lgpdLabel}</span>
          </label>

          {result && !result.error && (
            <div>
              <div
                className={`consulta-cpf-banner ${
                  hasRestrictions ? "consulta-cpf-banner--danger" : "consulta-cpf-banner--ok"
                }`}
                style={{ marginTop: 12 }}
              >
                {hasRestrictions ? (
                  <XCircle size={32} color="#dc2626" style={{ flexShrink: 0 }} />
                ) : (
                  <CheckCircle size={32} color="#16a34a" style={{ flexShrink: 0 }} />
                )}
                <div style={{ paddingRight: 110 }}>
                  <p className="consulta-cpf-banner__label">Tem restrição?</p>
                  <p
                    className={`consulta-cpf-banner__value ${
                      hasRestrictions
                        ? "consulta-cpf-banner__value--danger"
                        : "consulta-cpf-banner__value--ok"
                    }`}
                  >
                    {hasRestrictions ? "SIM, CPF COM RESTRIÇÃO" : "NÃO, CPF SEM RESTRIÇÃO"}
                  </p>
                </div>
                <button
                  type="button"
                  className="consulta-cpf-pdf-btn"
                  onClick={handleExportPdf}
                  title="Exportar PDF para mostrar ao cliente"
                >
                  <Download size={14} />
                  Exportar PDF
                </button>
              </div>

              <div className="consulta-cpf-section">
                <div className="consulta-cpf-section__head">
                  <p className="consulta-cpf-section__title" style={{ textTransform: "none", fontSize: 12 }}>
                    Score Consolidado
                  </p>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span
                      className={`consulta-cpf-chip ${
                        result.riskLevel === "baixo"
                          ? "consulta-cpf-chip--ok"
                          : result.riskLevel === "moderado"
                            ? ""
                            : "consulta-cpf-chip--danger"
                      }`}
                    >
                      {riskLabel(result.riskLevel)}
                    </span>
                  </div>
                </div>
                <ScoreBar score={result.score || 0} label="Score geral" />
              </div>

              {result.results?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p className="consulta-cpf-section__title">Resultado por Bureau</p>
                  {result.results.map((r, i) => {
                    const provHas = (r.restrictions?.length || 0) > 0;
                    return (
                      <div
                        key={`${r.provider}-${i}`}
                        className={`consulta-cpf-bureau ${
                          provHas ? "consulta-cpf-bureau--danger" : "consulta-cpf-bureau--ok"
                        }`}
                      >
                        <div className="consulta-cpf-bureau__top">
                          <div className="consulta-cpf-bureau__name">
                            <span>{providerIcon(r.provider)}</span>
                            {r.provider}
                          </div>
                          <span
                            className={`consulta-cpf-chip ${
                              provHas ? "consulta-cpf-chip--danger" : "consulta-cpf-chip--ok"
                            }`}
                          >
                            {provHas ? "Com Restrição" : "Sem Restrição"}
                          </span>
                        </div>
                        <div className="consulta-cpf-bureau-grid">
                          <div className="consulta-cpf-mini">
                            <p className="consulta-cpf-mini__label">Score</p>
                            <p
                              className={`consulta-cpf-mini__value tone-${scoreTone(r.score)}`}
                              style={{
                                color:
                                  scoreTone(r.score) === "success"
                                    ? "#16a34a"
                                    : scoreTone(r.score) === "warning"
                                      ? "#d97706"
                                      : "#dc2626",
                              }}
                            >
                              {r.score}
                            </p>
                            <ScoreBar score={r.score} label="" />
                          </div>
                          <div
                            className="consulta-cpf-mini"
                            style={{
                              background: provHas
                                ? "rgba(220,38,38,0.06)"
                                : "rgba(22,163,74,0.06)",
                              borderColor: provHas
                                ? "rgba(220,38,38,0.18)"
                                : "rgba(22,163,74,0.18)",
                            }}
                          >
                            <p className="consulta-cpf-mini__label">Status</p>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginTop: 4,
                              }}
                            >
                              {provHas ? (
                                <XCircle size={18} color="#dc2626" />
                              ) : (
                                <CheckCircle size={18} color="#16a34a" />
                              )}
                              <strong
                                style={{
                                  fontSize: 13,
                                  color: provHas ? "#dc2626" : "#16a34a",
                                }}
                              >
                                {provHas ? "RESTRIÇÃO" : "LIMPO"}
                              </strong>
                            </div>
                            <p style={{ margin: "4px 0 0", fontSize: 10, color: "#737d8c" }}>
                              {provHas
                                ? `${r.restrictions.length} pendência(s)`
                                : "Nenhuma pendência"}
                            </p>
                          </div>
                        </div>
                        {provHas && (
                          <div className="consulta-cpf-pendencias">
                            <p>Pendências:</p>
                            <ul>
                              {r.restrictions.map((rest, j) => (
                                <li key={j}>
                                  {typeof rest === "string" ? rest : rest.descricao}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {allRestrictions.length > 0 && (
                <div
                  className="consulta-cpf-section"
                  style={{
                    borderColor: "rgba(220,38,38,0.2)",
                    background: "rgba(220,38,38,0.04)",
                  }}
                >
                  <p
                    className="consulta-cpf-section__title"
                    style={{ color: "#dc2626", textTransform: "none", fontSize: 12 }}
                  >
                    <ShieldAlert size={14} /> Todas as restrições encontradas
                  </p>
                  {allRestrictions.map((r, i) => (
                    <div key={i} className="consulta-cpf-detail">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <p className="consulta-cpf-detail__title">{r.descricao}</p>
                        {r.valor > 0 && (
                          <strong style={{ fontSize: 12, color: "#dc2626", whiteSpace: "nowrap" }}>
                            {formatCurrencyBRL(r.valor)}
                          </strong>
                        )}
                      </div>
                      <div className="consulta-cpf-detail-grid consulta-cpf-detail-grid--3">
                        {r.credor ? (
                          <div>
                            <p className="lbl">Credor</p>
                            <p className="val">{r.credor}</p>
                          </div>
                        ) : null}
                        {r.cidade ? (
                          <div>
                            <p className="lbl">Local</p>
                            <p className="val">
                              {r.cidade}
                              {r.uf ? ` - ${r.uf}` : ""}
                            </p>
                          </div>
                        ) : null}
                        {r.data ? (
                          <div>
                            <p className="lbl">Data</p>
                            <p className="val">{formatDateBR(r.data)}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="consulta-cpf-section">
                <p className="consulta-cpf-section__title">
                  <Home size={14} color="#2673d9" /> Histórico de Despejo
                </p>
                {result.despejos?.length > 0 ? (
                  result.despejos.map((d, i) => (
                    <div
                      key={i}
                      className="consulta-cpf-detail"
                      style={{ background: "rgba(220,38,38,0.04)" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <p className="consulta-cpf-detail__title">{d.tipo}</p>
                        <span className="consulta-cpf-chip consulta-cpf-chip--danger">
                          {d.status}
                        </span>
                      </div>
                      <div className="consulta-cpf-detail-grid consulta-cpf-detail-grid--3">
                        <div>
                          <p className="lbl">Vara</p>
                          <p className="val">{d.vara}</p>
                        </div>
                        <div>
                          <p className="lbl">Comarca</p>
                          <p className="val">
                            {d.comarca} - {d.uf}
                          </p>
                        </div>
                        <div>
                          <p className="lbl">Data</p>
                          <p className="val">{formatDateBR(d.data)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="consulta-cpf-empty-ok">
                    <CheckCircle size={16} /> Nenhum registro de despejo encontrado
                  </div>
                )}
              </div>

              <div className="consulta-cpf-section">
                <p className="consulta-cpf-section__title">
                  <Scale size={14} color="#2673d9" /> Processos Cíveis
                </p>
                {result.processosCivis?.length > 0 ? (
                  result.processosCivis.map((p, i) => (
                    <div
                      key={i}
                      className="consulta-cpf-detail"
                      style={{
                        borderColor: "rgba(217,119,6,0.3)",
                        background: "rgba(217,119,6,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <p className="consulta-cpf-detail__title" style={{ color: "#d97706" }}>
                          {p.tipo}
                        </p>
                        <span className="consulta-cpf-chip">{p.status}</span>
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 10, fontFamily: "monospace", color: "#737d8c" }}>
                        {p.numero}
                      </p>
                      <div className="consulta-cpf-detail-grid consulta-cpf-detail-grid--4">
                        <div>
                          <p className="lbl">Natureza</p>
                          <p className="val">{p.natureza}</p>
                        </div>
                        <div>
                          <p className="lbl">Vara</p>
                          <p className="val">{p.vara}</p>
                        </div>
                        <div>
                          <p className="lbl">Comarca</p>
                          <p className="val">
                            {p.comarca} - {p.uf}
                          </p>
                        </div>
                        <div>
                          <p className="lbl">Data</p>
                          <p className="val">{formatDateBR(p.data)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="consulta-cpf-empty-ok">
                    <CheckCircle size={16} /> Nenhum processo cível encontrado
                  </div>
                )}
              </div>

              <div className="consulta-cpf-section">
                <p className="consulta-cpf-section__title">
                  <Gavel size={14} color="#2673d9" /> Antecedentes Criminais
                </p>
                {result.processosCriminais?.length > 0 ? (
                  result.processosCriminais.map((p, i) => (
                    <div
                      key={i}
                      className="consulta-cpf-detail"
                      style={{ background: "rgba(220,38,38,0.04)" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <p className="consulta-cpf-detail__title">{p.tipo}</p>
                        <span className="consulta-cpf-chip consulta-cpf-chip--danger">
                          {p.status}
                        </span>
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 10, fontFamily: "monospace", color: "#737d8c" }}>
                        {p.numero}
                      </p>
                      <div className="consulta-cpf-detail-grid consulta-cpf-detail-grid--4">
                        <div>
                          <p className="lbl">Natureza</p>
                          <p className="val">{p.natureza}</p>
                        </div>
                        <div>
                          <p className="lbl">Vara</p>
                          <p className="val">{p.vara}</p>
                        </div>
                        <div>
                          <p className="lbl">Comarca</p>
                          <p className="val">
                            {p.comarca} - {p.uf}
                          </p>
                        </div>
                        <div>
                          <p className="lbl">Data</p>
                          <p className="val">{formatDateBR(p.data)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="consulta-cpf-empty-ok">
                    <CheckCircle size={16} /> Nenhum antecedente criminal encontrado
                  </div>
                )}
              </div>

              {!hasRestrictions && result.score != null && (
                <div className="consulta-cpf-tips">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 4,
                    }}
                  >
                    <div className="consulta-cpf-card__icon" style={{ width: 32, height: 32 }}>
                      <TrendingUp size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#2b3340" }}>
                        Como Aumentar o Score
                      </p>
                      <p style={{ margin: 0, fontSize: 10, color: "#737d8c" }}>
                        Dicas personalizadas para o perfil consultado
                      </p>
                    </div>
                    <span className="consulta-cpf-chip consulta-cpf-chip--primary">
                      Score: {result.score}
                    </span>
                  </div>

                  {tips.map((t, i) => (
                    <div
                      key={i}
                      className={`consulta-cpf-tip${t.kind === "ok" ? " consulta-cpf-tip--ok" : ""}`}
                    >
                      {t.kind === "ok" ? (
                        <CheckCircle size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <Sparkles size={16} color="#2673d9" style={{ flexShrink: 0, marginTop: 2 }} />
                      )}
                      <div>
                        <h4 style={t.kind === "ok" ? { color: "#16a34a" } : undefined}>{t.title}</h4>
                        <p>{t.body}</p>
                      </div>
                    </div>
                  ))}

                  <div className="consulta-cpf-actions">
                    <button
                      type="button"
                      className="consulta-cpf-action consulta-cpf-action--primary"
                      onClick={async () => {
                        await handleExportPdf();
                        toast.success("PDF gerado — plano de ação exportado.");
                      }}
                    >
                      <FileText size={16} /> Exportar Plano PDF
                    </button>
                    <button
                      type="button"
                      className="consulta-cpf-action consulta-cpf-action--ok"
                      onClick={handleWhatsApp}
                    >
                      <MessageCircle size={16} /> Enviar via WhatsApp
                    </button>
                    <button
                      type="button"
                      className="consulta-cpf-action consulta-cpf-action--ghost"
                      onClick={handleAgendar}
                    >
                      <CalendarClock size={16} /> Agendar Reconsulta
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 8,
                      borderRadius: 10,
                      background: "#f7f9fc",
                      border: "1px solid #e2e6ee",
                      textAlign: "center",
                      fontSize: 10,
                      color: "#737d8c",
                    }}
                  >
                    Tempo médio para aumento de score:{" "}
                    <strong style={{ color: "#2b3340" }}>30 a 90 dias</strong> após adotar as
                    práticas acima.
                  </div>
                </div>
              )}

              {result.consultedAt && (
                <p className="consulta-cpf-footer-meta">
                  <Clock size={12} />
                  Consultado em: {new Date(result.consultedAt).toLocaleString("pt-BR")}
                  {result.cpfMasked && <span>CPF: {result.cpfMasked}</span>}
                </p>
              )}
            </div>
          )}

          {result?.error && (
            <div className="consulta-cpf-error">
              <XCircle size={16} />
              {result.error}
            </div>
          )}
        </motion.div>
      </div>
    </MainContainer>
  );
};

export default ConsultaCPF;
