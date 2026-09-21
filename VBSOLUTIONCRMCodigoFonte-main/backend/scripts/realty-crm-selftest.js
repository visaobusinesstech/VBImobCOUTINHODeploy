"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const srcPath = path.resolve(
  __dirname,
  "../../frontend/src/helpers/realtyCrm.js"
);
let src = fs.readFileSync(srcPath, "utf8");
src = src.replace(/export /g, "");
src +=
  "\nmodule.exports = { normalizeText, isImovelAvailable, scoreLeadImovelMatch, rankImoveisForLead, formatBRL, groupLeadsByStage, IMOVEL_STATUSES, CONTRATO_STATUSES };\n";

const sandbox = { module: { exports: {} }, exports: {}, console };
vm.runInNewContext(src, sandbox, { filename: "realtyCrm.js" });
const {
  normalizeText,
  isImovelAvailable,
  scoreLeadImovelMatch,
  rankImoveisForLead,
  clampPageSize,
  formatBRL,
  groupLeadsByStage
} = sandbox.module.exports;

assert.strictEqual(normalizeText("Brasília"), "brasilia");
assert.strictEqual(isImovelAvailable("captacao"), true);
assert.strictEqual(isImovelAvailable("vendido"), false);
assert.ok(formatBRL(1500).includes("1"));

const lead = {
  interestCity: "Brasília",
  interestNeighborhood: "Asa Norte",
  interestType: "apartamento",
  bedrooms: 2,
  value: 500000
};
const imovel = {
  id: 7,
  city: "Brasilia",
  neighborhood: "Asa Norte",
  type: "Apartamento",
  bedrooms: 3,
  price: 520000,
  status: "disponivel"
};
const { score } = scoreLeadImovelMatch(lead, imovel);
assert.strictEqual(score, 120);

const ranked = rankImoveisForLead(lead, [
  imovel,
  { id: 9, city: "Recife", status: "vendido", price: 10 }
]);
assert.strictEqual(ranked[0].imovelId, 7);
assert.strictEqual(
  ranked.some(r => r.imovelId === 9),
  false
);

const grouped = groupLeadsByStage([{ status: "visita" }], [
  { key: "novo" },
  { key: "visita" }
]);
assert.strictEqual(grouped.visita.length, 1);
assert.strictEqual(grouped.novo.length, 0);

console.log("realtyCrm self-test: OK");
