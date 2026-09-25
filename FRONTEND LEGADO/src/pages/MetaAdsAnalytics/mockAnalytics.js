/**
 * Dados fictícios SOMENTE para a conta testeanalisemeta@gmail.com
 * na página Análises Meta. Não importar em outras páginas.
 */
export const META_ADS_ANALYTICS_MOCK_EMAIL = "testeanalisemeta@gmail.com";

export function isMetaAdsAnalyticsMockAccount(email) {
  return (
    String(email || "")
      .trim()
      .toLowerCase() === META_ADS_ANALYTICS_MOCK_EMAIL
  );
}

const PRESET_DAYS = {
  today: 1,
  yesterday: 1,
  last_7d: 7,
  last_14d: 14,
  last_30d: 30,
  last_90d: 90,
  this_month: Math.max(1, new Date().getDate()),
  last_month: 30,
};

function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function isoDaysAgo(daysAgo) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function firedHoursAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

export const MOCK_META_AD_ACCOUNTS = [
  {
    id: "act_1029384756",
    adAccountId: "act_1029384756",
    name: "Teste Análise Meta · Ads",
    currency: "BRL",
    primary: true,
  },
  {
    id: "act_2040506070",
    adAccountId: "act_2040506070",
    name: "Conta Loja · Remarketing",
    currency: "BRL",
  },
  {
    id: "act_9988776655",
    adAccountId: "act_9988776655",
    name: "Conta Leads · Performance",
    currency: "BRL",
  },
];

function accountScale(accountId) {
  const id = String(accountId || "");
  if (id.includes("2040506070")) return 0.64;
  if (id.includes("9988776655")) return 1.22;
  return 1;
}

export function buildMockMetaAdsAnalytics(datePreset = "last_30d", accountId) {
  const days = PRESET_DAYS[datePreset] || 30;
  const scale = (days / 30) * accountScale(accountId);

  const campaignsMeta = [
    {
      id: "12008001001",
      name: "Conversão · Leads WhatsApp",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      objective: "OUTCOME_LEADS",
      platform: "facebook",
      product: "CRM WhatsApp",
      daily_budget: "18000",
      weight: 0.34,
    },
    {
      id: "12008001002",
      name: "Tráfego · Remarketing Site",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      objective: "OUTCOME_TRAFFIC",
      platform: "instagram",
      product: "Landing Site",
      daily_budget: "9500",
      weight: 0.18,
    },
    {
      id: "12008001003",
      name: "Cadastro · Formulário Instantâneo",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      objective: "OUTCOME_LEADS",
      platform: "facebook",
      product: "Lead Form",
      daily_budget: "12000",
      weight: 0.22,
    },
    {
      id: "12008001004",
      name: "Alcance · Branding Instagram",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      objective: "OUTCOME_AWARENESS",
      platform: "instagram",
      product: "Marca",
      daily_budget: "6000",
      weight: 0.09,
    },
    {
      id: "12008001005",
      name: "Vendas · Catálogo Loja",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      objective: "OUTCOME_SALES",
      platform: "facebook",
      product: "Catálogo",
      daily_budget: "14000",
      weight: 0.12,
    },
    {
      id: "12008001006",
      name: "Retargeting · Carrinho Abandonado",
      status: "PAUSED",
      effective_status: "PAUSED",
      objective: "OUTCOME_SALES",
      platform: "instagram",
      product: "Checkout",
      daily_budget: "4000",
      weight: 0.05,
    },
  ];

  const adsMeta = [
    {
      id: "12009001001",
      name: "Criativo · Depoimento 15s",
      campaignId: "12008001001",
      adsetId: "12008501001",
      adsetName: "Conjunto · Lookalike 1%",
      weight: 0.2,
    },
    {
      id: "12009001002",
      name: "Estático · Oferta Black",
      campaignId: "12008001001",
      adsetId: "12008501001",
      adsetName: "Conjunto · Lookalike 1%",
      weight: 0.14,
    },
    {
      id: "12009001003",
      name: "Carrossel · Cases de cliente",
      campaignId: "12008001002",
      adsetId: "12008501002",
      adsetName: "Conjunto · Visitantes 30d",
      weight: 0.18,
    },
    {
      id: "12009001004",
      name: "Stories · Formulário rápido",
      campaignId: "12008001003",
      adsetId: "12008501003",
      adsetName: "Conjunto · Interesse CRM",
      weight: 0.22,
    },
    {
      id: "12009001005",
      name: "Reels · Bastidores da marca",
      campaignId: "12008001004",
      adsetId: "12008501004",
      adsetName: "Conjunto · Alcance amplo",
      weight: 0.09,
    },
    {
      id: "12009001006",
      name: "Catálogo · Coleção verão",
      campaignId: "12008001005",
      adsetId: "12008501005",
      adsetName: "Conjunto · Compradores",
      weight: 0.12,
    },
    {
      id: "12009001007",
      name: "Dinâmico · Carrinho 7d",
      campaignId: "12008001006",
      adsetId: "12008501006",
      adsetName: "Conjunto · Abandono",
      weight: 0.05,
    },
  ];

  const baseSpend = 18420 * scale;
  const baseImpressions = 412800 * scale;
  const baseClicks = 9860 * scale;
  const baseReach = 186400 * scale;
  const baseLeads = 312 * scale;
  const basePurchases = 48 * scale;
  const crmLeads = Math.max(1, Math.round(268 * scale));
  const crmWon = Math.max(1, Math.round(41 * scale));
  const crmRevenue = round(67280 * scale, 2);
  const crmTickets = Math.max(1, Math.round(194 * scale));

  const campaignInsights = campaignsMeta.map((c, i) => {
    const spend = round(baseSpend * c.weight, 2);
    const impressions = Math.round(baseImpressions * c.weight * (1.05 - i * 0.04));
    const clicks = Math.round(baseClicks * c.weight * (1.08 - i * 0.05));
    const reach = Math.round(baseReach * c.weight);
    const leads = Math.round(baseLeads * c.weight);
    const purchases = Math.round(basePurchases * c.weight);
    const ctr = impressions > 0 ? round((clicks / impressions) * 100, 2) : 0;
    const cpc = clicks > 0 ? round(spend / clicks, 2) : 0;
    const cpm = impressions > 0 ? round((spend / impressions) * 1000, 2) : 0;
    return {
      campaignId: c.id,
      campaignName: c.name,
      impressions,
      clicks,
      spend,
      cpc,
      ctr,
      cpm,
      reach,
      leads,
      purchases,
    };
  });

  const campaignNameById = Object.fromEntries(
    campaignsMeta.map((c) => [c.id, c.name])
  );

  const adInsights = adsMeta.map((a, i) => {
    const spend = round(baseSpend * a.weight, 2);
    const impressions = Math.round(baseImpressions * a.weight * (1.02 - i * 0.03));
    const clicks = Math.round(baseClicks * a.weight * (1.04 - i * 0.03));
    const reach = Math.round(baseReach * a.weight);
    const leads = Math.round(baseLeads * a.weight);
    const purchases = Math.round(basePurchases * a.weight);
    const ctr = impressions > 0 ? round((clicks / impressions) * 100, 2) : 0;
    const cpc = clicks > 0 ? round(spend / clicks, 2) : 0;
    const cpm = impressions > 0 ? round((spend / impressions) * 1000, 2) : 0;
    return {
      id: a.id,
      name: a.name,
      campaignId: a.campaignId,
      campaignName: campaignNameById[a.campaignId],
      adsetId: a.adsetId,
      adsetName: a.adsetName,
      impressions,
      clicks,
      spend,
      cpc,
      ctr,
      cpm,
      reach,
      leads,
      purchases,
    };
  });

  const dailyInsights = Array.from({ length: days }, (_, idx) => {
    const ago = days - 1 - idx;
    const wave = 0.72 + 0.28 * Math.sin((idx / Math.max(1, days - 1)) * Math.PI);
    const weekend = [0, 6].includes(new Date(`${isoDaysAgo(ago)}T12:00:00`).getDay())
      ? 0.82
      : 1;
    const factor = (wave * weekend) / days;
    const spend = round(baseSpend * factor * 1.05, 2);
    const impressions = Math.round(baseImpressions * factor * 1.02);
    const clicks = Math.round(baseClicks * factor * 1.04);
    const reach = Math.round(baseReach * factor);
    const leads = Math.max(0, Math.round(baseLeads * factor));
    const ctr = impressions > 0 ? round((clicks / impressions) * 100, 2) : 0;
    const cpc = clicks > 0 ? round(spend / clicks, 2) : 0;
    return {
      date: isoDaysAgo(ago),
      impressions,
      clicks,
      spend,
      cpc,
      ctr,
      reach,
      leads,
    };
  });

  const spend = round(baseSpend, 2);
  const impressions = Math.round(baseImpressions);
  const clicks = Math.round(baseClicks);
  const reach = Math.round(baseReach);
  const ctr = impressions > 0 ? round((clicks / impressions) * 100, 2) : 0;
  const cpc = clicks > 0 ? round(spend / clicks, 2) : 0;
  const cpm = impressions > 0 ? round((spend / impressions) * 1000, 2) : 0;
  const roas = spend > 0 ? round(crmRevenue / spend, 2) : 0;
  const lucro = round(crmRevenue - spend, 2);
  const roi = spend > 0 ? round((lucro / spend) * 100, 1) : 0;
  const margem = crmRevenue > 0 ? round((lucro / crmRevenue) * 100, 1) : 0;
  const cpa =
    Math.round(baseLeads) > 0 ? round(spend / Math.round(baseLeads), 2) : 0;
  const pendingSales = round(crmRevenue * 0.18, 2);
  const refunds = round(crmRevenue * 0.04, 2);
  const productCosts = round(crmRevenue * 0.22, 2);
  const extraExpenses = round(spend * 0.06, 2);
  const fees = round(crmRevenue * 0.039, 2);
  const salesTax = round(crmRevenue * 0.0925, 2);
  const metaAdsTax = round(spend * 0.05, 2);
  const refundRate = crmRevenue > 0 ? round((refunds / crmRevenue) * 100, 1) : 0;
  const selectedAccount =
    MOCK_META_AD_ACCOUNTS.find(
      (a) => a.id === accountId || a.adAccountId === accountId
    ) || MOCK_META_AD_ACCOUNTS[0];

  const campaigns = campaignsMeta.map(({ weight, ...rest }) => ({
    ...rest,
    lifetime_budget: "0",
    updated_time: new Date().toISOString(),
  }));

  const adsets = [
    {
      id: "12008501001",
      name: "Conjunto · Lookalike 1%",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      campaign_id: "12008001001",
      daily_budget: "9000",
    },
    {
      id: "12008501002",
      name: "Conjunto · Visitantes 30d",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      campaign_id: "12008001002",
      daily_budget: "9500",
    },
    {
      id: "12008501003",
      name: "Conjunto · Interesse CRM",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      campaign_id: "12008001003",
      daily_budget: "12000",
    },
    {
      id: "12008501004",
      name: "Conjunto · Alcance amplo",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      campaign_id: "12008001004",
      daily_budget: "6000",
    },
    {
      id: "12008501005",
      name: "Conjunto · Compradores",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      campaign_id: "12008001005",
      daily_budget: "14000",
    },
    {
      id: "12008501006",
      name: "Conjunto · Abandono",
      status: "PAUSED",
      effective_status: "PAUSED",
      campaign_id: "12008001006",
      daily_budget: "4000",
    },
  ];

  const ads = adsMeta.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.campaignId === "12008001006" ? "PAUSED" : "ACTIVE",
    effective_status: a.campaignId === "12008001006" ? "PAUSED" : "ACTIVE",
    adset_id: a.adsetId,
    campaign_id: a.campaignId,
  }));

  const pixels = [
    {
      id: "112233445566778",
      name: "Pixel Principal · Site",
      is_unavailable: false,
      last_fired_time: firedHoursAgo(2),
      creation_time: "2024-03-12T14:00:00.000Z",
    },
    {
      id: "998877665544332",
      name: "Pixel Checkout · Loja",
      is_unavailable: false,
      last_fired_time: firedHoursAgo(5),
      creation_time: "2025-01-08T11:30:00.000Z",
    },
    {
      id: "556677889900112",
      name: "Pixel Leads · Landing",
      is_unavailable: false,
      last_fired_time: firedHoursAgo(1),
      creation_time: "2025-08-21T09:00:00.000Z",
    },
  ];

  return {
    cached: false,
    fetchedAt: new Date().toISOString(),
    datePreset,
    account: {
      id: selectedAccount.id,
      name: selectedAccount.name,
      currency: selectedAccount.currency || "BRL",
      status: 1,
      appName: "VB Solution",
    },
    adAccounts: MOCK_META_AD_ACCOUNTS,
    kpis: {
      spend,
      impressions,
      clicks,
      reach,
      ctr,
      cpc,
      cpm,
      metaLeadsReported: Math.round(baseLeads),
      metaPurchasesReported: Math.round(basePurchases),
      crmLeadsFromAds: crmLeads,
      crmLeadsWonFromAds: crmWon,
      crmRevenueFromAds: crmRevenue,
      crmTicketsFromAds: crmTickets,
      roas,
      lucro,
      roi,
      margem,
      cpa,
      pendingSales,
      refunds,
      refundRate,
      productCosts,
      extraExpenses,
      fees,
      salesTax,
      totalTax: round(salesTax + metaAdsTax, 2),
      metaAdsTax,
      chargeback: round(crmRevenue * 0.008, 2),
      approvalRateCard: 92.4,
      approvalRatePix: 98.1,
      approvalRateBoleto: 74.6,
    },
    campaigns,
    campaignInsights,
    adInsights,
    dailyInsights,
    adsets,
    ads,
    pixels,
    totals: {
      campaigns: campaigns.length,
      adsets: adsets.length,
      ads: ads.length,
      pixels: pixels.length,
      activeCampaigns: campaigns.filter(
        (c) => String(c.effective_status || c.status).toUpperCase() === "ACTIVE"
      ).length,
    },
  };
}
