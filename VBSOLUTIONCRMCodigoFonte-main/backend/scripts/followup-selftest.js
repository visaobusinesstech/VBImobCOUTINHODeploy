/**
 * Self-test Follow-up: schema + template + follow-up CRUD + counts query.
 */
"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

async function main() {
  const { default: sequelize } = require("../dist/database");
  const RealtyFollowup = require("../dist/models/RealtyFollowup").default;
  const RealtyFollowupMessageTemplate = require("../dist/models/RealtyFollowupMessageTemplate")
    .default;
  const LeadSale = require("../dist/models/LeadSale").default;
  const Company = require("../dist/models/Company").default;

  await sequelize.authenticate();

  const [cols] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='realty_followups'`
  );
  const names = cols.map(c => String(c.column_name));
  const needed = [
    "messageBody",
    "messageMode",
    "whatsappId",
    "metaTemplateQuickMessageId",
    "recurrenceEnabled",
    "contratoId",
    "sendNow",
    "whatsappSent"
  ];
  for (const n of needed) {
    if (!names.includes(n)) {
      throw new Error(`Missing column ${n}. Have: ${names.join(",")}`);
    }
  }
  console.log("✓ columns OK");

  const company = await Company.findOne({ order: [["id", "ASC"]] });
  if (!company) throw new Error("No company");

  const tpl = await RealtyFollowupMessageTemplate.create({
    title: "Selftest Template",
    message: "Olá {nome}, teste follow-up!",
    active: true,
    companyId: company.id
  });
  console.log("✓ template created", tpl.id);

  let lead = await LeadSale.findOne({ where: { companyId: company.id } });
  let createdLead = false;
  if (!lead) {
    lead = await LeadSale.create({
      name: "Lead Selftest Followup",
      phone: "11999990000",
      status: "novo",
      companyId: company.id
    });
    createdLead = true;
    console.log("✓ temp lead created", lead.id);
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const fuToday = await RealtyFollowup.create({
    type: "whatsapp",
    scheduledAt: today,
    status: "pendente",
    notes: "selftest today",
    messageBody: tpl.message,
    messageMode: "template",
    messageTemplateId: tpl.id,
    leadSaleId: lead.id,
    companyId: company.id,
    recurrenceEnabled: true,
    recurrenceType: "dias",
    recurrenceInterval: 3
  });

  const fuLate = await RealtyFollowup.create({
    type: "ligacao",
    scheduledAt: yesterday,
    status: "pendente",
    notes: "selftest late",
    leadSaleId: lead.id,
    companyId: company.id
  });

  const listed = await RealtyFollowup.findAll({
    where: { companyId: company.id, id: [fuToday.id, fuLate.id] },
    include: [{ model: LeadSale, as: "leadSale", required: false }]
  });
  if (listed.length !== 2) throw new Error("list include failed");
  if (!listed[0].leadSale && !listed[1].leadSale) {
    throw new Error("leadSale association empty");
  }
  console.log("✓ followups + lead include OK");

  // counts-like logic
  const all = await RealtyFollowup.findAll({
    where: { companyId: company.id, id: [fuToday.id, fuLate.id] }
  });
  const startOfDay = d => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const t0 = startOfDay(new Date()).getTime();
  const hoje = all.filter(
    f =>
      f.status === "pendente" &&
      startOfDay(f.scheduledAt).getTime() === t0
  ).length;
  const atrasados = all.filter(
    f =>
      f.status === "pendente" &&
      startOfDay(f.scheduledAt).getTime() < t0
  ).length;
  if (hoje < 1) throw new Error(`expected hoje>=1 got ${hoje}`);
  if (atrasados < 1) throw new Error(`expected atrasados>=1 got ${atrasados}`);
  console.log("✓ counts logic", { hoje, atrasados });

  // conclude + recurrence spawn (simulate controller)
  const { nextRecurrenceDate } = require("../dist/services/RealtyServices/dispatchFollowupWhatsApp");
  const next = nextRecurrenceDate(new Date(), "dias", 3);
  const deltaDays = Math.round((next - Date.now()) / 86400000);
  if (deltaDays < 2 || deltaDays > 4) throw new Error(`bad recurrence delta ${deltaDays}`);
  console.log("✓ recurrence helper", next.toISOString());

  await fuToday.destroy();
  await fuLate.destroy();
  await tpl.destroy();
  if (createdLead) await lead.destroy();

  console.log("followup self-test: ALL OK");
  await sequelize.close();
}

main().catch(err => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
