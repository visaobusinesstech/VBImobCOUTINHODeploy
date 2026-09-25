import { db } from '../state/db.js';

const SESSION_KEY = 'coutinho_crm_session_user';
const RESET_KEY = 'coutinho_crm_password_resets';
const MIGRATION_KEY = 'coutinho_crm_auth_migration';
const DEFAULT_PASSWORD = 'Coutinho@2026';
const ADMIN_EMAIL = 'acoutinhoimoveis@gmail.com';
const ADMIN_PASSWORD = 'Laysbiacarol@123';
const CURRENT_MIGRATION = 2;

function fallbackHash(value) {
  // Hash determinístico (FNV-1a de 53 bits) para quando crypto.subtle não está disponível (ex.: file://)
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'fb' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

async function hashPassword(email, password) {
  const value = `coutinho-crm-v1:${email.trim().toLowerCase()}:${password}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const bytes = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    // cai no fallback
  }
  return fallbackHash(value);
}

function getResetRequests() {
  try {
    return JSON.parse(localStorage.getItem(RESET_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveResetRequests(requests) {
  localStorage.setItem(RESET_KEY, JSON.stringify(requests));
}

export const authService = {
  async bootstrap() {
    let changed = false;
    for (const user of db.get('users')) {
      if (!user.passwordHash) {
        const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL;
        user.passwordHash = await hashPassword(user.email, isAdmin ? ADMIN_PASSWORD : DEFAULT_PASSWORD);
        user.passwordUpdatedAt = new Date().toISOString();
        user.mustChangePassword = false;
        changed = true;
      }
    }

    // Migração: garante a senha atual do admin em instalações já abertas
    const migration = Number(localStorage.getItem(MIGRATION_KEY) || 0);
    if (migration < CURRENT_MIGRATION) {
      const admin = db.get('users').find(u => u.email.toLowerCase() === ADMIN_EMAIL);
      if (admin) {
        admin.passwordHash = await hashPassword(admin.email, ADMIN_PASSWORD);
        admin.passwordUpdatedAt = new Date().toISOString();
        admin.mustChangePassword = false;
        changed = true;
      }
      localStorage.setItem(MIGRATION_KEY, String(CURRENT_MIGRATION));
    }

    if (changed) db.save();
  },

  getCurrentUser() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return session?.authenticated === true ? session.user : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ authenticated: true, user, signedInAt: new Date().toISOString() }));
    window.dispatchEvent(new CustomEvent('coutinho:user_changed', { detail: user }));
  },

  async login(email, password) {
    const target = db.get('users').find(user => user.email.toLowerCase() === email.trim().toLowerCase() && user.status === 'ATIVO');
    if (!target || !password) return { success: false, message: 'E-mail ou senha inválidos.' };

    const passwordHash = await hashPassword(target.email, password);
    if (passwordHash !== target.passwordHash) return { success: false, message: 'E-mail ou senha inválidos.' };

    this.setCurrentUser(target);
    return { success: true, user: target };
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  },

  async requestPasswordReset(email) {
    const user = db.get('users').find(item => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) return { success: true, message: 'Se existir uma conta com este e-mail, as instruções de recuperação foram enviadas.' };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const requests = getResetRequests().filter(item => item.email !== user.email);
    requests.push({ email: user.email, code, expiresAt: Date.now() + 15 * 60 * 1000 });
    saveResetRequests(requests);
    return {
      success: true,
      message: 'Código de recuperação gerado. Em produção, ele será enviado pelo e-mail transacional configurado.',
      demoCode: code
    };
  },

  async resetPassword(email, code, password) {
    if (!password || password.length < 10) return { success: false, message: 'Use uma senha com pelo menos 10 caracteres.' };
    const user = db.get('users').find(item => item.email.toLowerCase() === email.trim().toLowerCase());
    const requests = getResetRequests();
    const request = requests.find(item => item.email === user?.email && item.code === code && item.expiresAt > Date.now());
    if (!user || !request) return { success: false, message: 'Código inválido ou expirado.' };

    db.update('users', user.id, {
      passwordHash: await hashPassword(user.email, password),
      passwordUpdatedAt: new Date().toISOString(),
      mustChangePassword: false
    });
    saveResetRequests(requests.filter(item => item !== request));
    return { success: true, message: 'Senha atualizada. Entre com sua nova senha.' };
  },

  async changePassword(currentPassword, newPassword) {
    const user = this.getCurrentUser();
    if (!user) return { success: false, message: 'Sessão inválida.' };
    const result = await this.login(user.email, currentPassword);
    if (!result.success) return { success: false, message: 'Senha atual incorreta.' };
    if (!newPassword || newPassword.length < 10) return { success: false, message: 'Use uma senha com pelo menos 10 caracteres.' };

    const updated = db.update('users', user.id, {
      passwordHash: await hashPassword(user.email, newPassword),
      passwordUpdatedAt: new Date().toISOString(),
      mustChangePassword: false
    });
    this.setCurrentUser(updated);
    return { success: true, message: 'Senha atualizada com sucesso.' };
  },

  switchUser(userId) {
    const user = db.getById('users', userId);
    if (user) this.setCurrentUser(user);
    return user || null;
  },

  isAdmin() {
    return this.getCurrentUser()?.role === 'ADMINISTRADOR';
  },

  isManager() {
    return ['ADMINISTRADOR', 'GESTOR'].includes(this.getCurrentUser()?.role);
  },

  canAccessModule(moduleName) {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === 'ADMINISTRADOR') return true;
    if (user.role === 'GESTOR') return ['dashboard', 'crm', 'properties', 'evaluations', 'opportunities', 'contracts', 'financial', 'team', 'internal', 'blog', 'chat'].includes(moduleName);
    return ['dashboard', 'crm', 'properties', 'evaluations', 'opportunities', 'internal', 'contracts', 'chat'].includes(moduleName);
  }
};
