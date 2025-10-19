// + ΝΕΟ: έλεγχος DNT
function dntEnabled() {
  const dnt = (navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || '0') + '';
  return dnt === '1' || dnt === 'yes';
}

// + ΝΕΟ: helper για consent (αν βάλεις CMP αργότερα)
window.GAConsent = {
  set(consentObject) {
    if (!window.gtag) return;
    window.gtag('consent', 'update', consentObject || {});
  }
};

// + Στο boot(): μην φορτώσεις GA αν DNT
const cfg = await getConfig();
if (!cfg?.enabled) return;
if (dntEnabled()) { console.info('[GA] Skipped due to Do-Not-Track'); return; }
injectGtag(cfg.id);

// + Στο initGtag(): default consent “ασφαλές”
gtag('consent', 'default', {
  ad_storage: 'denied',
  analytics_storage: 'granted',
  functionality_storage: 'granted',
  personalization_storage: 'denied',
  security_storage: 'granted'
});
