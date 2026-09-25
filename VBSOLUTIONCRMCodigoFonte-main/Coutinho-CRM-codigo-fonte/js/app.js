/**
 * Coutinho CRM Imobiliário - Router e Shell SPA
 */
import { authService } from './services/auth.js';
import { db } from './state/db.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCRM } from './views/crm.js';
import { renderFunnel } from './views/funnel.js';
import { renderProperties } from './views/properties.js';
import { renderEvaluation } from './views/evaluation.js';
import { renderContracts } from './views/contracts.js';
import { renderFinancial } from './views/financial.js';
import { renderBrokers } from './views/brokers.js';
import { renderInternal } from './views/internal.js';
import { renderBlog } from './views/blog.js';
import { renderSettings } from './views/settings.js';
import { renderAssistant } from './views/assistant.js';
import { renderChat } from './views/chat.js';
import { renderFinancing } from './views/financing.js';
import { renderUsers } from './views/users.js';
import { renderRadar } from './views/radar.js';

const routes = {
  '/': renderDashboard,
  '/dashboard': renderDashboard,
  '/crm': renderCRM,
  '/funnel': renderFunnel,
  '/properties': renderProperties,
  '/evaluation': renderEvaluation,
  '/contracts': renderContracts,
  '/financial': renderFinancial,
  '/brokers': renderBrokers,
  '/internal': renderInternal,
  '/blog': renderBlog,
  '/settings': renderSettings,
  '/assistant': renderAssistant,
  '/chat': renderChat,
  '/financing': renderFinancing,
  '/users': renderUsers,
  '/radar': renderRadar
};

function navigate() {
  const hash = window.location.hash || '#/dashboard';
  const path = hash.split('?')[0].replace('#', '') || '/dashboard';
  const mainContent = document.getElementById('main-content');

  document.querySelectorAll('.nav-link').forEach(link => {
    const target = link.getAttribute('href')?.replace('#', '');
    if (target === path || (path === '/' && target === '/dashboard')) {
      link.classList.add('bg-slate-800', 'text-amber-400', 'font-bold');
      link.classList.remove('text-slate-300', 'hover:bg-slate-800/60');
    } else {
      link.classList.remove('bg-slate-800', 'text-amber-400', 'font-bold');
      link.classList.add('text-slate-300', 'hover:bg-slate-800/60');
    }
  });

  const renderFn = routes[path] || renderDashboard;
  if (mainContent) {
    mainContent.innerHTML = '';
    renderFn(mainContent);
  }
}

function showApp() {
  const shell = document.getElementById('app-shell');
  const loginRoot = document.getElementById('login-root');
  if (loginRoot) loginRoot.style.display = 'none';
  if (shell) shell.style.display = 'flex';
}

function showLogin() {
  const shell = document.getElementById('app-shell');
  let loginRoot = document.getElementById('login-root');
  if (shell) shell.style.display = 'none';
  if (!loginRoot) {
    loginRoot = document.createElement('div');
    loginRoot.id = 'login-root';
    document.body.appendChild(loginRoot);
  }
  loginRoot.style.display = 'block';
  renderLogin(loginRoot, () => {
    showApp();
    startAuthenticatedApp();
  });
}

let authenticatedAppStarted = false;

function startAuthenticatedApp() {
  const currentUser = authService.getCurrentUser();
  if (!currentUser) return;
  updateUserHeader(currentUser);

  if (!authenticatedAppStarted) {
    authenticatedAppStarted = true;
    window.addEventListener('hashchange', navigate);
    window.addEventListener('coutinho:user_changed', (e) => {
      updateUserHeader(e.detail);
      navigate();
    });

    const mobileToggle = document.getElementById('btn-mobile-menu');
    const sidebar = document.getElementById('app-sidebar');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('-translate-x-full');
      });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => authService.logout());

    const editProfileBtn = document.getElementById('btn-edit-admin-profile');
    if (editProfileBtn) editProfileBtn.addEventListener('click', () => openAdminProfileModal());
  }

  navigate();
}

export async function initApp() {
  try {
    await authService.bootstrap();
  } catch (e) {
    console.error('Falha no bootstrap de autenticação, seguindo para o login.', e);
  }
  try {
    if (authService.getCurrentUser()) {
      showApp();
      startAuthenticatedApp();
    } else {
      showLogin();
    }
  } catch (e) {
    console.error('Falha ao inicializar a aplicação.', e);
    showLogin();
  }
}

const ADMIN_EMAIL = 'acoutinhoimoveis@gmail.com';

function updateUserHeader(user) {
  if (!user) return;
  const userNameEl = document.getElementById('header-user-name');
  const userRoleEl = document.getElementById('header-user-role');
  const userAvatarEl = document.getElementById('header-user-avatar');
  const editBtn = document.getElementById('btn-edit-admin-profile');

  if (userNameEl) userNameEl.textContent = user.name;
  if (userRoleEl) userRoleEl.textContent = `${user.role} · CRECI ${user.creci || 'DF'}`;
  if (userAvatarEl) userAvatarEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0b1d3a&color=fff`;

  // Edição de perfil liberada para qualquer usuário logado (o próprio perfil)
  if (editBtn) editBtn.classList.remove('hidden');
}

function openAdminProfileModal() {
  const user = authService.getCurrentUser();
  if (!user) return;
  const modalRoot = document.getElementById('admin-profile-modal');
  if (!modalRoot) return;
  const isMasterAdmin = (user.email || '').toLowerCase() === ADMIN_EMAIL;
  let avatarData = user.avatar || '';

  modalRoot.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
        <div class="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Meu Perfil</h3>
            <p class="text-[11px] text-slate-500">Atualize sua foto e seus dados. Alterações refletem no sistema.</p>
          </div>
          <button id="ap-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
        </div>

        <form id="ap-form" class="mt-4 space-y-4 text-xs">
          <div class="flex items-center gap-4">
            <img id="ap-avatar-preview" src="${avatarData || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0b1d3a&color=fff`}" class="w-16 h-16 rounded-full object-cover border border-slate-200">
            <div class="flex-1">
              <label class="block font-semibold text-slate-700 mb-1">Foto de Perfil</label>
              <input type="file" id="ap-photo-file" accept="image/*" class="w-full text-[11px]">
              <p class="text-[10px] text-slate-400 mt-1">Ou cole a URL da foto:</p>
              <input type="url" id="ap-photo-url" value="${user.avatar || ''}" placeholder="https://..." class="w-full p-1.5 border rounded-lg mt-1">
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
              <label class="block font-semibold text-slate-700 mb-1">E-mail</label>
              <input type="email" name="email" value="${user.email || ''}" ${isMasterAdmin ? 'disabled' : ''} class="w-full p-2 border rounded-lg ${isMasterAdmin ? 'bg-slate-100 text-slate-500' : ''}">
              ${isMasterAdmin ? '<p class="text-[10px] text-slate-400 mt-1">E-mail do administrador mestre não pode ser alterado.</p>' : ''}
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">WhatsApp / Telefone</label>
              <input type="text" name="phone" value="${user.phone || ''}" class="w-full p-2 border rounded-lg" placeholder="(61) 98765-4321">
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Especialidades & Regiões (separadas por vírgula)</label>
            <input type="text" name="specialties" value="${(user.specialties || []).join(', ')}" class="w-full p-2 border rounded-lg" placeholder="Ex: Alto Padrão, Noroeste, Águas Claras">
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button type="button" id="ap-cancel" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const close = () => { modalRoot.innerHTML = ''; };
  modalRoot.querySelector('#ap-close').addEventListener('click', close);
  modalRoot.querySelector('#ap-cancel').addEventListener('click', close);

  const preview = modalRoot.querySelector('#ap-avatar-preview');
  const urlInput = modalRoot.querySelector('#ap-photo-url');
  const fileInput = modalRoot.querySelector('#ap-photo-file');

  urlInput.addEventListener('input', () => {
    avatarData = urlInput.value.trim();
    if (avatarData) preview.src = avatarData;
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande (máx. 2MB).'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { avatarData = ev.target.result; preview.src = avatarData; urlInput.value = ''; };
    reader.readAsDataURL(file);
  });

  modalRoot.querySelector('#ap-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const specialties = (fd.get('specialties') || '').split(',').map(s => s.trim()).filter(Boolean);
    const updates = {
      name: fd.get('name'),
      creci: fd.get('creci'),
      phone: fd.get('phone'),
      whatsapp: (fd.get('phone') || '').replace(/\D/g, ''),
      specialties,
      avatar: avatarData || `https://ui-avatars.com/api/?name=${encodeURIComponent(fd.get('name'))}&background=0b1d3a&color=fff`
    };
    if (!isMasterAdmin) updates.email = fd.get('email');

    const updated = db.update('users', user.id, updates);
    authService.setCurrentUser(updated);
    updateUserHeader(updated);
    close();
  });
}

window.addEventListener('DOMContentLoaded', initApp);
