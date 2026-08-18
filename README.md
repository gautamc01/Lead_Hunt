# LeadHunt

A Chrome Extension that extracts business leads from Google Maps and helps you send personalised cold outreach via email and WhatsApp.

---

## What it does

- Scrapes Google Maps search results for business leads
- Extracts name, category, rating, reviews, phone, email, website, address, hours, Maps URL
- Generates personalised cold-outreach emails using a built-in pitch model (no API key needed)
- Sends pre-filled WhatsApp messages with one click
- Exports all leads to CSV or JSON

---

## Features

| Feature | Detail |
|---|---|
| Smart scraping | Two-phase virtual DOM-proof scraping engine |
| Pitch model | Classifies 19 business types and tailors the pitch |
| Email drafts | 4 templates x 4 tones, generated instantly |
| WhatsApp outreach | Pre-filled messages with bulk queue |
| File attachments | Attach PDFs, images to WhatsApp messages |
| Export | CSV and JSON with configurable columns |
| No API key needed | Built-in model works offline |

---

## Install

1. Download `leadhunt-final.zip` and extract it
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `maps-scraper` folder (the one containing `manifest.json`)
6. Pin LeadHunt from the Chrome toolbar

---

## How to use

1. Go to [google.com/maps](https://google.com/maps)
2. Search a business category — e.g. `interior designers in Pune`
3. Wait for the list panel to appear on the left
4. Click the LeadHunt icon and hit **Start Scraping**
5. Switch to the **Email** or **WhatsApp** tab to send outreach

---

## Repo structure

```
Lead_Hunt/
├── extension/              Full working extension source
│   ├── manifest.json
│   ├── popup.html          All UI and CSS
│   ├── icons/
│   └── src/
│       ├── popup.js        UI logic, exports, email/WA generation
│       ├── content.js      Scraping engine (runs inside Maps tab)
│       ├── pitchModel.js   Rule-based pitch classifier
│       └── background.js   Service worker
├── leadhunt-final.zip      Ready-to-install extension
├── design-system.html      Full design system reference
├── color-palette.html      Colour palette
├── case-study.html         Product case study
├── product-thinking.md     Architecture and decision rationale
└── README.md
```

---

## Tech stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (zero dependencies)
- Plus Jakarta Sans — Google Fonts
- Lucide Icons — SVG inline
- No build tools, no npm

---

## Design system

- **Font:** Plus Jakarta Sans (400 / 500 / 600 / 700 / 800)
- **Brand colour:** `#D5552A` warm red-orange
- **Background:** `#F5F4F0` warm sand
- **Ink:** `#141210` warm charcoal
- **Icons:** Lucide SVG, 14px tabs, 16px buttons, 13px inline

---

## License

MIT — free to use, modify, and distribute.
