/**
 * Envia notificações (Slack e/ou e-mail) quando a suíte do PDF Premium quebra
 * ou quando algum cenário muda de forma relevante em relação ao baseline.
 *
 * Uso:  bun scripts/notifyPdfChanges.ts [pasta-artefatos]
 *
 * Variáveis de ambiente:
 *  - SLACK_WEBHOOK_URL   → webhook de entrada do Slack (opcional)
 *  - RESEND_API_KEY      → chave da Resend para envio de e-mail (opcional)
 *  - PDF_NOTIFY_EMAIL_TO → destinatários, separados por vírgula (obrigatório p/ e-mail)
 *  - PDF_NOTIFY_EMAIL_FROM → remetente (default: onboarding@resend.dev)
 *  - PDF_NOTIFY_ALWAYS   → "true" para notificar mesmo sem mudanças/falhas
 *
 * O script nunca derruba o job: falhas de envio são apenas logadas.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Falha = { suite: string; nome: string; mensagem: string };
type Mudanca = { nome: string; tipo: string; rotulo: string; detalhes: string[] };

type Payload = {
  status: string;
  total: number;
  ok: number;
  falhas: Falha[];
  totalFalhas: number;
  mudancas: Mudanca[];
  difTestes: { novasFalhas: string[]; corrigidos: string[]; novosTestes: string[]; removidos: string[] };
  baseline: { runId: string | null; geradoEm: string | null } | null;
  baselineUrl: string | null;
  artefato: string;
  artefatosUrl: string | null;
  runUrl: string | null;
  commit: string | null;
  workflow: string | null;
  repo: string | null;
  deveNotificar: boolean;
};

const dir = process.argv[2] || "pdf-test-artifacts";
const arquivo = join(dir, "notificacao.json");

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function enviarSlack(url: string, p: Payload, titulo: string) {
  const linhas: string[] = [
    `*${titulo}*`,
    `${p.status} — ${p.ok}/${p.total} testes · ${p.totalFalhas} falha(s) · ${p.mudancas.length} cenário(s) alterado(s)`,
  ];
  if (p.falhas.length) {
    linhas.push("", "*Falhas*");
    for (const f of p.falhas.slice(0, 8)) linhas.push(`• ${f.nome} (\`${f.suite}\`) — ${f.mensagem}`);
    if (p.totalFalhas > 8) linhas.push(`• _+${p.totalFalhas - 8} falha(s) adicionais_`);
  }
  if (p.mudancas.length) {
    linhas.push("", "*Mudanças vs. baseline*");
    for (const m of p.mudancas.slice(0, 8))
      linhas.push(`• ${m.nome} — *${m.rotulo}*${m.detalhes.length ? `: ${m.detalhes.join("; ")}` : ""}`);
    if (p.mudancas.length > 8) linhas.push(`• _+${p.mudancas.length - 8} cenário(s)_`);
  }
  const links = [
    p.artefatosUrl ? `<${p.artefatosUrl}|Artefato ${p.artefato} (PDFs + resumo HTML)>` : "",
    p.baselineUrl ? `<${p.baselineUrl}|Baseline (execução ${p.baseline?.runId})>` : "",
    p.runUrl ? `<${p.runUrl}|Execução no CI>` : "",
  ].filter(Boolean);
  if (links.length) linhas.push("", links.join("  ·  "));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: linhas.join("\n") }),
  });
  if (!res.ok) throw new Error(`Slack ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log("[pdf-notify] Slack: notificação enviada.");
}

async function enviarEmail(apiKey: string, p: Payload, titulo: string) {
  const to = (process.env.PDF_NOTIFY_EMAIL_TO || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!to.length) {
    console.log("[pdf-notify] PDF_NOTIFY_EMAIL_TO ausente — e-mail ignorado.");
    return;
  }
  const from = process.env.PDF_NOTIFY_EMAIL_FROM || "PDF Premium CI <onboarding@resend.dev>";
  const cor = p.totalFalhas ? "#b24a3c" : "#C9A84C";

  const html = `<div style="font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1A202C">
  <div style="background:#0B1F3A;color:#fff;padding:18px 22px;border-bottom:4px solid ${cor}">
    <strong style="font-size:17px">${esc(titulo)}</strong>
    <div style="opacity:.8;font-size:13px;margin-top:5px">${esc(p.status)} — ${p.ok}/${p.total} testes · ${p.totalFalhas} falha(s) · ${p.mudancas.length} cenário(s) alterado(s)</div>
  </div>
  <div style="padding:20px 22px">
    ${
      p.falhas.length
        ? `<h3 style="font-size:14px;margin:0 0 8px">Falhas</h3><ul style="margin:0 0 18px;padding-left:18px">${p.falhas
            .map((f) => `<li><strong>${esc(f.nome)}</strong> <code>${esc(f.suite)}</code><br>${esc(f.mensagem)}</li>`)
            .join("")}</ul>`
        : `<p style="margin:0 0 18px">Nenhuma falha nos testes.</p>`
    }
    ${
      p.mudancas.length
        ? `<h3 style="font-size:14px;margin:0 0 8px">Mudanças vs. baseline</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr style="background:#EFEBE1"><th align="left" style="padding:8px">Cenário</th><th align="left" style="padding:8px">Situação</th><th align="left" style="padding:8px">Detalhes</th></tr>
        ${p.mudancas
          .map(
            (m) =>
              `<tr><td style="padding:8px;border-top:1px solid #D6D0C2">${esc(m.nome)}</td><td style="padding:8px;border-top:1px solid #D6D0C2"><strong>${esc(m.rotulo)}</strong></td><td style="padding:8px;border-top:1px solid #D6D0C2">${esc(m.detalhes.join(" · ")) || "—"}</td></tr>`,
          )
          .join("")}
      </table>`
        : `<p style="margin:0 0 18px">Nenhuma mudança relevante nos PDFs.</p>`
    }
    <p style="margin:20px 0 0">
      ${p.artefatosUrl ? `<a href="${p.artefatosUrl}">Artefato ${esc(p.artefato)} (PDFs + resumo HTML)</a><br>` : ""}
      ${p.baselineUrl ? `<a href="${p.baselineUrl}">Baseline — execução ${esc(String(p.baseline?.runId))}</a><br>` : ""}
      ${p.runUrl ? `<a href="${p.runUrl}">Execução no CI</a>` : ""}
    </p>
    ${p.commit ? `<p style="color:#788091;font-size:12px;margin-top:16px">Commit ${esc(p.commit)}</p>` : ""}
  </div>
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject: titulo, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log(`[pdf-notify] E-mail enviado para ${to.join(", ")}.`);
}

async function main() {
  if (!existsSync(arquivo)) {
    console.log(`[pdf-notify] ${arquivo} não encontrado — nada a notificar.`);
    return;
  }
  const p: Payload = JSON.parse(readFileSync(arquivo, "utf8"));
  const sempre = String(process.env.PDF_NOTIFY_ALWAYS || "").toLowerCase() === "true";

  if (!p.deveNotificar && !sempre) {
    console.log("[pdf-notify] Sem falhas e sem mudanças relevantes — notificação não enviada.");
    return;
  }

  const prefixo = p.totalFalhas
    ? "❌ PDF Premium · testes falharam"
    : "⚠️ PDF Premium · cenários mudaram no PDF";
  const titulo = `${prefixo}${p.repo ? ` — ${p.repo}` : ""}${p.workflow ? ` (${p.workflow})` : ""}`;

  const slack = process.env.SLACK_WEBHOOK_URL;
  const resend = process.env.RESEND_API_KEY;
  if (!slack && !resend) {
    console.log("[pdf-notify] Nenhum canal configurado (SLACK_WEBHOOK_URL / RESEND_API_KEY).");
    return;
  }

  if (slack) {
    try {
      await enviarSlack(slack, p, titulo);
    } catch (e) {
      console.error("[pdf-notify] falha no Slack:", String(e));
    }
  }
  if (resend) {
    try {
      await enviarEmail(resend, p, titulo);
    } catch (e) {
      console.error("[pdf-notify] falha no e-mail:", String(e));
    }
  }
}

main().catch((e) => {
  console.error("[pdf-notify] erro:", e);
  process.exit(0); // nunca derruba o job
});
