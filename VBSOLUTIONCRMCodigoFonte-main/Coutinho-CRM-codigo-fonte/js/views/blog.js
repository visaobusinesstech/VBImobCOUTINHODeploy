/**
 * View: Blog + SEO Orgânico
 * CMS de artigos imobiliários com geração de conteúdo pela Coutinho IA
 */
import { db } from '../state/db.js';
import { aiService } from '../services/ai.js';

export function renderBlog(container) {
  function renderView() {
    const posts = db.get('blogPosts') || [];

    container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Blog & Estratégia de SEO Orgânico</h1>
          <p class="text-sm text-slate-500">Geração de tráfego qualificado de compradores e proprietários em Brasília e DF</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-viral-topics" class="btn-secondary text-xs flex items-center gap-2 border-rose-300 text-rose-700 hover:bg-rose-50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            Temas Virais (IA)
          </button>
          <button id="btn-instagram" class="btn-secondary text-xs flex items-center gap-2 border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
            Instagram Viral
          </button>
          <button id="btn-new-post" class="btn-primary text-xs flex items-center gap-2">
            <svg class="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Gerar Artigo com IA
          </button>
        </div>
      </div>

      <!-- Radar de Palavras-Chave DF -->
      <div class="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 bg-amber-400 rounded-full"></span>
            <h3 class="font-bold text-sm text-white">Estratégia SEO Local: Distrito Federal</h3>
          </div>
          <span class="text-xs bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded font-semibold">Coutinho IA · Palavras Prioritárias</span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          ${[
            { k: 'imóveis à venda Noroeste', v: 'Volume: 4.8k/mês · CPC R$ 5,20' },
            { k: 'apartamentos Águas Claras', v: 'Volume: 8.2k/mês · CPC R$ 4,10' },
            { k: 'casas em Vicente Pires', v: 'Volume: 3.6k/mês · CPC R$ 3,80' },
            { k: 'avaliação de imóveis Brasília', v: 'Volume: 1.9k/mês · Alta Intenção' }
          ].map(item => `
            <button class="kw-chip text-left p-2.5 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition" data-kw="${item.k}">
              <span class="text-amber-400 font-bold block">${item.k}</span>
              <span class="text-[11px] text-slate-300">${item.v}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Lista de Artigos CMS -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${posts.length ? posts.map(post => `
          <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2 text-xs">
                <span class="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">${post.category}</span>
                <span class="text-slate-400 font-medium">${post.views || 0} leituras</span>
              </div>
              <h3 class="font-bold text-slate-900 text-base mb-2">${post.title}</h3>
              <p class="text-xs text-slate-600 mb-3">${post.metaDescription}</p>

              <div class="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1 font-mono text-[11px] text-slate-700">
                <div><strong>Palavra-Chave:</strong> <span class="text-indigo-600">${post.mainKeyword}</span></div>
                <div><strong>Slug:</strong> /blog/${post.slug}</div>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span class="text-slate-500">Autor: <strong>${post.author}</strong></span>
              <div class="flex items-center gap-2">
                <button class="btn-seo-post text-amber-700 hover:text-amber-900 font-bold" data-id="${post.id}">Análise SEO</button>
                <button class="btn-view-post text-indigo-600 hover:text-indigo-800 font-bold" data-id="${post.id}">Ver conteúdo</button>
                <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">${post.status}</span>
              </div>
            </div>
          </div>
        `).join('') : '<div class="col-span-2 p-8 text-center text-slate-400 text-sm">Nenhum artigo publicado. Clique em "Gerar Artigo com IA".</div>'}
      </div>
    </div>

    <div id="blog-modal-container"></div>
  `;

    container.querySelectorAll('.kw-chip').forEach(chip => {
      chip.addEventListener('click', (e) => openGenerateModal(e.currentTarget.getAttribute('data-kw')));
    });

    const btnNew = container.querySelector('#btn-new-post');
    if (btnNew) btnNew.addEventListener('click', () => openGenerateModal(''));

    const btnViral = container.querySelector('#btn-viral-topics');
    if (btnViral) btnViral.addEventListener('click', () => openViralTopicsModal());

    const btnInsta = container.querySelector('#btn-instagram');
    if (btnInsta) btnInsta.addEventListener('click', () => openInstagramModal());

    container.querySelectorAll('.btn-view-post').forEach(btn => {
      btn.addEventListener('click', (e) => openViewModal(e.currentTarget.getAttribute('data-id')));
    });

    container.querySelectorAll('.btn-seo-post').forEach(btn => {
      btn.addEventListener('click', (e) => openSeoModal(e.currentTarget.getAttribute('data-id')));
    });
  }

  function openGenerateModal(prefillKeyword) {
    const modalRoot = container.querySelector('#blog-modal-container');
    let draft = null;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-900">Gerar Artigo SEO com Coutinho IA</h3>
              <p class="text-[11px] text-slate-500">Informe a palavra-chave e região; a IA monta título, meta, FAQ e schema.</p>
            </div>
            <button id="blog-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Palavra-chave principal *</label>
              <input id="gen-keyword" type="text" value="${prefillKeyword || ''}" class="w-full p-2 border rounded-lg" placeholder="Ex: apartamentos à venda no Sudoeste">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Região</label>
              <input id="gen-region" type="text" class="w-full p-2 border rounded-lg" placeholder="Ex: Sudoeste">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Tipo de imóvel</label>
              <input id="gen-type" type="text" class="w-full p-2 border rounded-lg" placeholder="Ex: apartamentos">
            </div>
          </div>

          <button id="btn-run-gen" class="mt-3 w-full btn-primary text-xs flex items-center justify-center gap-2">
            <svg class="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Gerar Conteúdo
          </button>

          <div id="gen-preview" class="mt-4 hidden">
            <div class="border border-slate-200 rounded-xl p-4 space-y-2 text-xs bg-slate-50 max-h-[40vh] overflow-y-auto">
              <div><strong class="text-slate-500">Título:</strong> <span id="pv-title" class="text-slate-900 font-bold"></span></div>
              <div><strong class="text-slate-500">SEO Title:</strong> <span id="pv-seo"></span></div>
              <div><strong class="text-slate-500">Meta description:</strong> <span id="pv-meta"></span></div>
              <div><strong class="text-slate-500">Slug:</strong> <span id="pv-slug" class="font-mono"></span></div>
              <div><strong class="text-slate-500">Secundárias:</strong> <span id="pv-sec"></span></div>
              <pre id="pv-content" class="whitespace-pre-wrap text-[11px] text-slate-700 bg-white border border-slate-200 rounded p-2 mt-2"></pre>
            </div>
          </div>

          <div class="mt-4 flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button id="blog-cancel" class="btn-secondary text-xs">Fechar</button>
            <button id="btn-save-post" class="btn-primary text-xs hidden">Publicar Artigo</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#blog-close').addEventListener('click', close);
    modalRoot.querySelector('#blog-cancel').addEventListener('click', close);

    modalRoot.querySelector('#btn-run-gen').addEventListener('click', () => {
      const keyword = modalRoot.querySelector('#gen-keyword').value.trim();
      if (!keyword) { alert('Informe a palavra-chave principal.'); return; }
      const region = modalRoot.querySelector('#gen-region').value.trim();
      const propertyType = modalRoot.querySelector('#gen-type').value.trim();
      draft = aiService.generateBlogArticle({ keyword, region, propertyType });

      modalRoot.querySelector('#pv-title').textContent = draft.title;
      modalRoot.querySelector('#pv-seo').textContent = draft.seoTitle;
      modalRoot.querySelector('#pv-meta').textContent = draft.metaDescription;
      modalRoot.querySelector('#pv-slug').textContent = '/blog/' + draft.slug;
      modalRoot.querySelector('#pv-sec').textContent = draft.secondaryKeywords.join(', ');
      modalRoot.querySelector('#pv-content').textContent = draft.content;
      modalRoot.querySelector('#gen-preview').classList.remove('hidden');
      modalRoot.querySelector('#btn-save-post').classList.remove('hidden');
    });

    modalRoot.querySelector('#btn-save-post').addEventListener('click', () => {
      if (!draft) return;
      const admin = db.get('users').find(u => u.role === 'ADMINISTRADOR') || db.get('users')[0];
      db.insert('blogPosts', {
        title: draft.title,
        slug: draft.slug,
        author: admin?.name || 'Coutinho Imóveis',
        category: draft.category,
        tags: draft.secondaryKeywords,
        seoTitle: draft.seoTitle,
        metaDescription: draft.metaDescription,
        mainKeyword: draft.mainKeyword,
        secondaryKeywords: draft.secondaryKeywords,
        content: draft.content,
        faq: draft.faq,
        schema: draft.schema,
        status: 'PUBLICADO',
        views: 0
      });
      close();
      renderView();
    });
  }

  function openViewModal(postId) {
    const post = db.getById('blogPosts', postId);
    if (!post) return;
    const modalRoot = container.querySelector('#blog-modal-container');
    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-900 pr-4">${post.title}</h3>
            <button id="vp-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>
          <div class="mt-4 text-xs text-slate-500 mb-2">Palavra-chave: <strong class="text-indigo-600">${post.mainKeyword}</strong> · Slug: /blog/${post.slug}</div>
          <pre class="whitespace-pre-wrap text-[12px] text-slate-800 leading-relaxed">${(post.content || '').replace(/</g, '&lt;')}</pre>
        </div>
      </div>
    `;
    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#vp-close').addEventListener('click', close);
  }

  function openSeoModal(postId) {
    const post = db.getById('blogPosts', postId);
    if (!post) return;
    const modalRoot = container.querySelector('#blog-modal-container');
    const seo = aiService.analyzeSEO(post);
    const gradeColor = seo.score >= 85 ? '#059669' : seo.score >= 65 ? '#0ea5e9' : seo.score >= 45 ? '#f59e0b' : '#ef4444';

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-base font-bold text-slate-900">Análise SEO · Coutinho IA</h3>
              <p class="text-[11px] text-slate-500 truncate max-w-[380px]">${post.title}</p>
            </div>
            <button id="seo-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-4 flex items-center gap-4">
            <div class="text-center">
              <div class="text-3xl font-black" style="color:${gradeColor}">${seo.score}<span class="text-sm text-slate-400">/100</span></div>
              <div class="text-[11px] font-bold" style="color:${gradeColor}">${seo.grade}</div>
            </div>
            <div class="flex-1">
              <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
                <div class="h-2 rounded-full" style="width:${seo.score}%;background:${gradeColor}"></div>
              </div>
              <div class="text-[11px] text-slate-500">${seo.wordCount} palavras no conteúdo</div>
            </div>
          </div>

          <div class="mt-4 space-y-1.5 text-xs">
            ${seo.checks.map(c => `
              <div class="flex items-center justify-between p-2 rounded-lg ${c.ok ? 'bg-emerald-50' : 'bg-amber-50'}">
                <span class="flex items-center gap-2 ${c.ok ? 'text-emerald-800' : 'text-amber-800'}">
                  ${c.ok ? '✓' : '!'} ${c.label}
                </span>
                <span class="font-bold ${c.ok ? 'text-emerald-700' : 'text-slate-400'}">${c.ok ? '+' + c.points : c.points}</span>
              </div>
            `).join('')}
          </div>

          ${seo.recommendations.length ? `
            <div class="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs">
              <strong class="text-indigo-900 block mb-1">Recomendações para ranquear melhor:</strong>
              <ul class="list-disc pl-4 space-y-1 text-indigo-800">
                ${seo.recommendations.map(r => `<li>${r}</li>`).join('')}
              </ul>
            </div>
          ` : '<div class="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-800 font-semibold">Artigo bem otimizado. Pronto para ranquear no orgânico.</div>'}
        </div>
      </div>
    `;
    modalRoot.querySelector('#seo-close').addEventListener('click', () => { modalRoot.innerHTML = ''; });
  }

  function openViralTopicsModal() {
    const modalRoot = container.querySelector('#blog-modal-container');
    const topics = aiService.discoverViralTopics();

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-900">Temas Virais do Mercado Imobiliário</h3>
              <p class="text-[11px] text-slate-500">Curadoria da Coutinho IA com a estratégia dos grandes players · fonte de referência incluída</p>
            </div>
            <button id="viral-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-4 space-y-3">
            ${topics.map((t, idx) => {
              const potColor = t.potential === 'Muito alto' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
              return `
                <div class="border border-slate-200 rounded-xl p-4">
                  <div class="flex items-start justify-between gap-3">
                    <h4 class="font-bold text-slate-900 text-sm">${t.title}</h4>
                    <span class="text-[10px] font-black px-2 py-0.5 rounded ${potColor} whitespace-nowrap">${t.potential}</span>
                  </div>
                  <p class="text-xs text-slate-600 mt-1">${t.angle}</p>
                  <div class="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span class="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">📐 ${t.format}</span>
                    ${t.keywords.map(k => `<span class="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">${k}</span>`).join('')}
                  </div>
                  <div class="mt-2 text-[10px] text-slate-400">Fonte de referência: ${t.source}</div>
                  <div class="mt-2 flex gap-2">
                    <button class="btn-topic-article text-[11px] font-bold text-indigo-600 hover:text-indigo-800" data-idx="${idx}">Gerar artigo →</button>
                    <button class="btn-topic-insta text-[11px] font-bold text-fuchsia-600 hover:text-fuchsia-800" data-idx="${idx}">Criar post Instagram →</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#viral-close').addEventListener('click', close);
    modalRoot.querySelectorAll('.btn-topic-article').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const t = topics[Number(e.currentTarget.getAttribute('data-idx'))];
        close();
        openGenerateModal(t.keywords[0]);
      });
    });
    modalRoot.querySelectorAll('.btn-topic-insta').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const t = topics[Number(e.currentTarget.getAttribute('data-idx'))];
        close();
        openInstagramModal(t.title);
      });
    });
  }

  function openInstagramModal(prefillTopic) {
    const modalRoot = container.querySelector('#blog-modal-container');
    let draft = null;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[92vh]">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-900">Instagram Viral · Criação com IA</h3>
              <p class="text-[11px] text-slate-500">Gera roteiro, legenda e hashtags. Publicação via API oficial do Instagram (conta Business).</p>
            </div>
            <button id="insta-close" class="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div class="md:col-span-2">
              <label class="block font-semibold text-slate-700 mb-1">Tema / assunto *</label>
              <input id="insta-topic" type="text" value="${prefillTopic ? prefillTopic.replace(/"/g, '&quot;') : ''}" class="w-full p-2 border rounded-lg" placeholder="Ex: financiamento imobiliário 2026">
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Formato</label>
              <select id="insta-format" class="w-full p-2 border rounded-lg">
                <option value="CARROSSEL">Carrossel</option>
                <option value="REELS">Reels</option>
                <option value="POST">Post único</option>
              </select>
            </div>
          </div>
          <div class="mt-2">
            <label class="block font-semibold text-slate-700 mb-1 text-xs">Região</label>
            <input id="insta-region" type="text" class="w-full p-2 border rounded-lg text-xs" placeholder="Ex: Brasília / Águas Claras">
          </div>

          <button id="btn-run-insta" class="mt-3 w-full btn-primary text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700">
            Gerar Conteúdo Viral
          </button>

          <div id="insta-preview" class="mt-4 hidden space-y-3"></div>

          <div class="mt-4 flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button id="insta-cancel" class="btn-secondary text-xs">Fechar</button>
            <button id="btn-insta-publish" class="btn-primary text-xs bg-fuchsia-600 hover:bg-fuchsia-700 hidden">Publicar no Instagram</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.querySelector('#insta-close').addEventListener('click', close);
    modalRoot.querySelector('#insta-cancel').addEventListener('click', close);

    modalRoot.querySelector('#btn-run-insta').addEventListener('click', () => {
      const topic = modalRoot.querySelector('#insta-topic').value.trim();
      if (!topic) { alert('Informe o tema.'); return; }
      const format = modalRoot.querySelector('#insta-format').value;
      const region = modalRoot.querySelector('#insta-region').value.trim();
      draft = aiService.generateInstagramPost({ topic, format, region });

      const slidesHtml = draft.slides ? `
        <div class="border border-slate-200 rounded-xl p-3">
          <strong class="text-[11px] text-slate-500 uppercase tracking-wider block mb-2">Roteiro do carrossel</strong>
          <div class="space-y-1.5">
            ${draft.slides.map(s => `
              <div class="flex gap-2 text-xs">
                <span class="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0">${s.n}</span>
                <div><span class="text-slate-800">${s.text}</span> <span class="text-[10px] text-slate-400">(${s.note})</span></div>
              </div>
            `).join('')}
          </div>
        </div>` : '';

      modalRoot.querySelector('#insta-preview').innerHTML = `
        <div class="p-3 bg-fuchsia-50 border border-fuchsia-200 rounded-xl text-xs">
          <strong class="text-fuchsia-900 block mb-1">Gancho (${draft.format})</strong>
          <span class="text-fuchsia-800">${draft.hook}</span>
        </div>
        ${slidesHtml}
        <div class="border border-slate-200 rounded-xl p-3">
          <strong class="text-[11px] text-slate-500 uppercase tracking-wider block mb-1">Legenda</strong>
          <pre id="insta-caption" class="whitespace-pre-wrap text-[11px] text-slate-700">${draft.caption}</pre>
          <button id="insta-copy" class="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Copiar legenda</button>
        </div>
        <div class="text-[11px] text-slate-500">⏰ Melhor horário: <strong>${draft.bestTime}</strong></div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
          <strong class="block mb-1">Políticas do Instagram (para não bloquear o perfil):</strong>
          <ul class="list-disc pl-4 space-y-0.5">${draft.policy.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
      `;
      modalRoot.querySelector('#insta-preview').classList.remove('hidden');
      modalRoot.querySelector('#btn-insta-publish').classList.remove('hidden');
      const copyBtn = modalRoot.querySelector('#insta-copy');
      if (copyBtn) copyBtn.addEventListener('click', () => navigator.clipboard.writeText(draft.caption));
    });

    modalRoot.querySelector('#btn-insta-publish').addEventListener('click', () => {
      const insta = db.get('chatChannels').find(c => c.type === 'INSTAGRAM');
      if (!insta || !insta.apiToken || insta.status !== 'CONECTADO') {
        alert('Publicação automática requer o Instagram conectado via API oficial. Configure em Conversas → Configurar (conta Business + token). Enquanto isso, a legenda foi preparada para publicação manual.');
        return;
      }
      alert('Conteúdo enfileirado para publicação via API oficial do Instagram. O envio respeita os limites e políticas da plataforma.');
      modalRoot.innerHTML = '';
    });
  }

  renderView();
}
