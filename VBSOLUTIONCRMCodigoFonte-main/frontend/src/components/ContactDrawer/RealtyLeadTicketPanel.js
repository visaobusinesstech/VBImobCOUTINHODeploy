/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Painel CRM imobiliário dentro do atendimento WhatsApp.
 */

import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Typography, Chip, TextField } from "@material-ui/core";
import leadsSalesService from "../../services/leadsSalesService";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const RealtyLeadTicketPanel = ({ contact, ticket }) => {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [followups, setFollowups] = useState([]);
  const [fuNotes, setFuNotes] = useState("");

  const loadLead = async () => {
    if (!contact?.id && !ticket?.id) return;
    setLoading(true);
    try {
      let found = null;
      if (contact?.id) {
        const data = await leadsSalesService.list({
          pageSize: 5,
          contactId: contact.id,
        });
        found = (data.leads || [])[0] || null;
      }
      if (!found && ticket?.id) {
        const data = await leadsSalesService.list({ pageSize: 80 });
        found = (data.leads || []).find((l) => Number(l.ticketId) === Number(ticket.id)) || null;
      }
      setLead(found);
      if (found?.id) {
        const fu = await realtyService.listFollowups({ pageSize: 50 });
        setFollowups(
          (fu.followups || [])
            .filter((f) => Number(f.leadSaleId) === Number(found.id))
            .slice(0, 3)
        );
      } else {
        setFollowups([]);
      }
    } catch (err) {
      setLead(null);
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id, ticket?.id]);

  const enviarMatch = async () => {
    if (!lead?.id) return;
    try {
      const data = await realtyService.sendMatchWhatsApp(lead.id);
      toast.success(data.sent ? "Imóveis enviados" : "Envio registrado");
    } catch (err) {
      toastError(err);
    }
  };

  const agendarFollowup = async () => {
    if (!lead?.id) return;
    try {
      await realtyService.createFollowup({
        leadSaleId: lead.id,
        type: "whatsapp",
        status: "pendente",
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ticketId: ticket?.id || lead.ticketId || null,
        notes: fuNotes || `Retorno estratégico do atendimento — ticket #${ticket?.id || "—"}`,
      });
      toast.success("Follow-up agendado para +24h");
      setFuNotes("");
      await loadLead();
    } catch (err) {
      toastError(err);
    }
  };

  if (loading) {
    return (
      <Box p={1}>
        <Typography variant="caption">Carregando CRM imobiliário…</Typography>
      </Box>
    );
  }

  if (!lead) {
    return (
      <Box p={1} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <Typography variant="subtitle2" gutterBottom>
          CRM Imobiliário
        </Typography>
        <Typography variant="caption" display="block" gutterBottom>
          Nenhum lead vinculado. Crie em Leads/Pipeline ou converta um lead de Landing.
        </Typography>
        <Button size="small" color="primary" component={RouterLink} to="/leads-sales">
          Abrir leads
        </Button>
        <Button size="small" component={RouterLink} to="/leads-landing">
          CRM Landing
        </Button>
      </Box>
    );
  }

  return (
    <Box p={1} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
      <Typography variant="subtitle2" gutterBottom>
        CRM Imobiliário · Atendimento
      </Typography>
      <Typography variant="body2">
        <strong>{lead.name}</strong>
      </Typography>
      <Box mt={0.5} mb={1} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <Chip size="small" label={lead.status || "novo"} />
        {lead.temperature ? <Chip size="small" label={lead.temperature} /> : null}
        {lead.interestCity ? <Chip size="small" label={lead.interestCity} /> : null}
      </Box>
      <Typography variant="caption" display="block">
        {lead.interestType || "—"} · {lead.bedrooms || "?"} qts · {lead.interestNeighborhood || "bairro —"}
      </Typography>
      {followups.length > 0 && (
        <Box mt={1} mb={1}>
          <Typography variant="caption" display="block" style={{ fontWeight: 600 }}>
            Follow-ups recentes
          </Typography>
          {followups.map((f) => (
            <Typography key={f.id} variant="caption" display="block">
              {f.type} · {f.status} ·{" "}
              {f.scheduledAt ? new Date(f.scheduledAt).toLocaleDateString("pt-BR") : "—"}
            </Typography>
          ))}
        </Box>
      )}
      <TextField
        size="small"
        fullWidth
        margin="dense"
        variant="outlined"
        label="Briefing do próximo retorno"
        value={fuNotes}
        onChange={(e) => setFuNotes(e.target.value)}
      />
      <Box mt={1} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Button size="small" color="primary" variant="contained" onClick={agendarFollowup}>
          Agendar follow-up (+24h)
        </Button>
        <Button size="small" color="primary" variant="outlined" onClick={enviarMatch}>
          Enviar imóveis (match)
        </Button>
        <Button size="small" component={RouterLink} to="/jornada">
          Ver jornada
        </Button>
        <Button size="small" component={RouterLink} to="/leads-sales">
          Pipeline
        </Button>
        <Button size="small" component={RouterLink} to="/followups">
          Todos follow-ups
        </Button>
      </Box>
    </Box>
  );
};

export default RealtyLeadTicketPanel;
