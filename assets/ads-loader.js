// Lightweight AdSense dynamic loader (no frameworks)
// Reads ADSENSE_* from /api/ads-config and injects the AdSense script + slots.
// Usage in HTML:
//   <script src="/assets/ads-loader.js"></script>
// Then call (μετά το DOM ready / μετά από consent):
//   ChronoAds.load({ targetId: 'ad-home', slotKey: 'home' });
//   ChronoAds.load({ targetId: 'ad-tapreflex', slotKey: 'tapreflex' });

window.ChronoAds = (function () {
  let cfg = null;
  let scriptLoaded = false;
  let currentClient = null;
  let queue = [];

  async function fetchConfig() {
    if (cfg !== null) return cfg;
    try {
      const r = await fetch("/api/ads-config", { credentials: "same-origin" });
      cfg = await r.json();
    } catch (e) {
      cfg = { enabled: false, reason: "fetch failed" };
      console.warn("[ChronoAds] /api/ads-config fetch failed", e);
    }
    return cfg;
  }

  function injectScript(client) {
    if (scriptLoaded && currentClient === client) return;

    // Αν έχει ήδη φορτωθεί script με ίδιο client, μην το ξαναβάλεις
    const existing = document.querySelector(
      'script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
    );
    if (existing) {
      scriptLoaded = true;
      currentClient = client;
      flushQueue();
      return;
    }

    const s = document.createElement("script");
    s.async = true;
    s.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      encodeURIComponent(client);
    s.crossOrigin = "anonymous";
    s.onload = () => {
      scriptLoaded = true;
      currentClient = client;
      flushQueue();
    };
    s.onerror = () => console.warn("[ChronoAds] AdSense script failed to load");
    document.head.appendChild(s);
  }

  function flushQueue() {
    (window.adsbygoogle = window.adsbygoogle || []);
    queue.forEach(() => window.adsbygoogle.push({}));
    queue = [];
  }

  function renderSlot(el, client, slot) {
    if (!el) {
      console.warn("[ChronoAds] target element not found");
      return;
    }
    if (el.dataset.adsLoaded === "1") {
      // Ήδη έχει γίνει render για αυτό το placeholder
      return;
    }
    if (!client || !slot) {
      console.warn("[ChronoAds] missing client/slot", { client, slot });
      return;
    }

    el.innerHTML = "";
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.minHeight = "90px"; // CLS guard
    ins.setAttribute("data-ad-client", client);
    ins.setAttribute("data-ad-slot", String(slot));
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    el.appendChild(ins);

    // Queue push για init
    queue.push({});
    el.dataset.adsLoaded = "1";
    if (scriptLoaded) flushQueue();
  }

  async function load({ targetId, slotKey }) {
    const conf = await fetchConfig();
    if (!conf?.enabled) {
      // AdSense off ή misconfigured — απλά μην κάνεις τίποτα
      return;
    }
    const client = conf.publisher;
    const slotId = (conf.slots || {})[slotKey];
    const target = document.getElementById(targetId);

    injectScript(client);
    renderSlot(target, client, slotId);
  }

  return { load };
})();
