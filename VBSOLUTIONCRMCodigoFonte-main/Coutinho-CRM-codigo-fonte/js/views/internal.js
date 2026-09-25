/**
 * View: Área Interna da Equipe
 * Mural, comunicados, agenda e avisos institucionais
 */
import { db } from '../state/db.js';

export function renderInternal(container) {
  const announcements = db.get('internalAnnouncements') || [];
  const users = db.get('users');

  container.innerHTML = `
    <div class="space-y-6">
      <div class="pb-2 border-b border-slate-200">
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Área Interna de Comunicação</h1>
        <p class="text-sm text-slate-500">Mural corporativo, metas do mês, comunicados e alinhamentos operacionais</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Mural de Avisos -->
        <div class="lg:col-span-2 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900">Mural de Avisos & Metas</h2>
            <span class="text-xs text-slate-500">Atualizado pela diretoria</span>
          </div>

          <div class="space-y-4">
            ${announcements.map(ann => {
              const author = users.find(u => u.id === ann.authorId) || users[0];
              return `
                <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900">${ann.category}</span>
                    <span class="text-xs text-slate-400">${new Date(ann.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <h3 class="font-bold text-slate-900 text-sm mb-2">${ann.title}</h3>
                  <p class="text-xs text-slate-600 leading-relaxed">${ann.content}</p>
                  <div class="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Publicado por: <strong>${author.name}</strong></span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Agenda & Treinamentos -->
        <div class="space-y-4">
          <h2 class="text-base font-bold text-slate-900">Próximos Treinamentos & Eventos</h2>
          <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
            <div class="p-3 bg-slate-50 rounded-lg border-l-4 border-l-indigo-600">
              <strong class="text-slate-900 block font-bold">Captação Exclusiva no DF</strong>
              <span class="text-slate-500 block text-[11px] mt-0.5">Quarta-feira · 09:00</span>
              <span class="text-slate-600 mt-1 block">Técnicas de apresentação de laudo mercadológico para proprietários.</span>
            </div>

            <div class="p-3 bg-slate-50 rounded-lg border-l-4 border-l-emerald-600">
              <strong class="text-slate-900 block font-bold">Uso da Coutinho IA</strong>
              <span class="text-slate-500 block text-[11px] mt-0.5">Sexta-feira · 14:00</span>
              <span class="text-slate-600 mt-1 block">Treinamento prático de nutrição e follow-up de leads parados.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
