/**
 * View: Gerenciar Usuários (admin)
 * Aprova acessos, gerencia planos/assinaturas, controla permissões e vê pagamentos.
 */
import { db } from '../state/db.js';
import { authService } from '../services/auth.js';
import { toCurrency } from '../services/evaluation.js';

export function renderUsers(container) {
  let tab = 'USUARIOS'; // 'USUARIOS' | 'ASSINATURAS' | 'PAGAMENTOS' | 'PLANOS'

  function planName(id) {
    return db.getById('plans', id)?.name || '—';
  }

  function subOf(userId) {
    return db.get('subscriptions').find(s => s.userId === userId);
  }

  function renderView() {
    if (!authService.isAdmin()) {
      container.innerHTML = `<div class="p-8 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-xl">Acesso restrito ao administrador.</div>`;
      return;
    }

    const users = db.get('users');
    const subs = db.get('subscriptions');
    const payments = db.get('payments');
    const plans = db.get('plans');

    const mrr = subs.filter(s => s.status === 'ATIVA').reduce((acc, s) => {
      const p = db.getById('plans', s.planId);
      if (!p) return acc;
      return acc + (s.cycle === 'ANNUAL' ? (p.annual / 12) : p.monthly);
    }, 0);
    const received = payments.filter(p => p.status === 'PAGO').reduce((acc, p) => acc + p.amount, 0);
    const overdue = payments.filter(p => p.status === 'ATRASADO').reduce((acc, p) => acc + p.amount, 0);
    const pending = users.filter(u => u.status === 'PENDENTE').length;

    container.innerHTML = `
      <div class="space-y-6">
        <div class="pb-2 border-b border-slate-200">
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Gerenciar Usuários</h1>
          <p class="text-sm text-slate-500">Aprove acessos, gerencie planos e controle permissões</p>
        </div>

        <!-- Indicadores -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="stat-card"><div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuários</div><div class="text-2xl font-black text-slate-900 mt-1">${users.length}</div><div class="text-xs text-amber-600 font-medium mt-1">${pending} aguardando aprovação</div></div>
          <div class="stat-card"><div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Receita Recorrente (MRR)</div><div class="text-2xl font-black text-indigo-700 mt-1">${toCurrency(mrr)}</div><div class="text-xs text-slate-500 mt-1">${subs.filter(s => s.status === 'ATIVA').length} assinaturas ativas</div></div>
          <div class="stat-card"><div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recebido</div><div class="text-2xl font-black text-emerald-600 mt-1">${toCurrency(received)}</div><div class="text-xs text-slate-500 mt-1">Pagamentos liquidados</div></div>
          <div class="stat-card border-l-4 border-l-rose-500"><div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Em Atraso</div><div class="text-2xl font-black text-rose-600 mt-1">${toCurrency(overdue)}</div><div class="text-xs text-rose-500 font-medium mt-1">Inadimplência</div></div>
        </div>

        <!-- Abas -->
        <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          ${[['USUARIOS','👥 Usuários & Acessos'],['ASSINATURAS','💳 Assinaturas'],['PAGAMENTOS','🧾 Pagamentos'],['PLANOS','⭐ Planos']].map(([k, label]) => `
            <button class="users-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-tab="${k}">${label}</button>
          `).join('')}
        </div>

        ${tab === 'USUARIOS' ? renderUsersTab(users) : ''}
        ${tab === 'ASSINATURAS' ? renderSubsTab(users, subs) : ''}
        ${tab === 'PAGAMENTOS' ? renderPaymentsTab(users, payments) : ''}
        ${tab === 'PLANOS' ? renderPlansTab(plans, subs) : ''}
      </div>

      <div id="users-modal"></div>
    `;

    attachEvents();
  }

  function statusBadge(status) {
    const map = {
      'ATIVO': 'bg-emerald-100 text-emerald-800', 'ATIVA': 'bg-emerald-100 text-emerald-800',
      'PENDENTE': 'bg-amber-100 text-amber-800', 'INATIVO': 'bg-slate-200 text-slate-600',
      'BLOQUEADO': 'bg-rose-100 text-rose-800', 'INADIMPLENTE': 'bg-rose-100 text-rose-800',
      'PAGO': 'bg-emerald-100 text-emerald-800', 'ATRASADO': 'bg-rose-100 text-rose-800', 'PREVISTO': 'bg-blue-100 text-blue-800'
    };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${map[status] || 'bg-slate-100 text-slate-700'}">${status}</span>`;
  }

  function renderUsersTab(users) {
    return `
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th class="px-4 py-3">Usuário</th><th class="px-4 py-3">Perfil</th><th class="px-4 py-3">Plano</th>
              <th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const sub = subOf(u.id);
              return `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                  <td class="px-4 py-3">
                    <div class="font-bold text-slate-900">${u.name}</div>
                    <div class="text-[11px] text-slate-500">${u.email}</div>
                  </td>
                  <td class="px-4 py-3">
                    <select class="sel-role text-[11px] p-1 border border-slate-200 rounded-lg bg-white" data-id="${u.id}" ${u.email.toLowerCase() === 'acoutinhoimoveis@gmail.com' ? 'disabled' : ''}>
                      ${['ADMINISTRADOR','GESTOR','CORRETOR'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                  </td>
                  <td class="px-4 py-3 text-slate-700">${sub ? planName(sub.planId) : '<span class="text-slate-400">Sem plano</span>'}</td>
                  <td class="px-4 py-3">${statusBadge(u.status || 'ATIVO')}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      ${u.status === 'PENDENTE' ? `<button class="btn-approve text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded" data-id="${u.id}">Aprovar</button>` : ''}
                      <button class="btn-config-user text-[11px] font-bold text-indigo-600 hover:text-indigo-800" data-id="${u.id}">Configurar</button>
                      ${u.status === 'BLOQUEADO'
                        ? `<button class="btn-toggle-block text-[11px] font-bold text-emerald-600 hover:text-emerald-800" data-id="${u.id}" data-to="ATIVO">Desbloquear</button>`
                        : (u.email.toLowerCase() !== 'acoutinhoimoveis@gmail.com' ? `<button class="btn-toggle-block text-[11px] font-bold text-rose-500 hover:text-rose-700" data-id="${u.id}" data-to="BLOQUEADO">Bloquear</button>` : '')}
                    </div>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderSubsTab(users, subs) {
    return `
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th class="px-4 py-3">Assinante</th><th class="px-4 py-3">Plano</th><th class="px-4 py-3">Ciclo</th>
              <th class="px-4 py-3">Valor</th><th class="px-4 py-3">Renova em</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${subs.length ? subs.map(s => {
              const u = users.find(x => x.id === s.userId) || { name: '—' };
              return `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                  <td class="px-4 py-3 font-bold text-slate-900">${u.name}</td>
                  <td class="px-4 py-3">${planName(s.planId)}</td>
                  <td class="px-4 py-3">${s.cycle === 'ANNUAL' ? 'Anual' : 'Mensal'}</td>
                  <td class="px-4 py-3 font-semibold">${toCurrency(s.amount)}</td>
                  <td class="px-4 py-3 text-slate-600">${s.renewsAt ? new Date(s.renewsAt).toLocaleDateString('pt-BR') : '—'}</td>
                  <td class="px-4 py-3">${statusBadge(s.status)}</td>
                  <td class="px-4 py-3 text-right">
                    <select class="sel-sub-status text-[11px] p-1 border border-slate-200 rounded-lg bg-white" data-id="${s.id}">
                      ${['ATIVA','INADIMPLENTE','CANCELADA','PAUSADA'].map(st => `<option value="${st}" ${s.status === st ? 'selected' : ''}>${st}</option>`).join('')}
                    </select>
                  </td>
                </tr>`;
            }).join('') : '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">Nenhuma assinatura registrada.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  function renderPaymentsTab(users, payments) {
    const sorted = [...payments].sort((a, b) => new Date(b.paidAt || b.createdAt || 0) - new Date(a.paidAt || a.createdAt || 0));
    return `
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th class="px-4 py-3">Referência</th><th class="px-4 py-3">Cliente</th><th class="px-4 py-3">Método</th>
              <th class="px-4 py-3">Valor</th><th class="px-4 py-3">Data</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.length ? sorted.map(p => {
              const u = users.find(x => x.id === p.userId) || { name: '—' };
              return `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                  <td class="px-4 py-3 font-medium text-slate-800">${p.reference || '—'}</td>
                  <td class="px-4 py-3">${u.name}</td>
                  <td class="px-4 py-3">${p.method}</td>
                  <td class="px-4 py-3 font-bold text-slate-900">${toCurrency(p.amount)}</td>
                  <td class="px-4 py-3 text-slate-600">${p.paidAt ? new Date(p.paidAt).toLocaleDateString('pt-BR') : '—'}</td>
                  <td class="px-4 py-3">${statusBadge(p.status)}</td>
                  <td class="px-4 py-3 text-right">
                    ${p.status !== 'PAGO' ? `<button class="btn-mark-paid text-[11px] font-bold text-emerald-600 hover:text-emerald-800" data-id="${p.id}">Marcar pago</button>` : '<span class="text-[11px] text-slate-400">Liquidado</span>'}
                  </td>
                </tr>`;
            }).join('') : '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">Nenhum pagamento registrado.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  function renderPlansTab(plans, subs) {
    return `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${plans.map(p => {
          const count = subs.filter(s => s.planId === p.id && s.status === 'ATIVA').length;
          return `
            <div class="bg-white border ${p.highlight ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-slate-200'} rounded-xl p-5 shadow-sm">
              ${p.highlight ? '<span class="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded">MAIS POPULAR</span>' : ''}
              <h3 class="font-bold text-slate-900 text-lg mt-2">${p.name}</h3>
              <p class="text-[11px] text-slate-500 mb-3">${p.tagline || ''}</p>
              <div class="text-2xl font-black text-slate-900">${toCurrency(p.monthly)}<span class="text-xs font-normal text-slate-400">/mês</span></div>
              <div class="text-[11px] text-slate-500 mb-3">ou ${toCurrency(p.annual)}/ano · ${p.seats} usuário(s)</div>
              <ul class="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-3">
                ${(p.features || []).map(f => `<li class="flex items-start gap-1.5"><span class="text-emerald-500 font-bold">✓</span> ${f}</li>`).join('')}
              </ul>
              <div class="mt-3 pt-3 border-t border-slate-100 text-[11px] font-bold text-indigo-700">${count} assinante(s) ativo(s)</div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function attachEvents() {
    container.querySelectorAll('.users-tab').forEach(b => b.addEventListener('click', e => { tab = e.currentTarget.getAttribute('data-tab'); renderView(); }));

    container.querySelectorAll('.sel-role').forEach(sel => sel.addEventListener('change', e => {
      db.update('users', e.currentTarget.getAttribute('data-id'), { role: e.currentTarget.value });
    }));

    container.querySelectorAll('.btn-approve').forEach(b => b.addEventListener('click', e => {
      db.update('users', e.currentTarget.getAttribute('data-id'), { status: 'ATIVO' });
      renderView();
    }));

    container.querySelectorAll('.btn-toggle-block').forEach(b => b.addEventListener('click', e => {
      db.update('users', e.currentTarget.getAttribute('data-id'), { status: e.currentTarget.getAttribute('data-to') });
      renderView();
    }));

    container.querySelectorAll('.sel-sub-status').forEach(sel => sel.addEventListener('change', e => {
      db.update('subscriptions', e.currentTarget.getAttribute('data-id'), { status: e.currentTarget.value });
      renderView();
    }));

    container.querySelectorAll('.btn-mark-paid').forEach(b => b.addEventListener('click', e => {
      db.update('payments', e.currentTarget.getAttribute('data-id'), { status: 'PAGO', paidAt: new Date().toISOString().split('T')[0] });
      renderView();
    }));

    container.querySelectorAll('.btn-config-user').forEach(b => b.addEventListener('click', e => {
      openConfigModal(e.currentTarget.getAttribute('data-id'));
    }));
  }

  const MODULES = [
    ['dashboard', 'Dashboard'], ['crm', 'CRM & Leads'], ['funnel', 'Funil'],
    ['properties', 'Imóveis'], ['evaluation', 'Avaliação'], ['financing', 'Simulador'],
    ['contracts', 'Contratos'], ['financial', 'Financeiro'], ['chat', 'Conversas'],
    ['assistant', 'Coutinho IA'], ['blog', 'Blog & SEO'], ['brokers', 'Equipe'],
    ['users', 'Gerenciar Usuários'], ['settings', 'Configurações']
  ];

  function openConfigModal(userId) {
    const u = db.getById('users', userId);
    if (!u) return;
    const modal = container.querySelector('#users-modal');
    const sub = subOf(userId);
    const plans = db.get('plans');
    const perms = u.permissions || {};
    const isMaster = u.email.toLowerCase() === 'acoutinhoimoveis@gmail.com';

    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-900">Configurar usuário</h3>
              <p class="text-[11px] text-slate-500">${u.name} · ${u.email}</p>
            </div>
            <button id="cfg-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <form id="cfg-user-form" class="mt-4 space-y-4 text-xs">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Perfil de acesso</label>
                <select name="role" class="w-full p-2 border rounded-lg" ${isMaster ? 'disabled' : ''}>
                  ${['ADMINISTRADOR', 'GESTOR', 'CORRETOR'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Status</label>
                <select name="status" class="w-full p-2 border rounded-lg" ${isMaster ? 'disabled' : ''}>
                  ${['ATIVO', 'PENDENTE', 'BLOQUEADO', 'INATIVO'].map(s => `<option value="${s}" ${(u.status || 'ATIVO') === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Plano</label>
                <select name="planId" class="w-full p-2 border rounded-lg">
                  <option value="">Sem plano</option>
                  ${plans.map(p => `<option value="${p.id}" ${sub && sub.planId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Ciclo de cobrança</label>
                <select name="cycle" class="w-full p-2 border rounded-lg">
                  <option value="MONTHLY" ${sub && sub.cycle === 'MONTHLY' ? 'selected' : ''}>Mensal</option>
                  <option value="ANNUAL" ${sub && sub.cycle === 'ANNUAL' ? 'selected' : ''}>Anual</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Limites de uso</label>
              <div class="grid grid-cols-3 gap-2">
                <input type="number" name="limitProperties" value="${u.limits?.properties ?? ''}" placeholder="Imóveis" class="w-full p-2 border rounded-lg">
                <input type="number" name="limitLeads" value="${u.limits?.leads ?? ''}" placeholder="Leads" class="w-full p-2 border rounded-lg">
                <input type="number" name="limitAI" value="${u.limits?.ai ?? ''}" placeholder="IA/mês" class="w-full p-2 border rounded-lg">
              </div>
              <p class="text-[10px] text-slate-400 mt-1">Deixe em branco para ilimitado.</p>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-2">Permissões de módulos ${isMaster ? '<span class="text-[10px] text-slate-400">(admin mestre: acesso total)</span>' : ''}</label>
              <div class="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                ${MODULES.map(([key, label]) => `
                  <label class="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50">
                    <input type="checkbox" name="perm_${key}" ${isMaster || perms[key] !== false ? 'checked' : ''} ${isMaster ? 'disabled' : ''}>
                    <span class="text-slate-700">${label}</span>
                  </label>`).join('')}
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="cfg-cancel" class="btn-secondary text-xs">Cancelar</button>
              <button type="submit" class="btn-primary text-xs">Salvar configuração</button>
            </div>
          </form>
        </div>
      </div>`;

    const close = () => { modal.innerHTML = ''; };
    modal.querySelector('#cfg-close').addEventListener('click', close);
    modal.querySelector('#cfg-cancel').addEventListener('click', close);

    modal.querySelector('#cfg-user-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const permissions = {};
      MODULES.forEach(([key]) => { permissions[key] = fd.get('perm_' + key) === 'on'; });
      const limits = {
        properties: fd.get('limitProperties') ? Number(fd.get('limitProperties')) : null,
        leads: fd.get('limitLeads') ? Number(fd.get('limitLeads')) : null,
        ai: fd.get('limitAI') ? Number(fd.get('limitAI')) : null
      };

      const userUpdates = { limits };
      if (!isMaster) {
        userUpdates.role = fd.get('role');
        userUpdates.status = fd.get('status');
        userUpdates.permissions = permissions;
      }
      db.update('users', userId, userUpdates);

      // Plano/assinatura
      const planId = fd.get('planId');
      const cycle = fd.get('cycle');
      if (planId) {
        const plan = db.getById('plans', planId);
        const amount = cycle === 'ANNUAL' ? plan.annual : plan.monthly;
        if (sub) {
          db.update('subscriptions', sub.id, { planId, cycle, amount });
        } else {
          db.insert('subscriptions', {
            userId, planId, cycle, amount, status: 'ATIVA', seatsUsed: 1,
            startDate: new Date().toISOString().split('T')[0],
            renewsAt: new Date(Date.now() + (cycle === 'ANNUAL' ? 365 : 30) * 86400000).toISOString().split('T')[0],
            method: 'A_DEFINIR'
          });
        }
      } else if (sub) {
        db.update('subscriptions', sub.id, { status: 'CANCELADA' });
      }

      close();
      renderView();
    });
  }

  renderView();
}
