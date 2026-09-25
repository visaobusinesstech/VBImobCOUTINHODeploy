/**
 * View: Imóveis, Captação & Proprietários
 * Cadastro completo, galeria de fotos, captação DF (DFimóveis, Wimoveis, OLX)
 */
import { db } from '../state/db.js';
import { toCurrency, toNumber } from '../services/evaluation.js';
import { aiService } from '../services/ai.js';

export function renderProperties(container) {
  let activeTab = 'IMOVEIS'; // 'IMOVEIS' | 'CAPTACAO'
  let filterRegion = 'TODAS';

  function renderView() {
    const properties = db.get('properties');
    const captures = db.get('captures');
    const users = db.get('users');
    const clients = db.get('clients');

    const regions = Array.from(new Set(properties.map(p => p.region).filter(Boolean)));

    const filteredProperties = properties.filter(p => {
      return filterRegion === 'TODAS' || p.region === filterRegion;
    });

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Topo da Gestão de Imóveis -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Imóveis & Captação</h1>
            <p class="text-sm text-slate-500">Portfólio ativo, proprietários e oportunidades de captação no DF</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-new-property" class="btn-primary flex items-center gap-2 text-xs">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Cadastrar Imóvel
            </button>
            <button id="btn-import-property" class="btn-secondary flex items-center gap-2 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              Cadastrar via Link
            </button>
            <button id="btn-import-ad" class="btn-secondary flex items-center gap-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              Captar Anúncio (Portal)
            </button>
            <button id="btn-new-capture" class="btn-secondary flex items-center gap-2 text-xs">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              Registrar Captação
            </button>
          </div>
        </div>

        <!-- Abas de Navegação -->
        <div class="flex items-center justify-between border-b border-slate-200">
          <div class="flex gap-4">
            <button class="tab-btn pb-3 text-sm font-bold border-b-2 ${activeTab === 'IMOVEIS' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}" data-tab="IMOVEIS">
              Imóveis no Portfólio (${properties.length})
            </button>
            <button class="tab-btn pb-3 text-sm font-bold border-b-2 ${activeTab === 'CAPTACAO' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}" data-tab="CAPTACAO">
              Captação de Proprietários (${captures.length})
            </button>
          </div>

          ${activeTab === 'IMOVEIS' ? `
            <div class="flex items-center gap-2 pb-2">
              <span class="text-xs text-slate-500 font-medium">Filtrar Região:</span>
              <select id="select-region-filter" class="text-xs p-1.5 border rounded-lg bg-white">
                <option value="TODAS">Todas as Regiões</option>
                ${regions.map(r => `<option value="${r}" ${r === filterRegion ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
            </div>
          ` : ''}
        </div>

        <!-- Conteúdo da Aba 1: Imóveis -->
        ${activeTab === 'IMOVEIS' ? `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${filteredProperties.map(prop => {
              const broker = users.find(u => u.id === prop.brokerId) || users[0];
              const owner = clients.find(c => c.id === prop.ownerId);
              const mainPhoto = prop.photos?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80';

              const statusBadge = {
                'DISPONIVEL': '<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold">Disponível</span>',
                'PROPOSTA': '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[11px] font-bold">Em Proposta</span>',
                'RESERVADO': '<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px] font-bold">Reservado</span>',
                'VENDIDO': '<span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[11px] font-bold">Vendido</span>'
              }[prop.status] || '<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">Ativo</span>';

              return `
                <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div class="relative h-48 bg-slate-100 overflow-hidden">
                      <img src="${mainPhoto}" alt="${prop.title}" class="w-full h-full object-cover">
                      <div class="absolute top-3 left-3 bg-slate-900/80 text-white text-[11px] font-black px-2 py-0.5 rounded backdrop-blur-sm">
                        ${prop.code}
                      </div>
                      <div class="absolute top-3 right-3">
                        ${statusBadge}
                      </div>
                      <div class="absolute bottom-3 left-3 bg-slate-900/90 text-amber-400 text-sm font-black px-2.5 py-1 rounded backdrop-blur-sm shadow">
                        ${toCurrency(prop.salePrice || prop.rentPrice)}
                      </div>
                    </div>

                    <div class="p-4">
                      <div class="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1">${prop.type} · ${prop.region}</div>
                      <h3 class="font-bold text-slate-900 text-sm leading-snug line-clamp-2 mb-2" title="${prop.title}">${prop.title}</h3>
                      <p class="text-xs text-slate-500 line-clamp-2 mb-3">${prop.description || prop.address}</p>

                      <div class="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center text-xs text-slate-600">
                        <div><strong class="text-slate-900 block">${toNumber(prop.area)}m²</strong>Área</div>
                        <div><strong class="text-slate-900 block">${prop.bedrooms} (${prop.suites} st)</strong>Quartos</div>
                        <div><strong class="text-slate-900 block">${prop.parkingSpots}</strong>Vagas</div>
                      </div>

                      <div class="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span>👤 Corretor: <strong>${broker.name.split(' ')[0]}</strong></span>
                        <span>Proprietário: <strong>${owner ? owner.name.split(' ')[0] : 'Direto'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div class="p-4 pt-0 border-t border-slate-100 bg-slate-50/50 flex gap-2 flex-wrap">
                    <a href="#/evaluation?property=${prop.id}" class="flex-1 btn-secondary text-center text-xs py-1.5">
                      Fazer Avaliação
                    </a>
                    <button class="btn-gen-ad flex-1 btn-primary text-center text-xs py-1.5 bg-indigo-600 hover:bg-indigo-700" data-id="${prop.id}">
                      Gerar Anúncio IA
                    </button>
                    <button class="btn-dup-prop text-xs py-1.5 px-2 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 font-semibold" data-id="${prop.id}" title="Duplicar imóvel">
                      Duplicar
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- Aba 2: Captação -->
          <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th class="px-4 py-3">Proprietário / Contato</th>
                  <th class="px-4 py-3">Região / Endereço</th>
                  <th class="px-4 py-3">Tipologia</th>
                  <th class="px-4 py-3">Valor Pretendido</th>
                  <th class="px-4 py-3">Origem / Anúncio</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${captures.map(cap => `
                  <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="px-4 py-3">
                      <div class="font-bold text-slate-900">${cap.ownerName}</div>
                      <div class="text-[11px] text-slate-500">${cap.phone} · ${cap.email || ''}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium text-slate-800">${cap.region}</div>
                      <div class="text-[11px] text-slate-500">${cap.address}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div>${cap.propertyType} (${toNumber(cap.area)} m²)</div>
                      <div class="text-[11px] text-slate-500">${cap.bedrooms} qtos · ${cap.parkingSpots} vagas</div>
                    </td>
                    <td class="px-4 py-3 font-bold text-slate-900">
                      ${toCurrency(cap.desiredValue)}
                    </td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-0.5 bg-slate-100 rounded font-semibold text-slate-700">${cap.portalSource}</span>
                      ${cap.adLink ? `<a href="${cap.adLink}" target="_blank" class="block text-[11px] text-indigo-600 hover:underline mt-0.5">Ver link</a>` : ''}
                    </td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">${cap.status}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <a href="#/evaluation?capture=${cap.id}" class="btn-primary text-xs py-1 px-2.5 inline-block">Criar Parecer</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <div id="property-modal-container"></div>
    `;

    attachEvents();
  }

  function attachEvents() {
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        activeTab = e.currentTarget.getAttribute('data-tab');
        renderView();
      });
    });

    const regionSelect = container.querySelector('#select-region-filter');
    if (regionSelect) {
      regionSelect.addEventListener('change', (e) => {
        filterRegion = e.target.value;
        renderView();
      });
    }

    const btnNewProp = container.querySelector('#btn-new-property');
    if (btnNewProp) {
      btnNewProp.addEventListener('click', () => openNewPropertyModal());
    }

    const btnNewCap = container.querySelector('#btn-new-capture');
    if (btnNewCap) {
      btnNewCap.addEventListener('click', () => openNewCaptureModal());
    }

    const btnImportAd = container.querySelector('#btn-import-ad');
    if (btnImportAd) {
      btnImportAd.addEventListener('click', () => openImportAdModal());
    }

    const btnImportProp = container.querySelector('#btn-import-property');
    if (btnImportProp) {
      btnImportProp.addEventListener('click', () => openImportPropertyModal());
    }

    container.querySelectorAll('.btn-gen-ad').forEach(btn => {
      btn.addEventListener('click', (e) => openGenerateAdModal(e.currentTarget.getAttribute('data-id')));
    });
  }

  function openImportPropertyModal() {
    const modalContainer = container.querySelector('#property-modal-container');
    const brokers = db.get('users');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-900">Cadastrar Imóvel via Link</h3>
              <p class="text-[11px] text-slate-500">Cole o link e/ou o texto do anúncio. A IA extrai os dados para o portfólio.</p>
            </div>
            <button id="modal-imp-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-4 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            ⚖️ Cadastre apenas imóveis que você tem autorização para anunciar. O navegador não acessa o link automaticamente por restrições dos portais (CORS/termos); cole o texto do anúncio para a extração.
          </div>

          <form id="form-imp-prop" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Link do anúncio</label>
              <input type="url" name="adLink" class="w-full p-2 border rounded-lg" placeholder="https://...">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Texto do anúncio (título, descrição, valor)</label>
              <textarea name="rawText" rows="5" class="w-full p-2 border rounded-lg font-mono text-[11px]" placeholder="Ex: Apartamento 3 quartos, 2 vagas, 85m² no Sudoeste. R$ 890.000. Andar alto, armários planejados..."></textarea>
            </div>
            <button type="button" id="btn-extract-prop" class="btn-secondary w-full text-xs flex items-center justify-center gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              Extrair Dados com IA
            </button>

            <div id="imp-preview" class="hidden pt-3 border-t border-slate-100 space-y-3">
              <div class="text-[11px] font-black text-indigo-700 uppercase tracking-wider">Revise antes de salvar</div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Título</label>
                <input type="text" name="title" class="w-full p-2 border rounded-lg">
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Tipo</label>
                  <select name="type" class="w-full p-2 border rounded-lg">
                    <option value="APARTAMENTO">Apartamento</option>
                    <option value="CASA">Casa</option>
                    <option value="COBERTURA">Cobertura</option>
                    <option value="SALA_COMERCIAL">Sala Comercial</option>
                    <option value="LOTE_TERRENO">Lote / Terreno</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Região</label>
                  <input type="text" name="region" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Área (m²)</label>
                  <input type="number" name="area" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Valor de Venda (R$)</label>
                  <input type="number" name="salePrice" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Quartos</label>
                  <input type="number" name="bedrooms" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Vagas</label>
                  <input type="number" name="parkingSpots" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Código</label>
                  <input type="text" name="code" class="w-full p-2 border rounded-lg" value="COU-${Math.floor(100 + Math.random() * 900)}">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Corretor</label>
                  <select name="brokerId" class="w-full p-2 border rounded-lg">
                    ${brokers.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea name="description" rows="3" class="w-full p-2 border rounded-lg"></textarea>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="btn-imp-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar no Portfólio</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-imp-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-imp-cancel').addEventListener('click', close);

    const form = modalContainer.querySelector('#form-imp-prop');
    const preview = modalContainer.querySelector('#imp-preview');

    modalContainer.querySelector('#btn-extract-prop').addEventListener('click', () => {
      const raw = (form.rawText.value || '') + ' ' + (form.adLink.value || '');
      if (!form.rawText.value.trim() && !form.adLink.value.trim()) { alert('Cole o texto ou o link do anúncio primeiro.'); return; }
      const data = extractAdData(raw);
      form.title.value = form.rawText.value.split('\n')[0].slice(0, 90) || `${(data.propertyType || 'Imóvel')} em ${data.region || 'Brasília'}`;
      form.type.value = data.propertyType || 'APARTAMENTO';
      form.region.value = data.region || '';
      form.area.value = data.area || '';
      form.salePrice.value = data.desiredValue || '';
      form.bedrooms.value = data.bedrooms || '';
      form.parkingSpots.value = data.parkingSpots || '';
      form.description.value = form.rawText.value.trim();
      preview.classList.remove('hidden');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (preview.classList.contains('hidden')) { alert('Extraia os dados com a IA antes de salvar.'); return; }
      db.insert('properties', {
        title: form.title.value || 'Imóvel importado',
        code: form.code.value,
        type: form.type.value,
        region: form.region.value,
        address: form.region.value,
        area: Number(form.area.value) || 0,
        bedrooms: Number(form.bedrooms.value) || 0,
        suites: 0,
        parkingSpots: Number(form.parkingSpots.value) || 0,
        salePrice: Number(form.salePrice.value) || 0,
        condoFee: 0,
        brokerId: form.brokerId.value,
        ownerId: null,
        description: form.description.value,
        adLink: form.adLink.value,
        source: 'IMPORTACAO_LINK',
        status: 'DISPONIVEL',
        photos: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80']
      });
      close();
      renderView();
    });
  }

  function openGenerateAdModal(propertyId) {
    const prop = db.getById('properties', propertyId);
    if (!prop) return;
    const modalContainer = container.querySelector('#property-modal-container');
    const ad = aiService.generateListingAd(prop);

    const block = (label, id, text, rows) => `
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="block font-semibold text-slate-700">${label}</label>
          <button type="button" class="btn-copy-ad text-[11px] font-bold text-indigo-600 hover:text-indigo-800" data-target="${id}">Copiar</button>
        </div>
        <textarea id="${id}" rows="${rows}" class="w-full p-2 border rounded-lg text-[11px] leading-relaxed">${text}</textarea>
      </div>`;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-900">Anúncio gerado por IA</h3>
              <p class="text-[11px] text-slate-500 truncate max-w-[420px]">${prop.title}</p>
            </div>
            <button id="modal-ad-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-4 space-y-4 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Opções de título (portais)</label>
              <div class="space-y-1.5">
                ${ad.titles.map((t, i) => `
                  <div class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span class="flex-1 text-slate-800">${t}</span>
                    <button type="button" class="btn-copy-title text-[11px] font-bold text-indigo-600 hover:text-indigo-800" data-t="${i}">Copiar</button>
                  </div>
                `).join('')}
              </div>
            </div>
            ${block('Descrição para portais (DFimóveis, ZAP, Viva Real)', 'ad-portal', ad.portalDescription, 8)}
            ${block('Legenda para Instagram / Facebook', 'ad-social', ad.socialCaption, 7)}
            ${block('Mensagem curta para WhatsApp', 'ad-whats', ad.whatsappText, 5)}
          </div>

          <div class="mt-4 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            ℹ️ Revise o texto antes de publicar. Valores e condições estão sujeitos a alteração; use fotos próprias ou licenciadas.
          </div>

          <div class="mt-4 flex justify-end gap-2">
            <button id="btn-save-desc" class="btn-secondary text-xs">Salvar como descrição do imóvel</button>
            <button id="modal-ad-ok" class="btn-primary text-xs">Concluído</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-ad-close').addEventListener('click', close);
    modalContainer.querySelector('#modal-ad-ok').addEventListener('click', close);

    modalContainer.querySelectorAll('.btn-copy-ad').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = modalContainer.querySelector('#' + e.currentTarget.getAttribute('data-target'));
        if (el) { navigator.clipboard.writeText(el.value); e.currentTarget.textContent = 'Copiado!'; setTimeout(() => { e.currentTarget.textContent = 'Copiar'; }, 1500); }
      });
    });
    modalContainer.querySelectorAll('.btn-copy-title').forEach(btn => {
      btn.addEventListener('click', (e) => {
        navigator.clipboard.writeText(ad.titles[Number(e.currentTarget.getAttribute('data-t'))]);
        e.currentTarget.textContent = 'Copiado!'; setTimeout(() => { e.currentTarget.textContent = 'Copiar'; }, 1500);
      });
    });

    modalContainer.querySelector('#btn-save-desc').addEventListener('click', () => {
      const desc = modalContainer.querySelector('#ad-portal').value;
      db.update('properties', propertyId, { description: desc });
      close();
      renderView();
    });
  }

  function detectPortal(text) {
    const t = text.toLowerCase();
    if (t.includes('olx')) return 'OLX';
    if (t.includes('dfimoveis') || t.includes('df imóveis') || t.includes('df imoveis')) return 'DFimóveis';
    if (t.includes('wimoveis') || t.includes('wimóveis')) return 'Wimoveis';
    if (t.includes('chavenamao') || t.includes('chave na mão')) return 'Chave na Mão';
    if (t.includes('facebook') || t.includes('marketplace') || t.includes('fb.com')) return 'Facebook Marketplace';
    if (t.includes('instagram')) return 'Instagram';
    if (t.includes('zap') || t.includes('vivareal')) return 'ZAP/VivaReal';
    return 'Portal Aberto';
  }

  function extractAdData(text) {
    const result = {};

    // Telefone / WhatsApp (formatos BR)
    const phoneMatch = text.match(/(?:\(?\d{2}\)?\s?)?9?\d{4}[-.\s]?\d{4}/);
    if (phoneMatch) result.phone = phoneMatch[0].trim();

    // Valor (R$)
    const priceMatch = text.match(/R\$\s?([\d.]+(?:,\d{2})?)/i);
    if (priceMatch) {
      const raw = priceMatch[1].replace(/\./g, '').replace(',', '.');
      result.desiredValue = Math.round(Number(raw)) || 0;
    }

    // Área (m²)
    const areaMatch = text.match(/(\d{2,4})\s?(?:m²|m2|metros)/i);
    if (areaMatch) result.area = Number(areaMatch[1]) || 0;

    // Quartos
    const bedMatch = text.match(/(\d)\s?(?:quartos?|qto?s?|dorm)/i);
    if (bedMatch) result.bedrooms = Number(bedMatch[1]) || 0;

    // Vagas
    const parkingMatch = text.match(/(\d)\s?(?:vagas?|garagem)/i);
    if (parkingMatch) result.parkingSpots = Number(parkingMatch[1]) || 0;

    // Região DF (lista comum)
    const regions = ['Noroeste', 'Sudoeste', 'Águas Claras', 'Aguas Claras', 'Taguatinga', 'Vicente Pires', 'Guará', 'Guara', 'Samambaia', 'Ceilândia', 'Ceilandia', 'Asa Norte', 'Asa Sul', 'Lago Norte', 'Lago Sul', 'Park Way', 'Jardim Botânico', 'Sobradinho', 'Gama', 'Planaltina', 'Recanto das Emas', 'Riacho Fundo', 'Cruzeiro'];
    const foundRegion = regions.find(r => text.toLowerCase().includes(r.toLowerCase()));
    if (foundRegion) result.region = foundRegion;

    // Tipo de imóvel
    const t = text.toLowerCase();
    if (t.includes('casa')) result.propertyType = 'CASA';
    else if (t.includes('cobertura')) result.propertyType = 'COBERTURA';
    else if (t.includes('lote') || t.includes('terreno')) result.propertyType = 'LOTE_TERRENO';
    else if (t.includes('apart') || t.includes('apto')) result.propertyType = 'APARTAMENTO';

    // Link
    const linkMatch = text.match(/https?:\/\/[^\s]+/i);
    if (linkMatch) result.adLink = linkMatch[0];

    // Nome do proprietário: linha com "proprietário", "dono", "falar com", "contato"
    const nameMatch = text.match(/(?:propriet[áa]rio|dono|falar com|contato|anunciante)[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú][a-zà-ú]+)?)/);
    if (nameMatch) result.ownerName = nameMatch[1].trim();

    return result;
  }

  function openImportAdModal() {
    const modalContainer = container.querySelector('#property-modal-container');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-900">Importar Anúncio de Portal Aberto</h3>
              <p class="text-[11px] text-slate-500">Cole o texto/link do anúncio do proprietário. A Coutinho IA extrai os dados automaticamente.</p>
            </div>
            <button id="modal-import-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-4 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            ⚖️ Uso conforme LGPD e termos dos portais: capte apenas anúncios públicos de proprietários que desejam contato. Não é permitido scraping automatizado que viole os termos das plataformas.
          </div>

          <form id="form-import-ad" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Texto do Anúncio / Link *</label>
              <textarea name="rawText" rows="6" required class="w-full p-2 border rounded-lg font-mono text-[11px]" placeholder="Ex: Apartamento 3 quartos, 2 vagas, 85m² no Sudoeste. R$ 720.000. Falar com Roberto (61) 98888-0000. https://olx.com.br/..."></textarea>
            </div>
            <button type="button" id="btn-extract-ad" class="btn-secondary w-full text-xs flex items-center justify-center gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
              Extrair Dados com IA
            </button>

            <div id="extract-preview" class="hidden pt-3 border-t border-slate-100 space-y-3">
              <div class="text-[11px] font-black text-indigo-700 uppercase tracking-wider">Dados Detectados (revise antes de salvar)</div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Proprietário</label>
                  <input type="text" name="ownerName" class="w-full p-2 border rounded-lg" placeholder="Nome (se detectado)">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">WhatsApp / Telefone</label>
                  <input type="text" name="phone" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Região</label>
                  <input type="text" name="region" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Tipo</label>
                  <input type="text" name="propertyType" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Área (m²)</label>
                  <input type="number" name="area" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Valor Pretendido (R$)</label>
                  <input type="number" name="desiredValue" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Portal</label>
                  <input type="text" name="portalSource" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Link</label>
                  <input type="url" name="adLink" class="w-full p-2 border rounded-lg">
                </div>
              </div>

              <div id="ai-outreach-box" class="p-3 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-lg">
                <div class="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Coutinho IA · Abordagem sugerida ao proprietário</div>
                <p id="ai-outreach-text" class="text-[11px] text-indigo-100 leading-relaxed"></p>
                <button type="button" id="btn-copy-outreach" class="mt-2 text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-1 rounded hover:bg-amber-300">Copiar Mensagem</button>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="btn-import-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar Captação</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-import-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-import-cancel').addEventListener('click', close);

    const form = modalContainer.querySelector('#form-import-ad');
    const preview = modalContainer.querySelector('#extract-preview');

    function refreshOutreach() {
      const outreach = aiService.suggestOwnerOutreach({
        ownerName: form.ownerName.value,
        propertyType: form.propertyType.value,
        region: form.region.value,
        portalSource: form.portalSource.value
      });
      modalContainer.querySelector('#ai-outreach-text').textContent = outreach;
    }

    modalContainer.querySelector('#btn-extract-ad').addEventListener('click', () => {
      const raw = form.rawText.value;
      if (!raw.trim()) { alert('Cole o texto ou link do anúncio primeiro.'); return; }
      const data = extractAdData(raw);
      form.ownerName.value = data.ownerName || '';
      form.phone.value = data.phone || '';
      form.region.value = data.region || '';
      form.propertyType.value = data.propertyType || 'APARTAMENTO';
      form.area.value = data.area || '';
      form.desiredValue.value = data.desiredValue || '';
      form.portalSource.value = detectPortal(raw);
      form.adLink.value = data.adLink || '';
      preview.classList.remove('hidden');
      refreshOutreach();
    });

    ['ownerName', 'propertyType', 'region', 'portalSource'].forEach(field => {
      form[field].addEventListener('input', refreshOutreach);
    });

    modalContainer.querySelector('#btn-copy-outreach').addEventListener('click', () => {
      navigator.clipboard.writeText(modalContainer.querySelector('#ai-outreach-text').textContent);
      const btn = modalContainer.querySelector('#btn-copy-outreach');
      btn.textContent = 'Copiado!';
      setTimeout(() => { btn.textContent = 'Copiar Mensagem'; }, 1500);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (preview.classList.contains('hidden')) { alert('Extraia os dados com a IA antes de salvar.'); return; }
      const capture = {
        ownerName: form.ownerName.value || 'Proprietário (a confirmar)',
        phone: form.phone.value,
        region: form.region.value,
        address: form.region.value,
        area: Number(form.area.value) || 0,
        desiredValue: Number(form.desiredValue.value) || 0,
        portalSource: form.portalSource.value,
        adLink: form.adLink.value,
        propertyType: form.propertyType.value || 'APARTAMENTO',
        bedrooms: 0,
        parkingSpots: 0,
        status: 'PENDENTE_CONTATO',
        outreachMessage: modalContainer.querySelector('#ai-outreach-text').textContent
      };
      db.insert('captures', capture);
      close();
      activeTab = 'CAPTACAO';
      renderView();
    });
  }

  function openNewPropertyModal() {
    const modalContainer = container.querySelector('#property-modal-container');
    const brokers = db.get('users');
    const owners = db.get('clients').filter(c => c.type === 'PROPRIETARIO');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold text-slate-900">Novo Imóvel para o Portfólio</h3>
            <button id="modal-prop-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <form id="form-create-prop" class="mt-4 space-y-4 text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Título do Anúncio *</label>
                <input type="text" name="title" required class="w-full p-2 border rounded-lg" placeholder="Ex: Apartamento 3 Quartos Noroeste">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Código do Imóvel *</label>
                <input type="text" name="code" required value="COU-${Math.floor(100 + Math.random() * 900)}" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Tipo de Imóvel</label>
                <select name="type" class="w-full p-2 border rounded-lg">
                  <option value="APARTAMENTO">Apartamento</option>
                  <option value="CASA">Casa em Condomínio</option>
                  <option value="COBERTURA">Cobertura</option>
                  <option value="SALA_COMERCIAL">Sala Comercial</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Região no DF *</label>
                <input type="text" name="region" required class="w-full p-2 border rounded-lg" placeholder="Ex: Noroeste, Águas Claras, Sudoeste">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Endereço Completo</label>
                <input type="text" name="address" required class="w-full p-2 border rounded-lg" placeholder="SQNW 104 Bloco G">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Área Privativa (m²) *</label>
                <input type="number" name="area" required class="w-full p-2 border rounded-lg" placeholder="120">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Quartos / Suítes</label>
                <div class="flex gap-2">
                  <input type="number" name="bedrooms" placeholder="Quartos" class="w-1/2 p-2 border rounded-lg" value="3">
                  <input type="number" name="suites" placeholder="Suítes" class="w-1/2 p-2 border rounded-lg" value="1">
                </div>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Vagas de Garagem</label>
                <input type="number" name="parkingSpots" class="w-full p-2 border rounded-lg" value="2">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Valor de Venda (R$)</label>
                <input type="number" name="salePrice" required class="w-full p-2 border rounded-lg" placeholder="950000">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Condomínio (R$)</label>
                <input type="number" name="condoFee" class="w-full p-2 border rounded-lg" placeholder="750">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Corretor Responsável</label>
                <select name="brokerId" class="w-full p-2 border rounded-lg">
                  ${brokers.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Proprietário</label>
                <select name="ownerId" class="w-full p-2 border rounded-lg">
                  ${owners.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Descrição Comercial</label>
              <textarea name="description" rows="3" class="w-full p-2 border rounded-lg" placeholder="Destaques de acabamento, posição solar, vista..."></textarea>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button type="button" id="btn-prop-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar Imóvel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-prop-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-prop-cancel').addEventListener('click', close);

    const form = modalContainer.querySelector('#form-create-prop');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      db.insert('properties', {
        title: fd.get('title'),
        code: fd.get('code'),
        type: fd.get('type'),
        region: fd.get('region'),
        address: fd.get('address'),
        area: Number(fd.get('area')),
        bedrooms: Number(fd.get('bedrooms')),
        suites: Number(fd.get('suites')),
        parkingSpots: Number(fd.get('parkingSpots')),
        salePrice: Number(fd.get('salePrice')),
        condoFee: Number(fd.get('condoFee')) || 0,
        brokerId: fd.get('brokerId'),
        ownerId: fd.get('ownerId'),
        description: fd.get('description'),
        status: 'DISPONIVEL',
        photos: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80']
      });
      close();
      renderView();
    });
  }

  function openNewCaptureModal() {
    const modalContainer = container.querySelector('#property-modal-container');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold text-slate-900">Registrar Captação de Proprietário</h3>
            <button id="modal-cap-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <form id="form-create-cap" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Nome do Proprietário *</label>
              <input type="text" name="ownerName" required class="w-full p-2 border rounded-lg" placeholder="Ex: Roberto Alencar">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">WhatsApp / Telefone *</label>
                <input type="text" name="phone" required class="w-full p-2 border rounded-lg" placeholder="(61) 98888-0000">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Região no DF *</label>
                <input type="text" name="region" required class="w-full p-2 border rounded-lg" placeholder="Águas Claras">
              </div>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Endereço do Imóvel</label>
              <input type="text" name="address" required class="w-full p-2 border rounded-lg" placeholder="Rua 25 Sul Lote 04">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Área (m²)</label>
                <input type="number" name="area" class="w-full p-2 border rounded-lg" placeholder="85">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Valor Pretendido (R$)</label>
                <input type="number" name="desiredValue" required class="w-full p-2 border rounded-lg" placeholder="720000">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Origem do Anúncio</label>
                <select name="portalSource" class="w-full p-2 border rounded-lg">
                  <option value="OLX">OLX</option>
                  <option value="DFimóveis">DFimóveis</option>
                  <option value="Wimoveis">Wimoveis</option>
                  <option value="Indicação">Indicação</option>
                  <option value="Placa">Placa no Local</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Link do Anúncio</label>
                <input type="url" name="adLink" class="w-full p-2 border rounded-lg" placeholder="https://...">
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button type="button" id="btn-cap-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Registrar Oportunidade</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-cap-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-cap-cancel').addEventListener('click', close);

    const form = modalContainer.querySelector('#form-create-cap');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      db.insert('captures', {
        ownerName: fd.get('ownerName'),
        phone: fd.get('phone'),
        region: fd.get('region'),
        address: fd.get('address'),
        area: Number(fd.get('area')) || 80,
        desiredValue: Number(fd.get('desiredValue')),
        portalSource: fd.get('portalSource'),
        adLink: fd.get('adLink'),
        propertyType: 'APARTAMENTO',
        bedrooms: 3,
        parkingSpots: 2,
        status: 'PENDENTE_AVALIACAO'
      });
      close();
      activeTab = 'CAPTACAO';
      renderView();
    });
  }

  renderView();
}
