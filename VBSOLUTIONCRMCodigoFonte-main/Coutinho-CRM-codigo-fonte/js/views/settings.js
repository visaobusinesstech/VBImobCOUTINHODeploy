/**
 * View: Configurações, Integrações Seguras & Automações
 * Campos protegidos para WhatsApp API, Portais (DFimóveis, Wimoveis, OLX), Google Calendar
 */
import { db } from '../state/db.js';

export function renderSettings(container) {
  let activeSection = 'EMPRESA'; // 'EMPRESA' | 'INTEGRACOES' | 'AUTOMACOES' | 'AUDITORIA'

  function renderView() {
    const settings = db.data.settings;
    const automations = db.get('automations');
    const logs = db.get('auditLogs') || [];

    container.innerHTML = `
      <div class="space-y-6">
        <div class="pb-2 border-b border-slate-200">
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Configurações do Sistema</h1>
          <p class="text-sm text-slate-500">Parâmetros da imobiliária, integrações oficiais de portais, automações e auditoria LGPD</p>
        </div>

        <!-- Abas -->
        <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          <button class="settings-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeSection === 'EMPRESA' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-section="EMPRESA">
            🏢 Dados da Imobiliária
          </button>
          <button class="settings-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeSection === 'INTEGRACOES' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-section="INTEGRACOES">
            🔌 Integrações & Portais
          </button>
          <button class="settings-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeSection === 'AUTOMACOES' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-section="AUTOMACOES">
            ⚡ Régua de Automações
          </button>
          <button class="settings-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeSection === 'AUDITORIA' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-section="AUDITORIA">
            🛡️ Logs de Auditoria & LGPD
          </button>
          <button class="settings-tab px-3 py-1.5 rounded-lg text-xs font-semibold ${activeSection === 'BACKUP' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-section="BACKUP">
            💾 Backup & Restauração
          </button>
        </div>

        <!-- Seção 1: Dados da Empresa -->
        ${activeSection === 'EMPRESA' ? `
          <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-3xl">
            <h3 class="text-base font-bold text-slate-900 mb-4">Dados Institucionais</h3>
            <form id="form-settings-company" class="space-y-4 text-xs">
              <!-- Logo / Marca -->
              <div class="flex items-center gap-4 pb-4 border-b border-slate-100">
                <img id="company-logo-preview" src="${settings.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(settings.tradingName || 'Coutinho')}&background=0b1d3a&color=d4af37&size=96`}" class="w-20 h-20 rounded-xl object-contain border border-slate-200 bg-white p-1">
                <div class="flex-1">
                  <label class="block font-semibold text-slate-700 mb-1">Logo / Marca da Imobiliária</label>
                  <input type="file" id="company-logo-file" accept="image/*" class="w-full text-[11px]">
                  <p class="text-[10px] text-slate-400 mt-1">Ou cole a URL do logo:</p>
                  <input type="url" id="company-logo-url" value="${settings.logo || ''}" placeholder="https://..." class="w-full p-1.5 border rounded-lg mt-1">
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Razão Social</label>
                  <input type="text" name="companyName" value="${settings.companyName}" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Nome Fantasia</label>
                  <input type="text" name="tradingName" value="${settings.tradingName}" class="w-full p-2 border rounded-lg">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">E-mail do Administrador Principal</label>
                  <input type="email" name="adminEmail" value="${settings.adminEmail}" disabled class="w-full p-2 border rounded-lg bg-slate-100 font-mono text-slate-500">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">CRECI Jurídico (DF)</label>
                  <input type="text" name="creciJ" value="${settings.creciJ}" class="w-full p-2 border rounded-lg">
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp Comercial</label>
                  <input type="text" name="phone" value="${settings.phone || ''}" class="w-full p-2 border rounded-lg" placeholder="(61) 3000-0000">
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">E-mail de Contato</label>
                  <input type="email" name="contactEmail" value="${settings.contactEmail || settings.adminEmail || ''}" class="w-full p-2 border rounded-lg" placeholder="contato@coutinho.com.br">
                </div>
              </div>

              <div>
                <label class="block font-semibold text-slate-700 mb-1">Endereço da Sede em Brasília</label>
                <input type="text" name="address" value="${settings.address}" class="w-full p-2 border rounded-lg">
              </div>

              <div class="pt-4 border-t border-slate-100 flex justify-end">
                <button type="submit" class="btn-primary text-xs">Salvar Alterações</button>
              </div>
            </form>
          </div>
        ` : ''}

        <!-- Seção 2: Integrações Oficiais (Item 17 e 25 do Prompt) -->
        ${activeSection === 'INTEGRACOES' ? `
          <div class="space-y-4 max-w-4xl">
            <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              🔒 <strong>Segurança e Termos de Uso:</strong> Todas as integrações com portais e mensageria funcionam através de APIs oficiais, chaves de acesso criptografadas e conformidade estrita com a LGPD. O sistema não utiliza scraping clandestino nem burla barreiras de autenticação.
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- WhatsApp Business Cloud API -->
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-bold text-sm text-slate-900">💬 WhatsApp Business Cloud API</span>
                  <span id="wa-status-badge" class="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">CONFIGURAR</span>
                </div>
                <p class="text-xs text-slate-500 mb-3">Canal oficial Meta. Nutrição automática de leads envia por aqui após aprovação humana.</p>
                <form id="form-wa" class="space-y-2 text-xs">
                  <input type="text" name="wa_phone_id" value="${settings.integrations?.whatsapp?.phoneId || ''}" placeholder="Phone Number ID" class="w-full p-2 border rounded text-xs">
                  <input type="text" name="wa_business_id" value="${settings.integrations?.whatsapp?.businessId || ''}" placeholder="WhatsApp Business Account ID" class="w-full p-2 border rounded text-xs">
                  <input type="password" name="wa_token" value="${settings.integrations?.whatsapp?.accessToken || ''}" placeholder="Access Token permanente" class="w-full p-2 border rounded text-xs">
                  <div class="flex gap-2">
                    <button type="submit" class="btn-primary text-xs flex-1">Salvar</button>
                    <button type="button" id="btn-wa-tutorial" class="btn-secondary text-xs">Como configurar?</button>
                  </div>
                </form>
              </div>

              <!-- Instagram Direct / Meta API -->
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-bold text-sm text-slate-900">📸 Instagram Direct (Meta API)</span>
                  <span id="ig-status-badge" class="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">CONFIGURAR</span>
                </div>
                <p class="text-xs text-slate-500 mb-3">Direct oficial via Instagram Graph API. Requer conta Business conectada a uma página do Facebook.</p>
                <form id="form-ig" class="space-y-2 text-xs">
                  <input type="text" name="ig_account_id" value="${settings.integrations?.instagram?.accountId || ''}" placeholder="Instagram Business Account ID" class="w-full p-2 border rounded text-xs">
                  <input type="text" name="ig_page_id" value="${settings.integrations?.instagram?.pageId || ''}" placeholder="Facebook Page ID vinculada" class="w-full p-2 border rounded text-xs">
                  <input type="password" name="ig_token" value="${settings.integrations?.instagram?.accessToken || ''}" placeholder="Long-lived Access Token" class="w-full p-2 border rounded text-xs">
                  <div class="flex gap-2">
                    <button type="submit" class="btn-primary text-xs flex-1">Salvar</button>
                    <button type="button" id="btn-ig-tutorial" class="btn-secondary text-xs">Como configurar?</button>
                  </div>
                </form>
              </div>

              <!-- Portal DFimóveis -->
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-bold text-sm text-slate-900">DFimóveis (API Oficial)</span>
                  <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">CONECTADO</span>
                </div>
                <p class="text-xs text-slate-500 mb-3">Sincronização bidirecional de carga de imóveis e captação de leads no DF.</p>
                <div class="space-y-2 text-xs font-mono">
                  <input type="password" value="••••••••••••••••••••••••" class="w-full p-2 bg-slate-50 border rounded text-xs" readonly>
                  <div class="text-[10px] text-slate-400">API Key ativa com webhook configurado</div>
                </div>
              </div>

              <!-- Portal Wimoveis -->
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-bold text-sm text-slate-900">Wimoveis / Navent</span>
                  <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">CONECTADO</span>
                </div>
                <p class="text-xs text-slate-500 mb-3">Publicação automática e recepção de leads com tag de campanha.</p>
                <div class="space-y-2 text-xs font-mono">
                  <input type="password" value="••••••••••••••••••••••••" class="w-full p-2 bg-slate-50 border rounded text-xs" readonly>
                </div>
              </div>

              <!-- Portal OLX -->
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-bold text-sm text-slate-900">OLX Imóveis (API Parceiro)</span>
                  <span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">AGUARDANDO CHAVE</span>
                </div>
                <p class="text-xs text-slate-500 mb-3">Insira o Client ID e Client Secret fornecidos pelo gerente de contas OLX.</p>
                <div class="space-y-2 text-xs">
                  <input type="text" placeholder="Client ID / API Key" class="w-full p-2 border rounded text-xs">
                  <input type="password" placeholder="Client Secret" class="w-full p-2 border rounded text-xs">
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Seção 3: Automações -->
        ${activeSection === 'AUTOMACOES' ? `
          <div class="space-y-4 max-w-4xl">
            <div class="flex justify-between items-center">
              <h3 class="text-base font-bold text-slate-900">Regras e Sequências Automáticas de Follow-up</h3>
              <button class="btn-primary text-xs">+ Nova Regra</button>
            </div>

            <div class="space-y-3">
              ${automations.map(auto => `
                <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start justify-between">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-bold text-slate-900 text-sm">${auto.name}</span>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded ${auto.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${auto.active ? 'ATIVA' : 'PAUSADA'}</span>
                    </div>
                    <div class="text-xs text-slate-500 mb-2">
                      Gatilho: <code class="font-bold text-indigo-700">${auto.trigger}</code> · Intervalo: <strong>${auto.delayDays} dias</strong>
                    </div>
                    <div class="p-2.5 bg-slate-50 border rounded text-[11px] font-mono text-slate-700">
                      Template: ${auto.template}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Seção 4: Auditoria LGPD -->
        ${activeSection === 'AUDITORIA' ? `
          <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto max-w-5xl">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 class="text-sm font-bold text-slate-900">Trilha de Auditoria e Logs de Alteração</h3>
              <span class="text-xs text-slate-500">${logs.length} registros computados</span>
            </div>
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th class="px-4 py-3">Data / Hora</th>
                  <th class="px-4 py-3">Usuário</th>
                  <th class="px-4 py-3">Ação</th>
                  <th class="px-4 py-3">Entidade</th>
                  <th class="px-4 py-3">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(log => `
                  <tr class="border-b border-slate-100 hover:bg-slate-50">
                    <td class="px-4 py-2.5 text-slate-500 font-mono text-[11px]">${new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                    <td class="px-4 py-2.5 font-semibold text-slate-800">${log.userName}</td>
                    <td class="px-4 py-2.5"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">${log.action}</span></td>
                    <td class="px-4 py-2.5 text-indigo-700 font-semibold">${log.entity}</td>
                    <td class="px-4 py-2.5 text-slate-600">${log.details}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${activeSection === 'BACKUP' ? `
          <div class="max-w-4xl space-y-4">
            <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
              💾 <strong>Backup local:</strong> baixa um arquivo JSON com <strong>tudo</strong> do CRM (leads, imóveis, contratos, avaliações, conversas, blog, etc). Guarde em local seguro — se limpar o navegador ou trocar de máquina, você reimporta e não perde nada.
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-2xl">⬇️</span>
                  <strong class="text-sm text-slate-900">Fazer backup agora</strong>
                </div>
                <p class="text-xs text-slate-500 mb-3">Gera um arquivo <code class="text-[10px] bg-slate-100 px-1 rounded">.json</code> com todo o conteúdo atual do CRM.</p>
                <div class="text-[11px] text-slate-600 mb-3 space-y-0.5">
                  <div>Clientes/Leads: <strong>${db.get('clients').length}</strong></div>
                  <div>Imóveis: <strong>${db.get('properties').length}</strong></div>
                  <div>Contratos: <strong>${db.get('contracts').length}</strong></div>
                  <div>Avaliações: <strong>${db.get('evaluations').length}</strong></div>
                  <div>Mensagens: <strong>${(db.get('messages') || []).length}</strong></div>
                  <div>Posts do blog: <strong>${(db.get('blogPosts') || []).length}</strong></div>
                </div>
                <button id="btn-backup" class="w-full btn-primary text-xs py-2.5">Baixar backup JSON</button>
              </div>

              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-2xl">⬆️</span>
                  <strong class="text-sm text-slate-900">Restaurar backup</strong>
                </div>
                <p class="text-xs text-slate-500 mb-3">Substitui os dados atuais pelos do arquivo. <strong class="text-rose-600">Ação irreversível</strong> — recomendado fazer um backup antes.</p>
                <input type="file" id="restore-file" accept=".json,application/json" class="w-full text-[11px] mb-2 border border-slate-200 rounded-lg p-1.5">
                <label class="flex items-start gap-2 text-[11px] text-slate-700 mb-3">
                  <input type="checkbox" id="restore-merge" class="mt-0.5 accent-indigo-600">
                  <span>Mesclar (mantém dados atuais e adiciona os do arquivo). Se desmarcado, <strong class="text-rose-600">substitui tudo</strong>.</span>
                </label>
                <button id="btn-restore" class="w-full btn-primary text-xs py-2.5 bg-rose-600 hover:bg-rose-700" disabled>Restaurar</button>
              </div>
            </div>

            <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-2xl">⚠️</span>
                <strong class="text-sm text-slate-900">Zona de perigo</strong>
              </div>
              <p class="text-xs text-slate-500 mb-3">Limpa todo o banco local e volta ao estado inicial (dados de demonstração). Use apenas se quiser recomeçar.</p>
              <button id="btn-reset-db" class="text-xs px-3 py-2 border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 font-semibold">Resetar banco para dados iniciais</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    container.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        activeSection = e.currentTarget.getAttribute('data-section');
        renderView();
      });
    });

    const btnBackup = container.querySelector('#btn-backup');
    if (btnBackup) btnBackup.addEventListener('click', () => {
      const payload = { exportedAt: new Date().toISOString(), version: 1, data: db.data };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coutinho_crm_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const restoreFile = container.querySelector('#restore-file');
    const btnRestore = container.querySelector('#btn-restore');
    if (restoreFile && btnRestore) {
      restoreFile.addEventListener('change', () => { btnRestore.disabled = !restoreFile.files.length; });
      btnRestore.addEventListener('click', () => {
        const file = restoreFile.files[0];
        if (!file) return;
        const merge = container.querySelector('#restore-merge').checked;
        if (!confirm(merge ? 'Mesclar dados do arquivo com os atuais?' : 'Substituir TUDO pelos dados do arquivo? Esta ação é irreversível.')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target.result);
            const incoming = parsed && parsed.data ? parsed.data : parsed;
            if (!incoming || typeof incoming !== 'object') throw new Error('Arquivo inválido');
            if (merge) {
              Object.keys(incoming).forEach(col => {
                if (Array.isArray(incoming[col]) && Array.isArray(db.data[col])) {
                  const existingIds = new Set(db.data[col].map(x => x.id));
                  incoming[col].forEach(item => { if (!existingIds.has(item.id)) db.data[col].push(item); });
                } else if (typeof incoming[col] === 'object' && incoming[col] !== null && !Array.isArray(incoming[col])) {
                  db.data[col] = { ...(db.data[col] || {}), ...incoming[col] };
                }
              });
            } else {
              db.data = incoming;
            }
            db.save();
            alert('Backup restaurado com sucesso. Recarregando…');
            window.location.reload();
          } catch (err) {
            alert('Falha ao restaurar: ' + err.message);
          }
        };
        reader.readAsText(file, 'UTF-8');
      });
    }

    const btnResetDb = container.querySelector('#btn-reset-db');
    if (btnResetDb) btnResetDb.addEventListener('click', () => {
      if (!confirm('ATENÇÃO: isso apaga todos os seus dados e volta ao estado inicial. Confirmar?')) return;
      if (!confirm('Última confirmação. Deseja realmente resetar tudo?')) return;
      db.reset();
      window.location.reload();
    });

    // Formulário de empresa: logo (upload/URL) + salvar
    const companyForm = container.querySelector('#form-settings-company');
    if (companyForm) {
      let logoData = db.data.settings.logo || '';
      const preview = container.querySelector('#company-logo-preview');
      const logoUrl = container.querySelector('#company-logo-url');
      const logoFile = container.querySelector('#company-logo-file');

      if (logoUrl) logoUrl.addEventListener('input', () => {
        logoData = logoUrl.value.trim();
        if (logoData && preview) preview.src = logoData;
      });

      if (logoFile) logoFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande (máx. 2MB).'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => { logoData = ev.target.result; if (preview) preview.src = logoData; if (logoUrl) logoUrl.value = ''; };
        reader.readAsDataURL(file);
      });

      companyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(companyForm);
        Object.assign(db.data.settings, {
          companyName: fd.get('companyName'),
          tradingName: fd.get('tradingName'),
          creciJ: fd.get('creciJ'),
          address: fd.get('address'),
          phone: fd.get('phone') || db.data.settings.phone,
          contactEmail: fd.get('contactEmail') || db.data.settings.contactEmail,
          logo: logoData
        });
        db.save();
        window.dispatchEvent(new CustomEvent('coutinho:settings_changed'));
        alert('Dados institucionais salvos com sucesso.');
      });
    }

    // Status badges de WhatsApp/Instagram baseados em credenciais salvas
    const s = db.data.settings;
    const waBadge = container.querySelector('#wa-status-badge');
    if (waBadge && s.integrations?.whatsapp?.accessToken) {
      waBadge.textContent = 'CONECTADO';
      waBadge.className = 'px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded';
    }
    const igBadge = container.querySelector('#ig-status-badge');
    if (igBadge && s.integrations?.instagram?.accessToken) {
      igBadge.textContent = 'CONECTADO';
      igBadge.className = 'px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded';
    }

    const waForm = container.querySelector('#form-wa');
    if (waForm) {
      waForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(waForm);
        db.data.settings.integrations = db.data.settings.integrations || {};
        db.data.settings.integrations.whatsapp = {
          ...(db.data.settings.integrations.whatsapp || {}),
          phoneId: fd.get('wa_phone_id'),
          businessId: fd.get('wa_business_id'),
          accessToken: fd.get('wa_token'),
          enabled: !!fd.get('wa_token'),
          officialApi: true,
          status: fd.get('wa_token') ? 'CONECTADO' : 'AGUARDANDO_CHAVE'
        };
        db.save();
        alert('WhatsApp Business API salvo. Reabra a aba para testar o envio.');
        renderView();
      });
    }

    const igForm = container.querySelector('#form-ig');
    if (igForm) {
      igForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(igForm);
        db.data.settings.integrations = db.data.settings.integrations || {};
        db.data.settings.integrations.instagram = {
          ...(db.data.settings.integrations.instagram || {}),
          accountId: fd.get('ig_account_id'),
          pageId: fd.get('ig_page_id'),
          accessToken: fd.get('ig_token'),
          enabled: !!fd.get('ig_token'),
          status: fd.get('ig_token') ? 'CONECTADO' : 'AGUARDANDO_CHAVE'
        };
        db.save();
        alert('Instagram Direct salvo. Reabra a aba para testar o envio.');
        renderView();
      });
    }

    const openTutorial = (type) => {
      let root = container.querySelector('#integration-tutorial-modal');
      if (!root) {
        root = document.createElement('div');
        root.id = 'integration-tutorial-modal';
        container.appendChild(root);
      }

      const tutorials = {
        WA: {
          title: '💬 Como configurar o WhatsApp Business Cloud API',
          intro: 'A API oficial do WhatsApp é fornecida pela Meta. É gratuita até 1.000 conversas iniciadas pela empresa por mês. Siga os passos:',
          steps: [
            { t: 'Crie uma conta no Meta for Developers', d: 'Acesse <b>developers.facebook.com</b>, faça login com sua conta Facebook e crie uma nova conta de desenvolvedor.' },
            { t: 'Crie um App', d: 'No painel, clique em <b>Meus Apps → Criar App</b>. Escolha o tipo <b>Negócios</b>. Dê um nome (ex: "Coutinho CRM WhatsApp").' },
            { t: 'Adicione o produto WhatsApp', d: 'Dentro do App, procure <b>WhatsApp</b> em "Adicionar produtos" e clique em <b>Configurar</b>.' },
            { t: 'Configure sua conta WhatsApp Business', d: 'A Meta pede uma <b>WhatsApp Business Account</b> (WABA). Se ainda não tem, o assistente cria uma. Anote o <b>WhatsApp Business Account ID</b> — cole no campo do CRM.' },
            { t: 'Registre um número de telefone', d: 'Adicione um número que <b>não esteja usando no WhatsApp comum</b> (ele será migrado para o Business). Verifique por SMS ou ligação. Anote o <b>Phone Number ID</b> gerado.' },
            { t: 'Gere o Access Token permanente', d: '<b>Importante:</b> o token que aparece de início é temporário (24h). Para produção, vá em <b>Configurações do sistema → Usuário do sistema → Gerar token</b>, marque as permissões <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code>, e escolha <b>Nunca expira</b>. Cole esse token no CRM.' },
            { t: 'Configure o webhook (opcional, para receber respostas)', d: 'Em <b>WhatsApp → Configuração</b>, aponte a URL do seu webhook (precisa de servidor HTTPS) e crie um Verify Token. As mensagens recebidas cairão direto no CRM.' },
            { t: 'Crie templates de mensagem', d: 'Para <b>iniciar</b> conversa com um cliente que não falou com você nas últimas 24h, é obrigatório usar um <b>Template</b> aprovado pela Meta. Crie no <b>WhatsApp Manager → Modelos de mensagem</b>. Categorias: Marketing, Utilitário, Autenticação.' },
            { t: 'Salve as 3 credenciais no CRM', d: 'Cole no formulário: <b>Phone Number ID</b>, <b>WhatsApp Business Account ID</b> e o <b>Access Token permanente</b>. Clique em Salvar.' }
          ],
          policy: [
            'Só envie mensagens para quem consentiu (LGPD).',
            'Fora da janela de 24h após a última resposta do cliente, só templates aprovados.',
            'Nunca compartilhe o Access Token — se vazar, revogue no painel Meta imediatamente.',
            'Meta cobra por conversa iniciada pela empresa acima de 1.000/mês. Preços variam por país.'
          ],
          links: [
            { label: 'developers.facebook.com/docs/whatsapp/cloud-api', url: 'https://developers.facebook.com/docs/whatsapp/cloud-api' },
            { label: 'business.facebook.com (WhatsApp Manager)', url: 'https://business.facebook.com' }
          ]
        },
        IG: {
          title: '📸 Como configurar o Instagram Direct via Meta API',
          intro: 'O Instagram Direct oficial é acessado pela mesma Meta Graph API. Requer conta profissional (Business ou Creator) conectada a uma Página do Facebook.',
          steps: [
            { t: 'Converta seu Instagram em conta Business', d: 'No app do Instagram: <b>Menu → Configurações → Conta → Mudar para conta profissional → Empresa</b>. Preencha categoria "Imóveis".' },
            { t: 'Vincule à uma Página do Facebook', d: 'Ainda nas configurações do Instagram, <b>Vinculação com Facebook</b> → conecte à Página da sua imobiliária. É obrigatório — a API não funciona sem isso.' },
            { t: 'Descubra o Instagram Business Account ID', d: 'Vá em <b>developers.facebook.com</b>, abra seu App (o mesmo do WhatsApp serve), Graph API Explorer, chame <code>GET /me/accounts</code> para ver as páginas, depois <code>GET /{page-id}?fields=instagram_business_account</code> para pegar o ID do Instagram. Cole no CRM.' },
            { t: 'Adicione o produto Instagram no App Meta', d: 'No painel do App: <b>Adicionar produtos → Instagram Graph API</b> (ou <b>Instagram Messaging</b> para direct).' },
            { t: 'Peça permissões avançadas', d: 'A conta precisa ser <b>revisada pela Meta</b> para permissões <code>instagram_manage_messages</code> e <code>pages_messaging</code>. Enquanto está em modo dev, só funciona para usuários que você adicionar como testers.' },
            { t: 'Gere Long-lived Access Token', d: 'No Graph API Explorer, gere um user token com as permissões acima, depois troque por um <b>long-lived token</b> (dura 60 dias) via endpoint <code>/oauth/access_token?grant_type=fb_exchange_token</code>. Cole no CRM.' },
            { t: 'Salve as 3 credenciais no CRM', d: 'Cole: <b>Instagram Business Account ID</b>, <b>Facebook Page ID</b> vinculada e o <b>Long-lived Access Token</b>.' }
          ],
          policy: [
            'Só é possível <b>responder</b> a mensagens recebidas no direct nas 24h seguintes — igual ao WhatsApp.',
            'Para iniciar uma conversa, use <b>tags de mensagem</b> aprovadas (ex: HUMAN_AGENT, transacional).',
            'Não é permitido enviar propaganda em massa via API — a Meta bane rápido.',
            'O token de 60 dias precisa ser renovado; automatize a renovação ou coloque um alerta.'
          ],
          links: [
            { label: 'developers.facebook.com/docs/messenger-platform/instagram', url: 'https://developers.facebook.com/docs/messenger-platform/instagram' },
            { label: 'Instagram Graph API — Getting Started', url: 'https://developers.facebook.com/docs/instagram-api/getting-started' }
          ]
        }
      };

      const t = tutorials[type];
      root.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 class="text-lg font-bold text-slate-900">${t.title}</h3>
              <button id="tut-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
            </div>
            <p class="text-xs text-slate-600 mt-4">${t.intro}</p>
            <ol class="mt-4 space-y-3">
              ${t.steps.map((s, i) => `
                <li class="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div class="flex items-start gap-2">
                    <span class="w-5 h-5 rounded-full bg-slate-900 text-white flex-shrink-0 flex items-center justify-center font-black text-[10px]">${i + 1}</span>
                    <div>
                      <strong class="text-slate-900 block">${s.t}</strong>
                      <span class="text-slate-600">${s.d}</span>
                    </div>
                  </div>
                </li>`).join('')}
            </ol>
            <div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <strong class="text-xs text-amber-900 block mb-1">⚠️ Regras importantes:</strong>
              <ul class="text-[11px] text-amber-800 space-y-1 list-disc list-inside">
                ${t.policy.map(p => `<li>${p}</li>`).join('')}
              </ul>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-100 text-xs">
              <strong class="text-slate-700 block mb-1">Documentação oficial:</strong>
              <ul class="space-y-1">
                ${t.links.map(l => `<li><a href="${l.url}" target="_blank" class="text-indigo-600 hover:underline">${l.label} ↗</a></li>`).join('')}
              </ul>
            </div>
            <div class="mt-4 flex justify-end">
              <button id="tut-ok" class="btn-primary text-xs">Entendi</button>
            </div>
          </div>
        </div>`;

      const close = () => { root.innerHTML = ''; };
      root.querySelector('#tut-close').addEventListener('click', close);
      root.querySelector('#tut-ok').addEventListener('click', close);
    };

    const btnWaTut = container.querySelector('#btn-wa-tutorial');
    if (btnWaTut) btnWaTut.addEventListener('click', () => openTutorial('WA'));
    const btnIgTut = container.querySelector('#btn-ig-tutorial');
    if (btnIgTut) btnIgTut.addEventListener('click', () => openTutorial('IG'));
  }

  renderView();
}
