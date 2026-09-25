// Gera public/rss.xml e public/atom.xml no predev/prebuild chamando o edge function blog-rss.
// Cobre feeds estáticos completos. Para feeds filtrados, use /rss?tipo=X ou /atom?cidade=Y (rota SPA).
import { writeFileSync } from "fs";
import { resolve } from "path";

const RSS_URL = "https://ugxnxztecfsklijmhhmo.supabase.co/functions/v1/blog-rss";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVneG54enRlY2Zza2xpam1oaG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTkyNTYsImV4cCI6MjA4ODA3NTI1Nn0.yk0nsCjYOuRnwTWaR5iQaiOrn936eb_l4DuBolzVBIM";

async function fetchFeed(format: "rss" | "atom"): Promise<string> {
  try {
    const res = await fetch(`${RSS_URL}?format=${format}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    console.warn(`Falha ao gerar ${format} feed:`, e);
    // Fallback mínimo válido para não quebrar o build
    if (format === "atom") {
      return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Blog radarimobtech</title>
  <link href="https://radarimobtech.shop/blog"/>
  <updated>${new Date().toISOString()}</updated>
  <id>https://radarimobtech.shop/blog</id>
</feed>`;
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Blog radarimobtech</title>
  <link>https://radarimobtech.shop/blog</link>
  <description>Feed indisponível no momento</description>
</channel></rss>`;
  }
}

async function main() {
  const [rss, atom] = await Promise.all([fetchFeed("rss"), fetchFeed("atom")]);
  writeFileSync(resolve("public/rss.xml"), rss);
  writeFileSync(resolve("public/atom.xml"), atom);
  console.log(`Feeds gerados: rss.xml (${rss.length} bytes), atom.xml (${atom.length} bytes)`);
}

void main();
