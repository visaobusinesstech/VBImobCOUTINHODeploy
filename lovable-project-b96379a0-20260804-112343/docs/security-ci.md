# Pipeline de segurança no CI

Cada PR/push em `main` e uma varredura diária às 03:00 BRT executam o
workflow `.github/workflows/security.yml`, que roda **três jobs paralelos
que reprovam o build ao encontrar problemas**:

## 1. SAST — Semgrep

Regras aplicadas:

- `p/ci` — ruleset curado (baixo falso-positivo)
- `p/security-audit`, `p/owasp-top-ten`
- `p/javascript`, `p/typescript`, `p/react`
- `p/secrets` — detecção de tokens embutidos em código

Resultados são publicados no GitHub Code Scanning (aba **Security**) em
formato SARIF. `--error` faz o job falhar em qualquer finding não
suprimido. Testes (`src/test/**`, `*.test.*`, `*.spec.*`) são excluídos.

## 2. Secret scanning — Gitleaks

Vasculha o histórico completo (`fetch-depth: 0`) usando regras default
mais as customizações em `.gitleaks.toml`:

- Bloqueia JWTs Supabase `service_role` (mas permite a `anon` key que
  legitimamente vai no `.env`).
- Bloqueia `LOVABLE_API_KEY` hardcoded.
- Allowlist para arquivos onde chaves públicas são esperadas
  (`.env`, `src/integrations/supabase/*`, docs, workflows).

Qualquer detecção → job vermelho e PR bloqueado.

## 3. Dependency audit

Três camadas independentes:

- **`npm audit --audit-level=high`** — falha em qualquer vulnerabilidade
  high/critical no `package-lock.json`.
- **Piso explícito para `jspdf`** — o workflow lê
  `node_modules/jspdf/package.json` e falha se a versão for < `4.2.1`
  (GHSA-wfv2-pwc8-crg5). Impede regressão mesmo que alguém rebaixe a
  dependência.
- **OSV-Scanner** — cruza o lockfile com o banco público OSV.dev,
  cobrindo CVEs que ainda não estão no advisory database do npm.

## Como um PR reprova

- SAST detectou padrão inseguro → veja a aba **Security → Code scanning
  alerts** ou os logs do job `SAST (Semgrep)`.
- Segredo commitado → job `Secret scanning` mostra o arquivo, linha e
  regra. Rotacione o segredo antes de qualquer force-push.
- Vulnerabilidade em dependência → atualize o pacote (`bun add pkg@latest`)
  e refaça o `bun install` para regenerar o lockfile. Não é possível
  ignorar uma dependência vulnerável só editando código.

## Suprimindo falsos positivos

- Semgrep: adicione `# nosemgrep: <rule-id> — justificativa` na linha
  específica.
- Gitleaks: prefira ajustar a `allowlist` do `.gitleaks.toml` com regex
  ou path mínimos. Nunca use `git filter-repo` sem antes rotacionar o
  segredo.
- OSV/npm audit: se um CVE for comprovadamente inaplicável, documente em
  `docs/security/exceptions.md` e crie uma issue com a justificativa
  antes de suprimir.
