/**
 * View: Contratos Imobiliários
 * Alertas de vencimento, documentos, comissão e status
 */
import { db } from '../state/db.js';
import { toCurrency } from '../services/evaluation.js';

export function renderContracts(container) {
  function renderView() {
    const contracts = db.get('contracts');
    const clients = db.get('clients');
    const properties = db.get('properties');
    const users = db.get('users');

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Contratos</h1>
            <p class="text-sm text-slate-500">Contratos de compra, venda, locação e administração com alertas automáticos</p>
          </div>
          <button id="btn-new-contract" class="btn-primary flex items-center gap-2 text-xs">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Novo Contrato
          </button>
        </div>

        <!-- Alertas Ativos -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
            <div class="font-bold text-emerald-900 flex items-center justify-between">
              <span>Contratos Ativos</span>
              <span class="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-black">${contracts.filter(c => c.status === 'ATIVO').length}</span>
            </div>
            <p class="text-emerald-700 mt-1">Instrumentos vigentes com garantia e comissão parametrizada.</p>
          </div>

          <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs">
            <div class="font-bold text-amber-900 flex items-center justify-between">
              <span>Alertas de Renovação</span>
              <span class="bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-black">1</span>
            </div>
            <p class="text-amber-700 mt-1">Contrato CTR-2026/089 com prazo de liquidação em 60 dias.</p>
          </div>

          <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
            <div class="font-bold text-indigo-900 flex items-center justify-between">
              <span>Comissões Vinculadas</span>
              <span class="bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded font-black">
                ${toCurrency(contracts.reduce((acc, c) => acc + (c.commissionValue || 0), 0))}
              </span>
            </div>
            <p class="text-indigo-700 mt-1">Volume de honorários apurados em contratos gerados.</p>
          </div>
        </div>

        <!-- Tabela de Contratos -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th class="px-4 py-3">Nº Contrato / Tipo</th>
                <th class="px-4 py-3">Partes (Cliente & Proprietário)</th>
                <th class="px-4 py-3">Imóvel</th>
                <th class="px-4 py-3">Valor Total</th>
                <th class="px-4 py-3">Honorários / Comissão</th>
                <th class="px-4 py-3">Vigência</th>
                <th class="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              ${contracts.map(c => {
                const client = clients.find(cl => cl.id === c.clientId) || { name: 'Comprador' };
                const owner = clients.find(cl => cl.id === c.ownerId) || { name: 'Proprietário' };
                const prop = properties.find(p => p.id === c.propertyId);
                const broker = users.find(u => u.id === c.brokerId) || users[0];

                return `
                  <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="px-4 py-3">
                      <div class="font-bold text-slate-900">${c.contractNumber}</div>
                      <div class="text-[11px] text-slate-500 font-medium">${c.type}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium text-slate-800">👤 Comprador: ${client.name}</div>
                      <div class="text-[11px] text-slate-500">🏢 Proprietário: ${owner.name}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium text-slate-800">${prop ? prop.title : 'Imóvel'}</div>
                      <div class="text-[11px] text-slate-500">Resp: ${broker.name.split(' ')[0]}</div>
                    </td>
                    <td class="px-4 py-3 font-bold text-slate-900">
                      ${toCurrency(c.totalValue)}
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-bold text-emerald-600">${toCurrency(c.commissionValue)}</div>
                      <div class="text-[10px] text-slate-500">Taxa: ${c.commissionRate}%</div>
                    </td>
                    <td class="px-4 py-3 text-slate-600">
                      <div>De: ${new Date(c.startDate).toLocaleDateString('pt-BR')}</div>
                      <div>Até: ${new Date(c.endDate).toLocaleDateString('pt-BR')}</div>
                    </td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">${c.status}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderView();
}
