import { Helmet } from "react-helmet-async";

const BASE_URL = "https://radarimobtech.shop";

interface SeoProps {
  title: string;
  description: string;
  path: string; // ex: "/portal" ou "/imovel/123"
  image?: string;
  type?: "website" | "article" | "product";
  jsonLd?: Record<string, any> | Record<string, any>[];
  noindex?: boolean;
}

export function Seo({ title, description, path, image, type = "website", jsonLd, noindex }: SeoProps) {
  const url = `${BASE_URL}${path}`;
  const img = image || `${BASE_URL}/pwa-512.png`;
  const schemas = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta property="og:site_name" content="radarimobtech" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
      <meta name="twitter:url" content={url} />

      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
}
