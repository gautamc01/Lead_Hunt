// content.js — MapsExtract Pro v4.0
// CORRECT ARCHITECTURE (matches Instant Data Scraper, the top-rated tool):
// Read ALL data directly from result CARDS during scroll. No per-listing
// navigation in Phase 1. Optionally deep-scrape only cards missing website/phone.

(function () {
  'use strict';
  if (window.__MEP4) return;
  window.__MEP4 = true;

  let STOP    = false;
  let RUNNING = false;
  let CFG  = {
    autoScroll: true, deepScrape: true, emailScrape: true, getHours: false,
    limit: 200, delay: 400, minRating: 0, needPhone: false, needWebsite: false,
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // post() sends to popup AND writes to storage so the popup can recover
  // its state even if it was closed (tab switch closes the popup).
  const post = (type, p = {}) => {
    try { chrome.runtime.sendMessage({ type, ...p }); } catch (_) {}
  };

  // Persist live run-state so the popup can reconnect after being closed.
  function setRunState(state) {
    try { chrome.storage.local.set({ mepRunState: { ...state, ts: Date.now() } }); } catch (_) {}
  }

  // Append a result to storage immediately (popup-independent).
  function persistResult(data) {
    try {
      chrome.storage.local.get(['mepResults'], d => {
        const arr = d.mepResults || [];
        arr.push(data);
        chrome.storage.local.set({ mepResults: arr });
      });
    } catch (_) {}
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'START_SCRAPING') {
      if (RUNNING) { sendResponse?.({ ok:false, reason:'already_running' }); return true; }
      CFG = { ...CFG, ...msg.options }; STOP = false;
      run().catch(e => post('ERROR', { message: e.message }));
      sendResponse?.({ ok:true });
    }
    if (msg.type === 'STOP_SCRAPING') { STOP = true; sendResponse?.({ ok:true }); }
    if (msg.type === 'PING_STATE')   { sendResponse?.({ running: RUNNING }); }
    return true; // keep channel open for async sendResponse
  });

  // Reduce background-tab throttling with a silent Web Audio context, which
  // keeps the tab in a less-throttled state when not focused.
  let audioKeepAlive = null;
  function startKeepAlive() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioKeepAlive = new Ctx();
      const osc = audioKeepAlive.createOscillator();
      const gain = audioKeepAlive.createGain();
      gain.gain.value = 0;
      osc.connect(gain); gain.connect(audioKeepAlive.destination);
      osc.start();
      audioKeepAlive._osc = osc;
    } catch (_) {}
  }
  function stopKeepAlive() {
    try { audioKeepAlive?._osc?.stop(); audioKeepAlive?.close(); audioKeepAlive = null; } catch (_) {}
  }

  // ─── Feed ───────────────────────────────────────────────────────────────
  function getFeed() {
    return document.querySelector('div[role="feed"]')
        || document.querySelector('div.m6QErb[aria-label]');
  }

  // ─── Cards currently in DOM ───────────────────────────────────────────────
  function getCards() {
    let cards = [...document.querySelectorAll('div[role="feed"] div.Nv2PK')];
    if (!cards.length) {
      cards = [...document.querySelectorAll('div[role="feed"] a.hfpxzc')]
        .map(a => a.closest('div') || a);
    }
    return cards;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARSE A CARD
  // ═══════════════════════════════════════════════════════════════════════════
  function parseCard(card) {
    const d = {
      name:'', category:'', rating:'', reviews:'', phone:'',
      email:'', website:'', address:'', hours:'', plusCode:'', mapsUrl:'',
    };

    const link = card.querySelector('a.hfpxzc') || card.querySelector('a[href*="/maps/place/"]');
    if (link) {
      d.mapsUrl = link.href.split('?')[0];
      const al = link.getAttribute('aria-label');
      if (al) d.name = al.trim();
    }
    if (!d.name) {
      d.name = (card.querySelector('.qBF1Pd')?.textContent
             || card.querySelector('.fontHeadlineSmall')?.textContent || '').trim();
    }

    d.rating = (card.querySelector('span.MW4etd')?.textContent || '').trim();

    let rev = (card.querySelector('span.UY7F9')?.textContent || '').replace(/[(),\s]/g,'').trim();
    if (!rev) {
      const star = card.querySelector('span[role="img"][aria-label*="star"], span[aria-label*="star"]');
      const m = star?.getAttribute('aria-label')?.match(/([\d,]+)\s*review/i);
      if (m) rev = m[1].replace(/,/g,'');
    }
    d.reviews = rev;

    // Parse W4Efsd info rows — exclude the rating/review row
    const infoText = [];
    card.querySelectorAll('.W4Efsd').forEach(el => {
      if (el.querySelector('.W4Efsd')) return;          // skip wrapper rows
      if (el.querySelector('.MW4etd, .UY7F9')) return;  // skip rating/review row
      const t = el.textContent.replace(/\s+/g,' ').trim();
      if (t) infoText.push(t);
    });

    const segs = infoText.join(' · ').split('·').map(s => s.trim()).filter(Boolean);

    for (const seg of segs) {
      if (!d.category && seg.length < 45 && !/^\d/.test(seg) &&
          !/^(open|closed|opens|closes|24 hours|temporarily)/i.test(seg) &&
          !/\d{4,}/.test(seg)) {
        d.category = seg; continue;
      }
      if (!d.phone && /(\+?\d[\d\s\-()]{7,})/.test(seg) && /\d{5,}/.test(seg.replace(/[\s\-()]/g,''))) {
        const pm = seg.match(/(\+?\d[\d\s\-()]{7,}\d)/);
        if (pm) { d.phone = pm[1].trim(); continue; }
      }
      if (!d.address &&
          (/\d/.test(seg) || /(road|street|st\b|ave|nagar|colony|society|floor|shop|lane|marg|rd\b|sector|block|plaza|tower|complex|building)/i.test(seg)) &&
          !/^(open|closed|opens|closes)/i.test(seg) && !/^(\+?\d[\d\s\-()]{7,}\d)$/.test(seg)) {
        d.address = seg; continue;
      }
    }

    const webLink = card.querySelector('a[data-value="Website"], a[aria-label*="Visit"]');
    if (webLink && webLink.href && !webLink.href.includes('google.com')) d.website = webLink.href;

    return d.name ? d : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Scroll + harvest cards AS DATA
  // ═══════════════════════════════════════════════════════════════════════════
  async function harvestCards() {
    const feed = getFeed();
    if (!feed) return [];

    const byKey = new Map();

    const sweep = () => {
      for (const card of getCards()) {
        const data = parseCard(card);
        if (!data) continue;
        const key = data.mapsUrl || ('name:' + data.name.toLowerCase().replace(/\s+/g,' ').trim());
        const existing = byKey.get(key);
        if (!existing) byKey.set(key, data);
        else mergeInto(existing, data);
      }
    };

    sweep();

    let stale = 0, prev = 0;
    for (let i = 0; i < 100; i++) {
      if (STOP) break;
      if (byKey.size >= CFG.limit) break;

      const end = [...feed.querySelectorAll('span.HlvSq, p.fontBodyMedium')]
        .some(el => /reached the end/i.test(el.textContent));
      if (end) break;

      feed.scrollBy(0, 1000);
      await sleep(950);
      sweep();

      const hlog = `Phase 1 — scrolling & reading cards… ${byKey.size} found`;
      post('PROGRESS', { current: byKey.size, total: CFG.limit, log: hlog, phase: 1 });
      setRunState({ running:true, phase:1, current:byKey.size, total:CFG.limit, log:hlog });

      if (byKey.size === prev) {
        stale++;
        if (stale === 3) { feed.scrollTop = feed.scrollHeight; await sleep(1400); sweep(); }
        if (stale >= 6) break;
      } else stale = 0;
      prev = byKey.size;
    }

    return [...byKey.values()].slice(0, CFG.limit);
  }

  function mergeInto(t, s) { for (const k of Object.keys(s)) if (!t[k] && s[k]) t[k] = s[k]; }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: deep-enrich cards missing website/phone
  // ═══════════════════════════════════════════════════════════════════════════
  async function deepEnrich(item) {
    if (!item.mapsUrl) return;
    window.history.pushState({}, '', item.mapsUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));

    let waited = 0;
    while (waited < 6000) {
      if (document.querySelector('h1.DUwDvf, h1.fontHeadlineLarge')) break;
      await sleep(300); waited += 300;
    }
    await sleep(400);

    document.querySelectorAll('button[data-item-id], a[data-item-id]').forEach(btn => {
      const id  = btn.getAttribute('data-item-id') || '';
      const val = (btn.querySelector('.Io6YTe, .fontBodyMedium, .rogA2c')?.textContent || '').trim();
      if (!item.website && id === 'authority')             item.website  = btn.getAttribute('href') || val;
      if (!item.phone   && /^phone/.test(id))              item.phone    = val;
      if (!item.address && /^(address|laddress)/.test(id)) item.address  = val;
      if (!item.plusCode && /plus_code/.test(id))          item.plusCode = val;
    });

    if (!item.category)
      item.category = (document.querySelector('button.DkEaL')?.textContent || '').trim();
    if (!item.reviews) {
      const rl = document.querySelector('div.F7nice span[aria-label]')?.getAttribute('aria-label') || '';
      const m = rl.match(/([\d,]+)\s*review/i);
      if (m) item.reviews = m[1].replace(/,/g,'');
    }
    if (!item.rating)
      item.rating = (document.querySelector('div.F7nice span[aria-hidden="true"]')?.textContent || '').trim();

    if (CFG.getHours && !item.hours) {
      const rows = [];
      document.querySelectorAll('table.eK4R0e tr').forEach(tr => {
        const c = tr.querySelectorAll('td');
        if (c.length >= 2) rows.push(`${c[0].textContent.trim()}: ${c[1].textContent.trim()}`);
      });
      item.hours = rows.join(' | ');
    }
  }

  // ─── Email from website ───────────────────────────────────────────────────
  async function fetchEmail(url) {
    if (!url) return '';
    try {
      if (!url.startsWith('http')) url = 'https://' + url;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return '';
      const html = await r.text();
      const all = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
      const BAD = ['example','sentry','w3.org','schema','wix.com','wordpress','shopify',
                   'google','cloudflare','jquery','amazon','facebook','twitter','instagram',
                   'cdn.','jsdelivr','unpkg','bootstrap','noreply','no-reply'];
      const ok = all.filter(e => { const l = e.toLowerCase();
        return e.split('@')[0].length > 2 && !BAD.some(b => l.includes(b)); });
      const base = url.replace(/https?:\/\/(www\.)?/,'').split('/')[0].split('.').slice(-2,-1)[0] || '';
      return ok.find(e => base && e.includes(base)) || ok[0] || '';
    } catch (_) { return ''; }
  }

  function passes(d) {
    if (CFG.minRating > 0 && d.rating && parseFloat(d.rating) < CFG.minRating) return false;
    if (CFG.needPhone   && !d.phone)   return false;
    if (CFG.needWebsite && !d.website) return false;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN
  // ═══════════════════════════════════════════════════════════════════════════
  async function run() {
    if (!getFeed()) {
      post('ERROR', { message: 'No results list found. Search a business category on Google Maps first (e.g. "interior designers in Pune").' });
      return;
    }

    RUNNING = true;
    startKeepAlive();
    setRunState({ running:true, phase:1, current:0, total:CFG.limit, log:'Phase 1 — collecting business cards…' });

    try {
      post('PROGRESS', { current:0, total:CFG.limit, log:'Phase 1 — collecting business cards…', phase:1 });
      const items = CFG.autoScroll ? await harvestCards()
                                   : getCards().map(parseCard).filter(Boolean).slice(0, CFG.limit);

      if (STOP) { finish(); return; }
      if (!items.length) {
        post('ERROR', { message: 'No business cards found. Make sure the list of results is visible on the left side of Google Maps.' });
        finish(); return;
      }

      post('PHASE1_DONE', { count: items.length });

      let saved = 0;
      const total = items.length;

      for (let i = 0; i < total; i++) {
        if (STOP) break;
        const it = items[i];
        const needEnrich = CFG.deepScrape && (!it.website || !it.phone);

        const log = needEnrich
          ? `Phase 2 — enriching ${i+1}/${total} (${saved} saved)`
          : `Saving ${i+1}/${total} (${saved} saved)`;
        post('PROGRESS', { current:i+1, total, log, phase:2 });
        setRunState({ running:true, phase:2, current:i+1, total, log });

        if (needEnrich) await deepEnrich(it);
        if (CFG.emailScrape && it.website && !it.email) it.email = await fetchEmail(it.website);

        if (!passes(it)) continue;

        persistResult(it);          // write to storage first (survives popup close)
        post('RESULT', { data: it }); // then notify popup if open
        saved++;
        await sleep(needEnrich ? CFG.delay : 25);
      }

      finish();
    } catch (err) {
      post('ERROR', { message: err.message });
      finish();
    }
  }

  function finish() {
    RUNNING = false;
    STOP = false;
    stopKeepAlive();
    setRunState({ running:false, phase:0, current:0, total:0, log:'Done' });
    post('DONE', {});
  }

})();
