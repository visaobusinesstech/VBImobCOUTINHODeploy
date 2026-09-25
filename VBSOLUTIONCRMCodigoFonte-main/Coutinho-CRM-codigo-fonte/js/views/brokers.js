/**
 * View: Gestão de Corretores & Equipe
 * Controle de acesso RBAC, metas, ranking, edição de dados e foto
 */
import { db } from '../state/db.js';
import { toCurrency } from '../services/evaluation.js';

export function renderBrokers(container) {
  function renderView() {
    const users = db.get('users');
    const opportunities = db.get('opportunities');
    const commissions = db.get('commissions');

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Equipe de Corretores & Permissões</h1>
            <p class="text-sm text-slate-500">Administração de corretores habilitados, CRECI, metas comerciais e ranking</p>
          </div>
          <button id="btn-new-broker" class="btn-primary text-xs flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
            Cadastrar Corretor
          </button>
        </div>

        <!-- Cards de Corretores -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${users.map(user => {
            const userOpps = opportunities.filter(o => o.brokerId === user.id);
            const userComms = commissions.filter(c => c.brokerId === user.id);
            const totalComms = userComms.reduce((acc, c) => acc + c.commissionAmount, 0);

            const roleBadge = {
              'ADMINISTRADOR': 'bg-slate-900 text-white',
              'GESTOR': 'bg-indigo-700 text-white',
              'CORRETOR': 'bg-slate-100 text-slate-800'
            }[user.role] || 'bg-slate-100 text-slate-800';

            const avatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0b1d3a&color=fff`;

            return `
              <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div class="flex items-start gap-3 mb-4">
                    <img src="${avatar}" alt="${user.name}" class="w-12 h-12 rounded-full object-cover border border-slate-200">
                    <div>
                      <div class="flex items-center gap-2">
                        <h3 class="font-bold text-slate-900 text-sm">${user.name}</h3>
                      </div>
                      <div class="text-xs text-slate-500 font-mono">${user.email}</div>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded ${roleBadge}">${user.role}</span>
                        <span class="text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200">CRECI ${user.creci || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div class="space-y-2 text-xs py-3 border-y border-slate-100 text-slate-600">
                    <div class="flex justify-between">
                      <span>WhatsApp / Tel:</span>
                      <strong class="text-slate-800">${user.phone || 'N/A'}</strong>
                    </div>
                    <div class="flex justify-between">
                      <span>Oportunidades Ativas:</span>
                      <strong class="text-indigo-600">${userOpps.length} no funil</strong>
                    </div>
                    <div class="flex justify-between">
                      <span>Volume de Comissões:</span>
                      <strong class="text-emerald-700">${toCurrency(totalComms)}</strong>
                    </div>
                  </div>

                  <div class="mt-3">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Especialidades & Regiões DF</span>
                    <div class="flex flex-wrap gap-1">
                      ${(user.specialties || ['Alto Padrão', 'DF']).map(s => `
                        <span class="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">${s}</span>
                      `).join('')}
                    </div>
                  </div>
                </div>

                <div class="pt-4 mt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                  <button class="btn-edit-user text-xs text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1" data-user-id="${user.id}">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Editar
                  </button>
                  <button class="btn-switch-user text-xs text-indigo-600 hover:text-indigo-900 font-semibold" data-user-id="${user.id}">
                    Simular Visão
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div id="broker-modal-container"></div>
    `;

    container.querySelectorAll('.btn-switch-user').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = e.currentTarget.getAttribute('data-user-id');
        const user = db.getById('users', uid);
        if (user) {
          localStorage.setItem('coutinho_crm_session_user', JSON.stringify({ authenticated: true, user, signedInAt: new Date().toISOString() }));
          alert(`Sessão alterada para: ${user.name} (${user.role}).`);
          window.location.reload();
        }
      });
    });

    container.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', (e) => openBrokerModal(e.currentTarget.getAttribute('data-user-id')));
    });

    const btnNew = container.querySelector('#btn-new-broker');
    if (btnNew) btnNew.addEventListener('click', () => openBrokerModal(null));
  }

  function openBrokerModal(userId) {
    const modalContainer = container.querySelector('#broker-modal-container');
    const isEdit = Boolean(userId);
    const user = isEdit ? db.getById('users', userId) : {
      name: '', email: '', phone: '', creci: '', role: 'CORRETOR',
      avatar: '', specialties: [], status: 'ATIVO'
    };

    let avatarData = user.avatar || '';

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold text-slate-900">${isEdit ? 'Editar Corretor' : 'Cadastrar Corretor'}</h3>
            <button id="modal-broker-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <form id="form-broker" class="mt-4 space-y-4 text-xs">
            <!-- Foto -->
            <div class="flex items-center gap-4">
              <img id="broker-avatar-preview" src="${avatarData || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Novo')}&background=0b1d3a&color=fff`}" class="w-16 h-16 rounded-full object-cover border border-slate-200">
              <div class="flex-1">
                <label class="block font-semibold text-slate-700 mb-1">Foto do Corretor</label>
                <input type="file" id="broker-photo-file" accept="image/*" class="w-full text-[11px]">
                <p class="text-[10px] text-slate-400 mt-1">Ou cole uma URL abaixo:</p>
                <input type="url" id="broker-photo-url" value="${user.avatar || ''}" placeholder="https://..." class="w-full p-1.5 border rounded-lg mt-1">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input type="text" name="name" required value="${user.name || ''}" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">CRECI</label>
                <input type="text" name="creci" value="${user.creci || ''}" class="w-full p-2 border rounded-lg" placeholder="00000-DF">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">E-mail *</label>
                <input type="email" name="email" required value="${user.email || ''}" class="w-full p-2 border rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">WhatsApp / Telefone</label>
                <input type="text" name="phone" value="${user.phone || ''}" class="w-full p-2 border rounded-lg" placeholder="(61) 98765-4321">
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Perfil de Acesso</label>
                <select name="role" class="w-full p-2 border rounded-lg">
                  <option value="CORRETOR" ${user.role === 'CORRETOR' ? 'selected' : ''}>Corretor</option>
                  <option value="GESTOR" ${user.role === 'GESTOR' ? 'selected' : ''}>Gestor</option>
                  <option value="ADMINISTRADOR" ${user.role === 'ADMINISTRADOR' ? 'selected' : ''}>Administrador</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Status</label>
                <select name="status" class="w-full p-2 border rounded-lg">
                  <option value="ATIVO" ${user.status === 'ATIVO' ? 'selected' : ''}>Ativo</option>
                  <option value="INATIVO" ${user.status === 'INATIVO' ? 'selected' : ''}>Inativo</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Especialidades & Regiões (separadas por vírgula)</label>
              <input type="text" name="specialties" value="${(user.specialties || []).join(', ')}" class="w-full p-2 border rounded-lg" placeholder="Ex: Alto Padrão, Noroeste, Águas Claras">
            </div>

            <div class="flex justify-between items-center pt-4 border-t border-slate-100">
              ${isEdit && user.role !== 'ADMINISTRADOR' ? `<button type="button" id="btn-delete-broker" class="text-rose-600 font-bold hover:underline">Remover</button>` : '<div></div>'}
              <div class="flex gap-2">
                <button type="button" id="btn-broker-cancel" class="btn-secondary">Cancelar</button>
                <button type="submit" class="btn-primary">${isEdit ? 'Salvar Alterações' : 'Cadastrar'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelector('#modal-broker-close').addEventListener('click', close);
    modalContainer.querySelector('#btn-broker-cancel').addEventListener('click', close);

    const preview = modalContainer.querySelector('#broker-avatar-preview');
    const urlInput = modalContainer.querySelector('#broker-photo-url');
    const fileInput = modalContainer.querySelector('#broker-photo-file');

    urlInput.addEventListener('input', () => {
      avatarData = urlInput.value.trim();
      if (avatarData) preview.src = avatarData;
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande (máx. 2MB).'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        avatarData = ev.target.result;
        preview.src = avatarData;
        urlInput.value = '';
      };
      reader.readAsDataURL(file);
    });

    const delBtn = modalContainer.querySelector('#btn-delete-broker');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (confirm(`Remover o corretor ${user.name}?`)) {
          db.delete('users', userId);
          close();
          renderView();
        }
      });
    }

    modalContainer.querySelector('#form-broker').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const specialties = (fd.get('specialties') || '').split(',').map(s => s.trim()).filter(Boolean);
      const data = {
        name: fd.get('name'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        whatsapp: (fd.get('phone') || '').replace(/\D/g, ''),
        creci: fd.get('creci'),
        role: fd.get('role'),
        status: fd.get('status'),
        specialties,
        avatar: avatarData || `https://ui-avatars.com/api/?name=${encodeURIComponent(fd.get('name'))}&background=0b1d3a&color=fff`
      };

      if (isEdit) {
        const updated = db.update('users', userId, data);
        // Se o usuário editou a si mesmo, atualiza a sessão/header
        const current = JSON.parse(localStorage.getItem('coutinho_crm_session_user') || 'null');
        if (current?.user?.id === userId) {
          localStorage.setItem('coutinho_crm_session_user', JSON.stringify({ ...current, user: updated }));
          window.dispatchEvent(new CustomEvent('coutinho:user_changed', { detail: updated }));
        }
      } else {
        db.insert('users', { ...data, createdAt: new Date().toISOString() });
      }

      close();
      renderView();
    });
  }

  renderView();
}
