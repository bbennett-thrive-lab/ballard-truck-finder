import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import test from "node:test";
import {
  parseBbycEvents,
  parseFoodPartner,
  parseLuckyEnvelope,
  dedupeEntries,
  mergeScrapeResults,
  parseObecHomepage,
  parseStoup,
  parseUrbanFamily,
  fetchWithRetry,
  formatScrapeWarnings,
  validateScrapeResults,
  venues
} from "../scripts/scrape.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, "fixtures");

const stoupVenue = {
  name: "Stoup Brewing - Ballard",
  address: "1108 NW 52nd St",
  url: "https://www.stoupbrewing.com/ballard/"
};

const urbanVenue = {
  name: "Urban Family Brewing",
  address: "1103 NW 52nd St",
  url: "https://urbanfamilybrewing.com/home/calendar/"
};

const bbycVenue = {
  name: "Yonder Cider x Bale Breaker",
  address: "826 NW 49th St",
  url: "https://www.bbycballard.com/food-trucks-1-1"
};

const obecVenue = {
  name: "Obec Brewing",
  address: "1144 NW 52nd St",
  url: "https://obecbrewing.com/"
};

const luckyVenue = {
  name: "Lucky Envelope Brewing",
  address: "907 NW 50th St",
  url: "https://www.luckyenvelopebrewing.com/"
};

const fairIsleVenue = {
  name: "Fair Isle Brewing",
  address: "936 NW 49th St",
  url: "https://fairislebrewing.com/"
};

const greatNotionVenue = {
  name: "Great Notion Ballard",
  address: "5101 14th Ave NW Ste. 101",
  url: "https://greatnotion.com/pages/ballard-1"
};

test("parseStoup extracts food truck entries", async () => {
  const html = await readFile(join(fixtures, "stoup.html"), "utf8");
  const result = parseStoup(html, stoupVenue, new Date("2026-06-08T12:00:00-07:00"));
  assert.equal(result.sourceStatus, "live");
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].date, "2026-06-08");
  assert.equal(result.entries[0].start, "17:00");
  assert.equal(result.entries[0].end, "20:00");
  assert.equal(result.entries[0].truck, "Where Ya At Matt");
  assert.equal(result.entries[0].cuisine, "New Orleans");
});

test("parseUrbanFamily extracts food trucks and filters non-food events", async () => {
  const html = await readFile(join(fixtures, "urban-family.html"), "utf8");
  const result = parseUrbanFamily(html, urbanVenue, new Date("2026-06-08T12:00:00-07:00"));
  const trucks = result.entries.map((entry) => entry.truck);
  assert.equal(result.sourceStatus, "live");
  assert.deepEqual(trucks, ["Empanadas El Pachi", "BurgerDOM", "Now Make Me A Sandwich"]);
  assert.ok(!trucks.includes("Tuesday Trivia"));
  assert.ok(!trucks.includes("Yoga in the Brewery!"));
});

test("parseBbycEvents extracts calendar events and filters non-food events", async () => {
  const items = JSON.parse(await readFile(join(fixtures, "bbyc-events.json"), "utf8"));
  const result = parseBbycEvents(items, bbycVenue, new Date("2026-06-08T12:00:00-07:00"));
  const trucks = result.entries.map((entry) => entry.truck);
  assert.equal(result.sourceStatus, "live");
  assert.deepEqual(trucks, ["Tummy Yummy Thai", "Tacos & Beer"]);
  assert.equal(result.entries[0].date, "2026-06-08");
  assert.equal(result.entries[0].start, "17:00");
  assert.equal(result.entries[0].end, "21:00");
  assert.equal(result.entries[0].cuisine, "Thai");
  assert.ok(!trucks.includes("Trivia Night"));
});

test("parseObecHomepage extracts today's homepage truck", async () => {
  const html = await readFile(join(fixtures, "obec.html"), "utf8");
  const result = parseObecHomepage(html, obecVenue, new Date("2026-06-08T12:00:00-07:00"));
  assert.equal(result.sourceStatus, "live");
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].date, "2026-06-08");
  assert.equal(result.entries[0].start, "16:00");
  assert.equal(result.entries[0].end, "20:00");
  assert.equal(result.entries[0].truck, "Plaza Garcia");
  assert.equal(result.entries[0].sourceType, "homepage_today");
  assert.equal(result.entries[0].confidence, "today_only");
});

test("parseObecHomepage treats missing homepage truck markup as a failure, not authoritative empty", async () => {
  const html = await readFile(join(fixtures, "obec-empty.html"), "utf8");
  const result = parseObecHomepage(html, obecVenue, new Date("2026-06-08T12:00:00-07:00"));
  assert.equal(result.sourceStatus, "error");
  assert.equal(result.entries.length, 0);
});

test("parseLuckyEnvelope extracts schedule cards and links", async () => {
  const html = await readFile(join(fixtures, "lucky-envelope.html"), "utf8");
  const result = parseLuckyEnvelope(html, luckyVenue, new Date("2026-06-08T12:00:00-07:00"));
  const trucks = result.entries.map((entry) => entry.truck);
  assert.equal(result.sourceStatus, "live");
  assert.deepEqual(trucks, ["El Koreano", "Llama Fusion"]);
  assert.equal(result.entries[0].date, "2026-06-12");
  assert.equal(result.entries[0].start, "16:30");
  assert.equal(result.entries[0].end, "20:00");
  assert.equal(result.entries[0].truckUrl, "https://www.elkoreano.com/");
  assert.equal(result.entries[0].cuisine, "Korean-Mexican");
  assert.ok(!trucks.includes("Trivia Night"));
});

test("parseFoodPartner marks Fair Isle as coverage without schedule entries", () => {
  const html = "<main>We have a full kitchen and proudly partner with La Marea. Ox Burger serves Sundays and Mondays.</main>";
  const result = parseFoodPartner(html, fairIsleVenue);

  assert.equal(result.sourceStatus, "permanent_food");
  assert.equal(result.entries.length, 0);
  assert.equal(result.message, "Fair Isle Brewing has onsite food or food partners; no rotating truck schedule emitted.");
});

test("parseFoodPartner marks Great Notion as coverage without schedule entries", () => {
  const html = "<main>Food provided by Po'Boy & Tings on site. Outside food is not allowed.</main>";
  const result = parseFoodPartner(html, greatNotionVenue);

  assert.equal(result.sourceStatus, "permanent_food");
  assert.equal(result.entries.length, 0);
  assert.equal(result.message, "Great Notion Ballard has onsite food or food partners; no rotating truck schedule emitted.");
});

test("permanent food venues include onsite food menu links", () => {
  const foodUrls = Object.fromEntries(
    venues
      .filter((venue) => venue.foodUrl)
      .map((venue) => [venue.id, venue.foodUrl])
  );

  assert.equal(foodUrls.reubens, "https://reubensbrews.com/location/ballard-taproom/");
  assert.equal(foodUrls["fair-isle"], "https://fairislebrewing.com/lamareamenu/");
  assert.equal(foodUrls["great-notion-ballard"], "https://greatnotion.com/pages/ballard-1");
});

test("failed venue refresh retains recent entries as stale", () => {
  const now = new Date("2026-07-13T12:00:00-07:00");
  const previousSchedule = [{
    date: "2026-07-14",
    start: "17:00",
    end: "20:00",
    truck: "Future Falafel",
    venue: stoupVenue.name,
    lastScrapedAt: "2026-07-12T12:00:00.000Z",
    notes: []
  }];
  const previousSources = [{
    id: "stoup",
    name: stoupVenue.name,
    sourceStatus: "live",
    lastSuccessfulAt: "2026-07-12T12:00:00.000Z"
  }];
  const merged = mergeScrapeResults({
    results: [{
      entries: [],
      source: {
        id: "stoup",
        name: stoupVenue.name,
        address: stoupVenue.address,
        sourceStatus: "error",
        source: stoupVenue.url,
        message: "Scrape failed: timeout"
      }
    }],
    previousSchedule,
    previousSources,
    now
  });

  assert.equal(merged.schedule.length, 1);
  assert.equal(merged.schedule[0].dataStatus, "stale");
  assert.match(merged.schedule[0].notes.join(" "), /refresh is unavailable/);
  assert.equal(merged.sources[0].dataStatus, "stale");
  assert.equal(merged.sources[0].sourceStatus, "error");
  assert.match(merged.sources[0].message, /last successful data/);
});

test("successful empty venue refresh removes previous entries authoritatively", () => {
  const merged = mergeScrapeResults({
    results: [{
      entries: [],
      source: {
        id: "obec",
        name: obecVenue.name,
        address: obecVenue.address,
        sourceStatus: "empty",
        source: obecVenue.url,
        message: "Obec explicitly reports no food truck today."
      }
    }],
    previousSchedule: [{
      date: "2026-07-14",
      start: "16:00",
      end: "20:00",
      truck: "Old Truck",
      venue: obecVenue.name
    }],
    previousSources: [],
    now: new Date("2026-07-13T12:00:00-07:00")
  });

  assert.deepEqual(merged.schedule, []);
  assert.equal(merged.sources[0].dataStatus, "fresh");
  assert.equal(merged.sources[0].sourceStatus, "empty");
});

test("stale retention prunes entries older than 60 days", () => {
  const merged = mergeScrapeResults({
    results: [{
      entries: [],
      source: {
        id: "stoup",
        name: stoupVenue.name,
        address: stoupVenue.address,
        sourceStatus: "error",
        source: stoupVenue.url,
        message: "Scrape failed"
      }
    }],
    previousSchedule: [{
      date: "2026-05-01",
      start: "16:00",
      end: "20:00",
      truck: "Too Old",
      venue: stoupVenue.name
    }],
    previousSources: [],
    now: new Date("2026-07-13T12:00:00-07:00")
  });

  assert.deepEqual(merged.schedule, []);
  assert.equal(merged.sources[0].dataStatus, "error");
});

test("quality gate rejects a complete rotating-source outage", () => {
  const rotatingVenues = venues.filter((venue) => (venue.adapter || venue.scrape) && !venue.foodUrl);
  const failedResults = rotatingVenues.map((venue) => ({
    entries: [],
    source: { id: venue.id, name: venue.name, sourceStatus: "error" }
  }));

  assert.throws(() => validateScrapeResults(failedResults), /All rotating venue sources failed/);
  assert.doesNotThrow(() => validateScrapeResults([
    ...failedResults.slice(1),
    { entries: [], source: { id: rotatingVenues[0].id, name: rotatingVenues[0].name, sourceStatus: "empty" } }
  ]));
});

test("fetchWithRetry retries a temporary source failure once", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary failure");
    return new Response("ok", { status: 200 });
  };

  try {
    const response = await fetchWithRetry("https://example.test/source");
    assert.equal(await response.text(), "ok");
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const octoberNow = new Date("2026-10-22T12:00:00-07:00");

function bbycItem(title, startDate = "2026-10-22T16:00:00-07:00", endDate = "2026-10-22T20:00:00-07:00") {
  return { title, structuredContent: { startDate, endDate } };
}

test("BBYC parses the live structuredContent millisecond schema in Seattle time", async () => {
  const items = JSON.parse(await readFile(join(fixtures, "bbyc-milliseconds.json"), "utf8"));
  const result = parseBbycEvents(items, bbycVenue, octoberNow);
  assert.equal(result.sourceStatus, "live");
  assert.deepEqual(result.entries.map(({ date, start, end, truck }) => ({ date, start, end, truck })), [
    { date: "2026-10-31", start: "13:00", end: "20:00", truck: "Outsider BBQ" },
    { date: "2026-10-30", start: "16:00", end: "20:00", truck: "Paparepas" }
  ]);
  assert.equal(result.entries[0].source, bbycVenue.url);
  assert.equal(result.entries[0].sourceType, "venue_calendar");
});

test("BBYC converts ISO offsets and UTC dates using Seattle daylight and standard time", () => {
  const result = parseBbycEvents([
    bbycItem("Kaosamai Thai", "2026-10-23T01:00:00Z", "2026-10-23T05:00:00+00:00"),
    bbycItem("Albrijes", "2026-12-02T01:00:00Z", "2026-12-02T05:00:00Z"),
    bbycItem("La Rivera", "2026-10-23T06:00:00+05:00", "2026-10-23T10:00:00+05:00")
  ], bbycVenue, octoberNow);
  assert.equal(result.sourceStatus, "live");
  assert.deepEqual(result.entries.map(({ date, start, end }) => ({ date, start, end })), [
    { date: "2026-10-22", start: "18:00", end: "22:00" },
    { date: "2026-12-01", start: "17:00", end: "21:00" },
    { date: "2026-10-22", start: "18:00", end: "22:00" }
  ]);
});

test("BBYC isolates malformed events, including null and missing fields, without losing good events", () => {
  const result = parseBbycEvents([
    bbycItem("Kaosamai Thai"),
    bbycItem("Bad Date", "not-a-date"),
    null,
    { title: "Missing Hours" },
    bbycItem("Albrijes"),
    bbycItem("Reversed Hours", "2026-10-22T20:00:00-07:00", "2026-10-22T16:00:00-07:00")
  ], bbycVenue, octoberNow);
  assert.equal(result.sourceStatus, "partial");
  assert.deepEqual(result.entries.map((entry) => entry.truck), ["Kaosamai", "Alebrijes"]);
  assert.match(result.message, /Skipped 4 malformed/);
  assert.match(result.entries[0].notes.join(" "), /Skipped 4 malformed/);
});

test("BBYC rejects unknown envelopes and all-invalid event schemas instead of success-empty", () => {
  for (const payload of [{ events: [] }, null, [{ title: "Changed Schema", date: "2026-10-22" }], [null]]) {
    const result = parseBbycEvents(payload, bbycVenue, octoberNow);
    assert.equal(result.sourceStatus, "error");
    assert.deepEqual(result.entries, []);
  }
  assert.equal(parseBbycEvents([], bbycVenue, octoberNow).sourceStatus, "empty");
});

test("BBYC does not normalize impossible dates or interpret timezone-free ISO strings in the host timezone", () => {
  const result = parseBbycEvents([
    bbycItem("Bad Day", "2026-02-30T17:00:00Z", "2026-03-03T19:00:00Z"),
    bbycItem("Missing Offset", "2026-10-22T16:00:00", "2026-10-22T20:00:00"),
    bbycItem("Invalid Hour", "2026-10-22T25:00:00Z", "2026-10-23T20:00:00Z")
  ], bbycVenue, octoberNow);
  assert.equal(result.sourceStatus, "error");
  assert.match(result.message, /Skipped 3 malformed/);
});

test("Urban Family uses exact event dates and source year, including adjacent-month cells, without footer text", async () => {
  const html = await readFile(join(fixtures, "urban-family-october.html"), "utf8");
  const result = parseUrbanFamily(html, urbanVenue, octoberNow);
  assert.equal(result.sourceStatus, "live");
  assert.deepEqual(result.entries.map(({ truck, date, start, end }) => ({ truck, date, start, end })), [
    { truck: "Burger Planet", date: "2025-10-22", start: "16:00", end: "20:00" },
    { truck: "Kaosamai", date: "2025-11-01", start: "13:00", end: "19:00" }
  ]);
  assert.ok(result.entries.every((entry) => !/contact|newsletter|hours|book club|d&d|dinner|no food truck/i.test(entry.truck)));
});

test("Urban Family isolates malformed food events while preserving valid events", async () => {
  const html = await readFile(join(fixtures, "urban-family-october.html"), "utf8");
  const result = parseUrbanFamily(html.replace("2025-10-22T20:00:00", "not-a-date"), urbanVenue, octoberNow);
  assert.equal(result.sourceStatus, "partial");
  assert.deepEqual(result.entries.map((entry) => entry.truck), ["Kaosamai"]);
  assert.match(result.message, /Skipped 1 malformed/);
});

test("Urban Family fails closed if event selectors or category metadata change", async () => {
  const html = await readFile(join(fixtures, "urban-family.html"), "utf8");
  assert.equal(parseUrbanFamily(html.replaceAll("sugar-calendar-block__event-cell", "changed-event"), urbanVenue, octoberNow).sourceStatus, "error");
  assert.equal(parseUrbanFamily(html.replaceAll("data-calendarsinfo", "changed-categories"), urbanVenue, octoberNow).sourceStatus, "error");
  assert.equal(parseUrbanFamily("<main>October 2026 22 4:00 pm - 8:00 pm Burger Planet Contact Us</main>", urbanVenue, octoberNow).sourceStatus, "error");
});

test("Urban Family requires source food categories, but does not guess unknown vendor identities", () => {
  const html = `<div class="sugar-calendar-block__event-cell" data-calendarsinfo='{"calendars":[{"name":"Food Truck Calendar"}]}'>
    <div class="sugar-calendar-block__event-cell__time"><time datetime="2026-10-22T16:00:00">4 pm</time><time datetime="2026-10-22T20:00:00">8 pm</time></div>
    <div class="sugar-calendar-block__event-cell__title">Brand New Vendor</div></div>`;
  assert.equal(parseUrbanFamily(html, urbanVenue, octoberNow).entries[0].truck, "Brand New Vendor");
  const nonfood = parseUrbanFamily(html.replace("Food Truck Calendar", "Urban Family Brewing Ballard"), urbanVenue, octoberNow);
  assert.equal(nonfood.sourceStatus, "empty");
  assert.deepEqual(nonfood.entries, []);
});

test("Obec uses Seattle today even when UTC is already the next date", async () => {
  const html = await readFile(join(fixtures, "obec-thursday.html"), "utf8");
  const result = parseObecHomepage(html, obecVenue, new Date("2026-10-23T02:30:00Z"));
  assert.equal(result.sourceStatus, "live");
  assert.equal(result.entries[0].date, "2026-10-22");
  assert.equal(result.entries[0].truck, "Woodshop BBQ");
  assert.equal(result.entries[0].start, "16:00");
  assert.equal(result.entries[0].end, "20:00");
});

test("Obec honors an explicit tomorrow label rather than silently assigning today", () => {
  for (const label of ["Tomorrow's food truck", "Food truck tomorrow", "Food truck: Tomorrow"]) {
    const result = parseObecHomepage(`<span class="btIconWidgetTitle">${label}: Kaosamai Thai 4:00 - 8:00</span>`, obecVenue, new Date("2026-10-23T02:30:00Z"));
    assert.equal(result.sourceStatus, "live", label);
    assert.equal(result.entries[0].date, "2026-10-23", label);
    assert.equal(result.entries[0].truck, "Kaosamai", label);
  }
});

test("Obec distinguishes explicit no-truck text from invalid markup, hours, and mismatched weekdays", async () => {
  const html = await readFile(join(fixtures, "obec-thursday.html"), "utf8");
  assert.equal(parseObecHomepage(html.replace("Woodshop BBQ 4:00 - 8:00", "No truck today"), obecVenue, octoberNow).sourceStatus, "empty");
  assert.equal(parseObecHomepage(html.replace("4:00 - 8:00", "hours TBD"), obecVenue, octoberNow).sourceStatus, "error");
  assert.equal(parseObecHomepage(html.replace("Thurs hours", "Fri hours"), obecVenue, octoberNow).sourceStatus, "error");
  assert.equal(parseObecHomepage("<main>Food truck: Footer Truck 4:00 - 8:00</main>", obecVenue, octoberNow).sourceStatus, "error");
});

test("Stoup excludes No Truck Today and fails closed if the date selector changes", () => {
  const html = '<div class="lunch-truck-info"><h4>Thu 10.22</h4><div class="hrs">5 - 8pm</div>No Truck Today<br></div>';
  const result = parseStoup(html, stoupVenue, octoberNow);
  assert.equal(result.sourceStatus, "empty");
  assert.deepEqual(result.entries, []);
  assert.equal(parseStoup(html.replaceAll("h4", "h5"), stoupVenue, octoberNow).sourceStatus, "error");
});

test("known truck aliases and curly apostrophes canonicalize without fuzzy identity guesses", () => {
  const result = parseBbycEvents([
    "Kaosamai Thai", "Albrijes", "Impeckable", "Impeckable Chicken", "La Rivera", "Oskar\u2019s Pizza", "Tat\u2018s Truck", "Unknown Impeckable Vendor"
  ].map((truck) => bbycItem(truck)), bbycVenue, octoberNow);
  assert.deepEqual(result.entries.map((entry) => entry.truck), [
    "Kaosamai", "Alebrijes", "Impeccable Chicken", "Impeccable Chicken", "La Riviera Maya", "Oskar's Pizza", "Tat's Truck", "Unknown Impeckable Vendor"
  ]);
  assert.equal(result.entries[5].cuisine, "Pizza");
  assert.equal(result.entries[6].cuisine, "Sandwiches");
  const duplicates = dedupeEntries([
    { ...result.entries[0], truck: "Kaosamai Thai" }, result.entries[0],
    { ...result.entries[5], truck: "Oskar\u2019s Pizza" }, result.entries[5]
  ]);
  assert.equal(duplicates.length, 2);
});

test("partial BBYC results keep good fresh events and retain unrefreshed trucks even at the same time", () => {
  const parsed = parseBbycEvents([bbycItem("Kaosamai Thai"), bbycItem("Broken", "invalid")], bbycVenue, octoberNow);
  const merged = mergeScrapeResults({
    results: [{ entries: parsed.entries, source: { id: "yonder-bale-breaker", name: bbycVenue.name, sourceStatus: parsed.sourceStatus, message: parsed.message } }],
    previousSchedule: [
      { ...parsed.entries[0], truck: "Kaosamai Thai" },
      { ...parsed.entries[0], truck: "Another Truck" },
      { ...parsed.entries[0], date: "2026-10-23", truck: "Retained Truck" }
    ],
    previousSources: [{ id: "yonder-bale-breaker", lastSuccessfulAt: "2026-10-21T19:00:00.000Z" }],
    now: octoberNow
  });
  assert.deepEqual(merged.schedule.map(({ truck, dataStatus }) => ({ truck, dataStatus })), [
    { truck: "Kaosamai", dataStatus: "fresh" },
    { truck: "Another Truck", dataStatus: "stale" },
    { truck: "Retained Truck", dataStatus: "stale" }
  ]);
  assert.equal(merged.sources[0].sourceStatus, "partial");
  assert.equal(merged.sources[0].dataStatus, "stale");
  assert.equal(merged.sources[0].lastSuccessfulAt, "2026-10-21T19:00:00.000Z");
  assert.doesNotThrow(() => validateScrapeResults([{ entries: parsed.entries, source: { id: "yonder-bale-breaker", sourceStatus: "partial" } }]));
});

test("homepage_today retention expires after its specific Seattle date even on refresh failure", () => {
  const entries = ["2026-10-21", "2026-10-22", "2026-10-23"].map((date) => ({
    date, start: "16:00", end: "20:00", truck: "Dated Truck", venue: obecVenue.name, sourceType: "homepage_today"
  }));
  const failed = [{ entries: [], source: { id: "obec", name: obecVenue.name, sourceStatus: "error", message: "Unavailable" } }];
  const sameSeattleDate = mergeScrapeResults({ results: failed, previousSchedule: entries, now: new Date("2026-10-23T02:30:00Z") });
  assert.deepEqual(sameSeattleDate.schedule.map((entry) => entry.date), ["2026-10-22", "2026-10-23"]);
  const nextSeattleDate = mergeScrapeResults({ results: failed, previousSchedule: entries, now: new Date("2026-10-23T07:30:00Z") });
  assert.deepEqual(nextSeattleDate.schedule.map((entry) => entry.date), ["2026-10-23"]);
});

test("invalid page formats retain prior venue data, including needs-adapter and no-schedule states", () => {
  for (const sourceStatus of ["error", "needs_adapter", "no_schedule_found"]) {
    const merged = mergeScrapeResults({
      results: [{ entries: [], source: { id: "stoup", name: stoupVenue.name, sourceStatus } }],
      previousSchedule: [{ date: "2026-10-22", start: "16:00", end: "20:00", truck: "Known Truck", venue: stoupVenue.name }],
      now: octoberNow
    });
    assert.equal(merged.schedule.length, 1, sourceStatus);
    assert.equal(merged.schedule[0].dataStatus, "stale", sourceStatus);
  }
});

test("Lucky Envelope selector failure is not an authoritative empty schedule", () => {
  assert.equal(parseLuckyEnvelope("<main>Calendar changed</main>", luckyVenue, octoberNow).sourceStatus, "error");
});

test("Lucky Envelope supports the live four-digit year and date/time separated by br", async () => {
  const html = await readFile(join(fixtures, "lucky-envelope-live.html"), "utf8");
  const result = parseLuckyEnvelope(html, luckyVenue, octoberNow);
  assert.equal(result.sourceStatus, "live");
  assert.deepEqual(result.entries.map(({ date, start, end, truck }) => ({ date, start, end, truck })), [
    { date: "2026-11-06", start: "16:30", end: "19:30", truck: "Kaosamai" }
  ]);
});

test("GitHub run summary surfaces partial/error sources without warning on healthy runs", () => {
  assert.equal(formatScrapeWarnings([{ name: "Healthy", dataStatus: "fresh", sourceStatus: "live" }]), "");
  const summary = formatScrapeWarnings([
    { name: "Healthy", dataStatus: "fresh", sourceStatus: "live" },
    { name: "BBYC", dataStatus: "stale", sourceStatus: "partial", message: "Skipped 1 malformed event." },
    { name: "Obec", dataStatus: "error", sourceStatus: "error", message: "Markup changed.\nReview source." }
  ]);
  assert.match(summary, /\*\*BBYC\*\* \(partial\).*Skipped 1 malformed/);
  assert.match(summary, /\*\*Obec\*\* \(error\).*Markup changed\. Review source\./);
  assert.doesNotMatch(summary, /Healthy/);
  assert.match(summary, /marked stale/);
});
