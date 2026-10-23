import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const fixtureNow = "2026-10-22T19:00:00.000Z";

function isoDate(offset = 0) {
  const date = new Date(fixtureNow);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function loadAppDom({ stale = false, endedOnly = false, expired = false, verificationAgeHours = 0, brokenJson = false, aliases = false, storedFavorites = [] } = {}) {
  const html = await readFile(join(rootDir, "index.html"), "utf8");
  const script = await readFile(join(rootDir, "app.js"), "utf8");
  const schedule = [
    {
      date: isoDate(),
      start: "17:00",
      end: "20:00",
      truck: "Today Taco",
      venue: "Urban Family Brewing",
      address: "1103 NW 52nd St",
      cuisine: "Mexican",
      tags: ["Tacos"],
      source: "https://example.test/today",
      sourceType: "venue_calendar",
      sourceStatus: "live",
      confidence: "fixture",
      lastScrapedAt: new Date().toISOString(),
      notes: []
    },
    {
      date: isoDate(1),
      start: "17:00",
      end: "20:00",
      truck: "Thai Tomorrow",
      venue: "Stoup Brewing - Ballard",
      address: "1108 NW 52nd St",
      cuisine: "Thai",
      tags: ["Thai"],
      source: "https://example.test/tomorrow",
      sourceType: "venue_calendar",
      sourceStatus: "live",
      confidence: "fixture",
      lastScrapedAt: new Date().toISOString(),
      notes: []
    },
    {
      date: isoDate(-2),
      start: "16:00",
      end: "19:00",
      truck: "Future Falafel",
      venue: "Urban Family Brewing",
      address: "1103 NW 52nd St",
      cuisine: "Mediterranean",
      tags: ["Falafel"],
      source: "https://example.test/falafel-past",
      sourceType: "venue_calendar",
      sourceStatus: "live",
      confidence: "fixture",
      truckUrl: "https://example.test/future-falafel",
      menuUrl: "https://example.test/future-falafel/menu",
      lastScrapedAt: new Date().toISOString(),
      notes: []
    },
    {
      date: isoDate(3),
      start: "17:00",
      end: "20:00",
      truck: "Future Falafel",
      venue: "Stoup Brewing - Ballard",
      address: "1108 NW 52nd St",
      cuisine: "Mediterranean",
      tags: ["Falafel", "Vegetarian"],
      source: "https://example.test/falafel-future",
      sourceType: "venue_calendar",
      sourceStatus: "live",
      confidence: "fixture",
      truckUrl: "https://example.test/future-falafel",
      menuUrl: "https://example.test/future-falafel/menu",
      lastScrapedAt: new Date().toISOString(),
      notes: []
    },
    {
      date: isoDate(-4),
      start: "16:00",
      end: "19:00",
      truck: "Past Pies",
      venue: "Lucky Envelope Brewing",
      address: "907 NW 50th Street",
      cuisine: "Pie",
      tags: ["Dessert"],
      source: "https://example.test/pies",
      sourceType: "venue_calendar",
      sourceStatus: "live",
      confidence: "fixture",
      lastScrapedAt: new Date().toISOString(),
      notes: []
    },
    {
      date: isoDate(),
      start: "16:30",
      end: "19:30",
      truck: "Lucky Dumplings",
      venue: "Lucky Envelope Brewing",
      address: "907 NW 50th Street",
      cuisine: "Dim sum",
      tags: ["Dumplings"],
      source: "https://example.test/lucky",
      sourceType: "venue_calendar",
      sourceStatus: "live",
      confidence: "fixture",
      lastScrapedAt: new Date().toISOString(),
      notes: []
    }
  ];
  const sources = {
    generatedAt: fixtureNow,
    venues: [
      {
        id: "urban-family",
        name: "Urban Family Brewing",
        address: "1103 NW 52nd St",
        sourceStatus: "live",
        source: "https://example.test/source"
      },
      {
        id: "lucky-envelope",
        name: "Lucky Envelope Brewing",
        address: "907 NW 50th Street",
        sourceStatus: "live",
        source: "https://example.test/lucky"
      },
      {
        id: "reubens",
        name: "Reuben's Brews",
        address: "5010 14th Ave NW",
        sourceStatus: "permanent_food",
        source: "https://example.test/reubens",
        foodUrl: "https://example.test/reubens/menu"
      },
      {
        id: "fair-isle",
        name: "Fair Isle Brewing",
        address: "936 NW 49th St",
        sourceStatus: "permanent_food",
        source: "https://example.test/fair-isle",
        foodUrl: "https://example.test/fair-isle/menu"
      },
      {
        id: "great-notion-ballard",
        name: "Great Notion Ballard",
        address: "5101 14th Ave NW Ste. 101",
        sourceStatus: "permanent_food",
        source: "https://example.test/great-notion",
        foodUrl: "https://example.test/great-notion/food"
      }
    ]
  };
  schedule.forEach((entry) => { entry.lastScrapedAt = fixtureNow; });
  if (aliases) {
    schedule.push({ ...schedule[0], truck: "Kaosamai Thai" }, { ...schedule[0], truck: "Kaosamai" });
  }
  if (expired || verificationAgeHours) {
    const previousUpdate = new Date(Date.parse(fixtureNow) - (expired ? 72 : verificationAgeHours) * 60 * 60 * 1000).toISOString();
    sources.generatedAt = previousUpdate;
    sources.venues.forEach((venue) => { venue.dataStatus = "fresh"; venue.lastSuccessfulAt = previousUpdate; });
    schedule.forEach((entry) => { entry.dataStatus = "fresh"; entry.lastScrapedAt = previousUpdate; });
  }
  if (stale) {
    schedule[0].dataStatus = "stale";
    sources.dataStatus = "partial";
    sources.lastSuccessfulAt = fixtureNow;
    sources.venues.find((venue) => venue.id === "urban-family").dataStatus = "stale";
  }
  if (endedOnly) {
    schedule.splice(0, schedule.length, {
      date: isoDate(),
      start: "00:00",
      end: "00:00",
      truck: "Ended Taco",
      venue: "Urban Family Brewing",
      address: "1103 NW 52nd St",
      cuisine: "Mexican",
      tags: ["Tacos"],
      source: "https://example.test/ended",
      sourceType: "venue_calendar",
      sourceStatus: "live",
      confidence: "fixture",
      notes: []
    });
  }
  const dom = new JSDOM(html, {
    url: "http://127.0.0.1:4173/",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  const BrowserDate = dom.window.Date;
  let clock = fixtureNow;
  dom.setClock = (iso) => { clock = iso; };
  dom.window.Date = class extends BrowserDate {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return new BrowserDate(clock).getTime(); }
  };
  dom.window.setInterval = (callback) => { dom.refreshClock = callback; return 0; };
  dom.window.localStorage.setItem("favoriteTrucksV1", JSON.stringify(storedFavorites));
  dom.window.fetch = async (url) => ({
    ok: true,
    json: async () => {
      if (brokenJson && url.includes("schedule")) throw new SyntaxError("Invalid JSON");
      return url.includes("schedule") ? schedule : sources;
    }
  });
  dom.window.console.warn = () => {};
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return dom;
}

function directoryCardByTitle(document, title) {
  return [...document.querySelectorAll(".directory-card")].find((card) => card.querySelector("h3").textContent === title);
}

test("frontend loads generated JSON and filters schedule", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;
  assert.equal(document.querySelector("#resultCount").textContent, "2 trucks");
  assert.deepEqual(
    [...document.querySelectorAll(".truck-card h3")].map((heading) => heading.textContent).sort(),
    ["Lucky Dumplings", "Today Taco"]
  );

  document.querySelector('[data-filter="tomorrow"]').click();
  assert.equal(document.querySelector("#scheduleTitle").textContent, "Tomorrow");
  assert.equal(document.querySelector(".truck-card h3").textContent, "Thai Tomorrow");
});

test("frontend filters schedule by venue row and clears with all venues", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  document.querySelector('[data-venue-id="lucky-envelope"]').click();
  assert.equal(document.querySelector("#resultCount").textContent, "1 truck");
  assert.equal(document.querySelector(".truck-card h3").textContent, "Lucky Dumplings");
  assert.ok(document.querySelector('[data-venue-id="lucky-envelope"]').classList.contains("is-selected"));

  document.querySelector(".all-venues-button").click();
  assert.equal(document.querySelector("#resultCount").textContent, "2 trucks");
  assert.ok(document.querySelector(".all-venues-button").classList.contains("is-active"));
});

test("frontend renders venue names as source website links", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;
  const link = document.querySelector('[data-venue-id="lucky-envelope"] .venue-link');

  assert.equal(link.textContent, "Lucky Envelope Brewing");
  assert.equal(link.href, "https://example.test/lucky");
  assert.equal(link.target, "_blank");
  assert.equal(link.getAttribute("rel"), "noreferrer");
});

test("frontend venue links do not trigger venue filtering", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  document.querySelector('[data-venue-id="lucky-envelope"] .venue-link').click();
  assert.equal(document.querySelector("#resultCount").textContent, "2 trucks");
  assert.equal(document.querySelector('[data-venue-id="lucky-envelope"]').classList.contains("is-selected"), false);
});

test("frontend venue rows can be selected with keyboard", async () => {
  const dom = await loadAppDom();
  const { document, KeyboardEvent } = dom.window;
  const row = document.querySelector('[data-venue-id="lucky-envelope"]');

  row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.equal(document.querySelector("#resultCount").textContent, "1 truck");
  assert.ok(document.querySelector('[data-venue-id="lucky-envelope"]').classList.contains("is-selected"));

  document.querySelector('[data-venue-id="lucky-envelope"]').dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
  assert.equal(document.querySelector("#resultCount").textContent, "2 trucks");
  assert.equal(document.querySelector('[data-venue-id="lucky-envelope"]').classList.contains("is-selected"), false);
});

test("frontend clears selected venue by clicking the active venue row again", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  document.querySelector('[data-venue-id="lucky-envelope"]').click();
  assert.equal(document.querySelector("#resultCount").textContent, "1 truck");
  assert.ok(document.querySelector('[data-venue-id="lucky-envelope"]').classList.contains("is-selected"));

  document.querySelector('[data-venue-id="lucky-envelope"]').click();
  assert.equal(document.querySelector("#resultCount").textContent, "2 trucks");
  assert.equal(document.querySelector('[data-venue-id="lucky-envelope"]').classList.contains("is-selected"), false);
});

test("frontend shows selected venue chip and clears venue filter from the chip", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  document.querySelector('[data-venue-id="lucky-envelope"]').click();
  const chip = document.querySelector(".selected-venue-chip");
  assert.equal(chip.textContent.replace(/\s+/g, " ").trim(), "Venue: Lucky Envelope Brewingx");
  assert.equal(chip.getAttribute("aria-label"), "Clear venue filter");

  chip.click();
  assert.equal(document.querySelector("#resultCount").textContent, "2 trucks");
  assert.equal(document.querySelector("#selectedVenueFilter").textContent.trim(), "");
  assert.ok(document.querySelector(".all-venues-button").classList.contains("is-active"));
});

test("frontend renders venue select buttons instead of source labels", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;
  const venueText = [...document.querySelectorAll(".venue-row")].map((row) => row.textContent.replace(/\s+/g, " ").trim());
  const buttons = [...document.querySelectorAll(".venue-select-button")];

  assert.equal(buttons.length, 5);
  assert.ok(buttons.every((button) => button.textContent === "Select"));
  assert.ok(venueText.some((text) => text.includes("Reuben's Brews") && text.includes("5010 14th Ave NW") && text.includes("Select")));
  assert.equal(venueText.some((text) => text.includes("Verified source")), false);
  assert.equal(venueText.some((text) => text.includes("Onsite food")), false);
});

test("frontend venue select buttons filter and clear venues", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  document.querySelector('[data-venue-id="lucky-envelope"] .venue-select-button').click();
  assert.equal(document.querySelector("#resultCount").textContent, "1 truck");
  assert.equal(document.querySelector('[data-venue-id="lucky-envelope"] .venue-select-button').textContent, "Selected");
  assert.ok(document.querySelector('[data-venue-id="lucky-envelope"] .venue-select-button').classList.contains("is-selected"));

  document.querySelector('[data-venue-id="lucky-envelope"] .venue-select-button').click();
  assert.equal(document.querySelector("#resultCount").textContent, "2 trucks");
  assert.equal(document.querySelector('[data-venue-id="lucky-envelope"] .venue-select-button').textContent, "Select");
});

test("frontend selected onsite food venues render menu cards", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  document.querySelector('[data-venue-id="reubens"] .venue-select-button').click();
  const card = document.querySelector(".truck-card");
  const link = card.querySelector(".source-link");

  assert.equal(document.querySelector("#resultCount").textContent, "0 trucks");
  assert.equal(document.querySelectorAll(".truck-card").length, 1);
  assert.equal(card.querySelector("h3").textContent, "Onsite food");
  assert.equal(card.querySelector(".source-badge").textContent, "Onsite food");
  assert.equal(card.querySelector(".meta").textContent, "Reuben's Brews | 5010 14th Ave NW");
  assert.equal(link.textContent, "Menu");
  assert.equal(link.href, "https://example.test/reubens/menu");
  assert.equal([...document.querySelectorAll(".truck-card h3")].some((heading) => heading.textContent === "Reuben's Brews"), false);
});

test("frontend onsite food cards remain visible when selected", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  document.querySelector('[data-venue-id="fair-isle"] .venue-select-button').click();

  assert.equal(document.querySelector("#resultCount").textContent, "0 trucks");
  assert.equal(document.querySelector(".truck-card h3").textContent, "Onsite food");
  assert.equal(document.querySelector(".truck-card .meta").textContent, "Fair Isle Brewing | 936 NW 49th St");
  assert.equal(document.querySelector(".truck-card .source-link").href, "https://example.test/fair-isle/menu");
});

test("frontend keeps El Camion out of tracked venues", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  assert.equal(document.querySelector('[data-venue-id="el-camion-ballard"]'), null);
  assert.equal([...document.querySelectorAll(".venue-row")].some((row) => row.textContent.includes("El Camion Ballard")), false);
});

test("frontend renders unique trucks in the directory", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  assert.equal(document.querySelector("#directoryCount").textContent, "6 trucks");
  assert.deepEqual(
    [...document.querySelectorAll(".directory-card h3")].map((heading) => heading.textContent).sort(),
    ["El Camion Ballard", "Future Falafel", "Lucky Dumplings", "Past Pies", "Thai Tomorrow", "Today Taco"]
  );
});

test("frontend shows El Camion as a directory-only permanent truck", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;
  const card = directoryCardByTitle(document, "El Camion Ballard");
  const text = card.textContent.replace(/\s+/g, " ").trim();

  assert.ok(text.includes("Permanent truck"));
  assert.ok(text.includes("Permanent Ballard truck"));
  assert.ok(text.includes("Not schedule-tracked"));
  assert.ok(text.includes("Directory only"));
  assert.equal(card.querySelector(".directory-links a").href, "https://www.myballard.com/2024/11/11/el-camion-food-truck-is-back-in-ballard/");
  assert.equal(card.querySelector(".known-stops-button").disabled, true);
  assert.equal([...document.querySelectorAll(".truck-card h3")].some((heading) => heading.textContent === "El Camion Ballard"), false);
  assert.equal(document.querySelector("#resultCount").textContent, "2 trucks");
});

test("frontend shows last seen and next scheduled stops in the directory", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;
  const card = directoryCardByTitle(document, "Future Falafel");
  const text = card.textContent.replace(/\s+/g, " ").trim();

  assert.ok(text.includes("Next in Ballard"));
  assert.ok(text.includes("Last seen"));
  assert.ok(text.includes("Stoup Brewing - Ballard"));
  assert.ok(text.includes("Urban Family Brewing"));
  assert.ok(text.includes("2 stops"));
  assert.equal(card.querySelectorAll(".directory-links a").length, 2);
});

test("frontend expands and collapses known stops for schedule-derived trucks", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  let card = directoryCardByTitle(document, "Future Falafel");
  let button = card.querySelector(".known-stops-button");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(card.querySelector(".known-stops-list").hidden, true);

  button.click();
  card = directoryCardByTitle(document, "Future Falafel");
  button = card.querySelector(".known-stops-button");
  const stops = [...card.querySelectorAll(".known-stop-row")].map((row) => row.textContent.replace(/\s+/g, " ").trim()).sort();

  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(card.querySelector(".known-stops-stat .known-stops-list"), null);
  assert.equal(card.querySelector(":scope > .known-stops-list").hidden, false);
  assert.deepEqual(stops, ["Stoup Brewing - Ballard1 stop", "Urban Family Brewing1 stop"]);

  button.click();
  card = directoryCardByTitle(document, "Future Falafel");
  assert.equal(card.querySelector(".known-stops-button").getAttribute("aria-expanded"), "false");
  assert.equal(card.querySelector(".known-stops-list").hidden, true);
});

test("frontend labels past-only directory trucks with no upcoming stop", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;
  const card = directoryCardByTitle(document, "Past Pies");

  assert.equal(card.querySelector(".next-stop").textContent, "No upcoming stop found");
  assert.ok(card.querySelector(".last-seen").textContent.includes("Lucky Envelope Brewing"));
});

test("frontend directory search and favorites filter work", async () => {
  const dom = await loadAppDom();
  const { document, Event } = dom.window;

  assert.equal(document.querySelector("#searchInput"), null);
  const search = document.querySelector("#directorySearch");
  assert.ok(search);
  search.value = "Future";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(document.querySelector("#directoryCount").textContent, "1 truck");
  assert.equal(document.querySelector(".directory-card h3").textContent, "Future Falafel");

  search.value = "";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  directoryCardByTitle(document, "Future Falafel").querySelector(".favorite-button").click();
  assert.equal(directoryCardByTitle(document, "Future Falafel").querySelector(".favorite-button").getAttribute("aria-pressed"), "true");
  document.querySelector("#favoritesOnlyToggle").click();
  assert.equal(document.querySelector("#directoryCount").textContent, "1 truck");
  assert.equal(document.querySelector(".directory-card h3").textContent, "Future Falafel");
});

test("frontend renders schedule, map, and trucks together", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  assert.equal(document.querySelectorAll("[data-view]").length, 0);
  assert.equal(document.querySelector('[data-screen-section="schedule"]').hidden, false);
  assert.equal(document.querySelector('[data-screen-section="map"]').hidden, false);
  assert.equal(document.querySelector('[data-screen-section="trucks"]').hidden, false);
  assert.equal(document.querySelector("#scheduleList").hidden, false);
  assert.equal(document.querySelector("#venueList").hidden, false);
  assert.equal(document.querySelector("#directoryList").hidden, false);
});

test("frontend shows stale freshness warning and stale schedule badge", async () => {
  const dom = await loadAppDom({ stale: true });
  const { document } = dom.window;

  assert.equal(document.querySelector("#freshnessBanner").hidden, false);
  assert.match(document.querySelector("#freshnessBanner").textContent, /schedules fresh/);
  const staleCard = [...document.querySelectorAll(".truck-card")].find((card) => card.querySelector("h3").textContent === "Today Taco");
  assert.equal(staleCard.querySelector(".source-badge").textContent, "Stale data");
});

test("frontend hero recommendation never promotes an ended truck", async () => {
  const dom = await loadAppDom({ endedOnly: true });
  const { document } = dom.window;

  assert.equal(document.querySelector("#topPick").textContent, "No more trucks tonight");
});

test("frontend includes public beta publishing metadata and disclaimer", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  assert.equal(
    document.querySelector('meta[name="description"]').getAttribute("content"),
    "A public beta tracker for Ballard food truck schedules, venue coverage, and food truck source links."
  );
  assert.equal(document.querySelector('meta[property="og:title"]').getAttribute("content"), "Ballard Truck Finder");
  assert.equal(
    document.querySelector(".site-footer").textContent.replace(/\s+/g, " ").trim(),
    "Schedules change. Please confirm with the venue or food truck before heading out."
  );
  assert.equal(document.querySelector('script[src="app.js?v=tracker-v4"]') !== null, true);
});

test("frontend expires previously fresh data and avoids recommending stale stops", async () => {
  const dom = await loadAppDom({ expired: true });
  const { document } = dom.window;
  assert.match(document.querySelector("#freshnessBanner").textContent, /0 of 2 schedules fresh/);
  assert.equal(document.querySelector("#freshnessBanner").hidden, false);
  assert.equal(document.querySelector(".truck-card .source-badge").textContent, "Stale data");
  assert.equal(document.querySelector("#topPick").textContent, "Today's schedule needs an update");
});

test("frontend expires Obec's previous-day homepage even within the freshness window", async () => {
  const dom = await loadAppDom();
  const record = { sourceType: "homepage_today", date: isoDate(-1), sourceStatus: "live", lastScrapedAt: "2026-10-22T05:00:00.000Z" };
  assert.equal(dom.window.eval(`getDataStatus(${JSON.stringify(record)})`), "stale");
});

test("frontend respects a homepage stop explicitly listed for tomorrow", async () => {
  const dom = await loadAppDom();
  const record = { sourceType: "homepage_today", date: isoDate(1), sourceStatus: "live", lastScrapedAt: fixtureNow };
  assert.equal(dom.window.eval(`getDataStatus(${JSON.stringify(record)})`), "fresh");
});

test("frontend reports invalid JSON as a loading failure", async () => {
  const dom = await loadAppDom({ brokenJson: true });
  const { document } = dom.window;
  assert.match(document.querySelector("#freshnessBanner").textContent, /could not be loaded/);
  assert.match(document.querySelector("#scheduleList").textContent, /could not be loaded/);
  assert.equal(document.querySelectorAll(".venue-row").length, 5);
});

test("frontend preserves permanent truck favorites across reloads", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;
  directoryCardByTitle(document, "El Camion Ballard").querySelector(".favorite-button").click();
  document.querySelector("#favoritesOnlyToggle").click();
  assert.equal(document.querySelector("#directoryCount").textContent, "1 truck");
  assert.equal(document.querySelector(".directory-card h3").textContent, "El Camion Ballard");
  const storedFavorites = JSON.parse(dom.window.localStorage.getItem("favoriteTrucksV1"));
  const reloaded = await loadAppDom({ storedFavorites });
  reloaded.window.document.querySelector("#favoritesOnlyToggle").click();
  assert.equal(reloaded.window.document.querySelector(".directory-card h3").textContent, "El Camion Ballard");
});

test("frontend keeps recommendations and warnings current in an open tab", async () => {
  const dom = await loadAppDom({ verificationAgeHours: 35 });
  const { document } = dom.window;
  assert.equal(document.querySelector("#freshnessBanner").hidden, true);
  assert.match(document.querySelector("#topPick").textContent, /Lucky Dumplings/);
  dom.setClock("2026-10-22T21:00:00.000Z");
  dom.refreshClock();
  assert.equal(document.querySelector("#freshnessBanner").hidden, false);
  assert.equal(document.querySelector("#topPick").textContent, "Today's schedule needs an update");
  assert.equal(document.querySelector(".truck-card .source-badge").textContent, "Stale data");
});

test("frontend preserves keyboard focus while favoriting and refreshing cards", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;
  const button = directoryCardByTitle(document, "El Camion Ballard").querySelector(".favorite-button");
  button.focus();
  button.click();
  assert.equal(document.activeElement.getAttribute("aria-label"), "Remove El Camion Ballard from favorites");
  dom.refreshClock();
  assert.equal(document.activeElement.getAttribute("aria-label"), "Remove El Camion Ballard from favorites");
});

test("frontend groups truck aliases and preserves older favorite names", async () => {
  const dom = await loadAppDom({ aliases: true, storedFavorites: ["kaosamai thai"] });
  const { document } = dom.window;
  assert.equal([...document.querySelectorAll(".directory-card h3")].filter((heading) => heading.textContent.startsWith("Kaosamai")).length, 1);
  document.querySelector("#favoritesOnlyToggle").click();
  assert.equal(document.querySelector("#directoryCount").textContent, "1 truck");
  assert.match(document.querySelector(".directory-card h3").textContent, /Kaosamai/);
});

test("frontend leaves nested venue keyboard controls to their own handlers", async () => {
  const dom = await loadAppDom();
  const { document, KeyboardEvent } = dom.window;
  const link = document.querySelector('[data-venue-id="lucky-envelope"] .venue-link');
  const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  link.dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, false);
  assert.equal(document.querySelector("#resultCount").textContent, "2 trucks");
  const button = document.querySelector('[data-venue-id="lucky-envelope"] .venue-select-button');
  button.focus();
  button.click();
  assert.equal(document.activeElement.getAttribute("aria-label"), "Clear Lucky Envelope Brewing");
  assert.equal(document.querySelector("#viewVenueResults").hidden, false);
  document.querySelector("#selectedVenueFilter button").click();
  assert.equal(document.querySelector("#viewVenueResults").hidden, true);
});
