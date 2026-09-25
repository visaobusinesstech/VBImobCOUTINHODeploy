/**
 * Smoke test: realty_imoveis premium columns + CRUD
 */
require("dotenv").config();
const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const c = new Client({
    connectionString,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await c.connect();

  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='realty_imoveis'
     ORDER BY ordinal_position`
  );
  const names = cols.rows.map((r) => r.column_name);
  const needed = [
    "exclusivo",
    "destaque",
    "aceitaPermuta",
    "aceitaFinanciamento",
    "aceitaFgts",
    "temEscritura",
    "andar",
    "posicaoSolar",
    "comissaoPercentual",
    "portalOrigem",
    "urlAnuncio",
    "fotoCapaIndex",
    "documentosMatricula",
    "documentosIptu",
    "documentosOutros",
    "videos",
  ];
  const missing = needed.filter((n) => !names.includes(n));
  console.log("columns:", names.length);
  console.log("missing:", missing.length ? missing.join(", ") : "(none)");

  // insert smoke row then delete
  const company = await c.query(`SELECT id FROM "Companies" ORDER BY id LIMIT 1`);
  const companyId = company.rows[0]?.id;
  if (!companyId) throw new Error("No company");

  const ins = await c.query(
    `INSERT INTO realty_imoveis
      (title, type, status, purpose, price, city, neighborhood, bedrooms, bathrooms, "areaM2",
       exclusivo, destaque, "aceitaPermuta", "portalOrigem", "urlAnuncio", "companyId", "createdAt", "updatedAt")
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,true,true,$11,$12,$13,NOW(),NOW())
     RETURNING id, title, exclusivo, destaque, "portalOrigem"`,
    [
      "Smoke Test Imovel Premium",
      "Apartamento",
      "disponivel",
      "venda",
      850000,
      "Brasília",
      "Asa Norte",
      3,
      2,
      120,
      "ZAP Imóveis",
      "https://example.com/anuncio",
      companyId,
    ]
  );
  console.log("inserted:", JSON.stringify(ins.rows[0]));
  await c.query(`DELETE FROM realty_imoveis WHERE id = $1`, [ins.rows[0].id]);
  console.log("deleted smoke row ok");
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
