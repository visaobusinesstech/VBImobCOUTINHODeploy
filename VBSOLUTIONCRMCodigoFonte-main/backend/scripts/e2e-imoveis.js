/**
 * End-to-end smoke: login + CRUD + upload + list premium fields
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const BASE = process.env.BACKEND_URL || "http://localhost:3000";

function request(method, urlPath, { token, body, formData, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const lib = u.protocol === "https:" ? https : http;
    const payload = formData || (body ? JSON.stringify(body) : null);
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: { ...headers },
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    if (payload && !formData) {
      opts.headers["Content-Type"] = "application/json";
      opts.headers["Content-Length"] = Buffer.byteLength(payload);
    }
    if (formData) {
      opts.headers["Content-Type"] = `multipart/form-data; boundary=${formData.boundary}`;
      opts.headers["Content-Length"] = formData.buffer.length;
    }
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let data = raw;
        try {
          data = JSON.parse(raw);
        } catch (_) {}
        if (res.statusCode >= 400) {
          const err = new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 300)}`);
          err.status = res.statusCode;
          err.data = data;
          return reject(err);
        }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on("error", reject);
    if (formData) req.write(formData.buffer);
    else if (payload) req.write(payload);
    req.end();
  });
}

function buildMultipart(fields, files) {
  const boundary = "----VBBoundary" + Date.now();
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
      )
    );
  }
  for (const f of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n`
      )
    );
    parts.push(f.buffer);
    parts.push(Buffer.from("\r\n"));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, buffer: Buffer.concat(parts) };
}

async function main() {
  const email = process.env.DEV_AUTH_EMAIL || "admin@local.dev";
  const password = process.env.DEV_AUTH_PASSWORD || "123456";
  console.log("1) login...");
  const login = await request("POST", "/auth/login", { body: { email, password } });
  const token = login.data.token;
  console.log("   ok company", login.data.user?.companyId);

  console.log("2) create imovel...");
  const created = await request("POST", "/imoveis", {
    token,
    body: {
      title: "Cobertura Lago Sul — Carteira Premium",
      type: "Cobertura",
      purpose: "venda",
      status: "disponivel",
      price: 2850000,
      city: "Brasília",
      neighborhood: "Lago Sul",
      address: "SHIS QI 15 Conjunto 5",
      state: "DF",
      zipCode: "71635050",
      bedrooms: 4,
      bathrooms: 5,
      suites: 3,
      parkingSpots: 4,
      areaM2: 320,
      exclusivo: true,
      destaque: true,
      aceitaFinanciamento: true,
      temEscritura: true,
      condoFee: 3200,
      iptu: 1800,
      portalOrigem: "ZAP Imóveis",
      urlAnuncio: "https://www.zapimoveis.com.br/exemplo",
      description: "Cobertura premium com vista para o lago.",
      code: "COV-001",
    },
  });
  const id = created.data.id;
  console.log("   created id=", id, "exclusivo=", created.data.exclusivo);

  console.log("3) upload png...");
  // 1x1 png
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const form = buildMultipart(
    { typeArch: "imoveis" },
    [{ name: "capa.png", type: "image/png", buffer: png }]
  );
  const up = await request("POST", "/imoveis/upload", { token, formData: form });
  console.log("   urls=", up.data.urls);

  console.log("4) update with images...");
  const updated = await request("PUT", `/imoveis/${id}`, {
    token,
    body: { images: up.data.urls || [] },
  });
  console.log("   images=", updated.data.images);

  console.log("5) list...");
  const list = await request("GET", "/imoveis?pageSize=50", { token });
  const found = (list.data.imoveis || []).find((i) => i.id === id);
  console.log(
    "   found=",
    !!found,
    "destaque=",
    found?.destaque,
    "portal=",
    found?.portalOrigem,
    "count=",
    list.data.count
  );

  // keep the imóvel for UI demo (do not delete)
  console.log("DONE — imóvel id", id, "kept for UI");
  fs.writeFileSync(
    path.join(__dirname, ".last-imovel-id"),
    String(id),
    "utf8"
  );
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
