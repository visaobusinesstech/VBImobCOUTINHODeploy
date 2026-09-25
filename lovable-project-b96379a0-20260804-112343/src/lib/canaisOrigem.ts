export const CANAIS_ORIGEM = [
  { id: "indicacao", label: "Indicação" },
  { id: "amigos", label: "Amigos" },
  { id: "portal_imoveis", label: "Portal de Imóveis" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "trafego_pago_instagram", label: "Tráfego Pago Instagram" },
  { id: "trafego_pago_google", label: "Tráfego Pago Google" },
  { id: "google_ads", label: "Google Ads" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "site", label: "Site" },
  { id: "cliente_carteira", label: "Cliente de Carteira" },
  { id: "placa", label: "Placa / Faixa" },
  { id: "olx", label: "OLX" },
  { id: "dfimoveis", label: "DF Imóveis" },
  { id: "chave_na_mao", label: "Chave na Mão" },
  { id: "wimoveis", label: "W Imóveis" },
  { id: "evento", label: "Evento / Feira" },
  { id: "parceria_corretor", label: "Parceria Corretor" },
  { id: "outro", label: "Outro" },
] as const;

export const getCanalLabel = (id: string | null | undefined): string => {
  if (!id) return "Não informado";
  return CANAIS_ORIGEM.find(c => c.id === id)?.label || id;
};
