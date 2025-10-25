// /assets/ga-loader.js
// GA4 loader: DNT-safe, no top-level await, never blocks rendering
(function () {
  function dntEnabled() {
    const dnt = (navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || "0") + "";
    return dnt === "1" || dnt === "yes";
  }

  async function getConfig() {
    try {
      const r = await fetch("/api/ga-config", { credentials: "same-origin" });
      if (!r.ok) return {};
      return await r.json();
    } catch {
      return {};
    }
  }

  function injectGtag(id) {
    if (!id) return;
    if (window.gtag) return;

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    s.onerror = () => console.info("[GA] script load failed");
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", id);

    // safe defaults
    gtag("consent", "default", {
      ad_storage: "denied",
      analytics_storage: "granted",
      functionality_storage: "granted",
      personalization_storage: "denied",
      security_storage: "granted",
    });

    // expose consent helper (optional)
    window.GAConsent = { set: (obj) => gtag("consent", "update", obj || {}) };
  }

  async function boot() {
    const cfg = await getConfig();
    if (!cfg?.enabled) return;
    if (dntEnabled()) { console.info("[GA] Skipped due to Do-Not-Track"); return; }
    injectGtag(cfg.id);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
