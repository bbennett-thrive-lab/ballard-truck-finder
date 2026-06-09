# Ballard Truck Finder

A static prototype for a better Ballard food truck tracker. It opens directly in a browser and is designed around source freshness, venue coverage, and fast discovery.

## What is included

- Date filters for today, tomorrow, this week, and all known schedule items.
- An "open now" toggle.
- Venue coverage status so verified data and future adapters are not mixed together.
- Food truck directory with next stop, last seen, known venues, and source links.
- Saved trucks using browser local storage.
- A source-adapter plan for turning this into a live aggregator.

## Current data

The schedule is generated from venue calendars and homepage schedule widgets. Stoup and Urban Family are parsed from public calendar pages. Yonder Cider x Bale Breaker is parsed from the Squarespace calendar API behind `https://www.bbycballard.com/food-trucks-1-1`. Obec is parsed as a today-only homepage truck. Lucky Envelope is parsed from its homepage Food Truck Schedule carousel. Reuben's stays in coverage as a kitchen source and does not emit truck schedule entries.

## Refresh the schedule

Install dependencies once:

```bash
npm install
```

Refresh the local static data:

```bash
npm run scrape
```

The scraper writes `data/schedule.json` and `data/sources.json`. Each adapter emits this shape:

```json
{
  "date": "2026-06-08",
  "start": "17:00",
  "end": "20:00",
  "truck": "Where Ya At Matt",
  "cuisine": "New Orleans",
  "venue": "Stoup Brewing - Ballard",
  "sourceStatus": "live",
  "source": "https://www.stoupbrewing.com/ballard/",
  "tags": ["Po' boys", "Cajun", "Dinner"]
}
```

Run parser fixture tests:

```bash
npm test
```

Build the static public site:

```bash
npm run build
```

Run the full deployment check:

```bash
npm run deploy:check
```

The BBYC/Yonder page is a Squarespace calendar block. The scraper reads its `GetItemsByMonth` calendar endpoint directly, which is more reliable than launching a browser for the rendered page.

## Publish on GitHub Pages

This project is ready to publish as a static GitHub Pages site. The deployable artifact is generated into `dist/` and contains only public files: `index.html`, `styles.css`, `app.js`, `assets/`, and `data/`.

1. Push this folder to a GitHub repository.
2. In the repository settings, open Pages.
3. Set the build and deployment source to GitHub Actions.
4. Push to the `main` branch or run the "Deploy GitHub Pages" workflow manually.

The GitHub Actions workflow also runs every day at 16:30 UTC, which is 9:30 AM Pacific during daylight time. Each scheduled run installs dependencies, runs tests, refreshes the schedule data, builds `dist/`, verifies the artifact, and deploys the updated static site. Refreshed JSON is deployed in the Pages artifact and is not committed back to the repository.

## Open it

Serve the folder locally and open the URL in a browser:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.
