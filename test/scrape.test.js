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
  parseObecHomepage,
  parseStoup,
  parseUrbanFamily,
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

test("parseObecHomepage returns empty without homepage truck text", async () => {
  const html = await readFile(join(fixtures, "obec-empty.html"), "utf8");
  const result = parseObecHomepage(html, obecVenue, new Date("2026-06-08T12:00:00-07:00"));
  assert.equal(result.sourceStatus, "empty");
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
