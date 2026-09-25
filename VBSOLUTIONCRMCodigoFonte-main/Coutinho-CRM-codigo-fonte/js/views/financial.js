/**
 * View: Financeiro & Comissões
 * Contas a receber, comissões por corretor e previsão de receita
 */
import { db } from '../state/db.js';
import { toCurrency } from '../services/evaluation.js';

export function renderFinancial(container) {
  function renderView() {
    const commissions = db.get('commissions');
    const users = db.get('users');
    const properties = db.get('properties');

    const totalReceivable = commissions
      .filter(c => ['A_RECEBER', 'PREVISTO', 'ATRASADO'].includes(c.status))
      .reduce((acc, c) => acc + c.commissionAmount, 0);

    const totalReceived = commissions
      .filter(c => c.status === 'RECEBIDO')
      .reduce((acc, c) => acc + c.commissionAmount, 0);

    const totalOverdue = commissions
      .filter(c => c.status === 'ATRASADO')
      .reduce((acc, c) => acc + c.commissionAmount, 0);

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Financeiro & Comissões Imobiliárias</h1>
            <p class="text-sm text-slate-500">Gestão de honorários de venda, locação, administração e contas a receber</p>
          </div>
          <button id="btn-new-commission" class="btn-primary text-xs flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Lançar Recebível
          </button>
        </div>

        <!-- Indicadores Financeiros -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Previsto / A Receber</span>
            <div class="text-2xl font-black text-amber-600 mt-1">${toCurrency(totalReceivable)}</div>
            <p class="text-[11px] text-slate-500 mt-1">Valores com vencimento programado</p>
          </div>

          <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Liquidado / Recebido</span>
            <div class="text-2xl font-black text-emerald-600 mt-1">${toCurrency(totalReceived)}</div>
            <p class="text-[11px] text-slate-500 mt-1">Valores quitados na conta da imobiliária</p>
          </div>

          <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Inadimplência / Atrasados</span>
            <div class="text-2xl font-black text-rose-600 mt-1">${toCurrency(totalOverdue)}</div>
            <p class="text-[11px] text-slate-500 mt-1">Cobranças pendentes de repasse</p>
          </div>

          <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Média de Taxa Aplicada</span>
            <div class="text-2xl font-black text-indigo-900 mt-1">5.0%</div>
            <p class="text-[11px] text-slate-500 mt-1">Padrão COFECI/CRECI-DF para intermediação</p>
          </div>
        </div>

        <!-- Tabela de Lançamentos de Comissões -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th class="px-4 py-3">Imóvel Referência</th>
                <th class="px-4 py-3">Categoria</th>
                <th class="px-4 py-3">Corretor Beneficiário</th>
                <th class="px-4 py-3">Valor Bruto</th>
                <th class="px-4 py-3">Comissão (R$)</th>
                <th class="px-4 py-3">Vencimento</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${commissions.map(comm => {
                const prop = properties.find(p => p.id === comm.propertyId);
                const broker = users.find(u => u.id === comm.brokerId) || users[0];

                const statusBadge = {
                  'RECEBIDO': '<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Recebido</span>',
                  'A_RECEBER': '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">A Receber</span>',
                  'PREVISTO': '<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">Previsto</span>',
                  'ATRASADO': '<span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">Atrasado</span>'
                }[comm.status] || `<span class="bg-slate-100 px-2 py-0.5 rounded">${comm.status}</span>`;

                return `
                  <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="px-4 py-3">
                      <div class="font-bold text-slate-900">${prop ? prop.title : 'Contrato / Transação'}</div>
                      <div class="text-[10px] text-slate-500">${prop ? prop.code : 'COU'}</div>
                    </td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-0.5 bg-slate-100 rounded font-semibold text-slate-700">${comm.category}</span>
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium text-slate-800">${broker.name}</div>
                      <div class="text-[10px] text-slate-500">${broker.creci}</div>
                    </td>
                    <td class="px-4 py-3 font-semibold text-slate-700">
                      ${toCurrency(comm.grossValue)}
                    </td>
                    <td class="px-4 py-3 font-black text-indigo-900">
                      ${toCurrency(comm.commissionAmount)}
                    </td>
                    <td class="px-4 py-3 text-slate-600">
                      ${new Date(comm.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td class="px-4 py-3">
                      ${statusBadge}
                    </td>
                    <td class="px-4 py-3 text-right">
                      ${comm.status !== 'RECEBIDO' ? `
                        <button class="btn-mark-received text-[11px] text-emerald-600 hover:text-emerald-800 font-bold" data-id="${comm.id}">
                          Baixar
                        </button>
                      ` : '<span class="text-[11px] text-slate-400 font-medium">Liquidado</span>'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-mark-received').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        db.update('commissions', id, {
          status: 'RECEBIDO',
          receivedDate: new Date().toISOString().split('T')[0]
        });
        renderView();
      });
    });
  }

  renderView();
}
