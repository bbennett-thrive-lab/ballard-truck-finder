import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function isoDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function loadAppDom() {
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
    generatedAt: new Date().toISOString(),
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
  const dom = new JSDOM(html, {
    url: "http://127.0.0.1:4173/",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  dom.window.fetch = async (url) => ({
    ok: true,
    json: async () => url.includes("schedule") ? schedule : sources
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
  assert.equal(chip.textContent.replace(/\s+/g, " ").trim(), "Venue: Lucky Envelope Brewing x");
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
  assert.ok(venueText.includes("Reuben's Brews 5010 14th Ave NW Select"));
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

test("frontend onsite food cards ignore open-now filter when selected", async () => {
  const dom = await loadAppDom();
  const { document, Event } = dom.window;

  document.querySelector("#openNowToggle").checked = true;
  document.querySelector("#openNowToggle").dispatchEvent(new Event("change"));
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
  assert.deepEqual(stops, ["Stoup Brewing - Ballard 1 stop", "Urban Family Brewing 1 stop"]);

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

test("frontend does not render search controls", async () => {
  const dom = await loadAppDom();
  const { document } = dom.window;

  assert.equal(document.querySelector("#searchInput"), null);
  assert.equal(document.querySelector("#directorySearchInput"), null);
  assert.equal(document.querySelector(".cuisine-shortcuts"), null);
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
  assert.equal(document.querySelector('script[src="app.js?v=public-beta-1"]') !== null, true);
});
