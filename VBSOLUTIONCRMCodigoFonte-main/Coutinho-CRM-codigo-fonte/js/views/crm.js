/**
 * View: CRM de Clientes e Leads
 * Cadastro completo, tipos (Comprador, Locatário, Proprietário, etc.) e temperatura
 */
import { db } from '../state/db.js';
import { toCurrency } from '../services/evaluation.js';
import { aiService } from '../services/ai.js';

export function renderCRM(container) {
  const hashQuery = (window.location.hash.split('?')[1] || '');
  const urlParams = new URLSearchParams(hashQuery);
  const filterParam = urlParams.get('filter');
  let activeFilter = ['TODOS', 'COMPRADOR', 'PROPRIETARIO', 'INVESTIDOR', 'QUENTES'].includes(filterParam) ? filterParam : 'TODOS';
  let searchTerm = '';
  let currentPage = 1;
  let pageSize = 20;
  const selectedIds = new Set();

  function renderList() {
    const clients = db.get('clients');
    const users = db.get('users');

    const q = searchTerm.toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const filtered = clients.filter(c => {
      const matchType = activeFilter === 'TODOS' || c.type === activeFilter || (activeFilter === 'QUENTES' && ['QUENTE', 'MUITO_QUENTE'].includes(c.temperature));
      if (!matchType) return false;
      if (searchTerm === '') return true;
      if ((c.name || '').toLowerCase().includes(q)) return true;
      if ((c.email || '').toLowerCase().includes(q)) return true;
      if (c.interestRegion && c.interestRegion.toLowerCase().includes(q)) return true;
      if (qDigits && qDigits.length >= 3) {
        const phoneDigits = ((c.phone || '') + (c.whatsapp || '')).replace(/\D/g, '');
        if (phoneDigits.includes(qDigits)) return true;
      }
      return false;
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const pageClients = filtered.slice(startIdx, startIdx + pageSize);
    const pageIds = pageClients.map(c => c.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));

    const stages = db.get('funnelStages').sort((a, b) => a.order - b.order);
    const listHtml = pageClients.map(client => {
      const broker = users.find(u => u.id === client.brokerId) || users[0];
      const score = aiService.scoreLead(client);
      const opp = db.get('opportunities').find(o => o.clientId === client.id);

      const tempBadge = {
        'FRIO': '<span class="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full font-semibold">Frio</span>',
        'MORNO': '<span class="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-semibold">Morno</span>',
        'QUENTE': '<span class="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-semibold">Quente</span>',
        'MUITO_QUENTE': '<span class="px-2 py-0.5 text-xs bg-rose-100 text-rose-800 rounded-full font-semibold">Muito Quente 🔥</span>'
      }[client.temperature] || '<span class="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full">Lead</span>';

      const stageSelect = client.type === 'PROPRIETARIO' ? '<span class="text-[10px] text-slate-400">—</span>' : `
        <select class="sel-stage text-[11px] p-1 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" data-id="${client.id}">
          <option value="" ${!opp ? 'selected' : ''} disabled>${opp ? 'Mudar etapa...' : 'Sem funil'}</option>
          ${stages.map(s => `<option value="${s.id}" ${opp && opp.stageId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>`;

      const isSelected = selectedIds.has(client.id);
      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100 ${isSelected ? 'bg-indigo-50/50' : ''}">
          <td class="px-3 py-3 text-center">
            <input type="checkbox" class="row-check accent-indigo-600" data-id="${client.id}" ${isSelected ? 'checked' : ''}>
          </td>
          <td class="px-4 py-3">
            <div class="font-bold text-slate-900 text-sm">${client.name}</div>
            <div class="text-xs text-slate-500">${client.email} · ${client.phone}</div>
          </td>
          <td class="px-4 py-3">
            <span class="px-2 py-0.5 text-xs bg-slate-100 font-medium text-slate-700 rounded">${client.type}</span>
          </td>
          <td class="px-4 py-3">
            <div class="text-xs text-slate-900 font-medium">${client.interestRegion || 'Brasília - DF'}</div>
            <div class="text-[11px] text-slate-500">${client.propertyType} · até ${toCurrency(client.priceRangeMax)}</div>
          </td>
          <td class="px-4 py-3">
            ${tempBadge}
            <div class="text-[10px] text-slate-500 mt-0.5">Score IA: <strong>${score}/100</strong></div>
          </td>
          <td class="px-4 py-3">
            ${stageSelect}
          </td>
          <td class="px-4 py-3 text-xs text-slate-700">
            <div class="font-medium">${broker.name}</div>
            <div class="text-[10px] text-slate-500">${broker.creci || 'CRECI'}</div>
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button class="btn-action-view text-xs text-indigo-600 hover:text-indigo-900 font-semibold" data-id="${client.id}">Detalhes</button>
              <button class="btn-action-edit text-xs text-slate-600 hover:text-slate-900 font-semibold px-1.5" data-id="${client.id}" title="Editar">Editar</button>
              <button class="btn-action-ai text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded font-semibold" data-id="${client.id}">IA</button>
              <button class="btn-action-delete text-xs text-rose-500 hover:text-rose-700 font-bold px-1.5" data-id="${client.id}" title="Excluir">✕</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const tbody = container.querySelector('#crm-table-body');
    if (tbody) tbody.innerHTML = listHtml || `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-400 text-sm">Nenhum cliente ou lead encontrado com os filtros selecionados.</td></tr>`;

    const headerCheck = container.querySelector('#crm-check-all');
    if (headerCheck) headerCheck.checked = allPageSelected;

    renderPaginationBar(totalFiltered, totalPages, startIdx, pageClients.length);
    renderBulkBar();
    attachRowEvents();
    attachSelectionEvents(pageIds);
  }

  function renderPaginationBar(total, totalPages, startIdx, pageCount) {
    const el = container.querySelector('#crm-pagination');
    if (!el) return;
    const from = total === 0 ? 0 : startIdx + 1;
    const to = startIdx + pageCount;
    el.innerHTML = `
      <div class="text-xs text-slate-600">Mostrando <strong>${from}–${to}</strong> de <strong>${total}</strong></div>
      <div class="flex items-center gap-2">
        <label class="text-xs text-slate-500">Por página:</label>
        <select id="crm-page-size" class="text-xs p-1.5 border border-slate-200 rounded-lg bg-white">
          ${[10, 20, 50, 100].map(n => `<option value="${n}" ${n === pageSize ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <button id="crm-prev" class="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40" ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span class="text-xs text-slate-600 font-semibold">Página ${currentPage} de ${totalPages}</span>
        <button id="crm-next" class="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40" ${currentPage >= totalPages ? 'disabled' : ''}>Próxima →</button>
      </div>
    `;
    const psize = el.querySelector('#crm-page-size');
    if (psize) psize.addEventListener('change', e => { pageSize = Number(e.target.value); currentPage = 1; renderList(); });
    const prev = el.querySelector('#crm-prev');
    const next = el.querySelector('#crm-next');
    if (prev) prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderList(); } });
    if (next) next.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderList(); } });
  }

  function renderBulkBar() {
    const el = container.querySelector('#crm-bulk-bar');
    if (!el) return;
    const count = selectedIds.size;
    if (count === 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const users = db.get('users');
    el.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <strong class="text-slate-900"><span class="text-indigo-700">${count}</span> selecionado(s)</strong>
        <select id="bulk-broker" class="p-1.5 border border-slate-200 rounded-lg bg-white">
          <option value="">Mudar corretor…</option>
          ${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
        </select>
        <select id="bulk-temp" class="p-1.5 border border-slate-200 rounded-lg bg-white">
          <option value="">Mudar temperatura…</option>
          <option value="FRIO">Frio</option>
          <option value="MORNO">Morno</option>
          <option value="QUENTE">Quente</option>
          <option value="MUITO_QUENTE">Muito Quente 🔥</option>
        </select>
        <button id="bulk-export" class="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800">Exportar CSV</button>
        <button id="bulk-delete" class="px-2.5 py-1.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700">Excluir selecionados</button>
        <button id="bulk-clear" class="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 font-semibold">Limpar seleção</button>
      </div>
    `;
    el.querySelector('#bulk-broker').addEventListener('change', e => {
      const id = e.target.value;
      if (!id) return;
      selectedIds.forEach(cid => db.update('clients', cid, { brokerId: id }));
      renderList();
    });
    el.querySelector('#bulk-temp').addEventListener('change', e => {
      const t = e.target.value;
      if (!t) return;
      selectedIds.forEach(cid => db.update('clients', cid, { temperature: t }));
      renderList();
    });
    el.querySelector('#bulk-export').addEventListener('click', () => bulkExport());
    el.querySelector('#bulk-delete').addEventListener('click', () => {
      if (!confirm(`Excluir ${selectedIds.size} contato(s)? Isso remove leads, oportunidades e interações.`)) return;
      selectedIds.forEach(cid => {
        db.get('opportunities').filter(o => o.clientId === cid).forEach(o => db.delete('opportunities', o.id));
        db.get('interactions').filter(i => i.clientId === cid).forEach(i => db.delete('interactions', i.id));
        db.delete('clients', cid);
      });
      selectedIds.clear();
      renderList();
    });
    el.querySelector('#bulk-clear').addEventListener('click', () => { selectedIds.clear(); renderList(); });
  }

  function bulkExport() {
    const cols = ['name', 'type', 'email', 'phone', 'interestRegion', 'propertyType', 'priceRangeMax', 'temperature', 'leadSource', 'familyIncome', 'downPayment', 'fgts'];
    const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = db.get('clients').filter(c => selectedIds.has(c.id));
    const csv = '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_selecionados_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function attachSelectionEvents(pageIds) {
    container.querySelectorAll('.row-check').forEach(cb => {
      cb.addEventListener('change', e => {
        const id = e.currentTarget.getAttribute('data-id');
        if (e.currentTarget.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        renderList();
      });
    });
    const headerCheck = container.querySelector('#crm-check-all');
    if (headerCheck) {
      headerCheck.addEventListener('change', e => {
        if (e.currentTarget.checked) pageIds.forEach(id => selectedIds.add(id));
        else pageIds.forEach(id => selectedIds.delete(id));
        renderList();
      });
    }
  }

  function attachRowEvents() {
    container.querySelectorAll('.btn-action-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openClientModal(id);
      });
    });

    container.querySelectorAll('.btn-action-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        openEditClientModal(e.currentTarget.getAttribute('data-id'));
      });
    });

    container.querySelectorAll('.btn-action-ai').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openAiFollowUpModal(id);
      });
    });

    container.querySelectorAll('.btn-action-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const client = db.getById('clients', id);
        if (!client) return;
        if (!confirm(`Excluir o contato "${client.name}"?\n\nIsso remove o lead, suas oportunidades no funil e o histórico de interações.`)) return;
        // Remove oportunidades e interações vinculadas
        db.get('opportunities').filter(o => o.clientId === id).forEach(o => db.delete('opportunities', o.id));
        db.get('interactions').filter(i => i.clientId === id).forEach(i => db.delete('interactions', i.id));
        db.delete('clients', id);
        renderList();
      });
    });

    container.querySelectorAll('.sel-stage').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const clientId = e.currentTarget.getAttribute('data-id');
        const stageId = e.currentTarget.value;
        if (!stageId) return;
        const client = db.getById('clients', clientId);
        let opp = db.get('opportunities').find(o => o.clientId === clientId);
        if (opp) {
          db.update('opportunities', opp.id, { stageId, lastContactAt: new Date().toISOString() });
        } else if (client) {
          db.insert('opportunities', {
            title: `${client.name} - ${client.interestRegion || 'Interesse Imóvel'}`,
            clientId, propertyId: null, brokerId: client.brokerId || db.get('users')[0]?.id,
            stageId, value: client.priceRangeMax || 0, temperature: client.temperature || 'MORNO',
            nextAction: 'Realizar primeiro contato e qualificação',
            nextActionDate: new Date(Date.now() + 86400000 * 2).toISOString(),
            lastContactAt: new Date().toISOString(), lostReason: null
          });
        }
        const stageName = db.getById('funnelStages', stageId)?.name || '';
        db.insert('interactions', {
          clientId, brokerId: client?.brokerId, channel: 'SISTEMA', type: 'MUDANCA_ESTAGIO',
          content: `Lead movido para a etapa "${stageName}" do funil.`, createdAt: new Date().toISOString()
        });
      });
    });
  }

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">CRM de Clientes & Leads</h1>
          <p class="text-sm text-slate-500">Gestão centralizada de compradores, locatários, proprietários e investidores</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <span class="text-[10px] font-semibold text-slate-500">Estágio na importação:</span>
            <select id="import-stage" class="text-xs bg-transparent font-semibold text-slate-800 focus:outline-none">
              ${db.get('funnelStages').sort((a, b) => a.order - b.order).map(s => `<option value="${s.id}" ${s.id === 'stg_1' ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <button id="btn-import-leads" class="btn-secondary flex items-center gap-2 text-xs">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Importar
          </button>
          <button id="btn-sync-funnel" class="btn-secondary flex items-center gap-2 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Enviar leads ao funil
          </button>
          <button id="btn-export-leads" class="btn-secondary flex items-center gap-2 text-xs">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Exportar
          </button>
          <button id="btn-new-client" class="btn-primary flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
            Cadastrar Cliente
          </button>
        </div>
        <input type="file" id="import-file-input" accept=".csv,.xlsx,.xls,.txt,text/csv" class="hidden">
      </div>

      <!-- Filtros e Busca -->
      <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-2">
          <button class="filter-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeFilter === 'TODOS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-filter="TODOS">Todos</button>
          <button class="filter-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeFilter === 'COMPRADOR' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-filter="COMPRADOR">Compradores</button>
          <button class="filter-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeFilter === 'PROPRIETARIO' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-filter="PROPRIETARIO">Proprietários</button>
          <button class="filter-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeFilter === 'INVESTIDOR' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-filter="INVESTIDOR">Investidores</button>
          <button class="filter-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeFilter === 'QUENTES' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}" data-filter="QUENTES">🔥 Quentes</button>
        </div>

        <div class="relative w-full md:w-72">
          <input type="text" id="crm-search-input" placeholder="Buscar por nome, e-mail ou região..." class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pl-9 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <svg class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      <!-- Barra de ações em lote (aparece quando há seleção) -->
      <div id="crm-bulk-bar" class="hidden bg-indigo-50 border border-indigo-200 rounded-xl p-3 shadow-sm"></div>

      <!-- Tabela -->
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th class="px-3 py-3 text-center"><input type="checkbox" id="crm-check-all" class="accent-indigo-600" title="Selecionar todos desta página"></th>
              <th class="px-4 py-3">Cliente / Contato</th>
              <th class="px-4 py-3">Tipo</th>
              <th class="px-4 py-3">Interesse / Região</th>
              <th class="px-4 py-3">Temperatura</th>
              <th class="px-4 py-3">Etapa do funil</th>
              <th class="px-4 py-3">Corretor</th>
              <th class="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody id="crm-table-body"></tbody>
        </table>
      </div>

      <!-- Paginação -->
      <div id="crm-pagination" class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3"></div>
    </div>

    <!-- Container de Modais -->
    <div id="crm-modal-container"></div>
  `;

  // Eventos de filtros
  container.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      container.querySelectorAll('.filter-tab').forEach(t => {
        t.className = 'filter-tab px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200';
      });
      e.currentTarget.className = 'filter-tab px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white';
      activeFilter = e.currentTarget.getAttribute('data-filter');
      renderList();
    });
  });

  const searchInput = container.querySelector('#crm-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderList();
    });
  }

  const btnNew = container.querySelector('#btn-new-client');
  if (btnNew) {
    btnNew.addEventListener('click', () => openNewClientModal());
  }

  const btnExport = container.querySelector('#btn-export-leads');
  if (btnExport) {
    btnExport.addEventListener('click', () => exportLeadsCSV());
  }

  const btnImport = container.querySelector('#btn-import-leads');
  const fileInput = container.querySelector('#import-file-input');
  if (btnImport && fileInput) {
    btnImport.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const stageId = container.querySelector('#import-stage')?.value || 'stg_1';
      if (file) importLeadsFile(file, stageId);
      e.target.value = '';
    });
  }

  const btnSyncFunnel = container.querySelector('#btn-sync-funnel');
  if (btnSyncFunnel) {
    btnSyncFunnel.addEventListener('click', () => {
      const stageId = container.querySelector('#import-stage')?.value || 'stg_1';
      const stage = db.getById('funnelStages', stageId);
      const clients = db.get('clients').filter(c => c.type !== 'PROPRIETARIO');
      const withOpp = new Set(db.get('opportunities').map(o => o.clientId));
      const pending = clients.filter(c => !withOpp.has(c.id));
      if (!pending.length) { alert('Todos os leads já possuem oportunidade no funil.'); return; }
      if (!confirm(`Enviar ${pending.length} lead(s) sem oportunidade para o funil, na etapa "${stage?.name || 'Lead novo'}"?`)) return;
      pending.forEach(c => {
        db.insert('opportunities', {
          title: `${c.name} - ${c.interestRegion || 'Interesse Imóvel'}`,
          clientId: c.id, propertyId: null, brokerId: c.brokerId || db.get('users')[0]?.id,
          stageId: stageId, value: c.priceRangeMax || 0, temperature: c.temperature || 'MORNO',
          nextAction: 'Realizar primeiro contato e qualificação',
          nextActionDate: new Date(Date.now() + 86400000 * 2).toISOString(),
          lastContactAt: new Date().toISOString(), lostReason: null
        });
      });
      alert(`${pending.length} lead(s) enviados ao funil na etapa "${stage?.name}".`);
      renderList();
    });
  }

  const CSV_COLUMNS = ['name', 'type', 'email', 'phone', 'interestRegion', 'propertyType', 'priceRangeMax', 'temperature', 'leadSource', 'familyIncome', 'downPayment', 'fgts', 'needsFinancing', 'bedroomsNeeded', 'parkingNeeded', 'purchaseDeadline', 'notes'];

  function csvEscape(value) {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function exportLeadsCSV() {
    const clients = db.get('clients');
    const header = CSV_COLUMNS.join(',');
    const rows = clients.map(c => CSV_COLUMNS.map(col => csvEscape(c[col])).join(','));
    const csv = '﻿' + [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_coutinho_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function detectDelimiter(text) {
    const firstLine = text.replace(/^﻿/, '').split(/\r?\n/)[0] || '';
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && counts[ch] !== undefined) counts[ch]++;
    }
    return Object.keys(counts).reduce((best, key) => counts[key] > counts[best] ? key : best, ',');
  }

  function normalizeHeader(h) {
    return (h || '').replace(/^﻿/, '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function parseCSV(text, delimiter) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += char;
      } else if (char === '"') inQuotes = true;
      else if (char === delimiter) { row.push(field); field = ''; }
      else if (char === '\r') { /* skip */ }
      else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += char;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(cell => cell.trim() !== ''));
  }

  function processImportedRows(rows) {
    if (!rows || rows.length < 2) { alert('Planilha vazia ou sem registros.'); return; }

    const headers = rows[0].map(h => (h == null ? '' : String(h)).trim());
    const normHeaders = headers.map(normalizeHeader);

    // Aliases aceitos para cada campo (aceita qualquer planilha)
    const ALIASES = {
      name: ['name', 'nome', 'nome completo', 'cliente', 'lead', 'contato', 'razao social', 'full name'],
      email: ['email', 'e-mail', 'mail', 'correio'],
      phone: ['phone', 'telefone', 'fone', 'celular', 'whatsapp', 'whats', 'tel', 'contato telefonico', 'numero'],
      type: ['type', 'tipo'],
      interestRegion: ['interestregion', 'regiao', 'regiao de interesse', 'bairro', 'cidade', 'localizacao', 'local'],
      propertyType: ['propertytype', 'tipo de imovel', 'imovel'],
      priceRangeMax: ['pricerangemax', 'valor', 'faixa de preco', 'orcamento', 'preco', 'valor maximo'],
      temperature: ['temperature', 'temperatura', 'status'],
      leadSource: ['leadsource', 'origem', 'fonte', 'canal'],
      familyIncome: ['familyincome', 'renda', 'renda familiar', 'salario'],
      downPayment: ['downpayment', 'entrada', 'sinal'],
      fgts: ['fgts'],
      needsFinancing: ['needsfinancing', 'financiamento', 'precisa financiar'],
      bedroomsNeeded: ['bedroomsneeded', 'quartos', 'dormitorios'],
      parkingNeeded: ['parkingneeded', 'vagas', 'garagem'],
      purchaseDeadline: ['purchasedeadline', 'prazo', 'prazo de compra'],
      notes: ['notes', 'observacoes', 'obs', 'observacao', 'anotacoes', 'comentarios']
    };

    // Mapeia cada campo do sistema ao índice da coluna correspondente
    const idxOf = {};
    Object.keys(ALIASES).forEach(field => {
      idxOf[field] = normHeaders.findIndex(h => ALIASES[field].includes(h));
    });

    // Se não achar coluna de nome, usa a primeira coluna como nome (aceita qualquer planilha)
    if (idxOf.name === -1) idxOf.name = 0;

    const val = (cells, field) => (idxOf[field] >= 0 && cells[idxOf[field]] != null ? String(cells[idxOf[field]]).trim() : '');

    let imported = 0, ignored = 0;
    rows.slice(1).forEach(cells => {
      const name = val(cells, 'name');
      if (!name) { ignored++; return; }

      const phone = val(cells, 'phone');
      const financing = val(cells, 'needsFinancing').toLowerCase();
      const newClient = {
        name,
        type: (val(cells, 'type') || 'LEAD').toUpperCase(),
        email: val(cells, 'email'),
        phone: phone,
        whatsapp: phone.replace(/\D/g, ''),
        interestRegion: val(cells, 'interestRegion'),
        propertyType: (val(cells, 'propertyType') || 'APARTAMENTO').toUpperCase(),
        priceRangeMax: Number(val(cells, 'priceRangeMax').replace(/[^\d]/g, '')) || 0,
        temperature: (val(cells, 'temperature') || 'MORNO').toUpperCase().replace(/\s+/g, '_'),
        brokerId: db.get('users')[0]?.id,
        leadSource: val(cells, 'leadSource') || 'IMPORTACAO_PLANILHA',
        familyIncome: Number(val(cells, 'familyIncome').replace(/[^\d]/g, '')) || 0,
        downPayment: Number(val(cells, 'downPayment').replace(/[^\d]/g, '')) || 0,
        fgts: Number(val(cells, 'fgts').replace(/[^\d]/g, '')) || 0,
        needsFinancing: ['true', 'sim', 's', 'yes', '1'].includes(financing),
        bedroomsNeeded: Number(val(cells, 'bedroomsNeeded').replace(/[^\d]/g, '')) || 0,
        parkingNeeded: Number(val(cells, 'parkingNeeded').replace(/[^\d]/g, '')) || 0,
        purchaseDeadline: val(cells, 'purchaseDeadline') || 'MEDIO',
        notes: val(cells, 'notes'),
        lastContactAt: new Date().toISOString(),
        nextContactAt: new Date(Date.now() + 86400000 * 2).toISOString(),
        status: 'ATIVO'
      };
      db.insert('clients', newClient);
      db.insert('interactions', {
        clientId: newClient.id,
        brokerId: newClient.brokerId,
        channel: 'SISTEMA',
        type: 'LEAD_CRIADO',
        content: 'Lead importado via planilha.',
        createdAt: new Date().toISOString()
      });
      // Cria oportunidade no funil (Kanban) na etapa escolhida
      if (newClient.type !== 'PROPRIETARIO') {
        db.insert('opportunities', {
          title: `${newClient.name} - ${newClient.interestRegion || 'Interesse Imóvel'}`,
          clientId: newClient.id, propertyId: null, brokerId: newClient.brokerId,
          stageId: stageId || 'stg_1', value: newClient.priceRangeMax || 0,
          temperature: newClient.temperature, nextAction: 'Realizar primeiro contato e qualificação',
          nextActionDate: newClient.nextContactAt, lastContactAt: new Date().toISOString(), lostReason: null
        });
      }
      imported++;
    });

    const stageName = db.getById('funnelStages', stageId)?.name || 'Lead novo';
    const usedFirstCol = idxOf.name === 0 && !ALIASES.name.includes(normHeaders[0]);
    alert(`${imported} lead(s) importado(s) com sucesso e enviados ao funil na etapa "${stageName}".` +
      (ignored ? `\n${ignored} linha(s) ignorada(s) por não ter nome.` : '') +
      (usedFirstCol ? `\n\nObs: não encontrei uma coluna "nome"; usei a primeira coluna ("${headers[0] || 'coluna 1'}") como nome.` : ''));
    renderList();
  }

  function importLeadsFile(file, stageId) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isExcel = ext === 'xlsx' || ext === 'xls';

    if (isExcel) {
      if (typeof XLSX === 'undefined') {
        alert('Não foi possível carregar o leitor de Excel (sem conexão com o CDN). Salve a planilha como "CSV UTF-8" e importe novamente.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
          processImportedRows(rows);
        } catch (err) {
          console.error(err);
          alert('Falha ao ler o arquivo Excel. Verifique o arquivo ou salve como "CSV UTF-8".');
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // CSV / texto
    const reader = new FileReader();
    reader.onload = (e) => {
      const delimiter = detectDelimiter(e.target.result);
      const rows = parseCSV(e.target.result, delimiter);
      processImportedRows(rows);
    };
    reader.readAsText(file, 'UTF-8');
  }

  // Modal Novo Cliente
  function openNewClientModal() {
    const modalContainer = container.querySelector('#crm-modal-container');
    const brokers = db.get('users');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold text-slate-900">Novo Cadastro de Cliente / Lead</h3>
            <button id="modal-close" class="text-slate-400 hover:text-slate-600">&times;</button>
          </div>

          <form id="form-create-client" class="mt-4 space-y-4 text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input type="text" name="name" required class="w-full p-2 border rounded-lg" placeholder="Ex: Ana Carolina Silva">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Tipo de Cliente *</label>
                <select name="type" class="w-full p-2 border rounded-lg">
                  <option value="COMPRADOR">Comprador</option>
                  <option value="PROPRIETARIO">Proprietário</option>
                  <option value="INVESTIDOR">Investidor</option>
                  <option value="LOCATARIO">Locatário</option>
                  <option value="LEAD">Lead Inicial</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">E-mail *</label>
                <input type="email" name="email" required class="w-full p-2 border rounded-lg" placeholder="cliente@email.com">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">WhatsApp / Telefone *</label>
                <input type="text" name="phone" required class="w-full p-2 border rounded-lg" placeholder="(61) 98765-4321">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Região de Interesse (DF)</label>
                <input type="text" name="interestRegion" class="w-full p-2 border rounded-lg" placeholder="Ex: Noroeste, Águas Claras, Sudoeste">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Tipo de Imóvel</label>
                <select name="propertyType" class="w-full p-2 border rounded-lg">
                  <option value="APARTAMENTO">Apartamento</option>
                  <option value="CASA">Casa em Condomínio</option>
                  <option value="COBERTURA">Cobertura</option>
                  <option value="SALA_COMERCIAL">Sala Comercial</option>
                  <option value="LOTE_TERRENO">Lote / Terreno</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Faixa de Preço Máxima (R$)</label>
                <input type="number" name="priceRangeMax" class="w-full p-2 border rounded-lg" placeholder="Ex: 1200000">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Temperatura do Lead</label>
                <select name="temperature" class="w-full p-2 border rounded-lg">
                  <option value="MORNO">Morno</option>
                  <option value="QUENTE">Quente</option>
                  <option value="MUITO_QUENTE">Muito Quente 🔥</option>
                  <option value="FRIO">Frio</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Corretor Responsável</label>
                <select name="brokerId" class="w-full p-2 border rounded-lg">
                  ${brokers.map(b => `<option value="${b.id}">${b.name} (${b.role})</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Origem do Lead</label>
                <select name="leadSource" class="w-full p-2 border rounded-lg">
                  <option value="PORTAL_DFIMOVEIS">Portal DFimóveis</option>
                  <option value="PORTAL_WIMOVEIS">Portal Wimoveis</option>
                  <option value="INSTAGRAM_ADS">Meta / Instagram Ads</option>
                  <option value="GOOGLE_ADS">Google Ads</option>
                  <option value="INDICACAO">Indicação</option>
                  <option value="CAPTACAO_DIRETA">Captação Direta</option>
                  <option value="LANDING_FINANCIAMENTO">Landing de Financiamento</option>
                </select>
              </div>
            </div>

            <div class="pt-2">
              <div class="text-[11px] font-black text-indigo-700 uppercase tracking-wider mb-2">Perfil Financeiro</div>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Renda Familiar (R$)</label>
                  <input type="number" name="familyIncome" class="w-full p-2 border rounded-lg" placeholder="Ex: 18000">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Entrada Disponível (R$)</label>
                  <input type="number" name="downPayment" class="w-full p-2 border rounded-lg" placeholder="Ex: 150000">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">FGTS Disponível (R$)</label>
                  <input type="number" name="fgts" class="w-full p-2 border rounded-lg" placeholder="Ex: 40000">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Precisa Financiar?</label>
                  <select name="needsFinancing" class="w-full p-2 border rounded-lg">
                    <option value="true">Sim, precisa de financiamento</option>
                    <option value="false">Não, compra à vista</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Quartos / Vagas</label>
                  <div class="flex gap-2">
                    <input type="number" name="bedroomsNeeded" placeholder="Qtos" class="w-1/2 p-2 border rounded-lg">
                    <input type="number" name="parkingNeeded" placeholder="Vagas" class="w-1/2 p-2 border rounded-lg">
                  </div>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Prazo para Comprar</label>
                  <select name="purchaseDeadline" class="w-full p-2 border rounded-lg">
                    <option value="IMEDIATO">Imediato (até 30 dias)</option>
                    <option value="CURTO">Curto prazo (1-3 meses)</option>
                    <option value="MEDIO">Médio prazo (3-6 meses)</option>
                    <option value="LONGO">Longo prazo (6+ meses)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Observações / Perfil de Compra</label>
              <textarea name="notes" rows="3" class="w-full p-2 border rounded-lg" placeholder="Detalhes específicos sobre forma de pagamento, urgência, etc."></textarea>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="btn-cancel-modal" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar no CRM</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeBtn = modalContainer.querySelector('#modal-close');
    const cancelBtn = modalContainer.querySelector('#btn-cancel-modal');
    const close = () => { modalContainer.innerHTML = ''; };
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    const form = modalContainer.querySelector('#form-create-client');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const newClient = {
          name: fd.get('name'),
          type: fd.get('type'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          whatsapp: fd.get('phone').replace(/\D/g, ''),
          interestRegion: fd.get('interestRegion'),
          propertyType: fd.get('propertyType'),
          priceRangeMax: Number(fd.get('priceRangeMax')) || 0,
          temperature: fd.get('temperature'),
          brokerId: fd.get('brokerId'),
          leadSource: fd.get('leadSource'),
          familyIncome: Number(fd.get('familyIncome')) || 0,
          downPayment: Number(fd.get('downPayment')) || 0,
          fgts: Number(fd.get('fgts')) || 0,
          needsFinancing: fd.get('needsFinancing') === 'true',
          bedroomsNeeded: Number(fd.get('bedroomsNeeded')) || 0,
          parkingNeeded: Number(fd.get('parkingNeeded')) || 0,
          purchaseDeadline: fd.get('purchaseDeadline'),
          notes: fd.get('notes'),
          lastContactAt: new Date().toISOString(),
          nextContactAt: new Date(Date.now() + 86400000 * 2).toISOString(),
          status: 'ATIVO'
        };

        db.insert('clients', newClient);

        // Registra entrada do lead na timeline
        db.insert('interactions', {
          clientId: newClient.id,
          brokerId: newClient.brokerId,
          channel: 'SISTEMA',
          type: 'LEAD_CRIADO',
          content: `Lead cadastrado via ${newClient.leadSource}.`,
          createdAt: new Date().toISOString()
        });

        // Cria oportunidade automática no funil se for comprador/lead
        if (['COMPRADOR', 'LEAD', 'INVESTIDOR'].includes(newClient.type)) {
          db.insert('opportunities', {
            title: `${newClient.name} - ${newClient.interestRegion || 'Interesse Imóvel'}`,
            clientId: newClient.id,
            propertyId: null,
            brokerId: newClient.brokerId,
            stageId: 'stg_1', // Lead novo
            value: newClient.priceRangeMax || 500000,
            temperature: newClient.temperature,
            nextAction: 'Realizar primeiro contato e qualificação',
            nextActionDate: newClient.nextContactAt,
            lastContactAt: new Date().toISOString(),
            lostReason: null
          });
        }

        close();
        renderList();
      });
    }
  }

  // Modal Detalhes do Cliente
  function openClientModal(clientId) {
    const client = db.getById('clients', clientId);
    if (!client) return;

    const modalContainer = container.querySelector('#crm-modal-container');
    const interactions = db.get('interactions').filter(i => i.clientId === clientId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const opps = db.get('opportunities').filter(o => o.clientId === clientId);
    const broker = db.getById('users', client.brokerId) || db.get('users')[0];
    const scoreData = aiService.scoreLeadDetailed(client);
    const score = scoreData.score;
    const scoreColor = score >= 70 ? '#059669' : score >= 40 ? '#f59e0b' : '#64748b';

    const tempLabel = {
      'FRIO': '🔵 Frio', 'MORNO': '🟡 Morno', 'QUENTE': '🔥 Quente', 'MUITO_QUENTE': '🔥 Muito Quente'
    }[client.temperature] || 'Lead';

    const deadlineLabel = {
      'IMEDIATO': 'Imediato (até 30 dias)', 'CURTO': 'Curto prazo (1-3 meses)',
      'MEDIO': 'Médio prazo (3-6 meses)', 'LONGO': 'Longo prazo (6+ meses)'
    }[client.purchaseDeadline] || 'Não informado';

    const timelineIcon = {
      'LEAD_CRIADO': '🆕', 'WHATSAPP': '💬', 'LIGACAO': '📞', 'EMAIL': '✉️',
      'VISITA': '🏠', 'PROPOSTA': '📝', 'FOLLOW_UP': '🔄', 'IMOVEIS_ENVIADOS': '📤'
    };

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-y-auto max-h-[92vh]">
          <!-- Cabeçalho -->
          <div class="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 flex justify-between items-start rounded-t-2xl">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl">
                ${client.name.charAt(0)}
              </div>
              <div>
                <h3 class="text-xl font-bold">${client.name}</h3>
                <p class="text-xs text-indigo-200">${client.type} · ${tempLabel} · Cadastrado em ${client.createdAt ? new Date(client.createdAt).toLocaleDateString('pt-BR') : '2026'}</p>
                <p class="text-xs text-indigo-200 mt-0.5">Origem: ${client.leadSource || 'N/A'} · Corretor: ${broker.name}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button id="btn-edit-client" class="text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                Editar
              </button>
              <button id="modal-view-close" class="text-white/70 hover:text-white text-2xl font-bold leading-none">&times;</button>
            </div>
          </div>

          <div class="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Coluna esquerda: Perfil + Financeiro + Score -->
            <div class="space-y-4">
              <!-- Lead Score -->
              <div class="border border-slate-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-[11px] font-black text-slate-500 uppercase tracking-wider">Lead Score</span>
                  <span class="text-2xl font-black" style="color:${scoreColor}">${score}<span class="text-sm text-slate-400">/100</span></span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-3">
                  <div class="h-2 rounded-full" style="width:${score}%;background:${scoreColor}"></div>
                </div>
                <div class="space-y-1">
                  ${scoreData.breakdown.map(b => `
                    <div class="flex items-center justify-between text-[11px] ${b.done ? 'text-slate-700' : 'text-slate-300'}">
                      <span class="flex items-center gap-1.5">${b.done ? '✓' : '○'} ${b.label}</span>
                      <span class="font-bold">+${b.points}</span>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Contato -->
              <div class="border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                <span class="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-1">Contato</span>
                <div class="flex justify-between"><span class="text-slate-500">WhatsApp:</span><strong class="text-slate-800">${client.phone}</strong></div>
                <div class="flex justify-between"><span class="text-slate-500">E-mail:</span><strong class="text-slate-800 truncate ml-2">${client.email}</strong></div>
                <div class="flex justify-between"><span class="text-slate-500">Cidade/Região:</span><strong class="text-slate-800">${client.interestRegion || 'DF'}</strong></div>
                <a href="https://wa.me/55${(client.whatsapp || client.phone || '').replace(/\D/g, '')}" target="_blank" class="mt-2 block text-center py-1.5 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition">Abrir WhatsApp</a>
              </div>

              <!-- Perfil Financeiro -->
              <div class="border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                <span class="text-[11px] font-black text-indigo-700 uppercase tracking-wider block mb-1">Perfil de Compra</span>
                <div class="flex justify-between"><span class="text-slate-500">Valor pretendido:</span><strong class="text-slate-800">${toCurrency(client.priceRangeMax)}</strong></div>
                <div class="flex justify-between"><span class="text-slate-500">Renda familiar:</span><strong class="text-slate-800">${client.familyIncome ? toCurrency(client.familyIncome) : 'N/A'}</strong></div>
                <div class="flex justify-between"><span class="text-slate-500">Entrada:</span><strong class="text-slate-800">${client.downPayment ? toCurrency(client.downPayment) : 'N/A'}</strong></div>
                <div class="flex justify-between"><span class="text-slate-500">FGTS:</span><strong class="text-slate-800">${client.fgts ? toCurrency(client.fgts) : 'N/A'}</strong></div>
                <div class="flex justify-between"><span class="text-slate-500">Financiamento:</span><strong class="text-slate-800">${client.needsFinancing ? 'Necessário' : 'À vista'}</strong></div>
                <div class="flex justify-between"><span class="text-slate-500">Quartos/Vagas:</span><strong class="text-slate-800">${client.bedroomsNeeded || '-'} / ${client.parkingNeeded || '-'}</strong></div>
                <div class="flex justify-between"><span class="text-slate-500">Prazo:</span><strong class="text-slate-800">${deadlineLabel}</strong></div>
              </div>
            </div>

            <!-- Coluna direita (2 cols): Próxima ação + Timeline -->
            <div class="lg:col-span-2 space-y-4">
              <!-- Próxima ação -->
              <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[11px] font-black text-amber-800 uppercase tracking-wider">Próxima Ação</span>
                  <span class="text-[10px] text-amber-700 font-semibold">${client.nextContactAt ? new Date(client.nextContactAt).toLocaleString('pt-BR') : 'A definir'}</span>
                </div>
                <p class="text-sm text-amber-900 font-medium">${opps[0]?.nextAction || 'Realizar primeiro contato e qualificar interesse.'}</p>
              </div>

              <!-- Oportunidades vinculadas -->
              ${opps.length ? `
                <div class="border border-slate-200 rounded-xl p-4">
                  <span class="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-2">Oportunidades no Funil (${opps.length})</span>
                  <div class="space-y-2">
                    ${opps.map(o => {
                      const stage = db.getById('funnelStages', o.stageId) || { name: 'Etapa', color: '#64748b' };
                      return `<div class="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                        <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full" style="background:${stage.color}"></span>${o.title}</span>
                        <span class="font-bold text-slate-800">${toCurrency(o.value)}</span>
                      </div>`;
                    }).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Timeline automática -->
              <div class="border border-slate-200 rounded-xl p-4">
                <span class="text-[11px] font-black text-slate-500 uppercase tracking-wider block mb-3">Timeline do Relacionamento</span>
                <div class="relative pl-5 space-y-4">
                  <div class="absolute left-[7px] top-1 bottom-1 w-0.5 bg-slate-200"></div>
                  ${interactions.length ? interactions.map(i => `
                    <div class="relative">
                      <span class="absolute -left-[18px] top-0.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center text-[8px]"></span>
                      <div class="flex items-center justify-between mb-0.5">
                        <span class="text-[11px] font-bold text-indigo-600">${timelineIcon[i.type] || '•'} ${i.channel} · ${i.type}</span>
                        <span class="text-[10px] text-slate-400">${new Date(i.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                      <p class="text-xs text-slate-700">${i.content}</p>
                    </div>
                  `).join('') : '<p class="text-xs text-slate-400 italic">Nenhuma interação registrada ainda.</p>'}
                </div>

                <!-- Registrar nova interação -->
                <form id="form-add-interaction" class="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                  <select name="channel" class="text-xs p-2 border rounded-lg bg-white">
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="LIGACAO">Ligação</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="VISITA">Visita</option>
                    <option value="PROPOSTA">Proposta</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                  </select>
                  <input type="text" name="content" required placeholder="Descreva o contato..." class="flex-1 text-xs p-2 border rounded-lg">
                  <button type="submit" class="btn-primary text-xs">Registrar</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-view-close').addEventListener('click', close);

    const btnEdit = modalContainer.querySelector('#btn-edit-client');
    if (btnEdit) btnEdit.addEventListener('click', () => openEditClientModal(clientId));

    const formInteraction = modalContainer.querySelector('#form-add-interaction');
    if (formInteraction) {
      formInteraction.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(formInteraction);
        db.insert('interactions', {
          clientId: clientId,
          brokerId: client.brokerId,
          channel: fd.get('channel'),
          type: fd.get('channel'),
          content: fd.get('content'),
          createdAt: new Date().toISOString()
        });
        db.update('clients', clientId, { lastContactAt: new Date().toISOString() });
        openClientModal(clientId);
      });
    }
  }

  // Modal Editar Cliente / Lead
  function openEditClientModal(clientId) {
    const client = db.getById('clients', clientId);
    if (!client) return;
    const modalContainer = container.querySelector('#crm-modal-container');
    const brokers = db.get('users');

    const opt = (value, current, label) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[55] flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold text-slate-900">Editar Lead / Cliente</h3>
            <button id="edit-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <form id="form-edit-client" class="mt-4 space-y-4 text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input type="text" name="name" required value="${(client.name || '').replace(/"/g, '&quot;')}" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Tipo</label>
                <select name="type" class="w-full p-2 border rounded-lg">
                  ${opt('COMPRADOR', client.type, 'Comprador')}
                  ${opt('PROPRIETARIO', client.type, 'Proprietário')}
                  ${opt('INVESTIDOR', client.type, 'Investidor')}
                  ${opt('LOCATARIO', client.type, 'Locatário')}
                  ${opt('LEAD', client.type, 'Lead Inicial')}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">E-mail</label>
                <input type="email" name="email" value="${(client.email || '').replace(/"/g, '&quot;')}" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">WhatsApp / Telefone</label>
                <input type="text" name="phone" value="${(client.phone || '').replace(/"/g, '&quot;')}" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Canal / Origem do Lead</label>
                <select name="leadSource" class="w-full p-2 border rounded-lg">
                  ${opt('PORTAL_DFIMOVEIS', client.leadSource, 'Portal DFimóveis')}
                  ${opt('PORTAL_WIMOVEIS', client.leadSource, 'Portal Wimoveis')}
                  ${opt('PORTAL_OLX', client.leadSource, 'OLX')}
                  ${opt('PORTAL_ZAP', client.leadSource, 'ZAP / VivaReal')}
                  ${opt('INSTAGRAM_ADS', client.leadSource, 'Meta / Instagram Ads')}
                  ${opt('GOOGLE_ADS', client.leadSource, 'Google Ads')}
                  ${opt('WHATSAPP', client.leadSource, 'WhatsApp')}
                  ${opt('INDICACAO', client.leadSource, 'Indicação')}
                  ${opt('SITE', client.leadSource, 'Site próprio')}
                  ${opt('LANDING_FINANCIAMENTO', client.leadSource, 'Landing de Financiamento')}
                  ${opt('SIMULADOR_FINANCIAMENTO', client.leadSource, 'Simulador de Financiamento')}
                  ${opt('CAPTACAO_DIRETA', client.leadSource, 'Captação Direta')}
                  ${opt('IMPORTACAO_PLANILHA', client.leadSource, 'Importação de Planilha')}
                  ${opt('EVENTO', client.leadSource, 'Evento / Feirão')}
                  ${opt('OUTRO', client.leadSource, 'Outro')}
                  ${client.leadSource && !['PORTAL_DFIMOVEIS','PORTAL_WIMOVEIS','PORTAL_OLX','PORTAL_ZAP','INSTAGRAM_ADS','GOOGLE_ADS','WHATSAPP','INDICACAO','SITE','LANDING_FINANCIAMENTO','SIMULADOR_FINANCIAMENTO','CAPTACAO_DIRETA','IMPORTACAO_PLANILHA','EVENTO','OUTRO'].includes(client.leadSource) ? `<option value="${client.leadSource}" selected>${client.leadSource}</option>` : ''}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Temperatura</label>
                <select name="temperature" class="w-full p-2 border rounded-lg">
                  ${opt('FRIO', client.temperature, 'Frio')}
                  ${opt('MORNO', client.temperature, 'Morno')}
                  ${opt('QUENTE', client.temperature, 'Quente')}
                  ${opt('MUITO_QUENTE', client.temperature, 'Muito Quente 🔥')}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Região de Interesse</label>
                <input type="text" name="interestRegion" value="${(client.interestRegion || '').replace(/"/g, '&quot;')}" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Tipo de Imóvel</label>
                <select name="propertyType" class="w-full p-2 border rounded-lg">
                  ${opt('APARTAMENTO', client.propertyType, 'Apartamento')}
                  ${opt('CASA', client.propertyType, 'Casa em Condomínio')}
                  ${opt('COBERTURA', client.propertyType, 'Cobertura')}
                  ${opt('SALA_COMERCIAL', client.propertyType, 'Sala Comercial')}
                  ${opt('LOTE_TERRENO', client.propertyType, 'Lote / Terreno')}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Faixa de Preço Máxima (R$)</label>
                <input type="number" name="priceRangeMax" value="${client.priceRangeMax || 0}" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Corretor Responsável</label>
                <select name="brokerId" class="w-full p-2 border rounded-lg">
                  ${brokers.map(b => `<option value="${b.id}" ${b.id === client.brokerId ? 'selected' : ''}>${b.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="pt-2">
              <div class="text-[11px] font-black text-indigo-700 uppercase tracking-wider mb-2">Perfil Financeiro</div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Renda (R$)</label>
                  <input type="number" name="familyIncome" value="${client.familyIncome || 0}" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Entrada (R$)</label>
                  <input type="number" name="downPayment" value="${client.downPayment || 0}" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">FGTS (R$)</label>
                  <input type="number" name="fgts" value="${client.fgts || 0}" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Financia?</label>
                  <select name="needsFinancing" class="w-full p-2 border rounded-lg">
                    ${opt('true', String(client.needsFinancing), 'Sim')}
                    ${opt('false', String(client.needsFinancing), 'À vista')}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Observações / Informações do Lead</label>
              <textarea name="notes" rows="4" class="w-full p-2 border rounded-lg" placeholder="Anote aqui detalhes do atendimento, preferências, histórico...">${(client.notes || '').replace(/</g, '&lt;')}</textarea>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button type="button" id="edit-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar Alterações</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { openClientModal(clientId); };
    modalContainer.querySelector('#edit-close').addEventListener('click', close);
    modalContainer.querySelector('#edit-cancel').addEventListener('click', close);

    modalContainer.querySelector('#form-edit-client').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const phone = fd.get('phone') || '';
      db.update('clients', clientId, {
        name: fd.get('name'),
        type: fd.get('type'),
        email: fd.get('email'),
        phone: phone,
        whatsapp: phone.replace(/\D/g, ''),
        leadSource: fd.get('leadSource'),
        temperature: fd.get('temperature'),
        interestRegion: fd.get('interestRegion'),
        propertyType: fd.get('propertyType'),
        priceRangeMax: Number(fd.get('priceRangeMax')) || 0,
        brokerId: fd.get('brokerId'),
        familyIncome: Number(fd.get('familyIncome')) || 0,
        downPayment: Number(fd.get('downPayment')) || 0,
        fgts: Number(fd.get('fgts')) || 0,
        needsFinancing: fd.get('needsFinancing') === 'true',
        notes: fd.get('notes')
      });
      db.insert('interactions', {
        clientId: clientId,
        brokerId: fd.get('brokerId'),
        channel: 'SISTEMA',
        type: 'EDICAO',
        content: 'Dados do lead atualizados.',
        createdAt: new Date().toISOString()
      });
      openClientModal(clientId);
      renderList();
    });
  }

  // Modal Sugestão IA Follow-up
  function openAiFollowUpModal(clientId) {
    const client = db.getById('clients', clientId);
    if (!client) return;

    const modalContainer = container.querySelector('#crm-modal-container');
    const msg = aiService.suggestFollowUp(client);

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
              <h3 class="text-base font-bold text-slate-900">Coutinho IA · Mensagem de Follow-up</h3>
            </div>
            <button id="modal-ai-close" class="text-slate-400 hover:text-slate-600">&times;</button>
          </div>

          <div class="mt-4 text-xs">
            <p class="text-slate-600 mb-2">Sugestão contextual gerada com base no histórico de <strong>${client.name}</strong>:</p>
            <div class="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-slate-800 font-mono text-xs leading-relaxed" id="ai-suggested-text">
              ${msg}
            </div>

            <div class="mt-4 text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              ℹ️ Por segurança e conformidade LGPD, a mensagem só será enviada pelo corretor via canal oficial.
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button id="btn-copy-ai" class="btn-secondary text-xs">Copiar Mensagem</button>
            <button id="btn-close-ai" class="btn-primary text-xs">Concluído</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-ai-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-close-ai').addEventListener('click', close);

    const btnCopy = modalContainer.querySelector('#btn-copy-ai');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(msg);
        btnCopy.textContent = 'Copiado!';
        setTimeout(() => { btnCopy.textContent = 'Copiar Mensagem'; }, 2000);
      });
    }
  }

  // Inicializa lista
  renderList();
}
