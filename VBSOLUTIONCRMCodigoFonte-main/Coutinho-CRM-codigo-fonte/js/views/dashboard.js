/**
 * View: Dashboard Principal
 * Cards de métricas operacionais + Gráficos em SVG/Canvas nativos
 */
import { db } from '../state/db.js';
import { toCurrency, toNumber } from '../services/evaluation.js';

export function renderDashboard(container) {
  const clients = db.get('clients');
  const properties = db.get('properties');
  const opportunities = db.get('opportunities');
  const evaluations = db.get('evaluations');
  const contracts = db.get('contracts');
  const commissions = db.get('commissions');

  // Cálculos rápidos
  const newLeads = clients.filter(c => c.type !== 'PROPRIETARIO' && c.temperature === 'FRIO').length;
  const inServiceLeads = clients.filter(c => c.type !== 'PROPRIETARIO' && ['MORNO', 'QUENTE'].includes(c.temperature)).length;
  const hotLeads = clients.filter(c => c.temperature === 'MUITO_QUENTE' || c.temperature === 'QUENTE').length;

  const staleLeads = clients.filter(c => {
    if (!c.lastContactAt || c.type === 'PROPRIETARIO') return false;
    const diff = Math.floor((new Date() - new Date(c.lastContactAt)) / (1000 * 60 * 60 * 24));
    return diff >= 3;
  }).length;

  const totalProperties = properties.length;
  const activeProperties = properties.filter(p => p.status === 'DISPONIVEL').length;
  const proposalProperties = properties.filter(p => p.status === 'PROPOSTA').length;

  const totalReceivable = commissions
    .filter(c => ['A_RECEBER', 'PREVISTO', 'ATRASADO'].includes(c.status))
    .reduce((acc, c) => acc + c.commissionAmount, 0);

  const totalReceived = commissions
    .filter(c => c.status === 'RECEBIDO')
    .reduce((acc, c) => acc + c.commissionAmount, 0);

  const pipelineValue = opportunities
    .filter(o => !['stg_11', 'stg_12'].includes(o.stageId))
    .reduce((acc, o) => acc + (o.value || 0), 0);

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Topo do Dashboard -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Operacional</h1>
          <p class="text-sm text-slate-500">Panorama em tempo real da operação imobiliária Coutinho</p>
        </div>
        <div class="flex items-center gap-3">
          <button id="btn-quick-new-lead" class="btn-primary flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Novo Lead
          </button>
          <a href="#/evaluation" class="btn-secondary flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
            Nova Avaliação
          </a>
        </div>
      </div>

      <!-- Grid de Cards de Indicadores (clicáveis) -->
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <a href="#/crm" class="stat-card cursor-pointer hover:shadow-md transition block">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Leads Novos</div>
          <div class="text-2xl font-black text-slate-900 mt-1">${newLeads}</div>
          <div class="text-xs text-blue-600 font-medium mt-1">Aguardando 1º contato →</div>
        </a>

        <a href="#/crm" class="stat-card cursor-pointer hover:shadow-md transition block">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Em Atendimento</div>
          <div class="text-2xl font-black text-slate-900 mt-1">${inServiceLeads}</div>
          <div class="text-xs text-emerald-600 font-medium mt-1">Nutrição ativa →</div>
        </a>

        <a href="#/crm?filter=QUENTES" class="stat-card cursor-pointer hover:shadow-md transition block border-l-4 border-l-amber-500">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Leads Quentes</div>
          <div class="text-2xl font-black text-amber-600 mt-1">${hotLeads}</div>
          <div class="text-xs text-slate-500 mt-1">Alta probabilidade →</div>
        </a>

        <a href="#/assistant" class="stat-card cursor-pointer hover:shadow-md transition block border-l-4 border-l-rose-500">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sem Follow-up (+3d)</div>
          <div class="text-2xl font-black text-rose-600 mt-1">${staleLeads}</div>
          <div class="text-xs text-rose-500 font-medium mt-1">Ação requerida →</div>
        </a>

        <a href="#/properties" class="stat-card cursor-pointer hover:shadow-md transition block">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Imóveis Ativos</div>
          <div class="text-2xl font-black text-slate-900 mt-1">${activeProperties}</div>
          <div class="text-xs text-slate-500 mt-1">${totalProperties} cadastrados →</div>
        </a>

        <a href="#/funnel" class="stat-card cursor-pointer hover:shadow-md transition block">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Propostas</div>
          <div class="text-2xl font-black text-indigo-600 mt-1">${proposalProperties}</div>
          <div class="text-xs text-slate-500 mt-1">Em negociação →</div>
        </a>
      </div>

      <!-- Bloco Financeiro e Pipeline -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-indigo-200 uppercase tracking-wider">Pipeline em Negociação</span>
            <span class="px-2 py-0.5 text-xs bg-indigo-500/30 text-indigo-200 rounded font-semibold">${opportunities.length} Oportunidades</span>
          </div>
          <div class="text-3xl font-black text-white mt-2">${toCurrency(pipelineValue)}</div>
          <p class="text-xs text-slate-300 mt-2">Valor bruto total do funil comercial ativo</p>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Comissões a Receber</span>
            <span class="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded font-semibold">Previsão</span>
          </div>
          <div class="text-3xl font-black text-amber-600 mt-2">${toCurrency(totalReceivable)}</div>
          <p class="text-xs text-slate-500 mt-2">Honorários previstos dos contratos vigentes</p>
        </div>

        <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Comissões Realizadas</span>
            <span class="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded font-semibold">Liquidado</span>
          </div>
          <div class="text-3xl font-black text-emerald-600 mt-2">${toCurrency(totalReceived)}</div>
          <p class="text-xs text-slate-500 mt-2">Valores liquidados no período corrente</p>
        </div>
      </div>

      <!-- Gráficos e Funil Visual -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Gráfico do Funil de Conversão -->
        <div class="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-base font-bold text-slate-900">Conversão por Estágio do Funil</h3>
              <p class="text-xs text-slate-500">Distribuição de oportunidades ativas por etapas</p>
            </div>
            <a href="#/funnel" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Ver Kanban &rarr;</a>
          </div>

          <div class="flex flex-col items-center gap-1 py-2">
            ${(() => {
              const commercialStages = db.get('funnelStages').filter(s => !['stg_12', 'stg_14', 'stg_15'].includes(s.id)).sort((a, b) => a.order - b.order);
              const maxCount = Math.max(1, ...commercialStages.map(s => opportunities.filter(o => o.stageId === s.id).length));
              const totalStages = commercialStages.length;
              return commercialStages.map((stage, index) => {
                const oppsInStage = opportunities.filter(o => o.stageId === stage.id);
                const count = oppsInStage.length;
                const val = oppsInStage.reduce((acc, o) => acc + (o.value || 0), 0);
                // Largura afunilada: começa em 100% e estreita progressivamente até ~42%
                const width = 100 - (index / (totalStages - 1)) * 58;
                return `
                  <div class="relative flex items-center justify-center text-white text-xs font-semibold rounded-md shadow-sm transition-all hover:brightness-110 group"
                       style="width: ${width}%; min-height: 34px; background: linear-gradient(90deg, ${stage.color}, ${stage.color}cc);">
                    <div class="flex items-center justify-between w-full px-3">
                      <span class="truncate text-[11px] font-bold drop-shadow-sm">${stage.name}</span>
                      <span class="flex items-center gap-1.5 flex-shrink-0">
                        <span class="bg-white/25 backdrop-blur-sm px-1.5 py-0.5 rounded text-[11px] font-black">${count}</span>
                        <span class="hidden sm:inline text-[10px] font-medium opacity-90">lead${count === 1 ? '' : 's'}</span>
                      </span>
                    </div>
                    <div class="absolute left-1/2 -translate-x-1/2 -bottom-7 hidden group-hover:block z-10 bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                      ${toCurrency(val)} em ${count} oportunidade${count === 1 ? '' : 's'}
                    </div>
                  </div>
                `;
              }).join('');
            })()}
          </div>
          <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span class="text-slate-500">Perdidos: <strong class="text-rose-600">${opportunities.filter(o => o.stageId === 'stg_12').length}</strong></span>
            <span class="text-slate-500">Ganhos: <strong class="text-emerald-600">${opportunities.filter(o => o.stageId === 'stg_11').length}</strong></span>
            <span class="text-slate-500">Total ativo: <strong class="text-slate-900">${opportunities.filter(o => !['stg_11','stg_12'].includes(o.stageId)).length}</strong></span>
          </div>
        </div>

        <!-- Radar de Ações Rápidas & Alertas Coutinho IA -->
        <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 class="text-base font-bold text-slate-900">Coutinho IA · Radar</h3>
              </div>
              <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">Assistente Ativa</span>
            </div>
            <p class="text-xs text-slate-600 mb-4">Avisos automatizados gerados para a equipe hoje:</p>

            <div class="space-y-2.5">
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                <div class="font-bold text-amber-900 flex items-center justify-between">
                  <span>Follow-up pendente</span>
                  <span class="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.2 rounded font-bold">URGENTE</span>
                </div>
                <div class="text-amber-800 mt-1">Lead <strong>Gustavo Barreto</strong> está há 5 dias sem contato após visita em Vicente Pires.</div>
              </div>

              <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                <div class="font-bold text-emerald-900">Proposta Quente no Noroeste</div>
                <div class="text-emerald-800 mt-1">Eduardo Guimarães possui carta aprovada no BRB para o SQNW 104.</div>
              </div>

              <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                <div class="font-bold text-blue-900">Nova Captação no OLX</div>
                <div class="text-blue-800 mt-1">Apartamento 3 quartos em Águas Claras cadastrado para avaliação inicial.</div>
              </div>
            </div>
          </div>

          <div class="pt-4 mt-4 border-t border-slate-100">
            <a href="#/assistant" class="w-full btn-secondary text-center block text-xs">
              Abrir Chat com Coutinho IA
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  // Listener para botão de novo lead
  const btnQuickLead = container.querySelector('#btn-quick-new-lead');
  if (btnQuickLead) {
    btnQuickLead.addEventListener('click', () => {
      window.location.hash = '#/crm?action=new';
    });
  }
}
