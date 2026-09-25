/**
 * View: Conversas WhatsApp & Multi-Canais
 * Painel com todos os canais integrados (WhatsApp, DFimóveis, Wimoveis, OLX, Meta, E-mail)
 */
import { db } from '../state/db.js';
import { aiService } from '../services/ai.js';

export function renderChat(container) {
  let selectedChannelId = 'chn_whatsapp';
  let selectedClientId = db.get('clients')[0]?.id || null;

  function renderView() {
    const channels = db.get('chatChannels') || [];
    const clients = db.get('clients') || [];
    const messages = db.get('messages') || [];
    const properties = db.get('properties') || [];

    const activeChannel = channels.find(c => c.id === selectedChannelId) || channels[0];
    const activeClient = clients.find(c => c.id === selectedClientId) || clients[0];

    // Filtra mensagens do cliente selecionado
    const conversationMessages = messages.filter(m => m.clientId === activeClient?.id);

    // Lista de conversas ativas por cliente
    const clientConversations = clients.map(client => {
      const clientMsgs = messages.filter(m => m.clientId === client.id);
      const lastMsg = clientMsgs[clientMsgs.length - 1];
      return {
        client,
        lastMsg,
        count: clientMsgs.length
      };
    });

    container.innerHTML = `
      <div class="h-[calc(100vh-120px)] flex flex-col space-y-4">
        <!-- Topo da Central de Conversas -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 flex-shrink-0">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Central de Conversas WhatsApp & Multi-Canais</h1>
            </div>
            <p class="text-xs text-slate-500">Atendimento unificado com WhatsApp Business Cloud API, Instagram e portais integrados</p>
          </div>

          <!-- Seletor de Canais Oficiais + Configurar -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <button id="btn-config-channels" class="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 transition flex-shrink-0">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              Configurar
            </button>
            ${channels.map(chn => `
              <button class="btn-channel-select px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0 ${chn.id === selectedChannelId ? 'bg-slate-900 text-white shadow' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}" data-channel-id="${chn.id}">
                <span>${chn.icon}</span>
                <span>${chn.name}</span>
                ${chn.unread ? `<span class="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">${chn.unread}</span>` : ''}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Layout 3 Colunas: Lista de Contatos | Chat Ativo | Card do Lead & Coutinho IA -->
        <div class="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          <!-- Coluna 1: Lista de Conversas (4 colunas) -->
          <div class="md:col-span-4 border-r border-slate-200 flex flex-col h-full bg-slate-50/50">
            <div class="p-3 border-b border-slate-200 bg-white">
              <div class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Contatos & Leads (${clients.length})</div>
              <input type="text" id="chat-search" placeholder="Buscar conversa..." class="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white">
            </div>

            <div class="flex-1 overflow-y-auto divide-y divide-slate-100" id="contacts-list">
              ${clientConversations.map(({ client, lastMsg, count }) => {
                const isSelected = client.id === selectedClientId;
                return `
                  <div class="contact-item p-3 cursor-pointer transition ${isSelected ? 'bg-indigo-50/80 border-l-4 border-l-indigo-600' : 'hover:bg-slate-100/70 bg-white'}" data-client-id="${client.id}">
                    <div class="flex justify-between items-start mb-1">
                      <strong class="text-xs text-slate-900 truncate max-w-[150px]">${client.name}</strong>
                      <span class="text-[10px] text-slate-400 font-medium">
                        ${lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Recente'}
                      </span>
                    </div>

                    <div class="text-[11px] text-slate-600 truncate mb-1.5">
                      ${lastMsg ? (lastMsg.sender === 'BROKER' ? 'Você: ' : '') + lastMsg.content : 'Iniciar primeiro contato'}
                    </div>

                    <div class="flex items-center justify-between">
                      <span class="text-[10px] font-bold px-1.5 py-0.2 rounded ${client.temperature === 'MUITO_QUENTE' ? 'bg-rose-100 text-rose-800' : client.temperature === 'QUENTE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
                        ${client.temperature === 'MUITO_QUENTE' ? '🔥 Quente' : client.temperature}
                      </span>
                      <span class="text-[10px] text-slate-400 font-mono">${client.interestRegion || 'DF'}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Coluna 2: Janela de Chat Ativa (5 colunas) -->
          <div class="md:col-span-5 flex flex-col h-full bg-slate-100/40">
            <!-- Header do Chat -->
            <div class="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs">
                  ${activeClient?.name ? activeClient.name.charAt(0) : 'C'}
                </div>
                <div>
                  <div class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <span>${activeClient?.name}</span>
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <div class="text-[10px] text-slate-500 flex items-center gap-1">
                    <span>Canal: <strong>${activeChannel.name}</strong></span>
                    <span>· WhatsApp: ${activeClient?.phone}</span>
                  </div>
                </div>
              </div>

              <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                API OFICIAL ATIVA
              </span>
            </div>

            <!-- Área de Mensagens -->
            <div class="flex-1 p-4 overflow-y-auto space-y-3" id="messages-container">
              ${conversationMessages.length ? conversationMessages.map(msg => {
                const isMe = msg.sender === 'BROKER';
                return `
                  <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${isMe ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}">
                      <div class="text-[10px] font-semibold mb-0.5 ${isMe ? 'text-amber-300' : 'text-indigo-600'}">
                        ${msg.senderName}
                      </div>
                      <div class="leading-relaxed whitespace-pre-wrap">${msg.content}</div>
                      <div class="text-[9px] mt-1 text-right ${isMe ? 'text-slate-400' : 'text-slate-400'}">
                        ${new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${msg.status || 'Enviado'}
                      </div>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center p-6">
                  <div class="text-2xl mb-2">💬</div>
                  <p>Nenhuma mensagem trocada ainda com <strong>${activeClient?.name}</strong> neste canal.</p>
                  <p class="text-[11px] mt-1">Utilize o campo abaixo ou a Coutinho IA para iniciar o atendimento.</p>
                </div>
              `}
            </div>

            <!-- Input de Envio de Mensagem -->
            <form id="form-send-message" class="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input type="text" id="input-message-text" placeholder="Digite uma mensagem para enviar via ${activeChannel.name}..." required class="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500">
              <button type="submit" class="btn-primary text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 flex-shrink-0">
                <span>Enviar</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
              </button>
            </form>
          </div>

          <!-- Coluna 3: Ficha Rápida do Lead & Sugestões da Coutinho IA (3 colunas) -->
          <div class="md:col-span-3 border-l border-slate-200 flex flex-col h-full bg-slate-50/70 p-4 overflow-y-auto space-y-4 text-xs">
            <!-- Card Perfil Lead -->
            <div class="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perfil no CRM</div>
              <div class="font-bold text-slate-900 text-sm">${activeClient?.name}</div>
              <div class="text-[11px] text-slate-600">
                Tipo: <strong class="text-slate-800">${activeClient?.type}</strong>
              </div>
              <div class="text-[11px] text-slate-600">
                Região: <strong class="text-slate-800">${activeClient?.interestRegion}</strong>
              </div>
              <div class="text-[11px] text-slate-600">
                Faixa: <strong class="text-slate-800">até R$ ${activeClient?.priceRangeMax?.toLocaleString('pt-BR')}</strong>
              </div>
            </div>

            <!-- Sugestão Inteligente Coutinho IA -->
            <div class="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-3.5 shadow-sm space-y-2">
              <div class="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                <span>⚡ Coutinho IA · Sugestão Rápida</span>
              </div>
              <div class="text-[11px] text-indigo-100 leading-relaxed font-mono bg-white/10 p-2.5 rounded-lg border border-white/10" id="ai-chat-quick-suggestion">
                ${activeClient ? aiService.suggestFollowUp(activeClient) : 'Selecione um cliente para gerar sugestão.'}
              </div>
              <button id="btn-insert-ai-text" class="w-full py-1.5 bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] hover:bg-amber-300 transition">
                Inserir no Chat
              </button>
            </div>

            <!-- Ações Rápidas no CRM -->
            <div class="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ações Comerciais</div>
              <a href="#/funnel" class="block w-full text-center py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold text-[11px]">
                Mover no Funil
              </a>
              <a href="#/evaluation" class="block w-full text-center py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold text-[11px]">
                Criar Avaliação
              </a>
              <a href="#/contracts" class="block w-full text-center py-1.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold text-[11px]">
                Gerar Contrato
              </a>
            </div>
          </div>

        </div>
      </div>

      <div id="chat-config-modal"></div>
    `;

    attachEvents();
  }

  function openConfigModal() {
    const modalRoot = container.querySelector('#chat-config-modal');
    const channels = db.get('chatChannels') || [];

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-900">Configurar Canais de Atendimento</h3>
              <p class="text-[11px] text-slate-500">WhatsApp Business Cloud API, Instagram Direct, e-mail e portais</p>
            </div>
            <button id="cfg-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-4 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            🔒 As credenciais ficam salvas apenas neste dispositivo. Em produção, use variáveis de ambiente e armazenamento seguro no servidor. Nenhuma mensagem é enviada sem uma API oficial autorizada.
          </div>

          <form id="cfg-form" class="mt-4 space-y-4 text-xs">
            ${channels.map(chn => `
              <div class="border border-slate-200 rounded-xl p-4" data-cfg-channel="${chn.id}">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2 font-bold text-slate-900">
                    <span>${chn.icon}</span><span>${chn.name}</span>
                  </div>
                  <label class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <input type="checkbox" name="enabled_${chn.id}" ${chn.status === 'CONECTADO' ? 'checked' : ''}>
                    Ativo
                  </label>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block font-semibold text-slate-600 mb-1">Identificador / Número / @usuário</label>
                    <input type="text" name="handle_${chn.id}" value="${chn.phone || ''}" class="w-full p-2 border rounded-lg" placeholder="${chn.type === 'INSTAGRAM' ? '@sua_conta' : chn.type === 'WHATSAPP' ? '(61) 90000-0000' : 'ID / e-mail'}">
                  </div>
                  <div>
                    <label class="block font-semibold text-slate-600 mb-1">API Key / Token</label>
                    <input type="password" name="token_${chn.id}" value="${chn.apiToken || ''}" class="w-full p-2 border rounded-lg" placeholder="Cole a chave oficial">
                  </div>
                  ${chn.type === 'WHATSAPP' || chn.type === 'INSTAGRAM' ? `
                    <div>
                      <label class="block font-semibold text-slate-600 mb-1">Phone/Business ID</label>
                      <input type="text" name="bizid_${chn.id}" value="${chn.businessId || ''}" class="w-full p-2 border rounded-lg" placeholder="ID da conta Meta">
                    </div>
                    <div>
                      <label class="block font-semibold text-slate-600 mb-1">Webhook URL</label>
                      <input type="url" name="webhook_${chn.id}" value="${chn.webhook || ''}" class="w-full p-2 border rounded-lg" placeholder="https://...">
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="cfg-cancel" class="btn-secondary">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar Configurações</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#cfg-close').addEventListener('click', close);
    modalRoot.querySelector('#cfg-cancel').addEventListener('click', close);

    modalRoot.querySelector('#cfg-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      channels.forEach(chn => {
        db.update('chatChannels', chn.id, {
          status: fd.get(`enabled_${chn.id}`) ? 'CONECTADO' : 'DESATIVADO',
          phone: fd.get(`handle_${chn.id}`) || chn.phone,
          apiToken: fd.get(`token_${chn.id}`) || '',
          businessId: fd.get(`bizid_${chn.id}`) || '',
          webhook: fd.get(`webhook_${chn.id}`) || ''
        });
      });
      close();
      renderView();
    });
  }

  function attachEvents() {
    const btnConfig = container.querySelector('#btn-config-channels');
    if (btnConfig) btnConfig.addEventListener('click', () => openConfigModal());

    // Troca de Canal Oficial
    container.querySelectorAll('.btn-channel-select').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedChannelId = e.currentTarget.getAttribute('data-channel-id');
        renderView();
      });
    });

    // Seleção de Contato
    container.querySelectorAll('.contact-item').forEach(item => {
      item.addEventListener('click', (e) => {
        selectedClientId = e.currentTarget.getAttribute('data-client-id');
        renderView();
      });
    });

    // Inserir sugestão IA no input
    const btnInsertAi = container.querySelector('#btn-insert-ai-text');
    const inputMsg = container.querySelector('#input-message-text');
    const aiText = container.querySelector('#ai-chat-quick-suggestion');
    if (btnInsertAi && inputMsg && aiText) {
      btnInsertAi.addEventListener('click', () => {
        inputMsg.value = aiText.textContent.trim();
        inputMsg.focus();
      });
    }

    // Envio de Mensagem
    const formSend = container.querySelector('#form-send-message');
    if (formSend) {
      formSend.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = inputMsg.value.trim();
        if (!text || !selectedClientId) return;

        const user = db.getById('users', 'usr_admin') || db.get('users')[0];

        // Insere nova mensagem do corretor
        db.insert('messages', {
          clientId: selectedClientId,
          channelId: selectedChannelId,
          sender: 'BROKER',
          senderName: user.name,
          content: text,
          timestamp: new Date().toISOString(),
          status: 'LIDO'
        });

        // Atualiza último contato no CRM
        db.update('clients', selectedClientId, {
          lastContactAt: new Date().toISOString()
        });

        inputMsg.value = '';
        renderView();

        // Rola até o final das mensagens
        const containerMsgs = container.querySelector('#messages-container');
        if (containerMsgs) containerMsgs.scrollTop = containerMsgs.scrollHeight;
      });
    }
  }

  renderView();
}
