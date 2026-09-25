import { authService } from '../services/auth.js';

export function renderLogin(container, onAuthenticated) {
  let mode = 'LOGIN';
  let recoveryEmail = '';
  let recoveryCode = '';

  function render() {
    const isLogin = mode === 'LOGIN';
    const isRequest = mode === 'RECOVERY_REQUEST';
    container.innerHTML = `
      <main class="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div class="absolute -top-40 -right-20 w-96 h-96 rounded-full bg-indigo-700/20 blur-3xl"></div>
        <div class="absolute -bottom-32 -left-24 w-80 h-80 rounded-full bg-amber-400/10 blur-3xl"></div>
        <section class="w-full max-w-md relative">
          <div class="mb-7 flex items-center justify-center gap-3 text-white">
            <div class="h-12 w-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg">C</div>
            <div>
              <h1 class="font-extrabold tracking-tight text-xl">COUTINHO</h1>
              <p class="text-[10px] text-amber-400 uppercase tracking-[0.16em] font-bold">CRM Imobiliário</p>
            </div>
          </div>
          <div class="bg-white rounded-2xl shadow-2xl p-7 border border-white/10">
            ${isLogin ? `
              <p class="text-xs uppercase tracking-wider font-bold text-indigo-700 mb-2">Acesso seguro</p>
              <h2 class="text-2xl font-black text-slate-900">Entre na sua operação</h2>
              <p class="text-sm text-slate-500 mt-2">Use suas credenciais para acessar os dados comerciais da Coutinho.</p>
              <form id="login-form" class="mt-6 space-y-4">
                <label class="block text-xs font-bold text-slate-700">E-mail
                  <input id="login-email" type="email" required autocomplete="email" placeholder="nome@empresa.com" class="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </label>
                <label class="block text-xs font-bold text-slate-700">Senha
                  <input id="login-password" type="password" required autocomplete="current-password" placeholder="Sua senha" class="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </label>
                <div id="login-feedback" class="hidden text-xs rounded-lg p-3"></div>
                <button type="submit" class="btn-primary w-full py-3">Entrar no CRM</button>
              </form>
              <button id="show-recovery" class="mt-4 w-full text-xs text-indigo-700 font-bold hover:underline">Esqueci minha senha</button>
            ` : isRequest ? `
              <button id="back-to-login" class="text-xs text-indigo-700 font-bold hover:underline">← Voltar para login</button>
              <p class="text-xs uppercase tracking-wider font-bold text-indigo-700 mt-5 mb-2">Recuperar acesso</p>
              <h2 class="text-2xl font-black text-slate-900">Recuperar senha</h2>
              <p class="text-sm text-slate-500 mt-2">Informe seu e-mail para gerar um código de recuperação.</p>
              <form id="recovery-request-form" class="mt-6 space-y-4">
                <label class="block text-xs font-bold text-slate-700">E-mail corporativo
                  <input id="recovery-email" type="email" required autocomplete="email" placeholder="nome@empresa.com" class="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </label>
                <div id="recovery-feedback" class="hidden text-xs rounded-lg p-3"></div>
                <button type="submit" class="btn-primary w-full py-3">Gerar código de recuperação</button>
              </form>
            ` : `
              <button id="back-to-login" class="text-xs text-indigo-700 font-bold hover:underline">← Voltar para login</button>
              <p class="text-xs uppercase tracking-wider font-bold text-indigo-700 mt-5 mb-2">Nova senha</p>
              <h2 class="text-2xl font-black text-slate-900">Confirme sua recuperação</h2>
              <p class="text-sm text-slate-500 mt-2">Digite o código gerado e escolha uma senha com ao menos 10 caracteres.</p>
              <form id="recovery-reset-form" class="mt-6 space-y-4">
                <label class="block text-xs font-bold text-slate-700">E-mail
                  <input id="reset-email" type="email" value="${recoveryEmail}" required class="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                </label>
                <label class="block text-xs font-bold text-slate-700">Código de 6 dígitos
                  <input id="reset-code" inputmode="numeric" value="${recoveryCode}" required class="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                </label>
                <label class="block text-xs font-bold text-slate-700">Nova senha
                  <input id="reset-password" type="password" minlength="10" required autocomplete="new-password" class="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                </label>
                <div id="reset-feedback" class="hidden text-xs rounded-lg p-3"></div>
                <button type="submit" class="btn-primary w-full py-3">Atualizar senha</button>
              </form>
            `}
          </div>
        </section>
      </main>
    `;

    if (isLogin) {
      container.querySelector('#show-recovery').addEventListener('click', () => { mode = 'RECOVERY_REQUEST'; render(); });
      container.querySelector('#login-form').addEventListener('submit', async event => {
        event.preventDefault();
        const feedback = container.querySelector('#login-feedback');
        const result = await authService.login(container.querySelector('#login-email').value, container.querySelector('#login-password').value);
        if (result.success) return onAuthenticated(result.user);
        feedback.textContent = result.message;
        feedback.className = 'text-xs rounded-lg p-3 bg-rose-50 text-rose-700 border border-rose-200';
      });
    }

    if (isRequest) {
      container.querySelector('#back-to-login').addEventListener('click', () => { mode = 'LOGIN'; render(); });
      container.querySelector('#recovery-request-form').addEventListener('submit', async event => {
        event.preventDefault();
        recoveryEmail = container.querySelector('#recovery-email').value;
        const result = await authService.requestPasswordReset(recoveryEmail);
        const feedback = container.querySelector('#recovery-feedback');
        feedback.innerHTML = `${result.message}${result.demoCode ? `<br><strong class="block mt-2">Código local: ${result.demoCode}</strong>` : ''}`;
        feedback.className = 'text-xs rounded-lg p-3 bg-amber-50 text-amber-800 border border-amber-200';
        if (result.demoCode) {
          recoveryCode = result.demoCode;
          setTimeout(() => { mode = 'RECOVERY_RESET'; render(); }, 1200);
        }
      });
    }

    if (!isLogin && !isRequest) {
      container.querySelector('#back-to-login').addEventListener('click', () => { mode = 'LOGIN'; render(); });
      container.querySelector('#recovery-reset-form').addEventListener('submit', async event => {
        event.preventDefault();
        const result = await authService.resetPassword(
          container.querySelector('#reset-email').value,
          container.querySelector('#reset-code').value,
          container.querySelector('#reset-password').value
        );
        const feedback = container.querySelector('#reset-feedback');
        feedback.textContent = result.message;
        feedback.className = `text-xs rounded-lg p-3 ${result.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`;
        if (result.success) setTimeout(() => { mode = 'LOGIN'; render(); }, 1000);
      });
    }
  }
  render();
}
