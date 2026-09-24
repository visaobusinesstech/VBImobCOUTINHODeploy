/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * Painel CRM imobiliário dentro do atendimento WhatsApp.
 */

import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Typography, Chip } from "@material-ui/core";
import leadsSalesService from "../../services/leadsSalesService";
import realtyService from "../../services/realtyService";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const RealtyLeadTicketPanel = ({ contact, ticket }) => {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
          const data = await leadsSalesService.list({ pageSize: 50 });
          found = (data.leads || []).find((l) => Number(l.ticketId) === Number(ticket.id)) || null;
        }
        if (!cancelled) setLead(found);
      } catch (err) {
        if (!cancelled) setLead(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
          Nenhum lead vinculado a este contato. Crie em Leads e Vendas ou Pipeline.
        </Typography>
        <Button size="small" color="primary" component={RouterLink} to="/leads-sales">
          Abrir leads
        </Button>
      </Box>
    );
  }

  return (
    <Box p={1} style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
      <Typography variant="subtitle2" gutterBottom>
        CRM Imobiliário
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
      <Box mt={1} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Button size="small" color="primary" variant="outlined" onClick={enviarMatch}>
          Enviar imóveis (match)
        </Button>
        <Button size="small" component={RouterLink} to={`/jornada`}>
          Ver jornada
        </Button>
        <Button size="small" component={RouterLink} to="/pipeline">
          Pipeline
        </Button>
        <Button size="small" component={RouterLink} to="/followups">
          Follow-ups
        </Button>
      </Box>
    </Box>
  );
};

export default RealtyLeadTicketPanel;
