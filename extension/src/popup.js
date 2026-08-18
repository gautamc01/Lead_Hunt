// popup.js - LeadHunt
'use strict';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const ALL_COLS = [
  { key:'name',     label:'Business Name', on:true  },
  { key:'category', label:'Category',      on:true  },
  { key:'rating',   label:'Rating',        on:true  },
  { key:'reviews',  label:'Reviews',       on:true  },
  { key:'phone',    label:'Phone',         on:true  },
  { key:'email',    label:'Email',         on:true  },
  { key:'website',  label:'Website',       on:true  },
  { key:'address',  label:'Address',       on:true  },
  { key:'hours',    label:'Hours',         on:false },
  { key:'plusCode', label:'Plus Code',     on:false },
  { key:'mapsUrl',  label:'Maps URL',      on:false },
];
let colState = {};
ALL_COLS.forEach(c => colState[c.key] = c.on);

// ─── App state ───────────────────────────────────────────────────────────────
let results    = [];
let filtered   = [];
let sortCol    = '';
let sortDir    = 'asc';
let searchQ    = '';
let isRunning  = false;
let activeTone = 'professional';
let activeTpl  = 'intro';
let senderName = '', senderCompany = '', senderService = '';
const SENDER_KEY = 'mep_sender';

// ─── Boot ────────────────────────────────────────────────────────────────────
(async () => {
  buildColGrid();
  loadSenderDefaults();
  loadApiKey();
  await loadStorage();
  bindAll();
  watchStorage();
  await reconnectIfRunning();
})();

// ─── Reconnect to an in-progress scrape when popup re-opens ───────────────────
async function reconnectIfRunning() {
  // 1) Read the last persisted run-state
  const state = await new Promise(res =>
    chrome.storage.local.get(['mepRunState'], d => res(d.mepRunState)));

  // 2) Ask the content script directly if it is still running
  let liveRunning = false;
  try {
    const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
    if (tab?.url?.match(/google\.com\/maps/)) {
      const resp = await chrome.tabs.sendMessage(tab.id, { type:'PING_STATE' }).catch(()=>null);
      liveRunning = !!resp?.running;
    }
  } catch (_) {}

  if (liveRunning) {
    // Scrape is still going - restore the running UI
    setRunning(true);
    if (state) {
      const pct = state.total ? Math.min(100, Math.round((state.current/state.total)*100)) : 0;
      $('progBar').style.width = pct + '%';
      $('progPct').textContent = pct + '%';
      $('progLog').textContent = state.log || 'Scraping in progress…';
      if (state.phase === 1) { $('ph1').className='prog-phase active-phase'; $('ph2').className='prog-phase'; setStatus('phase1','Phase 1: Collecting URLs...'); }
      else if (state.phase === 2) { $('ph1').className='prog-phase done-phase'; $('ph2').className='prog-phase active-phase'; setStatus('phase2','Phase 2: Extracting lead data...'); }
    } else {
      setStatus('phase1','Scraping in progress…');
    }
    showAlert('info','Scrape is still running in the Maps tab. You can keep this open to watch progress.');
  } else {
    setStatus(results.length ? 'ready' : 'idle',
      results.length ? `${results.length} leads loaded from last session`
                     : 'Open Google Maps, search a category, then click Start');
  }
}

// ─── Watch storage for results written by the content script ──────────────────
// This is the backup channel: even if the popup was closed during a result,
// it shows up here when the popup reopens or stays open in background.
function watchStorage() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.mepResults) {
      const next = changes.mepResults.newValue || [];
      if (next.length !== results.length) {
        results = next;
        refreshAll();
      }
    }
    if (changes.mepRunState) {
      const st = changes.mepRunState.newValue;
      if (st && st.running && !isRunning) setRunning(true);
      if (st && !st.running && isRunning)  setRunning(false);
    }
  });
}

// ─── Column checkbox grid ────────────────────────────────────────────────────
function buildColGrid() {
  $('colGrid').innerHTML = ALL_COLS.map(c => `
    <label class="col-lbl">
      <input type="checkbox" data-col="${c.key}" ${c.on ? 'checked' : ''}/>
      ${c.label}
    </label>`).join('');
  $('colGrid').querySelectorAll('input').forEach(el =>
    el.addEventListener('change', () => { colState[el.dataset.col] = el.checked; }));
}

// ─── Persist / load ──────────────────────────────────────────────────────────
async function loadStorage() {
  return new Promise(res => {
    chrome.storage.local.get(['mepResults'], d => {
      if (d.mepResults?.length) {
        results = d.mepResults;
        refreshAll();
        setStatus('ready', `${results.length} leads loaded from last session`);
      }
      res();
    });
  });
}
function save() { chrome.storage.local.set({ mepResults: results }); }

function loadSenderDefaults() {
  try {
    const s = JSON.parse(localStorage.getItem(SENDER_KEY) || '{}');
    $('senderCompany').value = senderCompany = s.company || '';
    $('senderService').value = senderService = s.service || '';
    if (s.name) { $('senderName').value = senderName = s.name; }
  } catch(_){}
}
function saveSenderDefaults() {
  senderName    = $('senderName').value.trim();
  senderCompany = $('senderCompany').value.trim();
  senderService = $('senderService').value.trim();
  try { localStorage.setItem(SENDER_KEY, JSON.stringify({name:senderName,company:senderCompany,service:senderService})); } catch(_){}
}

// ─── API key (stored locally on this device only) ─────────────────────────────
const APIKEY_KEY = 'mep_apikey';
function getApiKey() {
  try { return localStorage.getItem(APIKEY_KEY) || ''; } catch(_) { return ''; }
}
function loadApiKey() {
  const k = getApiKey();
  if ($('apiKey')) $('apiKey').value = k;
  updateApiKeyStatus(k);
}
function saveApiKey() {
  const k = ($('apiKey').value || '').trim();
  try {
    if (k) localStorage.setItem(APIKEY_KEY, k);
    else   localStorage.removeItem(APIKEY_KEY);
  } catch(_){}
  updateApiKeyStatus(k);
  copyText(k ? 'API key saved' : 'Key cleared. Using templates');
}
function updateApiKeyStatus(k) {
  const el = $('apiKeyStatus'); if (!el) return;
  if (k && k.startsWith('sk-ant-')) { el.textContent = '✓ AI generation enabled'; el.style.color = 'var(--grn)'; }
  else if (k)                       { el.textContent = '⚠ Key looks invalid (should start with sk-ant-)'; el.style.color = 'var(--amb)'; }
  else                              { el.textContent = 'Using smart templates'; el.style.color = 'var(--ink3)'; }
  // Reflect on the Generate button label
  const btn = $('btnGenerate');
  if (btn) btn.innerHTML = (k && k.startsWith('sk-ant-'))
    ? '✨&nbsp; Generate with AI'
    : '✨&nbsp; Generate Email Draft';
}

// ─── Bind events ─────────────────────────────────────────────────────────────
function bindAll() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // Start / Stop
  $('btnStart').addEventListener('click', startScrape);
  $('btnStop').addEventListener('click', stopScrape);

  // Export
  ['btnCSV','btnCSV2'].forEach(id => $(id)?.addEventListener('click', exportCSV));
  ['btnJSON','btnJSON2'].forEach(id => $(id)?.addEventListener('click', exportJSON));

  // Clear
  $('btnClear').addEventListener('click', clearResults);
  $('btnNukeClear').addEventListener('click', clearResults);

  // Search
  $('searchInput').addEventListener('input', () => { searchQ = $('searchInput').value; applyFilter(); renderTable(); });

  // Table sort (delegated)
  document.querySelector('#tableWrap').addEventListener('click', e => {
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    const col = th.dataset.col;
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortCol = col; sortDir = 'asc'; }
    applyFilter();
    renderTable();
  });

  // Email tab
  $('leadPicker').addEventListener('change', onLeadPick);
  document.querySelectorAll('.tpl-card').forEach(c =>
    c.addEventListener('click', () => {
      document.querySelectorAll('.tpl-card').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      activeTpl = c.dataset.tpl;
    }));
  document.querySelectorAll('.tone-btn').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.tone-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      activeTone = b.dataset.tone;
    }));
  $('btnGenerate').addEventListener('click', generateDraft);
  $('btnCopySubject').addEventListener('click', () => copyText($('draftSubject').value));
  $('btnCopyAll').addEventListener('click', () =>
    copyText(`Subject: ${$('draftSubject').value}\n\n${$('draftBody').value}`));
  $('btnMailto').addEventListener('click', openMailto);
  $('btnEmailAll').addEventListener('click', () => switchTab('email'));

  // Sender fields - auto-save
  ['senderName','senderCompany','senderService'].forEach(id =>
    $(id).addEventListener('blur', saveSenderDefaults));

  // API key
  $('btnSaveKey')?.addEventListener('click', saveApiKey);
  $('apiKey')?.addEventListener('input', () => updateApiKeyStatus(($('apiKey').value||'').trim()));
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'leads')     renderTable();
  if (name === 'email')     populateLeadPicker();
  if (name === 'whatsapp')  initWhatsAppTab();
}

// ─── Chrome messaging ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'RESULT') {
    // The content script already persisted this to storage. Pull the latest
    // from storage rather than pushing here, to avoid double-counting.
    chrome.storage.local.get(['mepResults'], d => {
      results = d.mepResults || results;
      refreshAll();
    });
  }
  if (msg.type === 'PROGRESS') {
    const pct = Math.min(100, Math.round((msg.current / msg.total) * 100));
    $('progBar').style.width = pct + '%';
    $('progPct').textContent = pct + '%';
    $('progLog').textContent = msg.log || '';
    if (msg.phase === 1) {
      $('ph1').className = 'prog-phase active-phase';
      $('ph2').className = 'prog-phase';
      setStatus('phase1', 'Phase 1: Collecting listing URLs...');
    } else if (msg.phase === 2) {
      $('ph1').className = 'prog-phase done-phase';
      $('ph2').className = 'prog-phase active-phase';
      setStatus('phase2', 'Phase 2: Extracting lead data...');
    }
  }
  if (msg.type === 'PHASE1_DONE') {
    $('ph1').className = 'prog-phase done-phase';
    showAlert('info', `Phase 1 complete: ${msg.count} listing URLs collected. Extracting data...`);
  }
  if (msg.type === 'DONE') {
    setRunning(false);
    $('ph1').className = 'prog-phase done-phase';
    $('ph2').className = 'prog-phase done-phase';
    $('progBar').style.width = '100%';
    $('progPct').textContent = '100%';
    $('progLog').textContent = `Done! ${results.length} unique leads extracted.`;
    setStatus('done', `Done: ${results.length} leads extracted`);
    showAlert('succ', `Scraping complete. ${results.length} leads saved. Export with CSV or JSON below.`);
  }
  if (msg.type === 'ERROR') {
    setRunning(false);
    setStatus('error', 'Error');
    showAlert('warn', msg.message);
  }
});

// ─── Start / Stop ─────────────────────────────────────────────────────────────
async function startScrape() {
  hideAlert();
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  if (!tab?.url?.match(/google\.com\/maps/)) {
    showAlert('warn', 'Navigate to Google Maps and search for a business category first (e.g. "restaurants in Pune").');
    return;
  }
  try {
    await chrome.scripting.executeScript({ target:{ tabId:tab.id }, files:['src/content.js'] });
  } catch(_) { /* already injected */ }

  const opts = {
    autoScroll:  $('oScroll').checked,
    deepScrape:  $('oDeep').checked,
    emailScrape: $('oEmail').checked,
    getHours:    $('oHours').checked,
    limit:       +$('oLimit').value  || 200,
    delay:       +$('oDelay').value  || 600,
    minRating:   +$('oMinRating').value || 0,
    needPhone:   $('oNeedPhone').checked,
    needWebsite: $('oNeedWeb').checked,
  };
  // Don't start a second scrape if one is already running in this tab
  const ping = await chrome.tabs.sendMessage(tab.id, { type:'PING_STATE' }).catch(()=>null);
  if (ping?.running) {
    showAlert('info','A scrape is already running in this tab. Watch its progress here.');
    setRunning(true);
    return;
  }

  const resp = await chrome.tabs.sendMessage(tab.id, { type:'START_SCRAPING', options:opts }).catch(()=>null);
  if (resp && resp.ok === false && resp.reason === 'already_running') {
    showAlert('info','A scrape is already running in this tab.');
    setRunning(true);
    return;
  }
  setRunning(true);
  $('progBar').style.width = '0%';
  $('progPct').textContent = '0%';
  $('progLog').textContent = 'Starting…';
  $('ph1').className = 'prog-phase';
  $('ph2').className = 'prog-phase';
}

async function stopScrape() {
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type:'STOP_SCRAPING' }).catch(()=>{});
  setRunning(false);
  setStatus('idle', `Stopped. ${results.length} leads saved`);
}

// ─── UI state ─────────────────────────────────────────────────────────────────
function setRunning(v) {
  isRunning = v;
  $('btnStart').disabled = v;
  $('btnStop').disabled  = !v;
}

function setStatus(state, text) {
  $('sDot').className = 'sdot ' + state;
  $('statusText').textContent = text;
}

function showAlert(type, msg) {
  $('alertBox').className = 'alert ' + type;
  $('alertMsg').textContent = msg;
}
function hideAlert() { $('alertBox').className = 'alert hidden'; }

// ─── Refresh all UI ───────────────────────────────────────────────────────────
function refreshAll() {
  // Stats
  $('s0').textContent = results.length;
  $('s1').textContent = results.filter(r => r.email).length;
  $('s2').textContent = results.filter(r => r.phone).length;
  $('s3').textContent = results.filter(r => r.website).length;

  // Live list
  renderLiveList();

  // Footer
  $('footStat').textContent = `${results.length} records saved`;
  $('liveCount').textContent = results.length + ' entries';

  // Button states
  const has = results.length > 0;
  ['btnCSV','btnCSV2','btnJSON','btnJSON2','btnClear','btnEmailAll'].forEach(id => {
    const el = $(id); if (el) el.disabled = !has;
  });
  // Sync pickers on other tabs if visible
  if ($('waPicker') && $('tab-whatsapp')?.classList.contains('active')) populateWaPicker();
}

function renderLiveList() {
  const list = $('liveList');
  if (!results.length) {
    list.innerHTML = '<div class="empty-state">No results yet - start scraping</div>';
    return;
  }
  list.innerHTML = [...results].reverse().slice(0, 30).map(r => `
    <div class="r-item">
      <div class="r-name">${esc(r.name || '-')}</div>
      <div class="r-meta">
        ${r.rating  ? `<span class="tag star">⭐ ${esc(r.rating)}</span>` : ''}
        ${r.phone   ? `<span class="tag phone">📞 ${esc(r.phone)}</span>` : ''}
        ${r.email   ? `<span class="tag email">✉ ${esc(r.email)}</span>` : ''}
        ${r.website ? `<span class="tag web">🌐 ${esc(shortUrl(r.website))}</span>` : ''}
        ${r.category? `<span class="tag">${esc(r.category)}</span>` : ''}
      </div>
    </div>`).join('');
}

// ─── Table rendering ──────────────────────────────────────────────────────────
function applyFilter() {
  const q = searchQ.toLowerCase();
  filtered = results.filter(r =>
    !q || ['name','phone','email','address','category','website']
      .some(k => (r[k]||'').toLowerCase().includes(q))
  );
  if (sortCol) {
    filtered.sort((a,b) => {
      const av = (a[sortCol]||'').toString().toLowerCase();
      const bv = (b[sortCol]||'').toString().toLowerCase();
      const n  = sortDir === 'asc' ? 1 : -1;
      return av < bv ? -n : av > bv ? n : 0;
    });
  }
  $('tableStat').textContent = `${filtered.length} of ${results.length} records`;
}

function renderTable() {
  applyFilter();
  const wrap = $('tableWrap');
  if (!results.length) {
    wrap.innerHTML = '<div class="no-data">Run a scrape first to see leads here.</div>';
    return;
  }
  const cols = ALL_COLS.filter(c => colState[c.key]);
  const sortHead = col => {
    let cls = '';
    if (sortCol === col) cls = sortDir === 'asc' ? 'sort-asc' : 'sort-desc';
    return cls;
  };

  wrap.innerHTML = `
    <table>
      <thead><tr>
        ${cols.map(c => `<th data-col="${c.key}" class="${sortHead(c.key)}">${c.label}</th>`).join('')}
        <th>Actions</th>
      </tr></thead>
      <tbody>
        ${filtered.map((r,i) => `
          <tr>
            ${cols.map(c => {
              let val = r[c.key] || '-';
              if (c.key === 'email' && r.email) val = `<span class="pill pill-green">${esc(r.email)}</span>`;
              else if (c.key === 'phone' && r.phone) val = `<span class="pill pill-green">${esc(r.phone)}</span>`;
              else if (c.key === 'rating' && r.rating) val = `⭐ ${esc(r.rating)}`;
              else if (c.key === 'website' && r.website)
                val = `<a href="${esc(r.website)}" target="_blank" style="color:var(--brand);text-decoration:none">${esc(shortUrl(r.website))}</a>`;
              else val = esc(val);
              return `<td title="${esc(r[c.key]||'')}">${val}</td>`;
            }).join('')}
            <td>
              <button class="btn btn-purple btn-sm" onclick="draftFor(${i})" style="padding:3px 8px;font-size:9px">✉</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ─── Clear results ────────────────────────────────────────────────────────────
function clearResults() {
  if (!confirm('Delete all scraped leads? This cannot be undone.')) return;
  results = []; filtered = [];
  chrome.storage.local.remove(['mepResults','mepRunState']);
  refreshAll();
  renderTable();
  $('progBar').style.width = '0%';
  $('progPct').textContent = '0%';
  $('progLog').textContent = 'Waiting to start…';
  $('ph1').className = 'prog-phase';
  $('ph2').className = 'prog-phase';
  populateLeadPicker();
  setStatus('idle', 'Data cleared');
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportCSV() {
  if (!results.length) return;
  const cols = ALL_COLS.filter(c => colState[c.key]);
  const q = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const lines = [
    cols.map(c => q(c.label)).join(','),
    ...results.map(r => cols.map(c => q(r[c.key]??'')).join(','))
  ];
  download(lines.join('\r\n'), 'text/csv', `mapsextract_${ts()}.csv`);
}
function exportJSON() {
  if (!results.length) return;
  const cols = ALL_COLS.filter(c => colState[c.key]);
  const out  = results.map(r => {
    const o = {}; cols.forEach(c => o[c.key] = r[c.key]||''); return o;
  });
  download(JSON.stringify(out, null, 2), 'application/json', `mapsextract_${ts()}.json`);
}
function download(content, mime, name) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content],{type:mime})),
    download: name,
  });
  a.click();
}
const ts = () => new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');

// ─── Lead picker (Email tab) ──────────────────────────────────────────────────
function populateLeadPicker() {
  const sel = $('leadPicker');
  sel.innerHTML = '<option value="">- Select a scraped lead -</option>' +
    results.map((r,i) => `<option value="${i}">${esc(r.name || 'Lead ' + (i+1))}</option>`).join('');
}

function onLeadPick() {
  const i = $('leadPicker').value;
  if (i === '') { $('leadInfoCard').style.display='none'; return; }
  const r = results[+i];
  if (!r) return;
  $('leadInfoCard').style.display = 'flex';
  $('li-name').textContent   = r.name    || '-';
  $('li-cat').textContent    = r.category|| '-';
  $('li-rating').textContent = r.rating  ? `⭐ ${r.rating} (${r.reviews||0} reviews)` : '-';
  $('li-phone').textContent  = r.phone   || '-';
  $('li-email').textContent  = r.email   || '-';
  $('li-addr').textContent   = r.address || '-';

  // Show what the pitch model detected for this lead
  if (window.PitchModel) {
    const seg = window.PitchModel.classify(r.category);
    const svc = seg.services.map(k => window.PitchModel.SERVICES[k]?.name).filter(Boolean).slice(0,3);
    $('li-segment').textContent  = seg.label + ': ' + seg.pain.split(' ').slice(0,7).join(' ') + '...';
    $('li-services').textContent = svc.join(' · ');
  }
}

// Called from table ✉ button
window.draftFor = function(rowIdx) {
  const r = filtered[rowIdx];
  if (!r) return;
  const globalIdx = results.indexOf(r);
  switchTab('email');
  populateLeadPicker();
  $('leadPicker').value = globalIdx;
  onLeadPick();
};

// ─── Generate email draft (AI-powered via Anthropic API) ────────────────────
async function generateDraft() {
  const idx = $('leadPicker').value;
  if (idx === '') { showAlert('warn','Please select a lead first.'); return; }
  const lead = results[+idx];
  if (!lead) return;

  saveSenderDefaults();
  const name    = senderName    || 'Our team';
  const company = senderCompany || 'Our Company';
  const service = senderService || 'digital marketing services';

  $('draftBox').style.display = 'block';

  const apiKey = (getApiKey() || '').trim();

  // ── PRIMARY: use the built-in Pitch Model (no API key needed) ──
  if (!apiKey) {
    const pitch = window.PitchModel.generatePitch(lead, { name, company }, {
      template: activeTpl, tone: activeTone,
    });
    $('draftSubject').value = pitch.subject;
    $('draftBody').value    = pitch.body;
    hideAlert();
    return;
  }

  // ── Key present → real AI generation ──
  $('draftSubject').value = '';
  $('draftBody').value    = '';
  const existing = $('genOverlay'); if (existing) existing.remove();
  $('draftBox').querySelector('.draft-hdr').insertAdjacentHTML('afterend',
    `<div class="generating-overlay" id="genOverlay"><span class="spin">⟳</span> Generating with AI…</div>`);

  // Enrich the AI prompt with the model's classification + service catalogue
  const seg = window.PitchModel.classify(lead.category);
  const recServices = seg.services.map(k => window.PitchModel.SERVICES[k]?.name).filter(Boolean);

  const tplDesc = {
    intro:  'a warm cold-outreach introduction to a potential client',
    audit:  'an offer for a free 30-minute growth audit',
    review: 'a pitch focused on reputation and online visibility',
    collab: 'a business partnership proposal',
  }[activeTpl] || 'an introduction email';

  const prompt = `You are an expert B2B sales copywriter for ${company}, a digital marketing agency.

Write ${tplDesc} on behalf of ${name} from ${company}.

LEAD:
- Business: ${lead.name}
- Category: ${lead.category || 'unknown'}
- Rating: ${lead.rating ? lead.rating + ' stars (' + (lead.reviews||0) + ' reviews)' : 'not available'}
- Website: ${lead.website || 'None listed'}
- Phone: ${lead.phone || 'n/a'}

OUR ANALYSIS OF THIS LEAD:
- They are a "${seg.label}" whose main need is: ${seg.pain}
- Most relevant services to pitch (in priority order): ${recServices.join(', ')}

REQUIREMENTS:
- Tone: ${activeTone}
- Open with a hook specific to this business (use rating if high, or the missing website if they have none)
- Pitch the 3 most relevant services above for their business type
- Subject under 60 characters, punchy
- Body max 160 words, short paragraphs
- Offer a free 30-minute growth audit as the CTA
- Use the real names - NO placeholders like [Your Name]

Respond ONLY with valid JSON, no markdown:
{"subject":"...","body":"..."}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role:'user', content: prompt }]
      })
    });

    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try { const e = await resp.json(); detail = e.error?.message || detail; } catch(_){}
      throw new Error(detail);
    }

    const data = await resp.json();
    const raw  = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = raw.replace(/```json|```/g,'').trim();
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch(_) {
      const subj = clean.match(/"subject"\s*:\s*"([^"]+)"/)?.[1] || `Following up from ${company}`;
      const body = clean.match(/"body"\s*:\s*"([\s\S]+?)"\s*}/)?.[1]?.replace(/\\n/g,'\n') || clean;
      parsed = { subject: subj, body };
    }

    $('genOverlay')?.remove();
    $('draftSubject').value = parsed.subject || '';
    $('draftBody').value    = (parsed.body || '').replace(/\\n/g,'\n');
    hideAlert();

  } catch(err) {
    $('genOverlay')?.remove();
    // Fall back to the built-in pitch model + explain why
    const pitch = window.PitchModel.generatePitch(lead, { name, company }, {
      template: activeTpl, tone: activeTone,
    });
    $('draftSubject').value = pitch.subject;
    $('draftBody').value    = pitch.body;
    const msg = /401|invalid|authentication/i.test(err.message)
      ? 'API key rejected. Showing a template draft instead. Check key in Settings.'
      : `AI unavailable (${err.message}). Showing a template draft instead.`;
    showAlert('info', msg);
  }
}

function buildFallbackDraft(lead, name, company, service) {
  const tplMap = {
    intro: {
      subject: `Quick question for ${lead.name}`,
      body: `Hi ${lead.name} team,

I came across your business on Google Maps and was impressed by your ${lead.rating ? lead.rating + '-star rating' : 'work'} in the ${lead.category || 'industry'}.

I'm ${name} from ${company}. We specialize in ${service} and work with local businesses to help them grow their online presence and convert more customers.

I'd love to share a few ideas tailored specifically for ${lead.name}. Would you be open to a quick 15-minute call this week?

Best regards,
${name}
${company}`
    },
    audit: {
      subject: `Free digital audit for ${lead.name}`,
      body: `Hi ${lead.name} team,

I noticed your business on Google Maps and wanted to reach out with something valuable - a completely free digital audit for ${lead.name}.

At ${company}, we offer ${service}. We've helped similar ${lead.category || 'local'} businesses identify quick wins that increased their online leads within 30 days.

No strings attached. Just a 20-minute review of your digital presence with actionable suggestions. Interested?

Warm regards,
${name}
${company}`
    },
    review: {
      subject: `Grow ${lead.name}'s reviews & reputation`,
      body: `Hi ${lead.name} team,

Your ${lead.rating ? lead.rating + '-star rating' : 'Google presence'} caught my eye - you've clearly built a great business. We help ${lead.category || 'local'} businesses like yours turn happy customers into more 5-star reviews consistently.

At ${company}, we offer ${service} that has helped our clients double their review count in 60 days.

I'd love to show you how it works. Can we connect for 15 minutes?

Best,
${name}
${company}`
    },
    collab: {
      subject: `Partnership opportunity: ${company} x ${lead.name}`,
      body: `Hi ${lead.name} team,

I'm ${name} from ${company}. We provide ${service} and are always looking to partner with outstanding local businesses. ${lead.name} fits perfectly.

I'd love to explore how we can create mutual value for each other's clients. It could be a referral arrangement, a co-marketing initiative, or something else entirely.

Would you have 20 minutes for a quick intro call?

Best,
${name}
${company}`
    },
  };
  return tplMap[activeTpl] || tplMap.intro;
}

// ─── Copy / Mailto ────────────────────────────────────────────────────────────
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    const notif = $('copyNotif');
    notif.classList.add('show');
    setTimeout(() => notif.classList.remove('show'), 1800);
  });
}

function openMailto() {
  const subj = encodeURIComponent($('draftSubject').value);
  const body = encodeURIComponent($('draftBody').value);
  const idx  = $('leadPicker').value;
  const to   = idx !== '' ? encodeURIComponent(results[+idx]?.email || '') : '';
  window.open(`mailto:${to}?subject=${subj}&body=${body}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function shortUrl(u) {
  try { return new URL(u).hostname.replace('www.',''); }
  catch(_) { return u.slice(0,30); }
}

// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP MODULE
// ═══════════════════════════════════════════════════════════════════════════

let waLeadIdx  = '';       // currently selected lead index
let waTpl      = 'intro';  // selected message template
let waTone     = 'friendly'; // selected tone
let waAttach   = null;     // { name, size, type, dataUrl }
let waBulkMode = false;

// ── Initialise WhatsApp tab when switched to ──────────────────────────────
function initWhatsAppTab() {
  populateWaPicker();
  renderWaBulk();
}

function populateWaPicker() {
  const sel = $('waPicker');
  sel.innerHTML = '<option value="">- Select a scraped lead -</option>' +
    results.map((r,i) => `<option value="${i}">${esc(r.name || 'Lead '+(i+1))}${r.phone?' ✓':' (no phone)'}</option>`).join('');
}

// ── Lead picker change ────────────────────────────────────────────────────
$('waPicker')?.addEventListener('change', () => {
  waLeadIdx = $('waPicker').value;
  if (waLeadIdx === '') {
    $('waPhone').value = '';
    $('waNoPhone').classList.add('hidden');
    $('btnWaSend').disabled = true;
    $('btnWaBulk').disabled = results.filter(r=>r.phone).length === 0;
    return;
  }
  const lead = results[+waLeadIdx];
  if (!lead) return;
  const cleaned = cleanPhone(lead.phone || '');
  $('waPhone').value = cleaned || '';
  $('waNoPhone').classList.toggle('hidden', !!cleaned);
  $('waPhoneSub').textContent = cleaned ? 'Ready to send' : 'Enter a number to proceed';
  $('btnWaSend').disabled = !cleaned;
  $('btnWaBulk').disabled = false;
  // Auto-generate message
  autoGenerateWaMsg();
});

// ── Phone input manual edit ───────────────────────────────────────────────
$('waPhone')?.addEventListener('input', () => {
  const v = cleanPhone($('waPhone').value);
  $('btnWaSend').disabled = !v;
  $('waPhoneSub').textContent = v ? `✓ ${v}` : 'Enter number with country code (e.g. +91 98330 65209)';
});

// ── Template & tone buttons ───────────────────────────────────────────────
document.querySelectorAll('[data-wa-tpl]').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-wa-tpl]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    waTpl = b.dataset.waTpl;
    autoGenerateWaMsg();
  }));
document.querySelectorAll('[data-wa-tone]').forEach(b =>
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-wa-tone]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    waTone = b.dataset.waTone;
    autoGenerateWaMsg();
  }));

// ── Generate button ───────────────────────────────────────────────────────
$('btnWaGenerate')?.addEventListener('click', autoGenerateWaMsg);

// ── Clear ─────────────────────────────────────────────────────────────────
$('btnWaClear')?.addEventListener('click', () => { $('waMessage').value = ''; updateCharCount(); });

// ── Char counter ─────────────────────────────────────────────────────────
$('waMessage')?.addEventListener('input', updateCharCount);
function updateCharCount() {
  const n = ($('waMessage').value || '').length;
  $('waMsgChars').textContent = n + ' chars';
  $('waMsgChars').style.color = n > 1000 ? 'var(--amber)' : 'var(--muted)';
}

// ── Send on WhatsApp ──────────────────────────────────────────────────────
$('btnWaSend')?.addEventListener('click', sendWhatsApp);

function sendWhatsApp() {
  const phone = cleanPhone($('waPhone').value);
  if (!phone) { showAlert('warn','Enter a valid phone number with country code (e.g. +91 9833065209)'); return; }

  const msg = ($('waMessage').value || '').trim();
  if (!msg) { showAlert('warn','Please generate or type a message before sending.'); return; }

  const url = buildWaUrl(phone, msg);

  // If there's an attachment, show the reminder
  if (waAttach) {
    $('attachReadyBox').classList.remove('hidden');
    showAlert('info','WhatsApp Web is opening. After it loads, click 📎 in the chat to attach your file.');
  }

  chrome.tabs.create({ url, active: true });
}

function buildWaUrl(phone, msg) {
  const num = phone.replace(/[^\d+]/g,'').replace(/^\+/,'');
  const encoded = encodeURIComponent(msg);
  return `https://web.whatsapp.com/send?phone=${num}&text=${encoded}`;
}

// ── Auto-generate WhatsApp message from PitchModel ─────────────────────────
function autoGenerateWaMsg() {
  if (waLeadIdx === '' || !window.PitchModel) return;
  const lead = results[+waLeadIdx];
  if (!lead) return;

  saveSenderDefaults();
  const pitch = window.PitchModel.generatePitch(lead,
    { name: senderName || 'Our team', company: senderCompany || 'Our Company' },
    { template: waTpl, tone: waTone }
  );

  // WhatsApp version: shorter, no subject, emoji-friendly
  const waMsg = buildWaMessage(lead, pitch, waTone);
  $('waMessage').value = waMsg;
  updateCharCount();
}

function buildWaMessage(lead, pitch, tone) {
  const name    = senderName    || 'Our team';
  const company = senderCompany || 'Our Company';

  // WhatsApp-optimised: shorter, uses bold (*text*), emojis, conversational
  const greeting = tone === 'friendly' ? `Hey ${lead.name} team! 👋` : `Hi ${lead.name} team,`;

  // Build a 3-line hook from the pitch body first paragraph
  const bodyLines = pitch.body.split('\n').filter(l => l.trim() && !l.startsWith('•') && !l.includes('Best regards') && !l.includes('Best,') && !l.includes('Cheers,') && l !== company && l !== name);
  const hook = bodyLines[1] || ''; // line after greeting
  const value = bodyLines[2] || '';

  const svcLine = pitch.services.slice(0,3).map(s => `✅ ${s}`).join('\n');

  let msg;
  if (tone === 'concise') {
    msg =
`${greeting}

${hook}

We can help with:
${svcLine}

Free 30-min audit, no obligation.
Call or reply: ${name}, ${company}`;
  } else {
    msg =
`${greeting}

${hook}

${value}

We help with:
${svcLine}

We've helped 150+ brands grow 📈 - happy to offer *${lead.name}* a *free 30-min growth audit*.

Interested? Just reply here 🙏
- ${name}, ${company}`;
  }

  return msg.trim();
}

// ── Attachment handling ───────────────────────────────────────────────────
const attachFile = $('attachFile');
const attachZone = $('attachZone');

attachFile?.addEventListener('change', e => handleAttachFile(e.target.files[0]));

attachZone?.addEventListener('dragover', e => { e.preventDefault(); attachZone.classList.add('drag-over'); });
attachZone?.addEventListener('dragleave', () => attachZone.classList.remove('drag-over'));
attachZone?.addEventListener('drop', e => {
  e.preventDefault();
  attachZone.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  if (file) handleAttachFile(file);
});

$('btnRemoveAttach')?.addEventListener('click', removeAttach);

function handleAttachFile(file) {
  if (!file) return;
  const MAX = 64 * 1024 * 1024;
  if (file.size > MAX) { showAlert('warn','File too large. WhatsApp supports up to 64 MB.'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    waAttach = { name: file.name, size: file.size, type: file.type, dataUrl: e.target.result };
    $('attachZone').classList.add('hidden');
    $('attachedFile').classList.remove('hidden');
    $('attachedName').textContent = file.name;
    $('attachedSize').textContent = formatBytes(file.size);
    $('attachedIcon').textContent = fileIcon(file.type);
    $('attachNote').style.display = 'block';
    $('attachReadyBox').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function removeAttach() {
  waAttach = null;
  $('attachZone').classList.remove('hidden');
  $('attachedFile').classList.add('hidden');
  $('attachNote').style.display = 'none';
  $('attachReadyBox').classList.add('hidden');
  if (attachFile) attachFile.value = '';
}

function fileIcon(type) {
  if (/image/.test(type)) return '🖼️';
  if (/pdf/.test(type)) return '📄';
  if (/word|document/.test(type)) return '📝';
  if (/sheet|excel/.test(type)) return '📊';
  if (/presentation|powerpoint/.test(type)) return '📑';
  if (/zip|rar/.test(type)) return '🗜️';
  return '📎';
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  return (b/1024/1024).toFixed(1) + ' MB';
}

// ── Bulk queue ────────────────────────────────────────────────────────────
$('btnWaBulk')?.addEventListener('click', () => {
  waBulkMode = !waBulkMode;
  $('waBulkWrap').style.display = waBulkMode ? 'block' : 'none';
  $('btnWaBulk').textContent = waBulkMode ? '✕ Close Queue' : '📋 Bulk Queue';
  if (waBulkMode) renderWaBulk();
});

function renderWaBulk() {
  const leads = results.filter(r => r.phone);
  $('waBulkCount').textContent = `${leads.length} leads with phone`;
  $('waBulkList').innerHTML = !leads.length
    ? '<div style="padding:8px;font-size:10.5px;color:var(--muted)">No leads with phone numbers scraped yet.</div>'
    : leads.map((r,i) => `
      <div class="wa-bulk-item" id="wb-${i}">
        <span class="wa-bulk-name">${esc(r.name)}</span>
        <span class="wa-bulk-phone">${cleanPhone(r.phone) || r.phone}</span>
        <button class="btn btn-wa btn-sm" style="flex:0 0 auto;padding:3px 9px;font-size:10px"
          onclick="waBulkSend(${results.indexOf(r)})">Send</button>
      </div>`).join('');
}

window.waBulkSend = function(idx) {
  const lead = results[idx];
  if (!lead) return;
  const phone = cleanPhone(lead.phone || '');
  if (!phone) return;
  const pitch = window.PitchModel.generatePitch(lead,
    {name: senderName || 'Our team', company: senderCompany || 'Our Company'},
    {template:waTpl, tone:waTone});
  const msg = buildWaMessage(lead, pitch, waTone);
  chrome.tabs.create({ url: buildWaUrl(phone, msg), active: true });
};

// ── Phone number normalisation ────────────────────────────────────────────
function cleanPhone(raw) {
  if (!raw) return '';
  // Remove all non-digit/plus chars for processing
  let digits = raw.replace(/[^\d+]/g,'');
  // If starts with 0 (Indian mobile), replace with +91
  if (digits.startsWith('0') && digits.length >= 10) digits = '+91' + digits.slice(1);
  // If no country code and looks like 10-digit Indian number, prepend +91
  if (!digits.startsWith('+') && digits.length === 10 && /^[6-9]/.test(digits)) digits = '+91' + digits;
  // Must have at least 10 digits (excluding +)
  if (digits.replace('+','').length < 10) return '';
  return digits;
}
