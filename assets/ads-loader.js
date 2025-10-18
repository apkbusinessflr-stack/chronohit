// Lightweight AdSense dynamic loader (no frameworks)
// Reads ADSENSE_* from /api/ads-config and injects the AdSense script + slots.
// Usage in HTML:
//   <script src="./assets/ads-loader.js"></script>        // on index.html
//   <script src="../../assets/ads-loader.js"></script>    // on game pages
// Then call:
//   ChronoAds.load({ targetId: 'ad-home', slotKey: 'home' });
//   ChronoAds.load({ targetId: 'ad-tapreflex', slotKey: 'tapreflex' });

window.ChronoAds = (function(){
  let cfg = null, scriptLoaded = false, queue = [];

  async function fetchConfig(){
    if (cfg !== null) return cfg;
    try {
      const r = await fetch('/api/ads-config');
      cfg = await r.json();
    } catch(e){
      cfg = { enabled:false, reason:'fetch failed' };
    }
    return cfg;
  }

  function injectScript(client){
    if (scriptLoaded) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    s.crossOrigin = 'anonymous';
    s.onload = () => { scriptLoaded = true; flushQueue(); };
    document.head.appendChild(s);
  }

  function flushQueue(){
    (window.adsbygoogle = window.adsbygoogle || []);
    queue.forEach(() => window.adsbygoogle.push({}));
    queue = [];
  }

  function renderSlot(el, client, slot){
    if (!el || !client || !slot) return;
    el.innerHTML = '';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.style.minHeight = '90px'; // CLS guard
    ins.setAttribute('data-ad-client', client);
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    el.appendChild(ins);
    queue.push({});
    if (scriptLoaded) flushQueue();
  }

  async function load({ targetId, slotKey }){
    const conf = await fetchConfig();
    if (!conf.enabled) return; // AdSense disabled or misconfigured
    injectScript(conf.publisher);
    const slotId = (conf.slots||{})[slotKey];
    const target = document.getElementById(targetId);
    renderSlot(target, conf.publisher, slotId);
  }

  return { load };
})();
