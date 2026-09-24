/**
 * Campos estratégicos dos sistemas legados (Radar + Coutinho)
 * persistidos em realty_modulos.payload via packPayload.
 */

import React from "react";

const select = (name, label, options, defaultValue) => ({
  name,
  label,
  type: "select",
  defaultValue: defaultValue != null ? defaultValue : options[0]?.value || "",
  options: options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
});

const bool = (name, label, defaultValue = "false") =>
  select(name, label, [
    { value: "true", label: "Sim" },
    { value: "false", label: "Não" },
  ], defaultValue);

export const KIND_FIELDS = {
  leads_landing: [
    { name: "email", label: "E-mail", type: "email" },
    { name: "telefone", label: "Telefone / WhatsApp" },
    { name: "mensagem", label: "Mensagem do lead", type: "textarea" },
    select("lido", "Status leitura", [
      { value: "false", label: "Novo" },
      { value: "true", label: "Lido" },
    ], "false"),
    { name: "source_url", label: "URL / origem da LP" },
    select("origem", "Canal", ["site", "facebook", "google", "instagram", "indicacao", "outro"], "site"),
    select("interesse", "Interesse", ["compra", "aluguel", "avaliacao", "captacao", "outro"], "compra"),
    { name: "cidade", label: "Cidade de interesse" },
    { name: "bairro", label: "Bairro de interesse" },
  ],
  pipeline_captacao: [
    select(
      "estagio",
      "Estágio",
      [
        "Prospectado",
        "Contactado",
        "Interessado",
        "Avaliacao Enviada",
        "Autorizacao",
        "Contrato Assinado",
        "Perdido",
      ],
      "Prospectado"
    ),
    select("origem", "Origem", ["site", "radarzap", "indicacao", "portal", "placa", "outro"], "indicacao"),
    { name: "telefone", label: "Telefone proprietário" },
    { name: "email", label: "E-mail" },
    { name: "imovel_endereco", label: "Endereço do imóvel" },
    { name: "imovel_cidade", label: "Cidade" },
    { name: "imovel_bairro", label: "Bairro" },
    { name: "imovel_tipo", label: "Tipo do imóvel", defaultValue: "apartamento" },
    select("operacao", "Operação", ["venda", "aluguel"], "venda"),
    { name: "valor_estimado", label: "Valor estimado", type: "number", cast: "number" },
    { name: "perdido_motivo", label: "Motivo perda", type: "textarea" },
  ],
  condominio: [
    { name: "sindico", label: "Síndico" },
    { name: "telefone", label: "Telefone" },
    { name: "endereco", label: "Endereço" },
    { name: "unidades", label: "Qtd unidades", type: "number", cast: "number" },
    { name: "taxa", label: "Taxa condomínio (R$)", type: "number", cast: "number" },
  ],
  relacionamento: [
    select("tipo", "Tipo", ["cliente", "proprietario", "parceiro", "indicador"], "cliente"),
    { name: "telefone", label: "Telefone" },
    { name: "ultimoContato", label: "Último contato", type: "date" },
    select("temperatura", "Temperatura", ["frio", "morno", "quente", "muito_quente"], "morno"),
    { name: "proximoPasso", label: "Próximo passo" },
  ],
  inadimplencia: [
    { name: "contratoRef", label: "Ref. contrato / imóvel" },
    { name: "diasAtraso", label: "Dias em atraso", type: "number", cast: "number" },
    { name: "valorDevido", label: "Valor devido", type: "number", cast: "number" },
    select("acao", "Ação", ["cobranca", "acordo", "juridico", "quitado"], "cobranca"),
  ],
  relatorio_agendado: [
    select("frequencia", "Frequência", ["diario", "semanal", "mensal"], "semanal"),
    { name: "destinatarios", label: "E-mails destinatários" },
    select("tipoRelatorio", "Tipo", ["pipeline", "captacao", "followups", "financeiro"], "pipeline"),
  ],
  monitoramento: [
    select("fonte", "Fonte", ["portal", "mercado", "concorrente", "radarzap"], "portal"),
    { name: "regiao", label: "Região / cidade" },
    { name: "alerta", label: "Condição de alerta" },
    select("severidade", "Severidade", ["baixa", "media", "alta"], "media"),
  ],
  feed: [
    select("canal", "Canal", ["instagram", "facebook", "site", "whatsapp"], "instagram"),
    { name: "link", label: "Link da publicação" },
    { name: "engajamento", label: "Engajamento / métrica" },
  ],
  curadoria: [
    select("formato", "Formato", ["reel", "carrossel", "story", "post", "video"], "post"),
    { name: "tema", label: "Tema / ângulo" },
    { name: "cta", label: "CTA" },
  ],
  radarzap_grupo: [
    { name: "inviteUrl", label: "Link do grupo" },
    { name: "cidade", label: "Cidade" },
    select("statusGrupo", "Status coleta", ["ativo", "pausado", "erro"], "ativo"),
  ],
  automacao: [
    select(
      "trigger_desc",
      "Gatilho",
      [
        { value: "lead_criado", label: "Lead criado" },
        { value: "imovel_ativado", label: "Imóvel ativado" },
        { value: "proposta_enviada", label: "Proposta enviada" },
        { value: "pagamento_atrasado", label: "Pagamento atrasado" },
        { value: "visita_realizada", label: "Visita realizada" },
      ],
      "lead_criado"
    ),
    { name: "acao", label: "Ação" },
    select(
      "tipo",
      "Canal",
      ["whatsapp", "email", "notificacao", "portal", "tarefa"],
      "whatsapp"
    ),
    select("categoria", "Categoria", ["comunicacao", "portal", "social", "financeiro"], "comunicacao"),
    bool("ativo", "Ativa", "true"),
  ],
  seguranca: [
    select("tipo", "Tipo", ["acesso", "incidente", "politica", "lgpd"], "politica"),
    { name: "responsavel", label: "Responsável" },
  ],
  auditoria_extracao: [
    { name: "fonte", label: "Fonte / portal" },
    { name: "qtdItens", label: "Itens extraídos", type: "number", cast: "number" },
    select("resultado", "Resultado", ["ok", "parcial", "falha"], "ok"),
  ],
  metricas_extracao: [
    { name: "periodo", label: "Período" },
    { name: "volume", label: "Volume", type: "number", cast: "number" },
    { name: "taxaSucesso", label: "Taxa sucesso %", type: "number", cast: "number" },
  ],
  auditoria_requests: [
    { name: "endpoint", label: "Endpoint / webhook" },
    { name: "metodo", label: "Método", defaultValue: "POST" },
    { name: "httpStatus", label: "HTTP status", type: "number", cast: "number" },
  ],
  auditoria_monitoramento: [
    { name: "alerta", label: "Alerta" },
    select("severidade", "Severidade", ["baixa", "media", "alta"], "media"),
  ],
  auditoria_leads: [
    { name: "leadRef", label: "Lead / ID" },
    { name: "campo", label: "Campo alterado" },
    { name: "de", label: "De" },
    { name: "para", label: "Para" },
  ],
  config_ia: [
    { name: "modelo", label: "Modelo / persona" },
    { name: "temperatura", label: "Temperatura", type: "number", cast: "number", defaultValue: 0.3 },
    { name: "promptSistema", label: "Prompt sistema", type: "textarea" },
    bool("ativo", "Ativo", "true"),
  ],
  diagnostico_avaliacao: [
    { name: "imovelRef", label: "Imóvel / ref" },
    { name: "precoAnunciado", label: "Preço anunciado", type: "number", cast: "number" },
    { name: "valorJusto", label: "Valor justo", type: "number", cast: "number" },
    { name: "parecer", label: "Parecer" },
  ],
  webhook_metrics: [
    { name: "endpoint", label: "Endpoint" },
    { name: "sucesso", label: "Sucessos", type: "number", cast: "number" },
    { name: "falhas", label: "Falhas", type: "number", cast: "number" },
  ],
  webhook_alerts: [
    select("severidade", "Severidade", ["info", "warning", "critical"], "warning"),
    { name: "mensagem", label: "Mensagem", type: "textarea" },
  ],
  wa_templates_captacao: [
    select("canal", "Canal", ["whatsapp", "sms", "email"], "whatsapp"),
    { name: "template", label: "Template / mensagem", type: "textarea" },
    { name: "variaveis", label: "Variáveis (ex: {nome})" },
  ],
  wa_consentimentos: [
    { name: "telefone", label: "Telefone" },
    select("optIn", "Opt-in", [
      { value: "true", label: "Permitido" },
      { value: "false", label: "Bloqueado" },
    ], "true"),
    { name: "origemConsent", label: "Origem do consentimento" },
  ],
  lgpd: [
    select("tipoPedido", "Tipo", ["acesso", "exclusao", "portabilidade", "correcao"], "acesso"),
    { name: "titular", label: "Titular (nome/e-mail)" },
    select("prazo", "Prazo", ["aberto", "em_andamento", "concluido"], "aberto"),
  ],
  busca_captacao: [
    { name: "cidade", label: "Cidade" },
    { name: "bairro", label: "Bairro" },
    { name: "tipo", label: "Tipo" },
    { name: "precoMin", label: "Preço mín.", type: "number", cast: "number" },
    { name: "precoMax", label: "Preço máx.", type: "number", cast: "number" },
  ],
  seo_auditoria: [
    { name: "url", label: "URL / imóvel" },
    { name: "score", label: "Score SEO", type: "number", cast: "number" },
    { name: "gaps", label: "Gaps encontrados", type: "textarea" },
  ],
  captacao_allowlist: [
    { name: "dominio", label: "Domínio / portal" },
    bool("ativo", "Ativo", "true"),
  ],
  consulta_cpf: [
    { name: "cpf", label: "CPF" },
    { name: "nome", label: "Nome consultado" },
    select("resultado", "Resultado", ["ok", "restricao", "nao_encontrado"], "ok"),
  ],
  radarzap_scoring: [
    { name: "palavraChave", label: "Palavra-chave / padrão" },
    { name: "pontos", label: "Pontos", type: "number", cast: "number", defaultValue: 10 },
    select("categoria", "Categoria", ["lead", "spam", "imovel", "negociacao"], "lead"),
  ],
  radarzap_onboarding: [
    select("passo", "Passo", ["conectar", "grupos", "scoring", "converter"], "conectar"),
    bool("concluido", "Concluído", "false"),
  ],
  radarzap_status: [
    select("saude", "Saúde", ["ok", "degradado", "offline"], "ok"),
    { name: "filaMensagens", label: "Msgs na fila", type: "number", cast: "number" },
    { name: "ultimaColeta", label: "Última coleta", type: "datetime-local" },
  ],
  radarzap_acessos: [
    { name: "usuario", label: "Usuário" },
    { name: "acao", label: "Ação" },
    { name: "recurso", label: "Recurso acessado" },
  ],
  diagnostico_captacao: [
    select("origem", "Origem", ["site", "radarzap", "portal", "indicacao"], "site"),
    { name: "qualidade", label: "Qualidade (1-10)", type: "number", cast: "number" },
    { name: "diagnostico", label: "Diagnóstico", type: "textarea" },
  ],
  lp_captacao_avaliacao: [
    { name: "headline", label: "Headline" },
    { name: "cta", label: "CTA" },
    { name: "url", label: "URL da LP" },
    { name: "conversoes", label: "Conversões", type: "number", cast: "number" },
  ],
  lp_venda_crm: [
    { name: "headline", label: "Headline" },
    { name: "cta", label: "CTA" },
    { name: "url", label: "URL" },
  ],
  portal_imoveis: [
    { name: "slug", label: "Slug / URL" },
    { name: "imovelIds", label: "IDs imóveis publicados" },
    bool("publicado", "Publicado", "true"),
  ],
  blog: [
    { name: "slug", label: "Slug" },
    { name: "autor", label: "Autor" },
    select("publicado", "Publicado", [
      { value: "true", label: "Sim" },
      { value: "false", label: "Rascunho" },
    ], "false"),
  ],
  anunciar_imovel: [
    { name: "imovelRef", label: "Imóvel / código" },
    select("portal", "Portal / rede", ["zap", "olx", "vivareal", "instagram", "facebook"], "zap"),
    select("statusAnuncio", "Status", ["rascunho", "publicado", "pausado"], "rascunho"),
  ],
  lgpd_portal: [
    { name: "protocolo", label: "Protocolo" },
    { name: "titular", label: "Titular" },
    select("estado", "Estado", ["aberto", "respondido"], "aberto"),
  ],
  consentimento: [
    { name: "titular", label: "Titular" },
    { name: "finalidade", label: "Finalidade" },
    bool("concedido", "Concedido", "true"),
  ],
  pagamento_publico: [
    { name: "cliente", label: "Cliente" },
    { name: "link", label: "Link de pagamento" },
    { name: "valorPagamento", label: "Valor", type: "number", cast: "number" },
    select("statusPagamento", "Status", ["pendente", "pago", "expirado"], "pendente"),
  ],
  radar_oportunidades: [
    { name: "regiao", label: "Região" },
    { name: "tipo", label: "Tipo imóvel" },
    { name: "score", label: "Score oportunidade", type: "number", cast: "number" },
    { name: "precoMedio", label: "Preço médio", type: "number", cast: "number" },
  ],
  config_imobiliaria: [
    { name: "marca", label: "Nome / marca" },
    { name: "cidadePadrao", label: "Cidade padrão" },
    { name: "creciEmpresa", label: "CRECI empresa" },
    { name: "telefone", label: "Telefone comercial" },
  ],
  corretor: [
    { name: "email", label: "E-mail" },
    { name: "telefone", label: "Telefone / WhatsApp" },
    { name: "creci", label: "CRECI" },
    select("statusCorretor", "Status", ["ativo", "inativo"], "ativo"),
    { name: "limite", label: "Limite leads ativos", type: "number", cast: "number", defaultValue: 20 },
    { name: "especialidades", label: "Especialidades / regiões", type: "textarea" },
    { name: "userId", label: "ID usuário CRM (opcional)", type: "number", cast: "number" },
  ],
};

export const kindCardMeta = (kind, item, display) => {
  const d = (name) => display(item, name);
  if (kind === "leads_landing") {
    return (
      <>
        <span className="realty-chip">{d("lido") === "true" || d("lido") === true ? "lido" : "novo"}</span>
        <span>
          {d("telefone") || "—"} · {d("email") || "—"} · {d("origem") || d("source_url") || ""}
        </span>
      </>
    );
  }
  if (kind === "pipeline_captacao") {
    return (
      <>
        <span className="realty-chip">{d("estagio") || item.status}</span>
        <span>
          {d("imovel_cidade") || "—"} · {d("telefone") || ""} · {d("origem") || ""}
        </span>
      </>
    );
  }
  if (kind === "corretor") {
    return (
      <>
        <span className="realty-chip">{d("statusCorretor") || item.status || "ativo"}</span>
        <span>
          CRECI {d("creci") || "—"} · {d("telefone") || d("email") || ""}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="realty-chip">{item.status || "aberto"}</span>
      <span>
        {[d("telefone"), d("cidade") || d("regiao"), item.notes].filter(Boolean).join(" · ") || "—"}
      </span>
    </>
  );
};
