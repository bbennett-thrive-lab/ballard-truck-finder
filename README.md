# Ballard Truck Finder

A static prototype for a better Ballard food truck tracker. It opens directly in a browser and is designed around source freshness, venue coverage, and fast discovery.

Live site: https://bbennett-thrive-lab.github.io/ballard-truck-finder/

## What is included

- Schedule, venue map, and truck directory sections on one screen with date filters for today, tomorrow, this week, and all known schedule items.
- Freshness warnings when an update fails or the last verification is older than 36 hours. Obec's homepage truck is valid only for its Seattle calendar date.
- Venue coverage status so verified data and future adapters are not mixed together.
- Food truck directory with search, truck-level favorites, next stop, last seen, known venues, and source links.
- Seattle-timezone comparisons for Today, event status, and the hero recommendation. Stale data is never promoted as tonight's recommendation.
- A map beside the schedule on desktop and a return-to-results link on mobile.

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

Refreshes run concurrently with a 15-second timeout and one retry per venue. A successful empty result is treated as authoritative. If one venue fails, its last successful entries are retained for up to 60 days and marked stale; if every rotating source fails, the existing JSON is left untouched and the refresh exits with an error.

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

The GitHub Actions workflow also runs every day at 16:17 UTC, which is 9:17 AM Pacific during daylight time and 8:17 AM during standard time. It uses Seattle's timezone while parsing dates. Each scheduled run installs dependencies, runs tests, refreshes the schedule data, builds `dist/`, verifies the artifact, commits accepted JSON back to `main` with `[skip ci]`, and deploys the updated static site. Saving the refresh keeps a last-known-good baseline and regular repository activity. Deployment checks reject a build when every rotating schedule is older than 36 hours. Source failures appear in the workflow summary and on the site.

## Open it

Serve the folder locally and open the URL in a browser:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.
