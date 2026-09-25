# GA4 + GTM — radarimobtech

## 1. Instalação

- Container GTM adicionado em `index.html` (snippet head + noscript body).
- Substitua `GTM-XXXXXXX` (2 ocorrências) pelo ID real do container antes de publicar.
- Todo tracking passa por `window.dataLayer` via `src/lib/analytics.ts`. Nunca chame `gtag()` direto.

## 2. Eventos disparados pela aplicação

| Evento                       | Quando dispara                                                          | Parâmetros                                                                              |
| ---------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `free_trial_started`         | Clique em qualquer CTA de "Teste grátis / Demonstração"                 | `trial_type`, `button_text`, `source`, `page_location`, `page_path`                     |
| `free_trial_signup_success`  | Conta criada em `/auth` OU captação com interesse "grátis/demonstração" | `user_id`, `plan_selected`, `signup_method`, `value`, `currency`                        |
| `form_submission`            | Envio bem-sucedido de qualquer formulário                               | `form_id`, `form_name`, `lead_type`, `form_status`, `page_location` + extras por origem |

Valores de `lead_type`: `contact`, `demo`, `newsletter_signup`, `captura_bairro`, `landing_capture`.

Fontes instrumentadas hoje:

- `src/pages/Landing.tsx` — ContactForm, LeadCaptureForm e 4 CTAs (`navbar`, `mobile_menu`, `hero_cta`, `footer_cta`).
- `src/pages/Auth.tsx` — `signUp` bem-sucedido.
- `src/pages/SolucoesSeoImobiliario.tsx` — CTAs hero e footer.
- `src/pages/ImoveisCidadeBairro.tsx` — formulário de captação por bairro.

## 3. Configuração no GTM

### Variáveis do Data Layer (uma por parâmetro)

Nome da variável = nome do parâmetro. Tipo = **Data Layer Variable**, versão 2.

`trial_type`, `button_text`, `source`, `user_id`, `plan_selected`, `signup_method`,
`value`, `currency`, `form_id`, `form_name`, `lead_type`, `form_status`, `page_location`, `page_path`.

### Triggers (Custom Event)

| Trigger                   | Event name matches                        |
| ------------------------- | ----------------------------------------- |
| `CE - free_trial_started` | `free_trial_started`                      |
| `CE - free_trial_signup`  | `free_trial_signup_success`               |
| `CE - form_submission`    | `form_submission`                         |
| `CE - lead_contact`       | `form_submission` **e** `lead_type=contact` |
| `CE - lead_demo`          | `form_submission` **e** `lead_type=demo`  |

Para os dois últimos use "Some Custom Events" com condição `lead_type equals contact` / `demo`.

### Tags GA4 (GA4 Event, Measurement ID = `G-XXXXXXX`)

1. **GA4 — free_trial_started** → trigger `CE - free_trial_started`
   Parâmetros: `trial_type`, `button_text`, `source`.
2. **GA4 — free_trial_signup_success** → trigger `CE - free_trial_signup`
   Parâmetros: `plan_selected`, `signup_method`, `value`, `currency`, `user_id`.
3. **GA4 — form_submission** → trigger `CE - form_submission`
   Parâmetros: `form_id`, `form_name`, `lead_type`, `form_status`.
4. (Opcional) **GA4 — lead_contact_form** → trigger `CE - lead_contact` (evento renomeado `lead_contact_form`).
5. (Opcional) **GA4 — lead_demo_request** → trigger `CE - lead_demo` (evento `lead_demo_request`).

Todas herdam a tag base **GA4 Configuration** já disparada em `All Pages`.

### Conversões no GA4 (Admin → Events → Mark as conversion)

- **Primária:** `free_trial_signup_success`.
- **Secundárias:** `lead_contact_form`, `lead_demo_request`, e `form_submission` (opcional, se preferir consolidar).

## 4. Validação

1. GTM → **Preview** → informe a URL do site → interaja (clique nos CTAs, envie formulários).
2. Na aba **Tag Assistant**, confirme:
   - `free_trial_started` dispara ao clicar em qualquer CTA "Demonstração / Teste grátis".
   - `form_submission` dispara após toast de sucesso em cada formulário.
   - `free_trial_signup_success` dispara ao criar conta em `/auth`.
3. GA4 → **Admin → DebugView**: com o Preview do GTM ativo, cada evento aparece com todos os parâmetros. Confirme que `plan_selected`, `lead_type`, `source` chegam preenchidos.
4. GA4 → **Realtime**: verifique contagem por `event_name`.
5. Após 24–48h os eventos aparecem em **Reports → Engagement → Events** e podem ser marcados como conversão.

## 5. Extendendo

Para instrumentar um novo formulário:

```ts
import { trackFormSubmission } from "@/lib/analytics";

trackFormSubmission({
  form_id: "novo-form",
  form_name: "Novo Formulário",
  lead_type: "newsletter_signup",
});
```

Para um novo CTA de trial:

```ts
import { trackFreeTrialStarted } from "@/lib/analytics";

trackFreeTrialStarted({ button_text: "Começar agora", source: "novo_ponto" });
```

Nenhuma configuração extra no GTM é necessária desde que os parâmetros usem os nomes já mapeados como variáveis.
