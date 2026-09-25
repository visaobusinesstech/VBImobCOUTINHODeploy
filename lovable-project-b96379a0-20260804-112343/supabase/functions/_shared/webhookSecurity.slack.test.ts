// Testes de envio automático de alertas para Slack via Incoming Webhook.
// Cobre: (1) sem SLACK_WEBHOOK_URL → não envia; (2) filtro por severidade
// mínima; (3) payload contém tenant, provider, valor, threshold e link
// para o dashboard.

import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { notifySlackAlerts, type WebhookAlert } from "./webhookSecurity.ts";

type CapturedRequest = { url: string; body: any };

function withMockedFetch(handler: (req: Request) => Promise<Response> | Response) {
  const original = globalThis.fetch;
  const captured: CapturedRequest[] = [];
  globalThis.fetch = (async (input: any, init?: any) => {
    const req = input instanceof Request
      ? input
      : new Request(String(input), init as RequestInit | undefined);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    captured.push({ url: req.url, body });
    return await handler(req);
  }) as typeof fetch;
  return {
    captured,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function makeAlert(over: Partial<WebhookAlert> = {}): WebhookAlert {
  return {
    tenantId: "00000000-0000-0000-0000-000000000001",
    provider: "portal:zap",
    alertType: "cache_hit_rate_low",
    severity: "critical",
    metricValue: 0.31,
    threshold: 0.7,
    sampleSize: 120,
    windowSeconds: 300,
    message: "cache hit rate abaixo do threshold",
    details: {},
    ...over,
  };
}

Deno.test("notifySlackAlerts: no-op quando SLACK_WEBHOOK_URL ausente", async () => {
  Deno.env.delete("SLACK_WEBHOOK_URL");
  const mock = withMockedFetch(() => new Response("ok"));
  try {
    await notifySlackAlerts([makeAlert()], "req_test_1");
    assertEquals(mock.captured.length, 0);
  } finally {
    mock.restore();
  }
});

Deno.test("notifySlackAlerts: envia crítico e inclui tenant/provider/valor/threshold/link", async () => {
  Deno.env.set("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T/B/XYZ");
  Deno.env.set("WEBHOOK_METRICS_DASHBOARD_URL", "https://example.test");
  const mock = withMockedFetch(() => new Response("ok", { status: 200 }));
  try {
    await notifySlackAlerts([makeAlert()], "req_test_2");
    assertEquals(mock.captured.length, 1);
    const { url, body } = mock.captured[0];
    assertEquals(url, "https://hooks.slack.com/services/T/B/XYZ");
    const flat = JSON.stringify(body);
    assertStringIncludes(flat, "00000000-0000-0000-0000-000000000001");
    assertStringIncludes(flat, "portal:zap");
    assertStringIncludes(flat, "31.0%"); // metricValue formatado
    assertStringIncludes(flat, "70%");   // threshold formatado
    assertStringIncludes(flat, "https://example.test/webhook-metrics?");
    assertStringIncludes(flat, "req_test_2");
  } finally {
    mock.restore();
    Deno.env.delete("SLACK_WEBHOOK_URL");
    Deno.env.delete("WEBHOOK_METRICS_DASHBOARD_URL");
  }
});

Deno.test("notifySlackAlerts: respeita SLACK_ALERT_MIN_SEVERITY=critical (default)", async () => {
  Deno.env.set("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T/B/XYZ");
  Deno.env.delete("SLACK_ALERT_MIN_SEVERITY"); // default = critical
  const mock = withMockedFetch(() => new Response("ok"));
  try {
    await notifySlackAlerts(
      [
        makeAlert({ severity: "info" }),
        makeAlert({ severity: "warning" }),
      ],
      "req_test_3",
    );
    assertEquals(mock.captured.length, 0);
  } finally {
    mock.restore();
    Deno.env.delete("SLACK_WEBHOOK_URL");
  }
});

Deno.test("notifySlackAlerts: formata latência em ms", async () => {
  Deno.env.set("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T/B/XYZ");
  const mock = withMockedFetch(() => new Response("ok"));
  try {
    await notifySlackAlerts(
      [
        makeAlert({
          alertType: "validation_latency_high",
          metricValue: 1834,
          threshold: 1500,
        }),
      ],
      "req_test_4",
    );
    assertEquals(mock.captured.length, 1);
    const flat = JSON.stringify(mock.captured[0].body);
    assertStringIncludes(flat, "1834 ms");
    assertStringIncludes(flat, "1500 ms");
  } finally {
    mock.restore();
    Deno.env.delete("SLACK_WEBHOOK_URL");
  }
});
