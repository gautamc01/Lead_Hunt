# 📍 MapsExtract Pro v4.0

Professional Google Maps lead extractor — Chrome Extension (Manifest V3).

## What changed in v4.0 (the fix)

**v3 was slow and incomplete** because it navigated to each business URL one-by-one (38 page loads = only 5-10% scraped before timing out).

**v4 reads data directly from the result cards while scrolling** — exactly how the top-rated tools (Instant Data Scraper) work. This is dramatically faster and captures every listing.

- **Phase 1**: Scroll the results panel, parse each card as it appears (name, category, rating, reviews, phone, address, Maps URL). Virtual-DOM-proof.
- **Phase 2**: Only opens individual listings that are *missing* a website or phone (enrichment). Most data is already captured in Phase 1.

## Data fields
Name · Category · Rating · Reviews · Phone · Email · Website · Address · Hours · Plus Code · Maps URL

## Install
1. Unzip the folder
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top-right)
4. Click **Load unpacked** → select the `maps-scraper` folder

## Use
1. Open [google.com/maps](https://www.google.com/maps)
2. Search a category: `"interior designers in Pune"`
3. Wait for the list to appear on the left
4. Click the 📍 extension → **Start Scraping**

## Tips for best results
- Google Maps caps each search at ~120 results. For more, search narrower areas.
- Turn OFF "Deep scrape" for fastest results (loses website/email enrichment).
- Turn OFF "Email extraction" if you only need Maps data — it's the slowest step.

## Features
- 4 tabs: Scrape · Leads (sortable table) · Email Draft (AI) · Settings
- AI email drafting per lead (4 templates, 4 tones)
- CSV + JSON export with column selection
- Smart filters (min rating, require phone/website)
- Search & sort leads table

## Folder structure
```
maps-scraper/
├── manifest.json
├── popup.html
├── icons/ (16, 48, 128)
└── src/
    ├── content.js     (scraping engine)
    ├── popup.js       (UI + AI email)
    └── background.js  (message relay)
```
