/**
 * View: Simulador de Financiamento Imobiliário
 * Poder de compra, comparador de bancos, MCMV/FGTS, lead automático e imóveis compatíveis.
 */
import { db } from '../state/db.js';
import { purchasingPower, compareBanks, analyzeMCMV, leadScoreFromSim, toCurrency } from '../services/financing.js';

export function renderFinancing(container) {
  function money(v) { return toCurrency(v); }

  function renderView() {
    const banks = db.get('financingBanks').filter(b => b.active);

    container.innerHTML = `
      <div class="max-w-5xl mx-auto space-y-6">
        <div class="pb-2 border-b border-slate-200">
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Simulador de Financiamento</h1>
          <p class="text-sm text-slate-500">Descubra o poder de compra do cliente, compare bancos e gere um lead qualificado</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Formulário -->
          <form id="sim-form" class="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 text-xs h-fit">
            <h3 class="text-sm font-bold text-slate-900">Dados do cliente</h3>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Nome</label>
              <input name="name" class="w-full p-2 border rounded-lg" placeholder="Nome completo">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">WhatsApp</label>
                <input name="phone" class="w-full p-2 border rounded-lg" placeholder="(61) 90000-0000">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Idade</label>
                <input name="age" type="number" value="35" class="w-full p-2 border rounded-lg">
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Renda mensal bruta familiar (R$) *</label>
              <input name="income" type="number" required class="w-full p-2 border rounded-lg" placeholder="12000">
              <p class="text-[10px] text-slate-400 mt-1">Some sua renda + do cônjuge (se for compor renda)</p>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Entrada (R$)</label>
                <input name="downPayment" type="number" class="w-full p-2 border rounded-lg" placeholder="150000">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">FGTS (R$)</label>
                <input name="fgts" type="number" class="w-full p-2 border rounded-lg" placeholder="40000">
              </div>
            </div>

            <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed">
              💰 <strong>Toda compra exige entrada.</strong> Bancos financiam no máximo 80% do imóvel (Caixa/BB/Bradesco/Santander) ou 82% (Itaú). Você precisa ter <strong>entre 10% e 20% do valor</strong> em recursos próprios (entrada + FGTS).
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Prazo (meses)</label>
              <input name="term" type="number" value="360" class="w-full p-2 border rounded-lg">
              <p class="text-[10px] text-slate-400 mt-1">Máximo: 420 meses (Caixa/BB/Santander) — 360 meses (Itaú/Bradesco)</p>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Já sabe o valor do imóvel? (opcional)</label>
              <input name="propertyValue" type="number" class="w-full p-2 border rounded-lg" placeholder="Deixe vazio para estimar">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Prazo de compra</label>
              <select name="deadline" class="w-full p-2 border rounded-lg">
                <option value="IMEDIATO">Agora</option>
                <option value="ATE_3M">Até 3 meses</option>
                <option value="ATE_6M">De 3 a 6 meses</option>
                <option value="ATE_12M">De 6 a 12 meses</option>
                <option value="PESQUISANDO">Ainda pesquisando</option>
              </select>
            </div>

            <label class="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer">
              <input type="checkbox" name="mcmvMode" class="mt-0.5 accent-emerald-600">
              <span class="text-[11px] text-emerald-900 leading-relaxed">
                <strong>🏠 Simular como Minha Casa Minha Vida</strong>
                <span class="block text-emerald-700 mt-0.5">Aplica regras específicas do programa: taxas subsidiadas, entrada reduzida (5-10%) e faixas de renda do MCMV.</span>
              </span>
            </label>

            <button type="submit" class="w-full btn-primary text-xs py-2.5">Calcular poder de compra</button>
          </form>

          <!-- Resultado -->
          <div class="lg:col-span-2 space-y-4">
            <div id="sim-result" class="hidden space-y-4"></div>
            <div id="sim-empty" class="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-400 text-sm">
              Preencha os dados ao lado para estimar a capacidade de compra e comparar bancos.
            </div>
          </div>
        </div>
      </div>
    `;

    const form = container.querySelector('#sim-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const income = Number(fd.get('income')) || 0;
      if (income <= 0) { alert('Informe a renda mensal.'); return; }
      const downPayment = Number(fd.get('downPayment')) || 0;
      const fgts = Number(fd.get('fgts')) || 0;
      const age = Number(fd.get('age')) || 35;
      const termMonths = Number(fd.get('term')) || 360;
      let propertyValue = Number(fd.get('propertyValue')) || 0;
      const mcmvMode = fd.get('mcmvMode') === 'on';

      const informedProperty = Number(fd.get('propertyValue')) > 0;

      // Modo MCMV: substitui o pool de bancos por bancos operadores do programa (Caixa/BB),
      // com taxa subsidiada de referência (~4,25% - 8,16% a.a. conforme faixa) e entrada mínima 5-10%.
      let banks;
      if (mcmvMode) {
        // Faixa de referência MCMV 2026: subsídio maior conforme menor a renda.
        const mcmvRate = income <= 2850 ? 4.25 : income <= 4700 ? 6.5 : income <= 8600 ? 8.16 : 10.49;
        const mcmvMaxPct = income <= 2850 ? 95 : income <= 4700 ? 90 : 85;
        banks = [
          { id: 'caixa_mcmv', name: 'Caixa · MCMV', annualRate: mcmvRate, maxFinancePct: mcmvMaxPct, maxTermMonths: 420, fgts: true, mcmv: true, system: 'SAC', active: true, source: 'Programa Minha Casa Minha Vida (referência)', updatedAt: new Date().toISOString().split('T')[0] },
          { id: 'bb_mcmv', name: 'Banco do Brasil · MCMV', annualRate: mcmvRate + 0.5, maxFinancePct: mcmvMaxPct, maxTermMonths: 420, fgts: true, mcmv: true, system: 'SAC', active: true, source: 'Programa Minha Casa Minha Vida (referência)', updatedAt: new Date().toISOString().split('T')[0] }
        ];
      } else {
        banks = db.get('financingBanks').filter(b => b.active);
      }

      const bestBank = banks.reduce((a, b) => (a.annualRate <= b.annualRate ? a : b), banks[0]);
      const power = purchasingPower({ income, downPayment, fgts, bank: bestBank, termMonths, age });
      if (!propertyValue) propertyValue = power.propertyValue;

      // No MCMV há tetos por região; DF 2026 referência: até R$ 350.000
      if (mcmvMode && propertyValue > 350000) propertyValue = 350000;

      const comparison = compareBanks({ propertyValue, income, downPayment, fgts, banks, termMonths, age });
      const mcmv = analyzeMCMV({ income, propertyValue });
      const lowRange = propertyValue * 0.9;
      const highRange = propertyValue * 1.05;

      const bestSim = comparison[0];
      const maxPct = bestSim ? bestSim.maxFinancePct : bestBank.maxFinancePct;
      const minOwnResources = propertyValue * (1 - maxPct / 100);
      const ownResources = downPayment + fgts;
      const requiredDown = Math.max(0, minOwnResources - fgts);
      const missingResources = Math.max(0, minOwnResources - ownResources);

      const commitOk = bestSim ? (bestSim.firstPayment <= income * 0.30) : false;
      const downOk = ownResources >= minOwnResources - 1;
      const viable = informedProperty ? (commitOk && downOk && bestSim && bestSim.feasible) : true;

      renderResult({
        client: { name: fd.get('name'), phone: fd.get('phone') },
        income, downPayment, fgts, age, termMonths,
        propertyValue, power, comparison, mcmv, lowRange, highRange,
        deadline: fd.get('deadline'),
        informedProperty, minOwnResources, requiredDown, missingResources,
        ownResources, viable, commitOk, downOk, maxPct, mcmvMode
      });
    });
  }

  function renderResult(data) {
    const { propertyValue, income, downPayment, fgts, power, comparison, mcmv, lowRange, highRange,
            informedProperty, minOwnResources, requiredDown, missingResources, ownResources, viable, commitOk, downOk, mcmvMode } = data;
    const best = comparison[0];
    const resultEl = container.querySelector('#sim-result');
    container.querySelector('#sim-empty').classList.add('hidden');
    resultEl.classList.remove('hidden');

    const matching = db.get('properties').filter(p => (p.salePrice || 0) > 0 && p.salePrice <= highRange && p.salePrice >= lowRange * 0.7).slice(0, 4);

    const mcmvBanner = mcmvMode ? `
      <div class="rounded-2xl p-4 border-2 border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-2xl">🏠</span>
          <strong class="text-base">Simulação Minha Casa Minha Vida</strong>
        </div>
        <p class="text-xs text-emerald-50">Taxa subsidiada aplicada · Entrada mínima reduzida (5-10%) · Teto de imóvel R$ 350.000 no DF · Renda ${money(income)}/mês · Faixa: <strong>${income <= 2850 ? '1 (subsídio máximo)' : income <= 4700 ? '2' : income <= 8600 ? '3' : 'fora do programa'}</strong></p>
      </div>` : '';

    // Veredito de viabilidade (só quando o valor do imóvel foi informado)
    let verdictHtml = '';
    if (informedProperty) {
      if (viable) {
        verdictHtml = `
          <div class="rounded-2xl p-5 border-2 border-emerald-400 bg-emerald-50">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-black">✓</span>
              <strong class="text-emerald-900 text-base">A renda comporta este imóvel</strong>
            </div>
            <p class="text-xs text-emerald-800">Com renda de ${money(income)}, a parcela estimada de ${money(best ? best.firstPayment : 0)} cabe no limite de 30% e a entrada disponível cobre o mínimo exigido pelo banco.</p>
          </div>`;
      } else {
        const motivos = [];
        if (!commitOk) motivos.push(`a parcela estimada (${money(best ? best.firstPayment : 0)}) passa de 30% da renda (${money(income * 0.3)})`);
        if (!downOk) motivos.push(`faltam ${money(missingResources)} de entrada/recursos próprios para atingir o mínimo de ${money(minOwnResources)}`);
        verdictHtml = `
          <div class="rounded-2xl p-5 border-2 border-amber-400 bg-amber-50">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-black">!</span>
              <strong class="text-amber-900 text-base">Ainda não fecha para este imóvel</strong>
            </div>
            <p class="text-xs text-amber-800">Motivo: ${motivos.join(' e ')}. Opções: aumentar a entrada, alongar o prazo, compor renda ou escolher um imóvel dentro do poder de compra estimado abaixo.</p>
          </div>`;
      }
    }

    resultEl.innerHTML = `
      ${mcmvBanner}
      ${verdictHtml}

      <div class="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow">
        <div class="text-xs font-bold text-indigo-200 uppercase tracking-wider">Poder de compra estimado</div>
        <div class="text-4xl font-black text-amber-400 mt-1">${money(propertyValue)}</div>
        <p class="text-xs text-slate-300 mt-1">Faixa estimada entre ${money(lowRange)} e ${money(highRange)}</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
          <div><span class="text-slate-400 block">Entrada</span><strong>${money(downPayment)}</strong></div>
          <div><span class="text-slate-400 block">FGTS</span><strong>${money(fgts)}</strong></div>
          <div><span class="text-slate-400 block">Financiado</span><strong>${money(power.financed)}</strong></div>
          <div><span class="text-slate-400 block">Parcela est.</span><strong>${money(best ? best.firstPayment : 0)}</strong></div>
        </div>
      </div>

      <!-- Entrada necessária -->
      <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 class="text-sm font-bold text-slate-900 mb-2">Entrada necessária</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div class="p-3 bg-slate-50 rounded-xl">
            <span class="text-slate-400 block">Recursos próprios mínimos</span>
            <strong class="text-slate-900 text-sm">${money(minOwnResources)}</strong>
            <span class="block text-[10px] text-slate-400 mt-0.5">Banco financia até ${data.maxPct}% do imóvel</span>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl">
            <span class="text-slate-400 block">Você já tem</span>
            <strong class="text-slate-900 text-sm">${money(ownResources)}</strong>
            <span class="block text-[10px] text-slate-400 mt-0.5">Entrada ${money(downPayment)} + FGTS ${money(fgts)}</span>
          </div>
          <div class="p-3 rounded-xl ${missingResources > 0 ? 'bg-amber-50' : 'bg-emerald-50'}">
            <span class="text-slate-400 block">${missingResources > 0 ? 'Ainda falta' : 'Situação'}</span>
            <strong class="${missingResources > 0 ? 'text-amber-700' : 'text-emerald-700'} text-sm">${missingResources > 0 ? money(missingResources) : 'Entrada suficiente ✓'}</strong>
          </div>
        </div>
        ${requiredDown > 0 ? `<p class="text-[11px] text-slate-500 mt-2">Considerando o FGTS informado, a entrada em dinheiro necessária é de aproximadamente <strong>${money(requiredDown)}</strong>.</p>` : ''}
      </div>

      <!-- MCMV -->
      <div class="rounded-2xl p-4 border ${mcmv.potential ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'} text-xs">
        <div class="flex items-center justify-between">
          <strong class="${mcmv.potential ? 'text-emerald-800' : 'text-slate-700'}">Minha Casa Minha Vida</strong>
          <span class="font-bold px-2 py-0.5 rounded ${mcmv.potential ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'}">
            ${mcmv.potential ? 'Potencial de enquadramento' : 'Fora das faixas de referência'}
          </span>
        </div>
        <p class="text-slate-600 mt-1">${mcmv.faixa} · Teto de renda referência ${money(mcmv.rendaTeto)}, imóvel até ${money(mcmv.imovelTeto)}.</p>
        <p class="text-[10px] text-slate-400 mt-1">${mcmv.disclaimer}</p>
      </div>

      <!-- Comparador de bancos -->
      <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 class="text-sm font-bold text-slate-900 mb-3">Comparador de bancos <span class="text-[10px] font-normal text-slate-400">(ordenado por compatibilidade)</span></h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                <th class="px-2 py-2">Banco</th><th class="px-2 py-2">Sistema</th><th class="px-2 py-2">Taxa a.a.</th>
                <th class="px-2 py-2">Parcela inicial</th><th class="px-2 py-2">Prazo</th><th class="px-2 py-2">Compat.</th>
              </tr>
            </thead>
            <tbody>
              ${comparison.map((b, i) => `
                <tr class="border-b border-slate-100 ${i === 0 ? 'bg-emerald-50/40' : ''}">
                  <td class="px-2 py-2 font-bold text-slate-900">${i === 0 ? '⭐ ' : ''}${b.bankName}</td>
                  <td class="px-2 py-2">${b.system}</td>
                  <td class="px-2 py-2">${b.annualRate.toFixed(2)}%</td>
                  <td class="px-2 py-2 font-semibold">${money(b.firstPayment)}</td>
                  <td class="px-2 py-2">${b.months}m</td>
                  <td class="px-2 py-2"><span class="font-black text-indigo-700">${b.score}</span>/100</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-3">
          ⚠️ Estimativa de capacidade de compra — não representa aprovação de crédito. Taxas são de referência e devem ser confirmadas na instituição.
        </p>
        <div class="mt-2 text-[11px] text-slate-600">
          <strong>Banco mais compatível:</strong> ${best ? best.bankName : '—'} — melhor combinação de taxa, prazo e comprometimento de renda para este perfil.
        </div>
      </div>

      <!-- Imóveis compatíveis -->
      <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-slate-900">Imóveis compatíveis (${matching.length})</h3>
          <a href="#/properties" class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Ver portfólio →</a>
        </div>
        ${matching.length ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${matching.map(p => `
            <div class="border border-slate-200 rounded-xl p-3 text-xs">
              <div class="font-bold text-slate-900 truncate">${p.title}</div>
              <div class="text-slate-500">${p.region} · ${p.bedrooms} quartos</div>
              <div class="font-black text-indigo-700 mt-1">${money(p.salePrice)}</div>
            </div>
          `).join('')}
        </div>` : '<p class="text-xs text-slate-400">Nenhum imóvel do portfólio nessa faixa no momento. Cadastre ou capte imóveis compatíveis.</p>'}
      </div>

      <!-- Aviso de pré-análise -->
      <div class="rounded-2xl p-4 bg-indigo-50 border border-indigo-200 text-xs">
        <strong class="text-indigo-900 block mb-1">Esta é uma pré-análise gratuita</strong>
        <p class="text-indigo-800">O resultado é uma estimativa de capacidade de compra e <strong>não representa aprovação de crédito</strong>. A aprovação final é feita pelo banco mediante <strong>análise de crédito e envio de documentos</strong> (RG/CPF, comprovante de renda, extrato de FGTS, entre outros). Nossa equipe conduz você em todas as etapas.</p>
      </div>

      <!-- Ações: lead + WhatsApp + PDF -->
      <div class="flex flex-wrap gap-2">
        <button id="btn-create-lead" class="btn-primary text-xs">Quero avançar — falar com especialista</button>
        <a id="btn-wa-sim" target="_blank" class="btn-secondary text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50">Enviar resultado no WhatsApp</a>
        <button id="btn-pdf-sim" class="btn-secondary text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50">Baixar PDF / Imprimir</button>
      </div>
    `;

    const phone = (data.client.phone || '').replace(/\D/g, '');
    const waText = `Olá${data.client.name ? ', ' + data.client.name.split(' ')[0] : ''}! Sua simulação de financiamento indicou um poder de compra estimado de ${money(propertyValue)}, com parcela a partir de ${money(best ? best.firstPayment : 0)}. Quer que eu te mostre imóveis compatíveis?`;
    const wa = resultEl.querySelector('#btn-wa-sim');
    wa.href = `https://wa.me/55${phone}?text=${encodeURIComponent(waText)}`;

    const btnPdf = resultEl.querySelector('#btn-pdf-sim');
    if (btnPdf) btnPdf.addEventListener('click', () => generateSimPDF(data));

    resultEl.querySelector('#btn-create-lead').addEventListener('click', () => {
      const { score, temperature } = leadScoreFromSim({
        income, downPayment, fgts, propertyValue, deadline: data.deadline,
        feasible: best ? best.feasible : false, requestedContact: true, completed: true
      });
      const admin = db.get('users').find(u => u.role === 'ADMINISTRADOR') || db.get('users')[0];
      const newClient = db.insert('clients', {
        name: data.client.name || 'Lead do Simulador',
        type: 'COMPRADOR', email: '', phone: data.client.phone || '',
        whatsapp: phone, interestRegion: 'DF', propertyType: 'APARTAMENTO',
        priceRangeMax: Math.round(propertyValue), temperature,
        brokerId: admin?.id, leadSource: 'SIMULADOR_FINANCIAMENTO',
        familyIncome: income, downPayment, fgts, needsFinancing: true,
        purchaseDeadline: data.deadline,
        notes: `Simulação: poder de compra ${money(propertyValue)}, banco recomendado ${best ? best.bankName : '—'}, parcela ${money(best ? best.firstPayment : 0)}. Lead Score ${score}.`,
        lastContactAt: new Date().toISOString(),
        nextContactAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'ATIVO'
      });
      db.insert('interactions', { clientId: newClient.id, brokerId: admin?.id, channel: 'SISTEMA', type: 'LEAD_CRIADO', content: 'Lead gerado pelo Simulador de Financiamento.', createdAt: new Date().toISOString() });
      db.insert('opportunities', {
        title: `${newClient.name} · Simulação (${money(propertyValue)})`, clientId: newClient.id, propertyId: null,
        brokerId: admin?.id, stageId: 'stg_1', value: Math.round(propertyValue), temperature,
        nextAction: 'Contatar lead do simulador e enviar imóveis compatíveis', nextActionDate: newClient.nextContactAt,
        lastContactAt: new Date().toISOString(), lostReason: null
      });
      alert(`Lead criado no CRM com Lead Score ${score} (${temperature.replace('_', ' ')}).`);
    });
  }

  function generateSimPDF(data) {
    const { propertyValue, income, downPayment, fgts, power, comparison, mcmv, minOwnResources, requiredDown, missingResources, ownResources, viable, maxPct, mcmvMode, client } = data;
    const best = comparison[0];
    const settings = db.data.settings || {};
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para gerar o PDF.'); return; }
    const html = `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Simulação de Financiamento - ${client.name || 'Cliente'}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.5; margin: 0; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0b1d3a; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { margin: 0; font-size: 20px; color: #0b1d3a; }
  .header p { margin: 2px 0 0 0; color: #64748b; font-size: 11px; }
  .badge { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 4px; font-weight: 600; font-size: 11px; }
  .banner { background: #0b1d3a; color: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  .banner h2 { margin: 0 0 8px 0; font-size: 16px; }
  .banner .price { font-size: 28px; font-weight: 800; color: #f59e0b; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; background: #fff; }
  .card h3 { margin: 0 0 10px 0; font-size: 12px; color: #0b1d3a; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #f1f5f9; }
  .row:last-child { border: none; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; color: #0b1d3a; }
  .disclaimer { margin-top: 24px; padding: 12px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; font-size: 10px; color: #78350f; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center; }
</style></head><body>
  <div class="header">
    <div><h1>${settings.tradingName || 'Coutinho Imóveis'}</h1><p>Simulação de Financiamento Imobiliário</p></div>
    <div class="badge">${mcmvMode ? 'MINHA CASA MINHA VIDA' : 'FINANCIAMENTO PADRÃO'}</div>
  </div>
  <div class="banner">
    <h2>${client.name || 'Cliente'}${client.phone ? ' · ' + client.phone : ''}</h2>
    <p style="margin: 0 0 8px 0; font-size: 11px; opacity: 0.9;">Poder de compra estimado</p>
    <div class="price">${money(propertyValue)}</div>
    <p style="margin: 8px 0 0 0; font-size: 11px; opacity: 0.9;">Faixa entre ${money(propertyValue * 0.9)} e ${money(propertyValue * 1.05)}</p>
  </div>
  <div class="grid-2">
    <div class="card"><h3>Perfil Financeiro</h3>
      <div class="row"><span>Renda mensal bruta:</span><strong>${money(income)}</strong></div>
      <div class="row"><span>Entrada informada:</span><strong>${money(downPayment)}</strong></div>
      <div class="row"><span>FGTS:</span><strong>${money(fgts)}</strong></div>
      <div class="row"><span>Recursos próprios:</span><strong>${money(ownResources)}</strong></div>
    </div>
    <div class="card"><h3>Entrada Necessária</h3>
      <div class="row"><span>Mínimo exigido:</span><strong>${money(minOwnResources)}</strong></div>
      <div class="row"><span>Você já tem:</span><strong>${money(ownResources)}</strong></div>
      <div class="row"><span>${missingResources > 0 ? 'Falta ainda:' : 'Situação:'}</span><strong>${missingResources > 0 ? money(missingResources) : 'Suficiente ✓'}</strong></div>
      <div class="row"><span>Banco financia até:</span><strong>${maxPct}%</strong></div>
    </div>
  </div>
  <div class="card" style="margin-bottom: 16px;"><h3>Comparação de Bancos</h3>
    <table><thead><tr><th>Banco</th><th>Sistema</th><th>Taxa a.a.</th><th>Parcela</th><th>Prazo</th><th>Compat.</th></tr></thead>
    <tbody>${comparison.map((b, i) => `<tr>${i === 0 ? '<td><strong>⭐ ' + b.bankName + '</strong></td>' : '<td>' + b.bankName + '</td>'}<td>${b.system}</td><td>${b.annualRate.toFixed(2)}%</td><td><strong>${money(b.firstPayment)}</strong></td><td>${b.months}m</td><td>${b.score}/100</td></tr>`).join('')}</tbody></table>
  </div>
  ${mcmv.potential ? `<div class="card" style="margin-bottom: 16px; background: #f0fdf4; border-color: #86efac;"><h3>Minha Casa Minha Vida</h3><p><strong>Potencial de enquadramento.</strong> ${mcmv.faixa}. Teto de renda referência: ${money(mcmv.rendaTeto)}, imóvel até ${money(mcmv.imovelTeto)}.</p></div>` : ''}
  <div class="disclaimer">
    <strong>Esta é uma pré-análise gratuita, não representa aprovação de crédito.</strong> A aprovação final é feita pelo banco mediante análise de crédito e envio de documentos (RG/CPF, comprovante de renda, extrato de FGTS, entre outros). Taxas de referência sujeitas a alteração pela instituição financeira.
  </div>
  <div class="footer">${settings.tradingName || 'Coutinho Imóveis'} · ${settings.phone || ''} · ${settings.contactEmail || settings.adminEmail || ''} · CRECI ${settings.creciJ || 'DF'}<br>Emitido em ${new Date().toLocaleString('pt-BR')}</div>
  <script>window.onload = function() { window.print(); };</script>
</body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  renderView();
}
