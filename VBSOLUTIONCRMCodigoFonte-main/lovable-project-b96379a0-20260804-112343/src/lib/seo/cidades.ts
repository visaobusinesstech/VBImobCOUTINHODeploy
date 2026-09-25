// Cidades priorizadas para SEO programático.
// Cobertura foco: DF (RAs), capitais e cidades quentes do entorno.
export const SEO_CIDADES: { slug: string; nome: string; uf: string }[] = [
  { slug: "brasilia", nome: "Brasília", uf: "DF" },
  { slug: "aguas-claras", nome: "Águas Claras", uf: "DF" },
  { slug: "taguatinga", nome: "Taguatinga", uf: "DF" },
  { slug: "ceilandia", nome: "Ceilândia", uf: "DF" },
  { slug: "sobradinho", nome: "Sobradinho", uf: "DF" },
  { slug: "gama", nome: "Gama", uf: "DF" },
  { slug: "guara", nome: "Guará", uf: "DF" },
  { slug: "samambaia", nome: "Samambaia", uf: "DF" },
  { slug: "planaltina", nome: "Planaltina", uf: "DF" },
  { slug: "nucleo-bandeirante", nome: "Núcleo Bandeirante", uf: "DF" },
  { slug: "sudoeste", nome: "Sudoeste", uf: "DF" },
  { slug: "noroeste", nome: "Noroeste", uf: "DF" },
  { slug: "lago-sul", nome: "Lago Sul", uf: "DF" },
  { slug: "lago-norte", nome: "Lago Norte", uf: "DF" },
  { slug: "asa-sul", nome: "Asa Sul", uf: "DF" },
  { slug: "asa-norte", nome: "Asa Norte", uf: "DF" },
  { slug: "vicente-pires", nome: "Vicente Pires", uf: "DF" },
  { slug: "jardim-botanico", nome: "Jardim Botânico", uf: "DF" },
  { slug: "park-way", nome: "Park Way", uf: "DF" },
  { slug: "cruzeiro", nome: "Cruzeiro", uf: "DF" },
  { slug: "valparaiso-de-goias", nome: "Valparaíso de Goiás", uf: "GO" },
  { slug: "aguas-lindas-de-goias", nome: "Águas Lindas de Goiás", uf: "GO" },
  { slug: "luziania", nome: "Luziânia", uf: "GO" },
  { slug: "goiania", nome: "Goiânia", uf: "GO" },
  { slug: "sao-paulo", nome: "São Paulo", uf: "SP" },
  { slug: "rio-de-janeiro", nome: "Rio de Janeiro", uf: "RJ" },
  { slug: "belo-horizonte", nome: "Belo Horizonte", uf: "MG" },
  { slug: "curitiba", nome: "Curitiba", uf: "PR" },
  { slug: "porto-alegre", nome: "Porto Alegre", uf: "RS" },
  { slug: "florianopolis", nome: "Florianópolis", uf: "SC" },
];

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function findCidadeBySlug(slug: string) {
  return SEO_CIDADES.find((c) => c.slug === slug) ?? null;
}
