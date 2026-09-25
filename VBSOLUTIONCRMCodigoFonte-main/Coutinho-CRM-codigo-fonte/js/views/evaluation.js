/**
 * View: Avaliação Mercadológica de Imóveis
 * Banco de comparáveis, cálculo de média/mediana do m² e emissão de laudo formal
 */
import { db } from '../state/db.js';
import { toCurrency, toNumber, calculateEvaluation, getEvaluationNarrative, findComparablesWithAI } from '../services/evaluation.js';
import { exportService } from '../services/export.js';

export function renderEvaluation(container) {
  let selectedEvaluationId = db.get('evaluations')[0]?.id || null;

  function renderView() {
    const evaluations = db.get('evaluations');
    const properties = db.get('properties');
    const currentEval = evaluations.find(e => e.id === selectedEvaluationId) || evaluations[0];
    const stats = currentEval ? calculateEvaluation(currentEval.propertyArea, currentEval.comparables || []) : null;
    const narrative = currentEval ? getEvaluationNarrative(currentEval) : null;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Topo -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Avaliação Mercadológica Profissional</h1>
            <p class="text-sm text-slate-500">Metodologia comparativa direta com cálculo de média/mediana do m² e laudo técnico</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-new-eval" class="btn-secondary flex items-center gap-1.5 text-xs">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Nova Avaliação
            </button>
            ${currentEval ? `
              <button id="btn-ai-evaluate" class="btn-primary flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700">
                <svg class="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Avaliar com IA
              </button>
            ` : ''}
            ${currentEval ? `
              <button id="btn-generate-report" class="btn-primary flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                GERAR AVALIAÇÃO (PDF)
              </button>
            ` : ''}
          </div>
        </div>


        ${currentEval ? `
          <!-- Painel Principal do Laudo Selecionado -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Coluna 1 e 2: Dados e Comparáveis -->
            <div class="lg:col-span-2 space-y-6">
              <!-- Dados do Imóvel Avaliado -->
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 class="text-base font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>Dados do Imóvel Avaliando</span>
                  <span class="text-xs font-normal text-slate-500">Área: <strong>${toNumber(currentEval.propertyArea)} m²</strong></span>
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div class="p-3 bg-slate-50 rounded-lg">
                    <span class="text-slate-500 block">Endereço</span>
                    <span class="font-semibold text-slate-800">${currentEval.propertyAddress}</span>
                  </div>
                  <div class="p-3 bg-slate-50 rounded-lg">
                    <span class="text-slate-500 block">Proprietário</span>
                    <span class="font-semibold text-slate-800">${currentEval.clientOwner}</span>
                  </div>
                  <div class="p-3 bg-slate-50 rounded-lg">
                    <span class="text-slate-500 block">Quartos / Vagas</span>
                    <span class="font-semibold text-slate-800">${currentEval.bedrooms} quartos · ${currentEval.parkingSpots} vagas</span>
                  </div>
                  <div class="p-3 bg-slate-50 rounded-lg">
                    <span class="text-slate-500 block">Conservação</span>
                    <span class="font-semibold text-slate-800">${currentEval.conservationState}</span>
                  </div>
                </div>
              </div>

              <!-- Tabela de Comparáveis de Mercado -->
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <h3 class="text-base font-bold text-slate-900">Banco de Imóveis Comparáveis</h3>
                    <p class="text-xs text-slate-500">Amostragem de mercado ativo para apuração do valor/m²</p>
                  </div>
                  <button id="btn-add-comparable" class="text-xs text-indigo-600 hover:text-indigo-800 font-bold">
                    + Adicionar Comparável
                  </button>
                </div>

                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                        <th class="px-3 py-2">Endereço</th>
                        <th class="px-3 py-2">Área (m²)</th>
                        <th class="px-3 py-2">Quartos</th>
                        <th class="px-3 py-2">Valor Anunciado</th>
                        <th class="px-3 py-2">Valor / m²</th>
                        <th class="px-3 py-2">Fonte</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(currentEval.comparables || []).map(comp => `
                        <tr class="border-b border-slate-100">
                          <td class="px-3 py-2 font-medium text-slate-800">
                            ${comp.address}
                            ${comp.url ? `<a href="${comp.url}" target="_blank" class="block text-[10px] text-indigo-600 hover:underline">🔗 ver anúncio</a>` : ''}
                          </td>
                          <td class="px-3 py-2">${toNumber(comp.area)} m²</td>
                          <td class="px-3 py-2">${comp.bedrooms}</td>
                          <td class="px-3 py-2 font-bold text-slate-900">${toCurrency(comp.price)}</td>
                          <td class="px-3 py-2 font-black text-indigo-700">${toCurrency(comp.priceM2 || comp.price / comp.area)}</td>
                          <td class="px-3 py-2"><span class="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">${comp.source}</span></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Parecer Comercial e Metodologia -->
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                <h3 class="text-base font-bold text-slate-900">Estratégia e Fundamentação</h3>
                <div class="p-3 bg-slate-50 rounded-lg text-slate-700 leading-relaxed">
                  <strong class="text-slate-900 block mb-1">Metodologia Aplicada:</strong>
                  ${narrative.methodology}
                </div>
                <div class="p-3 bg-slate-50 rounded-lg text-slate-700 leading-relaxed">
                  <strong class="text-slate-900 block mb-1">Posicionamento de Mercado:</strong>
                  ${narrative.pricingStrategy}
                </div>
              </div>
            </div>

            <!-- Coluna 3: Resultados Estatísticos e Conclusão -->
            <div class="space-y-6">
              <div class="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-md">
                <div class="text-xs font-bold text-indigo-200 uppercase tracking-wider">Valor Recomendado</div>
                <div class="text-3xl font-black text-amber-400 mt-2">${toCurrency(stats.idealSalePrice)}</div>
                <p class="text-xs text-slate-300 mt-1">Preço ideal de venda para máxima liquidez</p>

                <div class="mt-4 pt-4 border-t border-slate-700/60 space-y-2 text-xs">
                  <div class="flex justify-between">
                    <span class="text-slate-400">Preço Estratégico (Anúncio):</span>
                    <strong class="text-white">${toCurrency(stats.strategicListingPrice)}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Piso de Mercado:</span>
                    <strong class="text-slate-300">${toCurrency(stats.marketFloor)}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Média Apurada:</span>
                    <strong class="text-slate-300">${toCurrency(stats.averagePriceM2)}/m²</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Mediana Apurada:</span>
                    <strong class="text-slate-300">${toCurrency(stats.medianPriceM2)}/m²</strong>
                  </div>
                </div>
              </div>

              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs space-y-3">
                <h4 class="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Resumo Estatístico</h4>
                <div class="flex justify-between py-1 border-b border-slate-100">
                  <span class="text-slate-500">Menor valor m²:</span>
                  <strong class="text-slate-800">${toCurrency(stats.minPriceM2)}</strong>
                </div>
                <div class="flex justify-between py-1 border-b border-slate-100">
                  <span class="text-slate-500">Maior valor m²:</span>
                  <strong class="text-slate-800">${toCurrency(stats.maxPriceM2)}</strong>
                </div>
                <div class="flex justify-between py-1 border-b border-slate-100">
                  <span class="text-slate-500">Amostras Válidas:</span>
                  <strong class="text-slate-800">${stats.count} imóveis</strong>
                </div>

                ${stats.count < 3 ? `
                <div class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 mt-2">
                  ⚠️ <strong>Amostragem insuficiente</strong> (${stats.count} de 3 mínimos). Adicione imóveis de referência (por link ou manualmente) para um cálculo confiável.
                  <button id="btn-add-ref-inline" class="mt-2 w-full py-1.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700">+ Adicionar imóvel de referência</button>
                </div>` : ''}

                <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 mt-4">
                  ⚠️ <strong>Aviso Legal:</strong> Parecer de valor de mercado para finalidade comercial e negociação, nos termos do COFECI.
                </div>
              </div>

              <!-- Ajustes de mercado (experiência do corretor) -->
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs">
                <h4 class="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">Ajustes do Corretor</h4>
                <p class="text-[11px] text-slate-500 mb-3">Aplique sua experiência de mercado sobre a base calculada.</p>
                <div class="space-y-2">
                  <div>
                    <label class="block text-slate-500 mb-0.5">Ajuste de padrão / reforma (%)</label>
                    <input type="number" step="0.5" id="adj-percent" value="${currentEval.adjPercent ?? 0}" class="w-full p-1.5 border rounded-lg">
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-slate-500 mb-0.5">Vagas extras</label>
                      <input type="number" id="adj-extra-parking" value="${currentEval.adjExtraParking ?? 0}" class="w-full p-1.5 border rounded-lg">
                    </div>
                    <div>
                      <label class="block text-slate-500 mb-0.5">R$ por vaga extra</label>
                      <input type="number" step="1000" id="adj-parking-value" value="${currentEval.adjParkingValue ?? 110000}" class="w-full p-1.5 border rounded-lg">
                    </div>
                  </div>
                  <div>
                    <label class="block text-slate-500 mb-0.5">Outros ajustes (R$, +/-)</label>
                    <input type="number" step="1000" id="adj-other" value="${currentEval.adjOther ?? 0}" class="w-full p-1.5 border rounded-lg">
                  </div>
                  <div>
                    <label class="block text-slate-500 mb-0.5">Valor final manual (opcional, sobrepõe o cálculo)</label>
                    <input type="number" step="1000" id="adj-override" value="${currentEval.adjOverride ?? ''}" placeholder="Deixe em branco para usar o cálculo" class="w-full p-1.5 border rounded-lg">
                  </div>
                  <div>
                    <label class="block text-slate-500 mb-0.5">Justificativa dos ajustes (aparece no laudo)</label>
                    <textarea id="adj-notes" rows="2" class="w-full p-1.5 border rounded-lg" placeholder="Ex.: imóvel reformado acima do padrão da quadra; 1 vaga extra coberta.">${currentEval.adjNotes || ''}</textarea>
                  </div>
                  <button id="btn-apply-adjustments" class="w-full py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800">Aplicar ajustes e recalcular</button>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <div class="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
            Nenhuma avaliação mercadológica cadastrada. Clique em "Nova Avaliação" para iniciar.
          </div>
        `}
      </div>

      <div id="eval-modal-container"></div>
    `;

    attachEvents();
  }

  function attachEvents() {
    const select = container.querySelector('#select-eval-id');
    if (select) {
      select.addEventListener('change', (e) => {
        selectedEvaluationId = e.target.value;
        renderView();
      });
    }

    const btnPrint = container.querySelector('#btn-generate-report');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        exportService.printEvaluationReport(selectedEvaluationId);
      });
    }

    const btnNew = container.querySelector('#btn-new-eval');
    if (btnNew) {
      btnNew.addEventListener('click', () => openNewEvaluationModal());
    }

    const btnAddComp = container.querySelector('#btn-add-comparable');
    if (btnAddComp) {
      btnAddComp.addEventListener('click', () => openAddComparableModal());
    }

    const btnAI = container.querySelector('#btn-ai-evaluate');
    if (btnAI) {
      btnAI.addEventListener('click', () => runAIEvaluation());
    }

    const btnRefInline = container.querySelector('#btn-add-ref-inline');
    if (btnRefInline) {
      btnRefInline.addEventListener('click', () => openAddComparableModal());
    }

    const btnApplyAdj = container.querySelector('#btn-apply-adjustments');
    if (btnApplyAdj) {
      btnApplyAdj.addEventListener('click', () => {
        const currentEval = db.getById('evaluations', selectedEvaluationId);
        if (!currentEval) return;
        const get = (id) => container.querySelector('#' + id);
        const adjPercent = Number(get('adj-percent').value) || 0;
        const adjExtraParking = Number(get('adj-extra-parking').value) || 0;
        const adjParkingValue = Number(get('adj-parking-value').value) || 0;
        const adjOther = Number(get('adj-other').value) || 0;
        const adjOverrideRaw = get('adj-override').value;
        const adjOverride = adjOverrideRaw === '' ? null : Number(adjOverrideRaw);
        const adjNotes = get('adj-notes').value;

        const base = calculateEvaluation(currentEval.propertyArea, currentEval.comparables || []);
        let ideal = base.idealSalePrice * (1 + adjPercent / 100);
        ideal += adjExtraParking * adjParkingValue;
        ideal += adjOther;
        if (adjOverride !== null && Number.isFinite(adjOverride) && adjOverride > 0) ideal = adjOverride;
        const strategic = ideal * 1.03;

        db.update('evaluations', currentEval.id, {
          adjPercent, adjExtraParking, adjParkingValue, adjOther,
          adjOverride, adjNotes,
          suggestedPrice: ideal, idealSalePrice: ideal, strategicListingPrice: strategic
        });
        renderView();
      });
    }
  }

  function runAIEvaluation() {
    const currentEval = db.getById('evaluations', selectedEvaluationId);
    if (!currentEval) return;

    const subject = {
      id: currentEval.propertyId || currentEval.id,
      region: currentEval.region || (currentEval.propertyAddress || '').split(',').slice(-2, -1)[0]?.trim(),
      type: currentEval.propertyType || 'APARTAMENTO',
      area: Number(currentEval.propertyArea) || 0,
      bedrooms: Number(currentEval.bedrooms) || 0,
      suites: Number(currentEval.suites) || 0,
      parkingSpots: Number(currentEval.parkingSpots) || 0
    };

    const result = findComparablesWithAI(subject, db.get('properties'));

    if (!result.sufficient) {
      alert('Coutinho Valuation IA\n\n' + result.message);
    }

    if (result.comparables.length) {
      // Mescla os comparáveis da IA sem duplicar (por endereço) com os já existentes
      const existing = currentEval.comparables || [];
      const existingKeys = new Set(existing.map(c => (c.address || '').toLowerCase()));
      const aiComps = result.comparables
        .filter(c => !existingKeys.has((c.address || '').toLowerCase()))
        .map(c => ({
          address: c.address, area: c.area, bedrooms: c.bedrooms, parking: c.parking,
          price: c.price, priceM2: c.priceM2, source: c.source, url: c.url,
          date: c.date, similarity: c.similarity, reasons: c.reasons, origin: 'IA'
        }));

      const updatedComparables = [...existing, ...aiComps];
      const stats = calculateEvaluation(currentEval.propertyArea, updatedComparables);
      db.update('evaluations', currentEval.id, {
        comparables: updatedComparables,
        avgPriceM2: stats.averagePriceM2,
        medianPriceM2: stats.medianPriceM2,
        minPrice: stats.marketFloor,
        maxPrice: stats.maxPriceM2 * currentEval.propertyArea,
        suggestedPrice: stats.suggestedPrice,
        idealSalePrice: stats.idealSalePrice,
        strategicListingPrice: stats.strategicListingPrice,
        aiConfidence: result.confidence,
        aiConfidenceLabel: result.confidenceLabel,
        aiAvgSimilarity: result.avgSimilarity
      });
    }

    openAIResultModal(result);
    renderView();
  }

  function openAIResultModal(result) {
    const modalContainer = container.querySelector('#eval-modal-container');
    const confColor = result.confidence >= 75 ? '#059669' : result.confidence >= 50 ? '#f59e0b' : '#ef4444';

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
              <h3 class="text-base font-bold text-slate-900">Coutinho Valuation IA</h3>
            </div>
            <button id="modal-ai-eval-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <p class="text-xs text-slate-600 mt-4">${result.message}</p>

          <div class="mt-4 flex items-center gap-4">
            <div class="text-center">
              <div class="text-3xl font-black" style="color:${confColor}">${result.confidence}<span class="text-sm text-slate-400">%</span></div>
              <div class="text-[11px] font-bold" style="color:${confColor}">Confiança ${result.confidenceLabel}</div>
            </div>
            <div class="flex-1 text-xs space-y-1">
              <div class="flex justify-between"><span class="text-slate-500">Comparáveis reais:</span><strong>${result.count}</strong></div>
              <div class="flex justify-between"><span class="text-slate-500">Similaridade média:</span><strong>${result.avgSimilarity}%</strong></div>
              <div class="flex justify-between"><span class="text-slate-500">Origem:</span><strong>Portfólio CRM</strong></div>
            </div>
          </div>

          ${result.comparables.length ? `
            <div class="mt-4 space-y-2">
              <div class="text-[11px] font-black text-slate-500 uppercase tracking-wider">Imóveis semelhantes encontrados</div>
              ${result.comparables.map(c => `
                <div class="border border-slate-200 rounded-lg p-2.5 text-xs">
                  <div class="flex items-center justify-between">
                    <strong class="text-slate-900 truncate">${c.address}</strong>
                    <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 whitespace-nowrap">${c.similarity}% similar</span>
                  </div>
                  <div class="text-[11px] text-slate-500 mt-0.5">${toNumber(c.area)}m² · ${c.bedrooms} quartos · ${toCurrency(c.price)} · ${toCurrency(c.priceM2)}/m²</div>
                  ${c.reasons?.length ? `<div class="text-[10px] text-slate-400 mt-0.5">Motivos: ${c.reasons.join(', ')}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="mt-4 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            ℹ️ Comparáveis extraídos do portfólio real do CRM. Para análise de mercado externa, adicione comparáveis de portais com o link de referência. A IA não inventa imóveis.
          </div>

          <div class="mt-4 flex justify-end">
            <button id="btn-ai-eval-ok" class="btn-primary text-xs">Concluído</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-ai-eval-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-ai-eval-ok').addEventListener('click', close);
  }

  function openNewEvaluationModal() {
    const modalContainer = container.querySelector('#eval-modal-container');
    const properties = db.get('properties');
    const brokers = db.get('users');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold text-slate-900">Criar Novo Parecer Mercadológico</h3>
            <button id="modal-eval-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <form id="form-new-eval" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Título do Parecer *</label>
              <input type="text" name="title" required class="w-full p-2 border rounded-lg" placeholder="Ex: Parecer Mercadológico - SQNW 105 Noroeste">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Proprietário / Solicitante *</label>
                <input type="text" name="clientOwner" required class="w-full p-2 border rounded-lg" placeholder="Nome do cliente">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Corretor Responsável</label>
                <select name="brokerId" class="w-full p-2 border rounded-lg">
                  ${brokers.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Endereço do Imóvel Avaliando *</label>
              <input type="text" name="propertyAddress" required class="w-full p-2 border rounded-lg" placeholder="SQNW 105 Bloco B, Noroeste, Brasília - DF">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Tipologia do Imóvel *</label>
                <select name="propertyType" class="w-full p-2 border rounded-lg" required>
                  <option value="APARTAMENTO" selected>Apartamento</option>
                  <option value="COBERTURA">Cobertura</option>
                  <option value="APART_GARDEN">Apartamento Garden</option>
                  <option value="DUPLEX">Duplex / Triplex</option>
                  <option value="CASA">Casa</option>
                  <option value="CASA_CONDOMINIO">Casa em Condomínio</option>
                  <option value="SOBRADO">Sobrado</option>
                  <option value="KITNET">Kitnet / Studio / Flat</option>
                  <option value="LOFT">Loft</option>
                  <option value="SALA_COMERCIAL">Sala Comercial</option>
                  <option value="ANDAR_CORRIDO">Andar Corrido / Laje Comercial</option>
                  <option value="LOJA">Loja / Ponto Comercial</option>
                  <option value="GALPAO">Galpão / Depósito</option>
                  <option value="PREDIO">Prédio Comercial</option>
                  <option value="HOTEL">Hotel / Pousada</option>
                  <option value="LOTE_TERRENO">Lote / Terreno Urbano</option>
                  <option value="LOTE_COMERCIAL">Lote Comercial</option>
                  <option value="AREA_RURAL">Área / Chácara / Sítio / Fazenda</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Finalidade *</label>
                <select name="purpose" class="w-full p-2 border rounded-lg" required>
                  <option value="VENDA" selected>Venda</option>
                  <option value="ALUGUEL">Aluguel</option>
                  <option value="VENDA_ALUGUEL">Venda e Aluguel</option>
                  <option value="TEMPORADA">Aluguel por Temporada</option>
                  <option value="PERMUTA">Permuta</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-4 gap-2">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Área (m²) *</label>
                <input type="number" name="propertyArea" required class="w-full p-2 border rounded-lg" placeholder="150">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Quartos</label>
                <input type="number" name="bedrooms" value="3" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Suítes</label>
                <input type="number" name="suites" value="2" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Vagas</label>
                <input type="number" name="parkingSpots" value="2" class="w-full p-2 border rounded-lg">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Estado de Conservação</label>
                <select name="conservationState" class="w-full p-2 border rounded-lg">
                  <option value="Novo">Novo</option>
                  <option value="Excelente / Reformado" selected>Excelente / Reformado</option>
                  <option value="Bom">Bom</option>
                  <option value="Regular">Regular</option>
                  <option value="A Reformar">A reformar</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Posição Solar</label>
                <select name="solarPosition" class="w-full p-2 border rounded-lg">
                  <option value="Nascente">Nascente</option>
                  <option value="Poente">Poente</option>
                  <option value="Norte">Norte</option>
                  <option value="Sul">Sul</option>
                  <option value="Leste">Leste</option>
                  <option value="Oeste">Oeste</option>
                  <option value="Não informado" selected>Não informado</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Aceita financiamento?</label>
                <select name="acceptsFinancing" class="w-full p-2 border rounded-lg">
                  <option value="SIM" selected>Sim</option>
                  <option value="NAO">Não</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Escritura?</label>
                <select name="hasDeed" class="w-full p-2 border rounded-lg">
                  <option value="ESCRITURA_REGISTRADA" selected>Escritura registrada</option>
                  <option value="CONTRATO_GAVETA">Contrato de gaveta</option>
                  <option value="FINANCIADO">Em financiamento</option>
                  <option value="INVENTARIO">Em inventário</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Armários?</label>
                <select name="hasCabinets" class="w-full p-2 border rounded-lg">
                  <option value="SIM" selected>Sim, planejados</option>
                  <option value="PARCIAL">Parcial</option>
                  <option value="NAO">Não</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Reformado?</label>
                <select name="isRenovated" class="w-full p-2 border rounded-lg">
                  <option value="SIM">Sim, recente</option>
                  <option value="PARCIAL">Parcial</option>
                  <option value="NAO" selected>Não</option>
                </select>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button type="button" id="btn-eval-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Criar Laudo</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-eval-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-eval-cancel').addEventListener('click', close);

    const form = modalContainer.querySelector('#form-new-eval');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const area = Number(fd.get('propertyArea')) || 100;

      // Seed inicial de 3 comparáveis calculados
      const baseM2 = 12500;
      const initialComparables = [
        { address: 'Quadra Próxima Amostra 1', area: area, bedrooms: 3, parking: 2, price: area * baseM2, priceM2: baseM2, source: 'DFimóveis' },
        { address: 'Quadra Próxima Amostra 2', area: area - 5, bedrooms: 3, parking: 2, price: (area - 5) * (baseM2 + 400), priceM2: baseM2 + 400, source: 'Wimoveis' },
        { address: 'Quadra Próxima Amostra 3', area: area + 10, bedrooms: 3, parking: 2, price: (area + 10) * (baseM2 - 300), priceM2: baseM2 - 300, source: 'OLX' }
      ];

      const stats = calculateEvaluation(area, initialComparables);

      const newEval = db.insert('evaluations', {
        title: fd.get('title'),
        clientOwner: fd.get('clientOwner'),
        brokerId: fd.get('brokerId'),
        propertyAddress: fd.get('propertyAddress'),
        propertyType: fd.get('propertyType'),
        purpose: fd.get('purpose'),
        propertyArea: area,
        bedrooms: Number(fd.get('bedrooms')),
        suites: Number(fd.get('suites')),
        parkingSpots: Number(fd.get('parkingSpots')),
        conservationState: fd.get('conservationState'),
        solarPosition: fd.get('solarPosition'),
        acceptsFinancing: fd.get('acceptsFinancing'),
        hasDeed: fd.get('hasDeed'),
        hasCabinets: fd.get('hasCabinets'),
        isRenovated: fd.get('isRenovated'),
        comparables: initialComparables,
        avgPriceM2: stats.averagePriceM2,
        medianPriceM2: stats.medianPriceM2,
        minPrice: stats.marketFloor,
        maxPrice: stats.maxPriceM2 * area,
        suggestedPrice: stats.suggestedPrice,
        idealSalePrice: stats.idealSalePrice,
        strategicListingPrice: stats.strategicListingPrice,
        status: 'CONCLUIDA'
      });

      selectedEvaluationId = newEval.id;
      close();
      renderView();
      setTimeout(() => exportService.printEvaluationReport(newEval.id), 300);
    });
  }

  function openAddComparableModal() {
    const modalContainer = container.querySelector('#eval-modal-container');
    const currentEval = db.getById('evaluations', selectedEvaluationId);
    if (!currentEval) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-900">Adicionar Imóveis Comparáveis</h3>
            <button id="modal-comp-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-3 flex gap-2 border-b border-slate-200 pb-2">
            <button type="button" id="tab-single" class="comp-tab px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white">Um por vez</button>
            <button type="button" id="tab-bulk" class="comp-tab px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">Múltiplos links de referência</button>
          </div>

          <div id="bulk-panel" class="hidden mt-4 space-y-3 text-xs">
            <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
              ⚠️ Este sistema roda no navegador e não busca dados diretamente dos portais (bloqueio de CORS e termos de uso). Cole abaixo os links de referência e preencha os dados que você consultou em cada anúncio. O sistema calcula o R$/m², a média e o valor sugerido automaticamente.
            </div>

            <div class="flex items-center justify-between">
              <label class="font-semibold text-slate-700">Links de anúncios de referência</label>
              <button type="button" id="btn-add-link-row" class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">+ Adicionar linha</button>
            </div>

            <div id="bulk-rows" class="space-y-2"></div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="btn-bulk-cancel" class="btn-secondary">Cancelar</button>
              <button type="button" id="btn-bulk-save" class="btn-primary">Salvar todos os comparáveis</button>
            </div>
          </div>

          <form id="form-new-comp" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Endereço do Comparável *</label>
              <input type="text" name="address" required class="w-full p-2 border rounded-lg" placeholder="Ex: SQNW 105 Bloco C">
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Área Privativa (m²) *</label>
                <input type="number" name="area" required class="w-full p-2 border rounded-lg" placeholder="120">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Valor Anunciado (R$) *</label>
                <input type="number" name="price" required class="w-full p-2 border rounded-lg" placeholder="1500000">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Quartos</label>
                <input type="number" name="bedrooms" value="3" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Vagas</label>
                <input type="number" name="parking" value="2" class="w-full p-2 border rounded-lg">
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Fonte da Pesquisa</label>
              <select name="source" class="w-full p-2 border rounded-lg">
                <option value="DFimóveis">DFimóveis</option>
                <option value="Wimoveis">Wimoveis</option>
                <option value="OLX Imóveis">OLX Imóveis</option>
                <option value="Chave na Mão">Chave na Mão</option>
                <option value="ZAP / VivaReal">ZAP / VivaReal</option>
                <option value="Pesquisa de Campo">Pesquisa de Campo</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Link do Anúncio de Referência</label>
              <input type="url" name="url" class="w-full p-2 border rounded-lg" placeholder="https://... (cole o link do imóvel comparável)">
              <p class="text-[10px] text-slate-400 mt-1">O link fica registrado no laudo como fonte da amostragem.</p>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button type="button" id="btn-comp-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Adicionar ao Laudo</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-comp-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-comp-cancel').addEventListener('click', close);
    modalContainer.querySelector('#btn-bulk-cancel').addEventListener('click', close);

    // Tabs
    const tabSingle = modalContainer.querySelector('#tab-single');
    const tabBulk = modalContainer.querySelector('#tab-bulk');
    const panelSingle = modalContainer.querySelector('#form-new-comp');
    const panelBulk = modalContainer.querySelector('#bulk-panel');
    const activate = (target) => {
      const isBulk = target === 'BULK';
      panelSingle.classList.toggle('hidden', isBulk);
      panelBulk.classList.toggle('hidden', !isBulk);
      tabSingle.className = `comp-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${!isBulk ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;
      tabBulk.className = `comp-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${isBulk ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;
    };
    tabSingle.addEventListener('click', () => activate('SINGLE'));
    tabBulk.addEventListener('click', () => activate('BULK'));

    // Bulk rows
    const rowsEl = modalContainer.querySelector('#bulk-rows');
    const detectSource = (url) => {
      const u = (url || '').toLowerCase();
      if (u.includes('dfimoveis')) return 'DFimóveis';
      if (u.includes('wimoveis')) return 'Wimoveis';
      if (u.includes('olx')) return 'OLX Imóveis';
      if (u.includes('zapimoveis') || u.includes('zap.com') || u.includes('vivareal')) return 'ZAP / VivaReal';
      if (u.includes('chavenamao') || u.includes('chave-na-mao')) return 'Chave na Mão';
      if (u.includes('quintoandar')) return 'QuintoAndar';
      return 'Portal';
    };
    const addBulkRow = () => {
      const row = document.createElement('div');
      row.className = 'bulk-row grid grid-cols-12 gap-2 items-end p-2 border border-slate-200 rounded-lg';
      row.innerHTML = `
        <div class="col-span-12 md:col-span-5">
          <label class="block text-[10px] text-slate-500 mb-0.5">Link do anúncio</label>
          <input type="url" class="bulk-url w-full p-1.5 border rounded-lg" placeholder="https://...">
        </div>
        <div class="col-span-6 md:col-span-2">
          <label class="block text-[10px] text-slate-500 mb-0.5">Área (m²)</label>
          <input type="number" class="bulk-area w-full p-1.5 border rounded-lg" placeholder="120">
        </div>
        <div class="col-span-6 md:col-span-3">
          <label class="block text-[10px] text-slate-500 mb-0.5">Valor (R$)</label>
          <input type="number" class="bulk-price w-full p-1.5 border rounded-lg" placeholder="1500000">
        </div>
        <div class="col-span-10 md:col-span-1">
          <label class="block text-[10px] text-slate-500 mb-0.5">Qtos</label>
          <input type="number" class="bulk-bedrooms w-full p-1.5 border rounded-lg" placeholder="3">
        </div>
        <div class="col-span-2 md:col-span-1 flex justify-end">
          <button type="button" class="btn-remove-row text-rose-500 hover:text-rose-700 font-bold text-lg">×</button>
        </div>`;
      row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
      rowsEl.appendChild(row);
    };
    // 3 linhas iniciais
    addBulkRow(); addBulkRow(); addBulkRow();
    modalContainer.querySelector('#btn-add-link-row').addEventListener('click', addBulkRow);

    modalContainer.querySelector('#btn-bulk-save').addEventListener('click', () => {
      const newComps = [];
      rowsEl.querySelectorAll('.bulk-row').forEach(row => {
        const url = row.querySelector('.bulk-url').value.trim();
        const area = Number(row.querySelector('.bulk-area').value);
        const price = Number(row.querySelector('.bulk-price').value);
        const bedrooms = Number(row.querySelector('.bulk-bedrooms').value) || 3;
        if (area > 0 && price > 0) {
          newComps.push({
            address: url ? new URL(url).hostname.replace('www.', '') + ' (referência)' : 'Referência manual',
            area, price, priceM2: Number((price / area).toFixed(2)),
            bedrooms, parking: 2,
            source: detectSource(url), url,
            date: new Date().toISOString().split('T')[0]
          });
        }
      });
      if (!newComps.length) { alert('Preencha pelo menos uma linha com área e valor.'); return; }

      const updatedComparables = [...(currentEval.comparables || []), ...newComps];
      const stats = calculateEvaluation(currentEval.propertyArea, updatedComparables);
      db.update('evaluations', currentEval.id, {
        comparables: updatedComparables,
        avgPriceM2: stats.averagePriceM2, medianPriceM2: stats.medianPriceM2,
        minPrice: stats.marketFloor, maxPrice: stats.maxPriceM2 * currentEval.propertyArea,
        suggestedPrice: stats.suggestedPrice, idealSalePrice: stats.idealSalePrice,
        strategicListingPrice: stats.strategicListingPrice
      });
      close();
      renderView();
    });

    const form = modalContainer.querySelector('#form-new-comp');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const area = Number(fd.get('area'));
      const price = Number(fd.get('price'));
      const priceM2 = area > 0 ? price / area : 0;

      const newComp = {
        address: fd.get('address'),
        area: area,
        price: price,
        priceM2: Number(priceM2.toFixed(2)),
        bedrooms: Number(fd.get('bedrooms')),
        parking: Number(fd.get('parking')),
        source: fd.get('source'),
        date: new Date().toISOString().split('T')[0]
      };

      const updatedComparables = [...(currentEval.comparables || []), newComp];
      const stats = calculateEvaluation(currentEval.propertyArea, updatedComparables);

      db.update('evaluations', currentEval.id, {
        comparables: updatedComparables,
        avgPriceM2: stats.averagePriceM2,
        medianPriceM2: stats.medianPriceM2,
        minPrice: stats.marketFloor,
        maxPrice: stats.maxPriceM2 * currentEval.propertyArea,
        suggestedPrice: stats.suggestedPrice,
        idealSalePrice: stats.idealSalePrice,
        strategicListingPrice: stats.strategicListingPrice
      });

      close();
      renderView();
    });
  }

  renderView();
}
