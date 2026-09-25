/**
 * View: Coutinho IA
 * Assistente operacional + fila de follow-up automático
 */
import { aiService } from '../services/ai.js';
import { db } from '../state/db.js';

function daysSince(isoDate) {
  if (!isoDate) return 999;
  return Math.floor((Date.now() - new Date(isoDate)) / 86400000);
}

export function renderAssistant(container) {
  const greeting = aiService.getGreeting();

  container.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div class="flex items-center gap-2">
            <span class="relative flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Coutinho IA</h1>
          </div>
          <p class="text-sm text-slate-500">Assistente interno para inteligência comercial, priorização e relacionamento</p>
        </div>
        <div class="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold">
          Dados protegidos · Consulta apenas sua operação autorizada
        </div>
      </div>

      <!-- Clientes Prioritários (fechamento imediato) -->
      <div class="bg-white border-2 border-rose-400 rounded-2xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-rose-600 to-red-700 p-4 text-white flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-2xl">🔥</span>
            <div>
              <h2 class="font-bold text-sm">Clientes Prioritários · Fechamento Imediato</h2>
              <p class="text-[11px] text-rose-100">Score alto + prazo de compra imediato + interações recentes = atender AGORA</p>
            </div>
          </div>
          <span class="text-[10px] bg-white/15 px-2 py-1 rounded font-semibold">Atualiza em tempo real</span>
        </div>
        <div id="priority-list" class="divide-y divide-slate-100 max-h-[300px] overflow-y-auto"></div>
      </div>

      <!-- Fila de Follow-up Automático -->
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 text-white flex items-center justify-between">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <div>
              <h2 class="font-bold text-sm">Follow-up Automático · Próximos Leads para Contatar</h2>
              <p class="text-[11px] text-indigo-200">Priorizados por Lead Score, intenção e tempo sem contato</p>
            </div>
          </div>
          <span class="text-[10px] bg-white/10 px-2 py-1 rounded font-semibold">Revisão humana antes do envio</span>
        </div>
        <div id="followup-queue" class="divide-y divide-slate-100 max-h-[340px] overflow-y-auto"></div>
      </div>
      <div id="followup-modal"></div>

      <!-- Nutrição Automática de Leads -->
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-emerald-800 to-teal-700 p-4 text-white flex items-center justify-between">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            <div>
              <h2 class="font-bold text-sm">Nutrição Automática de Leads · Coutinho IA</h2>
              <p class="text-[11px] text-emerald-100">Leads parados recebem conteúdo de mercado; respostas alertam o corretor na hora</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-nurture-api" class="text-[11px] font-semibold bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              Configurar API
            </button>
            <label class="flex items-center gap-2 text-[11px] font-semibold cursor-pointer">
              <input type="checkbox" id="nurture-toggle" class="accent-amber-400">
              <span>Nutrição ativa</span>
            </label>
          </div>
        </div>
        <div id="nurture-alerts"></div>
        <div id="nurture-list" class="divide-y divide-slate-100 max-h-[400px] overflow-y-auto"></div>
      </div>
      <div id="nurture-modal"></div>
      <div id="nurture-api-modal"></div>

      <!-- Lembretes & Datas Importantes -->
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-rose-800 to-amber-700 p-4 text-white flex items-center justify-between">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <div>
              <h2 class="font-bold text-sm">Lembretes & Datas Importantes · Próximos 30 dias</h2>
              <p class="text-[11px] text-amber-100">Aniversários, casamento, filhos, aniversário da compra, contratos e datas festivas</p>
            </div>
          </div>
          <button id="btn-add-reminder" class="text-[11px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded font-semibold">+ Adicionar lembrete</button>
        </div>
        <div id="reminders-list" class="divide-y divide-slate-100 max-h-[380px] overflow-y-auto"></div>
      </div>
      <div id="reminders-modal"></div>

      <!-- Interface de Chat -->
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[560px] flex flex-col">
        <div class="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 text-white flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-lg shadow-lg">C</div>
          <div>
            <div class="font-bold text-sm">Coutinho IA · Consultora da Operação</div>
            <div class="text-xs text-indigo-200">Conectada ao CRM · Base demonstrativa local</div>
          </div>
        </div>

        <div id="ai-chat-history" class="flex-1 p-5 overflow-y-auto space-y-5 bg-slate-50/50">
          <div class="flex gap-3 items-start">
            <div class="w-7 h-7 rounded-lg bg-slate-900 text-amber-400 flex-shrink-0 flex items-center justify-center font-bold text-xs">C</div>
            <div class="bg-white border border-slate-200 rounded-xl rounded-tl-none px-4 py-3 text-sm text-slate-700 max-w-2xl shadow-sm">
              ${greeting}
            </div>
          </div>
        </div>

        <!-- Sugestões rápidas -->
        <div class="px-5 pb-3 bg-slate-50/50">
          <div class="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Perguntas sugeridas</div>
          <div class="flex flex-wrap gap-2" id="ai-quick-prompts">
            <button class="ai-prompt-chip">Quais leads estão sem contato há mais de 3 dias?</button>
            <button class="ai-prompt-chip">Quais clientes estão quentes?</button>
            <button class="ai-prompt-chip">Quanto tenho para receber este mês?</button>
            <button class="ai-prompt-chip">Quais imóveis estão disponíveis?</button>
            <button class="ai-prompt-chip">Qual corretor possui mais oportunidades?</button>
            <button class="ai-prompt-chip">Quais avaliações foram realizadas esta semana?</button>
          </div>
        </div>

        <form id="ai-chat-form" class="p-4 border-t border-slate-200 bg-white flex items-center gap-3">
          <input id="ai-chat-input" type="text" autocomplete="off" placeholder="Pergunte sobre leads, imóveis, contratos, comissões ou avaliações..." class="flex-1 text-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white">
          <button type="submit" class="btn-primary px-4 py-3 rounded-xl flex items-center gap-2">
            <span class="hidden sm:inline">Consultar</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 2L11 13"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </form>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div class="p-4 border border-slate-200 bg-white rounded-xl">
          <strong class="block text-slate-900 mb-1">Consulta contextual</strong>
          <span class="text-slate-600">Leads, imóveis, funil, contratos e comissões conforme permissões.</span>
        </div>
        <div class="p-4 border border-slate-200 bg-white rounded-xl">
          <strong class="block text-slate-900 mb-1">Follow-up assistido</strong>
          <span class="text-slate-600">Sugestões prontas para revisão humana antes de qualquer envio.</span>
        </div>
        <div class="p-4 border border-slate-200 bg-white rounded-xl">
          <strong class="block text-slate-900 mb-1">Canal seguro</strong>
          <span class="text-slate-600">Nenhuma mensagem externa sai sem API oficial e autorização configurada.</span>
        </div>
      </div>
    </div>
  `;

  const history = container.querySelector('#ai-chat-history');
  const form = container.querySelector('#ai-chat-form');
  const input = container.querySelector('#ai-chat-input');

  function escapeHtml(text) {
    const node = document.createElement('div');
    node.textContent = text;
    return node.innerHTML;
  }

  function submitQuestion(question) {
    const normalized = question.trim();
    if (!normalized) return;

    history.insertAdjacentHTML('beforeend', `
      <div class="flex gap-3 items-start justify-end">
        <div class="bg-indigo-600 text-white rounded-xl rounded-tr-none px-4 py-3 text-sm max-w-xl shadow-sm">
          ${escapeHtml(normalized)}
        </div>
        <div class="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex-shrink-0 flex items-center justify-center font-bold text-xs">EU</div>
      </div>
    `);

    const loadingId = `ai-loading-${Date.now()}`;
    history.insertAdjacentHTML('beforeend', `
      <div id="${loadingId}" class="flex gap-3 items-start">
        <div class="w-7 h-7 rounded-lg bg-slate-900 text-amber-400 flex-shrink-0 flex items-center justify-center font-bold text-xs">C</div>
        <div class="bg-white border border-slate-200 rounded-xl rounded-tl-none px-4 py-3 text-xs text-slate-500 shadow-sm">
          Analisando dados autorizados do CRM...
        </div>
      </div>
    `);
    history.scrollTop = history.scrollHeight;

    setTimeout(() => {
      const result = aiService.query(normalized);
      const loading = history.querySelector(`#${loadingId}`);
      if (loading) loading.remove();

      const items = result.items.length ? `
        <div class="mt-3 space-y-2">
          ${result.items.map(item => `
            <div class="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
              <div class="flex items-center justify-between gap-2">
                <strong class="text-slate-900 text-xs">${escapeHtml(item.title)}</strong>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 whitespace-nowrap">${escapeHtml(item.tag)}</span>
              </div>
              <div class="text-[11px] text-slate-600 mt-1">${escapeHtml(item.subtitle)}</div>
              <button class="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold mt-1.5 ai-item-action">${escapeHtml(item.action)}</button>
            </div>
          `).join('')}
        </div>
      ` : '';

      history.insertAdjacentHTML('beforeend', `
        <div class="flex gap-3 items-start">
          <div class="w-7 h-7 rounded-lg bg-slate-900 text-amber-400 flex-shrink-0 flex items-center justify-center font-bold text-xs">C</div>
          <div class="bg-white border border-slate-200 rounded-xl rounded-tl-none px-4 py-3 text-sm text-slate-700 max-w-2xl shadow-sm">
            <strong class="block text-slate-900 mb-1">${escapeHtml(result.title)}</strong>
            <span>${escapeHtml(result.answer)}</span>
            ${items}
          </div>
        </div>
      `);
      history.scrollTop = history.scrollHeight;
    }, 350);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitQuestion(input.value);
    input.value = '';
    input.focus();
  });

  container.querySelectorAll('.ai-prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => submitQuestion(chip.textContent));
  });

  // ---- Fila de Follow-up Automático ----
  function buildFollowupQueue() {
    const top = aiService.getTopLeads(12);
    return top.map(({ client, score }) => {
      const days = daysSince(client.lastContactAt);
      let priority = 3, reason = 'Nutrição de relacionamento';
      if (score >= 70 && days >= 1) { priority = 1; reason = `Score ${score} e ${days} dia(s) sem contato — contato imediato`; }
      else if (score >= 45 || days >= 3) { priority = 2; reason = days >= 3 ? `${days} dias sem retorno — reativar` : `Perfil qualificado (score ${score})`; }
      if (client.purchaseDeadline === 'IMEDIATO') { priority = Math.min(priority, 1); reason = 'Compra prevista para os próximos 30 dias — ' + reason; }
      return { client, score, days, priority, reason };
    }).sort((a, b) => a.priority - b.priority || b.score - a.score);
  }

  function renderQueue() {
    const queueEl = container.querySelector('#followup-queue');
    if (!queueEl) return;
    const queue = buildFollowupQueue();
    if (!queue.length) {
      queueEl.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">Nenhum lead na fila de follow-up no momento.</div>';
      return;
    }
    const priBadge = { 1: 'bg-rose-100 text-rose-800', 2: 'bg-amber-100 text-amber-800', 3: 'bg-slate-100 text-slate-600' };
    const priLabel = { 1: 'PRIORIDADE 1', 2: 'PRIORIDADE 2', 3: 'ACOMPANHAR' };
    queueEl.innerHTML = queue.map(({ client, score, priority, reason }) => `
      <div class="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50">
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-[9px] font-black px-1.5 py-0.5 rounded ${priBadge[priority]}">${priLabel[priority]}</span>
            <strong class="text-xs text-slate-900 truncate">${escapeHtml(client.name)}</strong>
            <span class="text-[10px] font-bold text-indigo-600">${score}/100</span>
          </div>
          <div class="text-[11px] text-slate-500 truncate">${escapeHtml(reason)}</div>
        </div>
        <button class="btn-followup flex-shrink-0 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg" data-client-id="${client.id}">
          Preparar contato
        </button>
      </div>
    `).join('');

    queueEl.querySelectorAll('.btn-followup').forEach(btn => {
      btn.addEventListener('click', (e) => openFollowupModal(e.currentTarget.getAttribute('data-client-id')));
    });
  }

  function openFollowupModal(clientId) {
    const client = db.getById('clients', clientId);
    if (!client) return;
    const modalRoot = container.querySelector('#followup-modal');
    const msg = aiService.suggestFollowUp(client);
    const phone = (client.whatsapp || client.phone || '').replace(/\D/g, '');

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-900">Follow-up · ${escapeHtml(client.name)}</h3>
            <button id="fu-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>
          <div class="mt-4 text-xs">
            <label class="block font-semibold text-slate-700 mb-1">Mensagem gerada pela Coutinho IA</label>
            <textarea id="fu-text" rows="5" class="w-full p-3 border rounded-lg font-mono text-[11px] leading-relaxed">${escapeHtml(msg)}</textarea>
            <div class="mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              ℹ️ Revise antes de enviar. O disparo é feito por você via canal oficial (LGPD).
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button id="fu-copy" class="btn-secondary text-xs">Copiar</button>
            <a id="fu-whats" href="https://wa.me/55${phone}?text=" target="_blank" class="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700">Enviar no WhatsApp</a>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#fu-close').addEventListener('click', close);
    const textEl = modalRoot.querySelector('#fu-text');
    const whats = modalRoot.querySelector('#fu-whats');
    const syncLink = () => { whats.href = `https://wa.me/55${phone}?text=${encodeURIComponent(textEl.value)}`; };
    syncLink();
    textEl.addEventListener('input', syncLink);
    modalRoot.querySelector('#fu-copy').addEventListener('click', () => { navigator.clipboard.writeText(textEl.value); });
    whats.addEventListener('click', () => {
      db.insert('interactions', { clientId, brokerId: client.brokerId, channel: 'WHATSAPP', type: 'FOLLOW_UP', content: textEl.value, createdAt: new Date().toISOString() });
      db.update('clients', clientId, { lastContactAt: new Date().toISOString() });
      close();
      renderQueue();
    });
  }

  function buildPriorityLeads() {
    const clients = db.get('clients') || [];
    return clients
      .filter(c => c.type !== 'PROPRIETARIO' && c.status === 'ATIVO')
      .map(c => {
        const score = aiService.scoreLead(c);
        const days = daysSince(c.lastContactAt);
        const interactions = db.get('interactions').filter(i => i.clientId === c.id);
        const hasRecentInteraction = interactions.some(i => daysSince(i.createdAt) <= 3);
        const isImmediate = c.purchaseDeadline === 'IMEDIATO' || c.purchaseDeadline === 'ATE_3M';
        const isHot = score >= 70 || c.temperature === 'MUITO_QUENTE' || c.temperature === 'QUENTE';

        let priorityScore = 0;
        if (isHot) priorityScore += 40;
        if (isImmediate) priorityScore += 30;
        if (hasRecentInteraction) priorityScore += 20;
        if (score >= 80) priorityScore += 10;
        if (days <= 2) priorityScore += 10;

        return { client: c, score, days, priorityScore, isImmediate, hasRecentInteraction };
      })
      .filter(x => x.priorityScore >= 60)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 8);
  }

  function renderPriority() {
    const listEl = container.querySelector('#priority-list');
    if (!listEl) return;
    const items = buildPriorityLeads();
    if (!items.length) {
      listEl.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">Nenhum cliente com potencial de fechamento imediato agora. Continue nutrindo os leads da fila abaixo.</div>';
      return;
    }
    listEl.innerHTML = items.map(({ client, score, days, priorityScore, isImmediate, hasRecentInteraction }) => {
      const broker = db.getById('users', client.brokerId);
      const phone = (client.whatsapp || client.phone || '').replace(/\D/g, '');
      const dealValue = client.priceRangeMax || 0;
      return `
        <div class="p-3.5 hover:bg-rose-50/40 border-l-4 border-l-rose-500">
          <div class="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-lg">🔥</span>
                <strong class="text-sm text-slate-900">${escapeHtml(client.name)}</strong>
                <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">${priorityScore}pts</span>
                ${isImmediate ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">FECHA JÁ</span>' : ''}
                ${hasRecentInteraction ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">✓ AQUECIDO</span>' : ''}
              </div>
              <div class="text-[11px] text-slate-600 mt-0.5">
                Score ${score}/100 · ${escapeHtml(client.interestRegion || 'DF')} · ${escapeHtml(client.propertyType || 'imóvel')} até <strong>${dealValue ? 'R$ ' + dealValue.toLocaleString('pt-BR') : '—'}</strong>
              </div>
              <div class="text-[10px] text-slate-500 mt-0.5">
                Corretor: <strong>${broker ? escapeHtml(broker.name) : '—'}</strong> · Último contato: ${days === 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`}
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              ${phone ? `<a href="https://wa.me/55${phone}?text=${encodeURIComponent(`Oi ${(client.name || '').split(' ')[0]}! Posso te ligar hoje para acelerar o fechamento?`)}" target="_blank" class="text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg">Chamar agora</a>` : ''}
              <button class="btn-priority-details text-[11px] font-bold text-rose-700 hover:text-rose-900 px-2" data-id="${client.id}">Abrir</button>
            </div>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.btn-priority-details').forEach(b => b.addEventListener('click', e => {
      const id = e.currentTarget.getAttribute('data-id');
      window.location.hash = `#/crm?id=${id}`;
    }));
  }

  renderQueue();
  renderPriority();

  const REMINDER_TYPES = {
    ANIVERSARIO: { label: 'Aniversário', icon: '🎂', color: 'bg-rose-100 text-rose-800' },
    CASAMENTO: { label: 'Casamento', icon: '💍', color: 'bg-pink-100 text-pink-800' },
    FILHO: { label: 'Aniversário de filho', icon: '👶', color: 'bg-sky-100 text-sky-800' },
    ANIVERSARIO_COMPRA: { label: 'Aniversário da compra', icon: '🏠', color: 'bg-amber-100 text-amber-800' },
    CONTRATO: { label: 'Vencimento de contrato', icon: '📋', color: 'bg-indigo-100 text-indigo-800' },
    FESTIVA: { label: 'Data festiva', icon: '🎉', color: 'bg-emerald-100 text-emerald-800' },
    PESSOAL: { label: 'Pessoal', icon: '📌', color: 'bg-slate-100 text-slate-700' }
  };

  const FESTIVE_DATES = [
    { md: '01-01', title: 'Ano Novo' },
    { md: '04-21', title: 'Aniversário de Brasília / Tiradentes' },
    { md: '05-01', title: 'Dia do Trabalhador' },
    { md: '05-11', title: 'Dia das Mães (2º dom. de maio — verifique)' },
    { md: '05-27', title: 'Dia do Corretor de Imóveis' },
    { md: '06-12', title: 'Dia dos Namorados' },
    { md: '08-10', title: 'Dia dos Pais (2º dom. de agosto — verifique)' },
    { md: '09-07', title: 'Independência do Brasil' },
    { md: '10-12', title: 'Dia das Crianças / Nossa Senhora Aparecida' },
    { md: '10-15', title: 'Dia do Professor' },
    { md: '10-28', title: 'Dia do Servidor Público' },
    { md: '11-15', title: 'Proclamação da República' },
    { md: '12-25', title: 'Natal' },
    { md: '03-13', title: 'Aniversário de Ceilândia' },
    { md: '05-25', title: 'Aniversário de Taguatinga' },
    { md: '10-25', title: 'Aniversário de Samambaia' },
    { md: '06-27', title: 'Aniversário de Águas Claras' },
    { md: '05-13', title: 'Aniversário do Guará' },
    { md: '05-05', title: 'Aniversário de Sobradinho' },
    { md: '10-05', title: 'Aniversário de Planaltina' },
    { md: '10-19', title: 'Aniversário do Gama' },
    { md: '04-06', title: 'Aniversário do Núcleo Bandeirante' },
    { md: '07-04', title: 'Aniversário do Cruzeiro' },
    { md: '05-06', title: 'Aniversário do Lago Norte' },
    { md: '01-10', title: 'Aniversário do Lago Sul' },
    { md: '05-06', title: 'Aniversário do Riacho Fundo' },
    { md: '01-27', title: 'Aniversário do Recanto das Emas' },
    { md: '01-26', title: 'Aniversário de Vicente Pires' },
    { md: '03-08', title: 'Aniversário do Jardim Botânico' },
    { md: '04-27', title: 'Aniversário do Itapoã' },
    { md: '07-25', title: 'Aniversário da Estrutural' },
    { md: '07-10', title: 'Dia do Engenheiro' },
    { md: '10-11', title: 'Dia do Arquiteto' },
    { md: '11-11', title: 'Dia do Advogado' },
    { md: '08-22', title: 'Dia do Contador' },
    { md: '10-18', title: 'Dia do Médico' },
    { md: '05-12', title: 'Dia do Enfermeiro' }
  ];

  function daysUntil(dateStr) {
    const today = new Date(); today.setHours(0,0,0,0);
    const [y, m, d] = dateStr.split('-').map(Number);
    let next = new Date(today.getFullYear(), m - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
    return Math.round((next - today) / 86400000);
  }

  function collectReminders() {
    const items = [];
    const rems = db.get('reminders') || [];
    rems.forEach(r => {
      const days = daysUntil(r.date);
      if (days <= 60) items.push({ id: r.id, type: r.type, title: r.title, notes: r.notes, date: r.date, days, clientId: r.clientId, source: 'MANUAL' });
    });

    (db.get('contracts') || []).forEach(c => {
      if (!c.endDate || c.status !== 'ATIVO') return;
      const days = daysUntil(c.endDate);
      if (days <= 60) items.push({
        id: 'ctr-' + c.id, type: 'CONTRATO',
        title: `Contrato ${c.contractNumber || c.id} vence`,
        notes: `Valor: R$ ${(c.totalValue || 0).toLocaleString('pt-BR')}`,
        date: c.endDate, days, clientId: c.clientId, source: 'CONTRACT'
      });
    });

    const thisYear = new Date().getFullYear();
    FESTIVE_DATES.forEach(f => {
      const dateStr = `${thisYear}-${f.md}`;
      const days = daysUntil(dateStr);
      if (days <= 30) items.push({
        id: 'festive-' + f.md, type: 'FESTIVA', title: f.title,
        notes: 'Data festiva — oportunidade de contato', date: dateStr, days, clientId: null, source: 'FESTIVE'
      });
    });

    return items.sort((a, b) => a.days - b.days);
  }

  function renderReminders() {
    const el = container.querySelector('#reminders-list');
    if (!el) return;
    const items = collectReminders();
    if (!items.length) {
      el.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">Nenhum lembrete nos próximos 30-60 dias. Clique em "+ Adicionar lembrete" para cadastrar.</div>';
      return;
    }
    el.innerHTML = items.map(item => {
      const t = REMINDER_TYPES[item.type] || REMINDER_TYPES.PESSOAL;
      const client = item.clientId ? db.getById('clients', item.clientId) : null;
      const urgent = item.days <= 7;
      return `
        <div class="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 ${urgent ? 'border-l-4 border-l-rose-500' : ''}">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-0.5 flex-wrap">
              <span class="text-lg">${t.icon}</span>
              <strong class="text-xs text-slate-900 truncate">${escapeHtml(item.title)}</strong>
              <span class="text-[9px] font-black px-1.5 py-0.5 rounded ${t.color}">${t.label.toUpperCase()}</span>
              ${item.source !== 'MANUAL' ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">AUTO</span>` : ''}
              <span class="text-[10px] font-bold ${urgent ? 'text-rose-600' : 'text-slate-500'}">
                ${item.days === 0 ? 'HOJE' : item.days === 1 ? 'AMANHÃ' : `em ${item.days} dias`} · ${new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div class="text-[11px] text-slate-500 truncate">
              ${client ? `<strong class="text-slate-700">${escapeHtml(client.name)}</strong> · ` : ''}${escapeHtml(item.notes || '')}
            </div>
          </div>
          <div class="flex items-center gap-1">
            ${client && (client.whatsapp || client.phone) ? `<a href="https://wa.me/55${(client.whatsapp || client.phone).replace(/\\D/g,'')}?text=${encodeURIComponent(item.title)}" target="_blank" class="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg">WhatsApp</a>` : ''}
            ${item.source === 'MANUAL' ? `<button class="btn-del-reminder text-[11px] text-rose-500 hover:text-rose-700 font-bold px-2" data-id="${item.id}">✕</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('.btn-del-reminder').forEach(b => b.addEventListener('click', e => {
      if (confirm('Remover este lembrete?')) {
        db.delete('reminders', e.currentTarget.getAttribute('data-id'));
        renderReminders();
      }
    }));
  }

  function openReminderModal() {
    const modal = container.querySelector('#reminders-modal');
    const clients = db.get('clients') || [];
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-900">Novo lembrete</h3>
            <button id="rem-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>
          <form id="rem-form" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Tipo *</label>
              <select name="type" class="w-full p-2 border rounded-lg" required>
                ${Object.entries(REMINDER_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Título *</label>
              <input type="text" name="title" required class="w-full p-2 border rounded-lg" placeholder="Ex: Aniversário do João">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Data *</label>
              <input type="date" name="date" required class="w-full p-2 border rounded-lg">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Cliente vinculado (opcional)</label>
              <select name="clientId" class="w-full p-2 border rounded-lg">
                <option value="">— Sem cliente —</option>
                ${clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Observações</label>
              <textarea name="notes" rows="2" class="w-full p-2 border rounded-lg"></textarea>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="rem-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar lembrete</button>
            </div>
          </form>
        </div>
      </div>
    `;
    const close = () => { modal.innerHTML = ''; };
    modal.querySelector('#rem-close').addEventListener('click', close);
    modal.querySelector('#rem-cancel').addEventListener('click', close);
    modal.querySelector('#rem-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      db.insert('reminders', {
        type: fd.get('type'),
        title: fd.get('title'),
        date: fd.get('date'),
        clientId: fd.get('clientId') || null,
        notes: fd.get('notes') || ''
      });
      close();
      renderReminders();
    });
  }

  const btnAddRem = container.querySelector('#btn-add-reminder');
  if (btnAddRem) btnAddRem.addEventListener('click', openReminderModal);
  renderReminders();

  const NURTURE_KEY = 'coutinho_nurture_active';
  const NURTURE_API_KEY = 'coutinho_nurture_api_config';
  const nurtureToggle = container.querySelector('#nurture-toggle');
  if (nurtureToggle) {
    nurtureToggle.checked = localStorage.getItem(NURTURE_KEY) === '1';
    nurtureToggle.addEventListener('change', () => {
      localStorage.setItem(NURTURE_KEY, nurtureToggle.checked ? '1' : '0');
      renderNurture();
    });
  }

  function getApiConfig() {
    try { return JSON.parse(localStorage.getItem(NURTURE_API_KEY) || '{}'); } catch { return {}; }
  }

  function openNurtureApiModal() {
    const modal = container.querySelector('#nurture-api-modal');
    const cfg = getApiConfig();
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-base font-bold text-slate-900">Configurar APIs de Nutrição</h3>
              <p class="text-[11px] text-slate-500">Credenciais oficiais para envio automatizado e geração de conteúdo com IA</p>
            </div>
            <button id="na-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-4 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            🔒 Credenciais salvas localmente neste navegador. Em produção, use variáveis de ambiente no servidor. Sem chave, a IA apenas <strong>prepara</strong> a mensagem para você revisar e enviar manualmente.
          </div>

          <form id="na-form" class="mt-4 space-y-4 text-xs">
            <div class="border border-slate-200 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <strong class="text-slate-900">💬 WhatsApp Business Cloud API</strong>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded ${cfg.waToken ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
                  ${cfg.waToken ? 'CONFIGURADO' : 'PENDENTE'}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 mb-2">Canal oficial Meta. Necessário para disparo autorizado das mensagens de nutrição.</p>
              <div class="grid grid-cols-2 gap-2">
                <input name="waPhoneId" value="${cfg.waPhoneId || ''}" placeholder="Phone Number ID" class="p-2 border rounded-lg">
                <input name="waBusinessId" value="${cfg.waBusinessId || ''}" placeholder="Business Account ID" class="p-2 border rounded-lg">
              </div>
              <input name="waToken" type="password" value="${cfg.waToken || ''}" placeholder="Access Token permanente" class="w-full p-2 border rounded-lg mt-2">
              <p class="text-[10px] text-slate-400 mt-1.5">Obtenha em <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" class="text-indigo-600 hover:underline">developers.facebook.com</a> · Conta Meta Business verificada</p>
            </div>

            <div class="border border-slate-200 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <strong class="text-slate-900">🤖 IA para geração de conteúdo</strong>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded ${cfg.aiToken ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
                  ${cfg.aiToken ? 'CONFIGURADO' : 'PENDENTE'}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 mb-2">Para gerar mensagens personalizadas de nutrição de acordo com o perfil do lead.</p>
              <select name="aiProvider" class="w-full p-2 border rounded-lg mb-2">
                <option value="anthropic" ${cfg.aiProvider === 'anthropic' ? 'selected' : ''}>Anthropic Claude (recomendado)</option>
                <option value="openai" ${cfg.aiProvider === 'openai' ? 'selected' : ''}>OpenAI GPT</option>
              </select>
              <input name="aiToken" type="password" value="${cfg.aiToken || ''}" placeholder="API Key" class="w-full p-2 border rounded-lg">
              <p class="text-[10px] text-slate-400 mt-1.5">Sem chave configurada, o sistema usa os templates internos da Coutinho IA.</p>
            </div>

            <div class="border border-slate-200 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <strong class="text-slate-900">📊 Regras da Nutrição</strong>
              </div>
              <label class="block text-[11px] text-slate-600 mb-1">Considerar "lead parado" após (dias sem contato)</label>
              <input name="daysUntilParked" type="number" value="${cfg.daysUntilParked || 7}" min="1" class="w-full p-2 border rounded-lg mb-2">
              <label class="block text-[11px] text-slate-600 mb-1">Intervalo entre mensagens de nutrição (dias)</label>
              <input name="nurtureInterval" type="number" value="${cfg.nurtureInterval || 14}" min="3" class="w-full p-2 border rounded-lg mb-2">
              <label class="flex items-center gap-2 text-[11px] text-slate-700">
                <input type="checkbox" name="autoSend" ${cfg.autoSend ? 'checked' : ''} class="accent-emerald-600">
                <span>Enviar automaticamente sem aprovação humana (não recomendado — LGPD)</span>
              </label>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="na-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar configuração</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ''; };
    modal.querySelector('#na-close').addEventListener('click', close);
    modal.querySelector('#na-cancel').addEventListener('click', close);
    modal.querySelector('#na-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const newCfg = {
        waPhoneId: fd.get('waPhoneId') || '',
        waBusinessId: fd.get('waBusinessId') || '',
        waToken: fd.get('waToken') || '',
        aiProvider: fd.get('aiProvider') || 'anthropic',
        aiToken: fd.get('aiToken') || '',
        daysUntilParked: Number(fd.get('daysUntilParked')) || 7,
        nurtureInterval: Number(fd.get('nurtureInterval')) || 14,
        autoSend: fd.get('autoSend') === 'on'
      };
      localStorage.setItem(NURTURE_API_KEY, JSON.stringify(newCfg));
      close();
    });
  }

  const btnApi = container.querySelector('#btn-nurture-api');
  if (btnApi) btnApi.addEventListener('click', openNurtureApiModal);

  const MARKET_DATA_DF = {
    'Plano Piloto': { m2Venda: 12800, m2Aluguel: 55, tendencia: 'estável', ofertaVariacao: '+3%', destaque: 'alta demanda para 2 e 3 quartos reformados' },
    'Asa Norte': { m2Venda: 12500, m2Aluguel: 53, tendencia: 'alta', ofertaVariacao: '+2%', destaque: 'valorização em quadras próximas ao metrô' },
    'Asa Sul': { m2Venda: 13200, m2Aluguel: 58, tendencia: 'alta', ofertaVariacao: '+1%', destaque: 'liquidez alta em 1 e 2 quartos' },
    'Noroeste': { m2Venda: 13500, m2Aluguel: 55, tendencia: 'alta', ofertaVariacao: '+4%', destaque: 'maior valorização do DF em 12 meses' },
    'Sudoeste': { m2Venda: 12100, m2Aluguel: 50, tendencia: 'estável', ofertaVariacao: '+2%', destaque: 'boa relação custo x localização' },
    'Águas Claras': { m2Venda: 8900, m2Aluguel: 38, tendencia: 'alta', ofertaVariacao: '+5%', destaque: 'metrô e infraestrutura completa' },
    'Vicente Pires': { m2Venda: 5800, m2Aluguel: 28, tendencia: 'alta', ofertaVariacao: '+6%', destaque: 'casas com terreno em valorização acelerada' },
    'Taguatinga': { m2Venda: 6200, m2Aluguel: 26, tendencia: 'estável', ofertaVariacao: '+2%', destaque: 'centro comercial e comércio consolidado' },
    'Guará': { m2Venda: 7800, m2Aluguel: 34, tendencia: 'alta', ofertaVariacao: '+3%', destaque: 'proximidade com Plano Piloto' },
    'Ceilândia': { m2Venda: 4200, m2Aluguel: 18, tendencia: 'estável', ofertaVariacao: '+1%', destaque: 'entrada para primeiros compradores' },
    'Samambaia': { m2Venda: 3900, m2Aluguel: 16, tendencia: 'estável', ofertaVariacao: '+2%', destaque: 'MCMV forte na região' },
    'Sobradinho': { m2Venda: 5100, m2Aluguel: 22, tendencia: 'alta', ofertaVariacao: '+4%', destaque: 'expansão dos condomínios horizontais' },
    'Lago Sul': { m2Venda: 18500, m2Aluguel: 90, tendencia: 'estável', ofertaVariacao: '0%', destaque: 'alto padrão, ticket alto, baixa liquidez' },
    'Lago Norte': { m2Venda: 15800, m2Aluguel: 75, tendencia: 'estável', ofertaVariacao: '+1%', destaque: 'residencial de médio-alto padrão' },
    'Park Way': { m2Venda: 9500, m2Aluguel: 42, tendencia: 'alta', ofertaVariacao: '+3%', destaque: 'chácaras e mansões' }
  };

  function getMarketData(region) {
    if (!region) return null;
    const clean = region.split('/')[0].trim();
    for (const key in MARKET_DATA_DF) {
      if (clean.toLowerCase().includes(key.toLowerCase())) return { region: key, ...MARKET_DATA_DF[key] };
    }
    return null;
  }

  function nurtureTemplates(client, days) {
    const first = (client.name || '').split(' ')[0] || 'olá';
    const region = client.interestRegion || 'sua região';
    const market = getMarketData(region);

    const marketLine = market
      ? ` Em ${market.region}, o m² de venda está em R$ ${market.m2Venda.toLocaleString('pt-BR')} (tendência ${market.tendencia}, variação ${market.ofertaVariacao} na oferta). Destaque: ${market.destaque}.`
      : '';

    const t1 = `Oi, ${first}! Passando pra saber se ainda está pensando em imóvel em ${region}.${marketLine} Se quiser, mando um panorama completo — sem compromisso.`;
    const t2 = `${first}, uma dúvida rápida: se surgisse hoje um imóvel em ${region} dentro da sua faixa, mas com condição diferente (entrada menor, ou pronto pra financiar), você olharia?${market ? ` O m² por lá está em R$ ${market.m2Venda.toLocaleString('pt-BR')} e a tendência é ${market.tendencia}.` : ''}`;
    const t3 = `Só pra ficar no seu radar, ${first}: fiz um resumo do que fechou de verdade em ${region} nos últimos 60 dias (valores reais, não os pedidos nos portais).${marketLine} Quer que eu te mande?`;
    if (days < 14) return t1;
    if (days < 30) return t2;
    return t3;
  }

  function analyzeReply(reply) {
    const t = (reply || '').toLowerCase();
    let intent = 'GERAL', priority = 'MEDIUM';
    if (/visita|visitar|conhecer|ver o im[oó]vel|ver pessoalmente|agendar/.test(t)) { intent = 'VISITA'; priority = 'URGENT'; }
    else if (/proposta|oferec|dou r\$|meu lance|fazer proposta/.test(t)) { intent = 'PROPOSTA'; priority = 'URGENT'; }
    else if (/financia|financ|banco|caixa|carta de cr[eé]dito|entrada/.test(t)) { intent = 'FINANCIAMENTO'; priority = 'HIGH'; }
    else if (/quanto|pre[cç]o|valor|custa/.test(t)) { intent = 'PREÇO'; priority = 'HIGH'; }
    else if (/manda|envia|me mostra|op[cç][oõ]es|outras/.test(t)) { intent = 'ENVIAR_OPÇÕES'; priority = 'HIGH'; }
    else if (/pensando|talvez|depois|mais pra frente|n[ãa]o sei/.test(t)) { intent = 'INDECISO'; priority = 'MEDIUM'; }
    else if (/obrigad|valeu|n[ãa]o tenho|n[ãa]o quero|desisti|fechei|comprei/.test(t)) { intent = 'ENCERRAR'; priority = 'LOW'; }
    else if (/sim|claro|pode|vamos|topo|fechado/.test(t)) { intent = 'INTERESSE_POSITIVO'; priority = 'HIGH'; }
    return { intent, priority };
  }

  function suggestReplyForBroker(client, reply, analysis) {
    const first = (client.name || '').split(' ')[0] || '';
    const region = client.interestRegion || 'a região';
    const map = {
      VISITA: `${first}, ótimo! Posso te chamar agora rapidinho para alinhar o melhor horário. Prefere manhã ou tarde?`,
      PROPOSTA: `${first}, perfeito. Vou levar sua proposta ao proprietário ainda hoje. Só preciso confirmar 2 pontos: forma de pagamento e prazo. Podemos falar?`,
      FINANCIAMENTO: `${first}, posso te ajudar com a simulação. Rapidamente: qual sua renda mensal aproximada e quanto teria de entrada? Com isso mostro o valor da parcela em cada banco.`,
      PREÇO: `${first}, sobre valor: o proprietário está aberto a negociar dentro do razoável. Posso te enviar o comparativo do m² da ${region} pra você entender a faixa real de mercado?`,
      ENVIAR_OPÇÕES: `${first}, já estou separando opções alinhadas ao seu perfil na ${region}. Me confirma rápido: prefere pronto pra morar ou aceita reformar? E vaga é obrigatória?`,
      INDECISO: `${first}, sem pressão. Posso te mandar 1x por semana só o que aparecer de melhor na ${region} — assim você fica no radar sem precisar ficar procurando. Fecha?`,
      ENCERRAR: `${first}, tudo bem, obrigado pelo retorno. Fico à disposição se algum dia voltar a considerar. Sucesso!`,
      INTERESSE_POSITIVO: `${first}, ótimo! Vou te mandar agora os detalhes. Consegue receber por WhatsApp mesmo ou prefere e-mail?`,
      GERAL: `${first}, obrigado pelo retorno! Me conta um pouco mais para eu te ajudar melhor: qual a prioridade agora — ver os imóveis, entender financiamento ou agendar visita?`
    };
    return map[analysis.intent] || map.GERAL;
  }

  function getNurtureState() {
    const stored = localStorage.getItem('coutinho_nurture_state');
    try { return stored ? JSON.parse(stored) : {}; } catch { return {}; }
  }
  function saveNurtureState(state) {
    localStorage.setItem('coutinho_nurture_state', JSON.stringify(state));
  }

  function findParkedLeads() {
    const clients = db.get('clients') || [];
    return clients
      .filter(c => c.type !== 'PROPRIETARIO' && c.status === 'ATIVO')
      .map(c => ({ client: c, days: daysSince(c.lastContactAt) }))
      .filter(({ days }) => days >= 7)
      .sort((a, b) => b.days - a.days);
  }

  function renderNurture() {
    const listEl = container.querySelector('#nurture-list');
    const alertsEl = container.querySelector('#nurture-alerts');
    if (!listEl) return;

    const active = localStorage.getItem(NURTURE_KEY) === '1';
    const state = getNurtureState();
    const parked = findParkedLeads();

    const responded = Object.entries(state)
      .filter(([, s]) => s.responded && !s.acknowledged)
      .map(([id, s]) => ({ id, ...s, client: db.getById('clients', id) }))
      .filter(x => x.client);

    if (alertsEl) {
      alertsEl.innerHTML = responded.length ? `
        <div class="p-3 bg-gradient-to-r from-rose-50 to-amber-50 border-b-2 border-rose-300 space-y-2">
          <div class="text-[11px] font-black text-rose-900 uppercase tracking-wider flex items-center gap-2">
            🚨 ${responded.length} lead(s) responderam · Atender AGORA
          </div>
          ${responded.map(r => {
            const broker = db.getById('users', r.client.brokerId);
            const analysis = analyzeReply(r.reply || '');
            const suggestion = suggestReplyForBroker(r.client, r.reply || '', analysis);
            const phone = (r.client.whatsapp || r.client.phone || '').replace(/\D/g, '');
            const priBadge = { URGENT: 'bg-rose-600 text-white', HIGH: 'bg-amber-500 text-white', MEDIUM: 'bg-blue-500 text-white', LOW: 'bg-slate-400 text-white' };
            return `<div class="bg-white border border-rose-200 rounded-lg p-3 space-y-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2 flex-wrap">
                  <strong class="text-sm text-slate-900">${escapeHtml(r.client.name)}</strong>
                  <span class="text-[9px] font-black px-1.5 py-0.5 rounded ${priBadge[analysis.priority] || priBadge.MEDIUM}">${analysis.priority}</span>
                  <span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">${analysis.intent}</span>
                  ${broker ? `<span class="text-[10px] text-slate-500">corretor: <strong>${escapeHtml(broker.name)}</strong></span>` : ''}
                </div>
                <button class="btn-ack-nurture text-[10px] font-bold text-slate-600 hover:text-slate-900 px-2" data-id="${r.id}">Marcar ciente</button>
              </div>
              <div class="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                <span class="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Cliente respondeu:</span>
                "<em>${escapeHtml(r.reply || '')}</em>"
              </div>
              <div class="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded">
                <span class="text-[10px] font-bold text-emerald-700 uppercase block mb-0.5">💡 Sugestão de resposta:</span>
                ${escapeHtml(suggestion)}
              </div>
              <div class="flex gap-1.5 flex-wrap">
                ${phone ? `<a href="https://wa.me/55${phone}?text=${encodeURIComponent(suggestion)}" target="_blank" class="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg">Responder no WhatsApp</a>` : ''}
                <button class="btn-copy-suggestion text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg" data-suggestion="${escapeHtml(suggestion)}">Copiar</button>
                <button class="btn-ack-nurture text-[11px] font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg" data-id="${r.id}">Já respondi</button>
              </div>
            </div>`;
          }).join('')}
        </div>` : '';
    }

    if (!active) {
      listEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">
        Nutrição desativada. Ative acima para a IA começar a acompanhar leads parados há 7+ dias com conteúdo de mercado.
        <div class="text-[10px] text-slate-400 mt-2">🔒 As mensagens ficam prontas para revisão. Nada é enviado sem sua aprovação (LGPD).</div>
      </div>`;
      return;
    }

    if (!parked.length) {
      listEl.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">Nenhum lead parado há mais de 7 dias. Sua carteira está bem acompanhada.</div>';
      return;
    }

    listEl.innerHTML = parked.slice(0, 20).map(({ client, days }) => {
      const broker = db.getById('users', client.brokerId);
      const st = state[client.id] || {};
      const msg = nurtureTemplates(client, days);
      const phone = (client.whatsapp || client.phone || '').replace(/\D/g, '');
      return `
        <div class="p-3.5 hover:bg-slate-50">
          <div class="flex items-center justify-between gap-3 mb-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-0.5">
                <strong class="text-xs text-slate-900 truncate">${escapeHtml(client.name)}</strong>
                <span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${days} DIAS SEM CONTATO</span>
                ${st.sent ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">✓ NUTRIDO</span>' : ''}
                ${st.responded ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">📩 RESPONDEU</span>' : ''}
              </div>
              <div class="text-[11px] text-slate-500">${escapeHtml(client.interestRegion || 'DF')} · ${escapeHtml(client.propertyType || 'Imóvel')} · corretor: <strong>${broker ? escapeHtml(broker.name) : '—'}</strong></div>
            </div>
          </div>
          <div class="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono leading-relaxed text-slate-700 mb-2">${escapeHtml(msg)}</div>
          <div class="flex flex-wrap gap-1.5">
            ${phone ? `<a href="https://wa.me/55${phone}?text=${encodeURIComponent(msg)}" target="_blank" class="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg">Enviar no WhatsApp</a>` : ''}
            <button class="btn-mark-sent text-[11px] font-bold text-white bg-slate-800 hover:bg-slate-900 px-2.5 py-1.5 rounded-lg" data-id="${client.id}">${st.sent ? 'Marcar nova rodada' : 'Marcar como enviado'}</button>
            ${st.sent && !st.responded ? `<button class="btn-sim-reply text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg" data-id="${client.id}">Simular resposta</button>` : ''}
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.btn-mark-sent').forEach(b => b.addEventListener('click', e => {
      const id = e.currentTarget.getAttribute('data-id');
      const s = getNurtureState();
      s[id] = { ...(s[id] || {}), sent: true, sentAt: new Date().toISOString(), responded: false, acknowledged: false };
      saveNurtureState(s);
      const client = db.getById('clients', id);
      if (client) {
        const msg = nurtureTemplates(client, daysSince(client.lastContactAt));
        db.insert('interactions', { clientId: id, brokerId: client.brokerId, channel: 'SISTEMA', type: 'NUTRICAO', content: 'Mensagem de nutrição preparada pela IA: ' + msg, createdAt: new Date().toISOString() });
      }
      renderNurture();
    }));

    listEl.querySelectorAll('.btn-sim-reply').forEach(b => b.addEventListener('click', e => {
      const id = e.currentTarget.getAttribute('data-id');
      const reply = prompt('Digite a resposta que o lead enviou:');
      if (!reply) return;
      const s = getNurtureState();
      s[id] = { ...(s[id] || {}), responded: true, reply, respondedAt: new Date().toISOString(), acknowledged: false };
      saveNurtureState(s);
      const client = db.getById('clients', id);
      if (client) {
        db.insert('interactions', { clientId: id, brokerId: client.brokerId, channel: 'WHATSAPP', type: 'RESPOSTA_LEAD', content: reply, createdAt: new Date().toISOString() });
        db.update('clients', id, { lastContactAt: new Date().toISOString(), temperature: 'QUENTE' });
      }
      renderNurture();
    }));

    if (alertsEl) {
      alertsEl.querySelectorAll('.btn-ack-nurture').forEach(b => b.addEventListener('click', e => {
        const id = e.currentTarget.getAttribute('data-id');
        const s = getNurtureState();
        if (s[id]) { s[id].acknowledged = true; saveNurtureState(s); renderNurture(); }
      }));
      alertsEl.querySelectorAll('.btn-copy-suggestion').forEach(b => b.addEventListener('click', e => {
        const text = e.currentTarget.getAttribute('data-suggestion');
        navigator.clipboard.writeText(text);
        e.currentTarget.textContent = 'Copiado!';
        setTimeout(() => { e.currentTarget.textContent = 'Copiar'; }, 1500);
      }));
    }
  }

  renderNurture();
}
