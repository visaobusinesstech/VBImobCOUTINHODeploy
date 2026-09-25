import { db } from '../state/db.js';

const PORTAL_CATALOG = [
  { id: 'proprietariodireto', name: 'Proprietário Direto', quality: 'Altíssima', searchable: true, phone: 'Chat interno', note: 'Todo card já vem marcado "Proprietário".' },
  { id: 'olx', name: 'OLX', quality: 'Alta', searchable: true, phone: 'Chat interno', note: 'Filtro nativo "Tipo: Particular" exclui corretor.' },
  { id: 'chavesnamao', name: 'Chaves na Mão', quality: 'Baixa', searchable: true, phone: 'Formulário', note: 'Tag de proprietário não é confiável.' },
  { id: 'zapviva', name: 'ZAP / Viva Real', quality: 'Baixa', searchable: true, phone: 'Formulário', note: 'Maioria imobiliária.' },
  { id: 'facebookgrupos', name: 'Grupos de Facebook', quality: 'Alta', searchable: true, phone: 'Muitas vezes no texto', note: 'Alta proporção de proprietário; exige curadoria.' },
  { id: 'whatsapp', name: 'Grupos de WhatsApp', quality: 'Alta', searchable: false, phone: 'Inerente', note: 'Fechado — só entrando manualmente.' },
  { id: 'placas', name: 'Placas físicas Vende-se', quality: 'Altíssima', searchable: false, phone: 'Impresso na placa', note: 'Prospecção de campo.' },
  { id: 'porteiros', name: 'Porteiros e síndicos', quality: 'Alta', searchable: false, phone: 'Via indicação', note: 'Rede de relacionamento local.' }
];

const TYPE_DEFS = ['Venda', 'Aluguel', 'Permuta', 'Ágio'];

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
}

function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

export function renderRadar(container) {
  const filters = { city: 'all', type: 'all', cls: 'all', portal: 'all' };

  function getConfig() {
    const cfg = db.data.radarConfig || {};
    return {
      activePortals: cfg.activePortals || ['proprietariodireto', 'olx', 'facebookgrupos'],
      activeTypes: cfg.activeTypes || TYPE_DEFS.slice()
    };
  }

  function saveConfig(cfg) {
    db.data.radarConfig = cfg;
    db.save();
  }

  function togglePortal(id) {
    const cfg = getConfig();
    cfg.activePortals = cfg.activePortals.includes(id) ? cfg.activePortals.filter(p => p !== id) : [...cfg.activePortals, id];
    saveConfig(cfg);
    render();
  }

  function toggleType(id) {
    const cfg = getConfig();
    cfg.activeTypes = cfg.activeTypes.includes(id) ? cfg.activeTypes.filter(t => t !== id) : [...cfg.activeTypes, id];
    saveConfig(cfg);
    render();
  }

  function convertToCapture(leadId) {
    const lead = (db.get('radarLeads') || []).find(l => l.id === leadId);
    if (!lead) return;
    db.insert('captures', {
      ownerName: lead.owner && lead.owner !== '—' ? lead.owner : 'A confirmar',
      phone: lead.phone || '',
      email: '',
      address: lead.title,
      region: lead.city,
      propertyType: 'APARTAMENTO',
      desiredValue: Number((lead.price || '').replace(/\D/g, '')) || 0,
      purpose: lead.type,
      portalSource: lead.portal,
      adLink: lead.url,
      notes: `Convertido do Radar. Sinais: ${(lead.tags || []).join(' · ')}`,
      status: 'PENDENTE_AVALIACAO'
    });
    alert(`Lead "${lead.title}" enviado para Captação.`);
    render();
  }

  function addManualLead(data) {
    db.insert('radarLeads', {
      ...data,
      cls: 'owner',
      conf: 80,
      tags: ['Cadastro manual'],
      pains: [],
      firstSeenBySystem: new Date().toISOString().split('T')[0],
      lastCheckedBySystem: new Date().toISOString().split('T')[0]
    });
    render();
  }

  function openAddModal() {
    const modal = container.querySelector('#radar-modal');
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-900">Adicionar lead ao Radar</h3>
            <button id="rd-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>
          <form id="rd-form" class="mt-4 space-y-3 text-xs">
            <div class="grid grid-cols-2 gap-2">
              <input name="city" required placeholder="Cidade *" class="p-2 border rounded-lg">
              <select name="type" class="p-2 border rounded-lg">
                ${TYPE_DEFS.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
            <input name="title" required placeholder="Título do anúncio *" class="w-full p-2 border rounded-lg">
            <div class="grid grid-cols-2 gap-2">
              <input name="owner" placeholder="Proprietário" class="p-2 border rounded-lg">
              <input name="price" placeholder="Preço (R$ ...)" class="p-2 border rounded-lg">
            </div>
            <input name="portal" placeholder="Portal / origem" class="w-full p-2 border rounded-lg">
            <input name="url" type="url" placeholder="Link do anúncio" class="w-full p-2 border rounded-lg">
            <input name="phone" placeholder="Telefone (se disponível)" class="w-full p-2 border rounded-lg">
            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="rd-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar</button>
            </div>
          </form>
        </div>
      </div>`;
    const close = () => { modal.innerHTML = ''; };
    modal.querySelector('#rd-close').addEventListener('click', close);
    modal.querySelector('#rd-cancel').addEventListener('click', close);
    modal.querySelector('#rd-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      addManualLead({
        city: fd.get('city'), type: fd.get('type'), title: fd.get('title'),
        owner: fd.get('owner') || '—', price: fd.get('price') || '—',
        portal: fd.get('portal') || 'Manual', url: fd.get('url') || '',
        phone: fd.get('phone') || ''
      });
      close();
    });
  }

  function render() {
    const cfg = getConfig();
    const leads = db.get('radarLeads') || [];
    const filtered = leads.filter(l =>
      (filters.city === 'all' || l.city === filters.city) &&
      (filters.type === 'all' || l.type === filters.type) &&
      (filters.cls === 'all' || l.cls === filters.cls) &&
      (filters.portal === 'all' || l.portal === filters.portal)
    );

    const cities = [...new Set(leads.map(l => l.city))].filter(Boolean);
    const types = [...new Set(leads.map(l => l.type))].filter(Boolean);
    const portals = [...new Set(leads.map(l => l.portal))].filter(Boolean);
    const owners = leads.filter(l => l.cls === 'owner').length;

    container.innerHTML = `
      <div class="space-y-6">
        <div class="pb-2 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Radar de Captação</h1>
            <p class="text-sm text-slate-500">Anúncios de proprietário no DF e cidades satélites, consolidados de múltiplos portais</p>
          </div>
          <button id="btn-add-radar" class="btn-primary text-xs">+ Adicionar lead manual</button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div class="stat-card"><div class="text-xs font-semibold text-slate-500 uppercase">Leads na base</div><div class="text-2xl font-black text-slate-900 mt-1">${leads.length}</div></div>
          <div class="stat-card border-l-4 border-l-emerald-500"><div class="text-xs font-semibold text-slate-500 uppercase">Proprietários</div><div class="text-2xl font-black text-emerald-600 mt-1">${owners}</div></div>
          <div class="stat-card"><div class="text-xs font-semibold text-slate-500 uppercase">Cidades</div><div class="text-2xl font-black text-slate-900 mt-1">${cities.length}</div></div>
          <div class="stat-card"><div class="text-xs font-semibold text-slate-500 uppercase">Portais</div><div class="text-2xl font-black text-slate-900 mt-1">${portals.length}</div></div>
          <div class="stat-card border-l-4 border-l-indigo-500"><div class="text-xs font-semibold text-slate-500 uppercase">Filtrado</div><div class="text-2xl font-black text-indigo-700 mt-1">${filtered.length}</div></div>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl p-4">
          <div class="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Configuração de portais</div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            ${PORTAL_CATALOG.map(p => `
              <label class="flex items-start gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="checkbox" data-portal="${p.id}" ${cfg.activePortals.includes(p.id) ? 'checked' : ''} class="mt-0.5 accent-slate-900">
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    ${esc(p.name)}
                    <span class="text-[9px] font-bold px-1 py-0.5 rounded ${p.searchable ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}">${p.searchable ? '🔎' : '✋'}</span>
                  </div>
                  <div class="text-[10px] text-slate-500 leading-tight">${esc(p.note)}</div>
                  <div class="text-[10px] text-slate-400 mt-0.5">Qualidade: ${esc(p.quality)} · ☎ ${esc(p.phone)}</div>
                </div>
              </label>
            `).join('')}
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span class="text-[11px] font-bold text-slate-600 mr-1">Tipos:</span>
            ${TYPE_DEFS.map(t => `<button data-type="${t}" class="text-[11px] px-2 py-1 rounded ${cfg.activeTypes.includes(t) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}">${t}</button>`).join('')}
          </div>
          <div class="mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            ℹ️ Este sistema roda no navegador e não busca dados ao vivo em portais (bloqueio de CORS e termos de uso). Use o botão <strong>+ Adicionar lead manual</strong> ou importe da aba <strong>Portfólio & Captação → Importar Anúncio</strong>.
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <aside class="lg:col-span-1 space-y-4">
            <div class="bg-white border border-slate-200 rounded-xl p-3">
              <div class="text-[10px] font-black text-slate-500 uppercase mb-1.5">Cidade</div>
              <div class="space-y-0.5 text-xs">
                <button data-f="city" data-v="all" class="w-full text-left py-1 ${filters.city === 'all' ? 'font-bold text-indigo-700' : 'text-slate-600'}">Todas (${leads.length})</button>
                ${cities.map(c => `<button data-f="city" data-v="${esc(c)}" class="w-full text-left py-1 ${filters.city === c ? 'font-bold text-indigo-700' : 'text-slate-600'}">${esc(c)} (${leads.filter(l => l.city === c).length})</button>`).join('')}
              </div>
            </div>
            <div class="bg-white border border-slate-200 rounded-xl p-3">
              <div class="text-[10px] font-black text-slate-500 uppercase mb-1.5">Negócio</div>
              <div class="space-y-0.5 text-xs">
                <button data-f="type" data-v="all" class="w-full text-left py-1 ${filters.type === 'all' ? 'font-bold text-indigo-700' : 'text-slate-600'}">Todos</button>
                ${types.map(t => `<button data-f="type" data-v="${esc(t)}" class="w-full text-left py-1 ${filters.type === t ? 'font-bold text-indigo-700' : 'text-slate-600'}">${esc(t)}</button>`).join('')}
              </div>
            </div>
            <div class="bg-white border border-slate-200 rounded-xl p-3">
              <div class="text-[10px] font-black text-slate-500 uppercase mb-1.5">Portal</div>
              <div class="space-y-0.5 text-xs">
                <button data-f="portal" data-v="all" class="w-full text-left py-1 ${filters.portal === 'all' ? 'font-bold text-indigo-700' : 'text-slate-600'}">Todos</button>
                ${portals.map(p => `<button data-f="portal" data-v="${esc(p)}" class="w-full text-left py-1 truncate ${filters.portal === p ? 'font-bold text-indigo-700' : 'text-slate-600'}">${esc(p)}</button>`).join('')}
              </div>
            </div>
          </aside>

          <main class="lg:col-span-3 space-y-3">
            ${filtered.length ? filtered.map(l => {
              const days = daysSince(l.firstSeenBySystem);
              return `
                <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
                  <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="min-w-0">
                      <div class="text-[10px] font-black text-indigo-700 uppercase tracking-wider">${esc(l.city)} · ${esc(l.type)}${l.owner && l.owner !== '—' ? ' · ' + esc(l.owner) : ''}</div>
                      <div class="font-bold text-slate-900 text-sm mt-0.5">${esc(l.title)}</div>
                      <div class="text-sm font-black text-emerald-600 mt-0.5">${esc(l.price)}</div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                      <span class="text-[10px] font-black px-2 py-0.5 rounded ${l.cls === 'owner' ? 'bg-emerald-100 text-emerald-800' : l.cls === 'broker' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}">
                        ${l.cls === 'owner' ? 'Proprietário' : l.cls === 'broker' ? 'Corretor' : 'A checar'} · ${l.conf || 0}%
                      </span>
                      ${days !== null && days > 0 ? `<span class="text-[10px] text-slate-500">Monitorado há ${days}d</span>` : ''}
                    </div>
                  </div>

                  ${l.tags && l.tags.length ? `<div class="mt-2 flex flex-wrap gap-1">${l.tags.map(t => `<span class="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">${esc(t)}</span>`).join('')}</div>` : ''}

                  <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <span class="text-[10px] font-mono text-slate-500">${esc(l.portal)}</span>
                    <div class="flex gap-1.5">
                      ${l.url ? `<a href="${esc(l.url)}" target="_blank" class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded">Ver anúncio</a>` : ''}
                      <button class="btn-convert text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded" data-id="${esc(l.id)}">Enviar para Captação</button>
                    </div>
                  </div>
                </div>`;
            }).join('') : '<div class="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-sm text-slate-400">Nenhum lead com esses filtros. Ajuste os critérios ao lado ou adicione um lead manual.</div>'}
          </main>
        </div>
      </div>
      <div id="radar-modal"></div>
    `;

    container.querySelectorAll('input[data-portal]').forEach(el => el.addEventListener('change', e => togglePortal(e.currentTarget.getAttribute('data-portal'))));
    container.querySelectorAll('button[data-type]').forEach(el => el.addEventListener('click', e => toggleType(e.currentTarget.getAttribute('data-type'))));
    container.querySelectorAll('button[data-f]').forEach(el => el.addEventListener('click', e => {
      filters[e.currentTarget.getAttribute('data-f')] = e.currentTarget.getAttribute('data-v');
      render();
    }));
    container.querySelectorAll('.btn-convert').forEach(el => el.addEventListener('click', e => convertToCapture(e.currentTarget.getAttribute('data-id'))));
    container.querySelector('#btn-add-radar').addEventListener('click', openAddModal);
  }

  render();
}
