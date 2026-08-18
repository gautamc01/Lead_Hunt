# LeadHunt — Product Thinking

Architecture decisions, design rationale, and the reasoning behind every major choice in this extension.

---

## The problem it solves

Sales teams and agency founders spend hours manually searching Google Maps, copying business names, finding phone numbers, switching to email, writing pitches from scratch. LeadHunt compresses that workflow into minutes — scrape, classify, pitch, send.

---

## Core architecture decisions

### 1. Why a Chrome Extension (not a web app or SaaS)?

Google Maps requires a real browser session. Headless scrapers get blocked almost immediately. A content script running inside the user's own Chrome session looks identical to normal browsing — same cookies, same IP, same user agent. No proxy costs, no CAPTCHA solving, no infrastructure to maintain.

### 2. The virtual DOM problem (and how it was solved)

Google Maps uses virtual scrolling. As you scroll the results panel, cards that go off-screen are **removed from the DOM entirely**. Early versions tried to collect all cards after scrolling — this only captured 5 to 10% of results because most cards had already been removed.

**The fix: two-phase architecture**

- **Phase 1** — Harvest URLs and card data *during* scrolling. Every card that briefly appears in the DOM gets its data read and stored in a `Map`. By the time scrolling ends, all leads are captured regardless of whether the card still exists in the DOM.
- **Phase 2** — Navigate to only the cards that are missing website or phone (optional enrichment). Most data is already captured in Phase 1, so Phase 2 is minimal.

This is the same approach used by top-rated scraping tools like Instant Data Scraper.

### 3. Why the scraper lives in the content script, not the popup

Chrome popups close the moment you click away. If the scraper ran inside the popup, switching tabs would kill it. Moving all scraping state to the content script means:

- The scraper runs independently of the popup
- You can switch tabs freely during a scrape
- The popup reconnects on reopen by pinging the content script (`PING_STATE`)
- Results are written to `chrome.storage` immediately, so nothing is lost even if Chrome crashes

### 4. Why chrome.storage (not localStorage or sessionStorage)

- Persists across popup open/close cycles
- Accessible from both the popup and the content script
- Survives browser restarts
- The content script writes directly to storage — the popup reads from it. This makes storage the single source of truth and prevents duplicates.

### 5. Why a silent Web Audio context for background tabs

Chrome heavily throttles `setTimeout` in background tabs — timers can slow to 1/10th speed. A silent Web Audio context (gain set to 0, inaudible) keeps the tab in a less-throttled state, maintaining consistent scroll speed and timing even when the Maps tab is not focused.

---

## The pitch model

### Why rule-based instead of LLM-first?

An LLM call adds 2 to 5 seconds of latency, costs API credits, requires an internet connection, and fails silently when the API is down. For a tool used in bulk outreach, speed and reliability matter more than marginal quality improvement.

The rule-based model classifies businesses into 19 segments using regex pattern matching on the category string. For each segment it:

1. Knows the primary pain point (e.g. restaurants need more diners, clinics need patient acquisition)
2. Selects the 3 most relevant services
3. Adapts the opening hook based on available signals:
   - High rating with many reviews: leads with social proof angle
   - No website listed: leads with missed opportunity angle
   - Low rating: leads with reputation management angle
4. Builds the email body from structured templates

This produces a genuinely personalised email in under 50ms with zero API cost.

The Anthropic API is available as an optional enhancement — if the user pastes a key, the model's classification is used to enrich the AI prompt, making the AI output significantly better targeted than a generic prompt would be.

### The 19 segments

Restaurant, Beauty and Grooming, Healthcare, Fitness, Interior Design, Real Estate, Retail, Hospitality, Legal and Professional, Education, Home Services, Automotive, B2B and Manufacturing, Tech and Software, Events and Creative, Financial Services, Logistics, NGO, and a catch-all fallback.

---

## WhatsApp architecture

WhatsApp Web does not expose a public API. The only reliable way to pre-fill a message is the `wa.me` deep link:

```
https://web.whatsapp.com/send?phone=COUNTRYCODE+NUMBER&text=ENCODED_MESSAGE
```

This opens WhatsApp Web in a new tab with the chat pre-loaded and the message typed in the input field. The user just hits send.

File attachments cannot be passed via URL. The extension handles this by showing a clear instruction — after WhatsApp Web opens, click the paperclip icon and select the file. The file is previewed inside the extension so the user knows exactly what to attach.

Phone number normalisation handles the messy formats that Google Maps returns — spaces, dashes, missing country codes, leading zeros — and converts them all to the `+91XXXXXXXXXX` format WhatsApp requires.

---

## UI decisions

### Why 460px wide?

Chrome enforces a maximum popup width. 460px is the practical limit before Chrome clips or scrolls the popup. The entire layout is designed around this constraint.

### Why warm neutrals instead of cold greys?

Most developer tools default to blue-grey palettes. A warm sand (`#F5F4F0`) and warm charcoal (`#141210`) palette with a red-orange accent (`#D5552A`) makes the tool feel distinct, warmer, and more like a product designed for sales people rather than developers.

### Why Plus Jakarta Sans?

It has genuine personality at display sizes (the 800 weight wordmark) while remaining clean and legible at 11px caption sizes. Most system fonts feel generic at small sizes. Plus Jakarta Sans maintains clarity across the full scale used in the extension.

### Why Lucide instead of emoji or other icon sets?

Emoji render inconsistently across operating systems and Chrome versions. A custom icon font adds a network request. Lucide SVGs are inline, render identically on every platform, respect colour inheritance via `currentColor`, and have a consistent 2px stroke weight that matches the overall UI weight.

### No em-dashes

Em-dashes look wrong in certain fonts at small sizes, break line wrapping in tight containers, and feel typographically heavy for UI copy. All separators use colons, commas, or plain hyphens.

---

## What was built iteratively

1. Basic card scraper — broke on virtual DOM
2. URL-harvest approach — fixed virtual DOM but slow (38 page loads)
3. Card-data harvest during scroll (Phase 1) — correct architecture, fast
4. Deep scrape enrichment only for missing fields (Phase 2) — right balance
5. Background tab keep-alive — fixed scrape stopping on tab switch
6. Storage as source of truth — fixed popup reconnect after close
7. Pitch model — 4 templates, 4 tones, 19 segments
8. WhatsApp tab — pre-filled messages, phone normalisation, bulk queue, attachments
9. Full design system — Plus Jakarta Sans, Lucide icons, warm palette
10. Public release cleanup — removed all hardcoded brand references

---

## Known limitations

- Google Maps caps each search at approximately 120 results. For more, search narrower areas.
- Google Maps updates its DOM selectors occasionally. The scraper uses multiple fallback selectors per field, but a Maps UI update may require selector patches in `content.js`.
- Email extraction depends on the business website exposing emails in plain HTML. JavaScript-rendered contact pages are not crawled.
- WhatsApp file attachment requires manual action after WhatsApp Web opens — this is a WhatsApp API limitation, not a bug.
