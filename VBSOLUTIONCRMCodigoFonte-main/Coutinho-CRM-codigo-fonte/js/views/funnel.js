/**
 * View: Funil de Vendas Kanban 12 Etapas
 * Arrastar cards, probabilidade, temperatura e cálculo de conversão
 */
import { db } from '../state/db.js';
import { toCurrency } from '../services/evaluation.js';

export function renderFunnel(container) {
  let brokerFilter = 'all';

  function renderBoard() {
    const stages = db.get('funnelStages').sort((a, b) => a.order - b.order);
    const allOpportunities = db.get('opportunities');
    const clients = db.get('clients');
    const properties = db.get('properties');
    const users = db.get('users');

    const opportunities = brokerFilter === 'all'
      ? allOpportunities
      : allOpportunities.filter(o => o.brokerId === brokerFilter);

    const TERMINAL_STAGES = ['stg_11', 'stg_12', 'stg_14', 'stg_15'];
    const totalPipelineValue = opportunities
      .filter(o => !TERMINAL_STAGES.includes(o.stageId))
      .reduce((acc, o) => acc + (o.value || 0), 0);

    const closedCount = opportunities.filter(o => o.stageId === 'stg_11').length;
    const totalCount = opportunities.length || 1;
    const conversionRate = ((closedCount / totalCount) * 100).toFixed(1);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Topo do Funil -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Funil Comercial Imobiliário</h1>
            <p class="text-sm text-slate-500">Fluxo completo de conversão em 12 etapas padronizadas</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <select id="broker-filter" class="text-xs p-1.5 border border-slate-200 rounded-lg bg-white font-semibold">
              <option value="all" ${brokerFilter === 'all' ? 'selected' : ''}>Todos os corretores</option>
              ${users.map(u => `<option value="${u.id}" ${brokerFilter === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
            </select>
            <div class="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm">
              Valor no Funil: <span class="text-amber-400 font-black">${toCurrency(totalPipelineValue)}</span>
            </div>
            <div class="px-3 py-1.5 bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold shadow-sm">
              Taxa de Conversão: ${conversionRate}%
            </div>
            <button id="btn-add-opp" class="btn-primary flex items-center gap-1.5 text-xs">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Nova Oportunidade
            </button>
          </div>
        </div>

        <!-- Barra de rolagem superior (sincronizada) -->
        <div id="kanban-scroll-top" class="overflow-x-auto overflow-y-hidden" style="height: 12px;">
          <div id="kanban-scroll-top-inner" style="height: 1px;"></div>
        </div>

        <!-- Kanban Board Horizontal Scroll -->
        <div id="kanban-board" class="flex gap-4 overflow-x-auto pb-6 pt-2 items-start select-none" style="min-height: calc(100vh - 220px);">
          ${stages.map(stage => {
            const stageOpps = opportunities.filter(o => o.stageId === stage.id);
            const stageTotal = stageOpps.reduce((acc, o) => acc + (o.value || 0), 0);

            return `
              <div class="kanban-column w-72 flex-shrink-0 bg-slate-100/80 rounded-xl p-3 border border-slate-200 flex flex-col max-h-[80vh]" data-stage-id="${stage.id}">
                <!-- Cabeçalho da Coluna -->
                <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${stage.color}"></span>
                    <span class="font-bold text-slate-800 text-xs truncate max-w-[140px]" title="${stage.name}">${stage.name}</span>
                    <span class="text-[10px] font-black bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">${stageOpps.length}</span>
                  </div>
                  <span class="text-[10px] text-slate-500 font-semibold">${stage.probability}%</span>
                </div>

                <!-- Subtotal da etapa -->
                <div class="text-[11px] text-slate-500 font-semibold mb-2 px-1">
                  ${toCurrency(stageTotal)}
                </div>

                <!-- Cards da etapa -->
                <div class="kanban-cards-container kanban-vscroll flex-1 space-y-2.5 px-1 min-h-[120px]" data-stage-id="${stage.id}">
                  ${stageOpps.map(opp => {
                    const client = clients.find(c => c.id === opp.clientId) || { name: 'Cliente' };
                    const prop = properties.find(p => p.id === opp.propertyId);
                    const broker = users.find(u => u.id === opp.brokerId) || users[0];

                    const tempClasses = {
                      'MUITO_QUENTE': 'border-l-4 border-l-rose-500 bg-rose-50/30',
                      'QUENTE': 'border-l-4 border-l-amber-500 bg-amber-50/20',
                      'MORNO': 'border-l-4 border-l-blue-500 bg-white',
                      'FRIO': 'border-l-4 border-l-slate-400 bg-white'
                    }[opp.temperature] || 'border-l-4 border-l-indigo-500 bg-white';

                    return `
                      <div class="kanban-card ${tempClasses} p-3 rounded-lg border border-slate-200/80 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing bg-white" draggable="true" data-opp-id="${opp.id}">
                        <div class="flex justify-between items-start mb-1">
                          <span class="font-bold text-slate-900 text-xs">${client.name}</span>
                          <span class="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">${opp.temperature === 'MUITO_QUENTE' ? '🔥 Quente' : opp.temperature}</span>
                        </div>

                        ${prop ? `<div class="text-[11px] text-slate-600 truncate font-medium mb-1">🏢 ${prop.title}</div>` : ''}

                        <div class="text-xs font-black text-indigo-900 mb-2">${toCurrency(opp.value)}</div>

                        <div class="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 mb-2">
                          <span class="font-semibold text-slate-700 block">Próxima Ação:</span>
                          <span class="truncate block">${opp.nextAction || 'Definir follow-up'}</span>
                        </div>

                        <div class="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                          <span class="truncate max-w-[100px] text-slate-600 font-medium">👤 ${broker.name.split(' ')[0]}</span>
                          <button class="btn-edit-opp text-indigo-600 hover:text-indigo-900 font-bold" data-opp-id="${opp.id}">Editar</button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Container para modal de oportunidade -->
      <div id="funnel-modal-container"></div>
    `;

    attachKanbanEvents();
  }

  function attachKanbanEvents() {
    let draggedOppId = null;

    const brokerSel = container.querySelector('#broker-filter');
    if (brokerSel) brokerSel.addEventListener('change', e => { brokerFilter = e.target.value; renderBoard(); });

    const board = container.querySelector('#kanban-board');
    const topScroll = container.querySelector('#kanban-scroll-top');
    const topScrollInner = container.querySelector('#kanban-scroll-top-inner');
    if (board && topScroll && topScrollInner) {
      topScrollInner.style.width = board.scrollWidth + 'px';
      let syncing = false;
      topScroll.addEventListener('scroll', () => {
        if (syncing) { syncing = false; return; }
        syncing = true;
        board.scrollLeft = topScroll.scrollLeft;
      });
      board.addEventListener('scroll', () => {
        if (syncing) { syncing = false; return; }
        syncing = true;
        topScroll.scrollLeft = board.scrollLeft;
      });
    }

    // Drag start
    container.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedOppId = e.currentTarget.getAttribute('data-opp-id');
        e.dataTransfer.setData('text/plain', draggedOppId);
        e.currentTarget.classList.add('opacity-50');
      });

      card.addEventListener('dragend', (e) => {
        e.currentTarget.classList.remove('opacity-50');
      });
    });

    // Drop containers
    container.querySelectorAll('.kanban-cards-container').forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('bg-indigo-50/50');
      });

      col.addEventListener('dragleave', (e) => {
        col.classList.remove('bg-indigo-50/50');
      });

      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('bg-indigo-50/50');
        const targetStageId = col.getAttribute('data-stage-id');
        if (draggedOppId && targetStageId) {
          db.update('opportunities', draggedOppId, {
            stageId: targetStageId,
            lastContactAt: new Date().toISOString()
          });
          renderBoard();
        }
      });
    });

    // Abrir Modal de Edição
    container.querySelectorAll('.btn-edit-opp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-opp-id');
        openOpportunityModal(id);
      });
    });

    const btnAdd = container.querySelector('#btn-add-opp');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => openOpportunityModal(null));
    }
  }

  function openOpportunityModal(oppId) {
    const modalContainer = container.querySelector('#funnel-modal-container');
    const clients = db.get('clients');
    const properties = db.get('properties');
    const brokers = db.get('users');
    const stages = db.get('funnelStages').sort((a, b) => a.order - b.order);

    const isEdit = Boolean(oppId);
    const opp = isEdit ? db.getById('opportunities', oppId) : {
      title: '',
      clientId: clients[0]?.id || '',
      propertyId: properties[0]?.id || '',
      brokerId: brokers[0]?.id || '',
      stageId: 'stg_1',
      value: 500000,
      temperature: 'MORNO',
      nextAction: 'Agendar primeiro contato'
    };
    const linkedClient = isEdit ? db.getById('clients', opp.clientId) : null;
    const leadSources = ['PORTAL_DFIMOVEIS','PORTAL_WIMOVEIS','PORTAL_OLX','PORTAL_ZAP','INSTAGRAM_ADS','GOOGLE_ADS','WHATSAPP','INDICACAO','SITE','LANDING_FINANCIAMENTO','SIMULADOR_FINANCIAMENTO','CAPTACAO_DIRETA','IMPORTACAO_PLANILHA','EVENTO','OUTRO'];

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold text-slate-900">${isEdit ? 'Editar Oportunidade' : 'Nova Oportunidade no Funil'}</h3>
            <button id="modal-opp-close" class="text-slate-400 hover:text-slate-600">&times;</button>
          </div>

          <form id="form-opp" class="mt-4 space-y-4 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Cliente *</label>
              <select name="clientId" required class="w-full p-2 border rounded-lg">
                ${clients.map(c => `<option value="${c.id}" ${c.id === opp.clientId ? 'selected' : ''}>${c.name} (${c.type})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Imóvel Associado</label>
              <select name="propertyId" class="w-full p-2 border rounded-lg">
                <option value="">Nenhum imóvel específico</option>
                ${properties.map(p => `<option value="${p.id}" ${p.id === opp.propertyId ? 'selected' : ''}>${p.code} - ${p.title} (${toCurrency(p.salePrice)})</option>`).join('')}
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Valor da Oportunidade (R$)</label>
                <input type="number" name="value" value="${opp.value || 0}" required class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Etapa Atual</label>
                <select name="stageId" class="w-full p-2 border rounded-lg">
                  ${stages.map(s => `<option value="${s.id}" ${s.id === opp.stageId ? 'selected' : ''}>${s.order}. ${s.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Temperatura</label>
                <select name="temperature" class="w-full p-2 border rounded-lg">
                  <option value="MUITO_QUENTE" ${opp.temperature === 'MUITO_QUENTE' ? 'selected' : ''}>Muito Quente 🔥</option>
                  <option value="QUENTE" ${opp.temperature === 'QUENTE' ? 'selected' : ''}>Quente</option>
                  <option value="MORNO" ${opp.temperature === 'MORNO' ? 'selected' : ''}>Morno</option>
                  <option value="FRIO" ${opp.temperature === 'FRIO' ? 'selected' : ''}>Frio</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Corretor Responsável</label>
                <select name="brokerId" class="w-full p-2 border rounded-lg">
                  ${brokers.map(b => `<option value="${b.id}" ${b.id === opp.brokerId ? 'selected' : ''}>${b.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Próxima Ação de Follow-up</label>
              <input type="text" name="nextAction" value="${opp.nextAction || ''}" required class="w-full p-2 border rounded-lg" placeholder="Ex: Enviar proposta ou agendar visita">
            </div>

            ${linkedClient ? `
              <div class="pt-3 mt-1 border-t border-slate-100">
                <div class="text-[11px] font-black text-indigo-700 uppercase tracking-wider mb-2">Dados do Lead · ${linkedClient.name}</div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">Canal / Origem</label>
                    <select name="leadSource" class="w-full p-2 border rounded-lg">
                      ${leadSources.map(s => `<option value="${s}" ${s === linkedClient.leadSource ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
                      ${linkedClient.leadSource && !leadSources.includes(linkedClient.leadSource) ? `<option value="${linkedClient.leadSource}" selected>${linkedClient.leadSource}</option>` : ''}
                    </select>
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">WhatsApp / Telefone</label>
                    <input type="text" name="clientPhone" value="${(linkedClient.phone || '').replace(/"/g, '&quot;')}" class="w-full p-2 border rounded-lg">
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">E-mail</label>
                    <input type="email" name="clientEmail" value="${(linkedClient.email || '').replace(/"/g, '&quot;')}" class="w-full p-2 border rounded-lg">
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">Região de Interesse</label>
                    <input type="text" name="clientRegion" value="${(linkedClient.interestRegion || '').replace(/"/g, '&quot;')}" class="w-full p-2 border rounded-lg">
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">Renda (R$)</label>
                    <input type="number" name="clientIncome" value="${linkedClient.familyIncome || 0}" class="w-full p-2 border rounded-lg">
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">Entrada (R$)</label>
                    <input type="number" name="clientDown" value="${linkedClient.downPayment || 0}" class="w-full p-2 border rounded-lg">
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">FGTS (R$)</label>
                    <input type="number" name="clientFgts" value="${linkedClient.fgts || 0}" class="w-full p-2 border rounded-lg">
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-700 mb-1">Financia?</label>
                    <select name="clientFinancing" class="w-full p-2 border rounded-lg">
                      <option value="true" ${linkedClient.needsFinancing ? 'selected' : ''}>Sim</option>
                      <option value="false" ${!linkedClient.needsFinancing ? 'selected' : ''}>À vista</option>
                    </select>
                  </div>
                </div>
                <div class="mt-3">
                  <label class="block font-semibold text-slate-700 mb-1">Observações / Informações do Lead</label>
                  <textarea name="clientNotes" rows="3" class="w-full p-2 border rounded-lg">${(linkedClient.notes || '').replace(/</g, '&lt;')}</textarea>
                </div>
              </div>
            ` : ''}

            <div class="flex justify-between items-center pt-4 border-t border-slate-100">
              ${isEdit ? `<button type="button" id="btn-delete-opp" class="text-rose-600 font-bold hover:underline">Excluir</button>` : '<div></div>'}
              <div class="flex gap-2">
                <button type="button" id="btn-cancel-opp" class="btn-secondary">Cancelar</button>
                <button type="submit" class="btn-primary">Salvar</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-opp-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-cancel-opp').addEventListener('click', close);

    const btnDel = modalContainer.querySelector('#btn-delete-opp');
    if (btnDel) {
      btnDel.addEventListener('click', () => {
        if (confirm('Deseja realmente remover esta oportunidade?')) {
          db.delete('opportunities', oppId);
          close();
          renderBoard();
        }
      });
    }

    const form = modalContainer.querySelector('#form-opp');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        clientId: fd.get('clientId'),
        propertyId: fd.get('propertyId') || null,
        brokerId: fd.get('brokerId'),
        stageId: fd.get('stageId'),
        value: Number(fd.get('value')) || 0,
        temperature: fd.get('temperature'),
        nextAction: fd.get('nextAction'),
        lastContactAt: new Date().toISOString()
      };

      if (isEdit) {
        db.update('opportunities', oppId, data);
      } else {
        db.insert('opportunities', data);
      }

      // Salva os dados completos do lead no cliente vinculado
      if (linkedClient && fd.get('clientPhone') !== null) {
        const phone = fd.get('clientPhone') || '';
        db.update('clients', linkedClient.id, {
          leadSource: fd.get('leadSource') || linkedClient.leadSource,
          phone: phone,
          whatsapp: phone.replace(/\D/g, ''),
          email: fd.get('clientEmail') || '',
          interestRegion: fd.get('clientRegion') || '',
          familyIncome: Number(fd.get('clientIncome')) || 0,
          downPayment: Number(fd.get('clientDown')) || 0,
          fgts: Number(fd.get('clientFgts')) || 0,
          needsFinancing: fd.get('clientFinancing') === 'true',
          temperature: data.temperature,
          notes: fd.get('clientNotes') || '',
          lastContactAt: new Date().toISOString()
        });
      }

      close();
      renderBoard();
    });
  }

  renderBoard();
}
