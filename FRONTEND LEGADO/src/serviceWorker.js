export function register() {
  // Registra somente em produção e se suportado pelo navegador
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    try {
      // Valida existência do arquivo e MIME adequado (javascript)
      const response = await fetch(swUrl, { method: 'HEAD' });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('javascript')) {
        console.warn('Service worker não registrado (arquivo ausente ou MIME inválido).', {
          status: response.status,
          contentType
        });
        return;
      }

      const registration = await navigator.serviceWorker.register(swUrl);
      console.log('Service worker registrado com sucesso!', registration);
    } catch (error) {
      console.error('Erro durante o registro do service worker:', error);
    }
  });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('Erro durante o desregistro do service worker:', error);
      });
  }
}
