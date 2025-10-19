// /assets/ga-loader.js
// Lightweight GA4 loader that reads the Measurement ID from /api/ga-config
// and injects gtag.js only if GA is enabled in ENV.

(function () {
  let loaded = false;

  async function getConfig() {
    try {
      const r = await fetch('/api/ga-config', { credentials: 'same-origin' });
      return await r.json();
    } catch (e) {
      console.warn('[GA] /api/ga-config failed', e);
      return { enabled: false };
    }
  }

  function injectGtag(id) {
    if (loaded || !id) return;
    // gtag script
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    s.onload = initGtag.bind(null, id);
    s.onerror = () => console.warn('[GA] gtag script failed to load');
    document.head.appendChild(s);
  }

  function initGtag(id) {
    if (loaded) return;
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    // Basic privacy-friendly defaults
    gtag('config', id, {
      anonymize_ip: true,
      send_page_view: true
    });

    loaded = true;
  }

  // auto-run on DOM ready (safe in <head>)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  async function boot() {
    const cfg = await getConfig();
    if (!cfg?.enabled) return;
    injectGtag(cfg.id);
  }
})();
