import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const cheerio = require("cheerio/slim");

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const dataDir = join(rootDir, "data");
const fixtureDir = join(rootDir, "test", "fixtures");
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_FETCH_ATTEMPTS = 2;
const STALE_RETENTION_DAYS = 60;
const SEATTLE_TIME_ZONE = "America/Los_Angeles";
const seattleFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SEATTLE_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

export const venues = [
  {
    id: "stoup",
    name: "Stoup Brewing - Ballard",
    address: "1108 NW 52nd St",
    url: "https://www.stoupbrewing.com/ballard/",
    adapter: parseStoup
  },
  {
    id: "urban-family",
    name: "Urban Family Brewing",
    address: "1103 NW 52nd St",
    url: "https://urbanfamilybrewing.com/home/calendar/",
    adapter: parseUrbanFamily
  },
  {
    id: "yonder-bale-breaker",
    name: "Yonder Cider x Bale Breaker",
    address: "826 NW 49th St",
    url: "https://www.bbycballard.com/food-trucks-1-1",
    collectionId: "61328af17400707612fccbc6",
    scrape: scrapeBbyc
  },
  {
    id: "obec",
    name: "Obec Brewing",
    address: "1144 NW 52nd St",
    url: "https://obecbrewing.com/",
    adapter: parseObecHomepage
  },
  {
    id: "reubens",
    name: "Reuben's Brews",
    address: "5010 14th Ave NW",
    url: "https://reubensbrews.com/location/ballard-taproom/",
    foodUrl: "https://reubensbrews.com/location/ballard-taproom/",
    adapter: parsePermanentFood
  },
  {
    id: "lucky-envelope",
    name: "Lucky Envelope Brewing",
    address: "907 NW 50th St",
    url: "https://www.luckyenvelopebrewing.com/",
    adapter: parseLuckyEnvelope
  },
  {
    id: "fair-isle",
    name: "Fair Isle Brewing",
    address: "936 NW 49th St",
    url: "https://fairislebrewing.com/",
    foodUrl: "https://fairislebrewing.com/lamareamenu/",
    adapter: parseFoodPartner
  },
  {
    id: "great-notion-ballard",
    name: "Great Notion Ballard",
    address: "5101 14th Ave NW Ste. 101",
    url: "https://greatnotion.com/pages/ballard-1",
    foodUrl: "https://greatnotion.com/pages/ballard-1",
    adapter: parseFoodPartner
  }
];

const truckSources = {
  "where ya at matt": {
    truckUrl: "https://www.whereyaatmatt.com/",
    menuUrl: "https://www.whereyaatmatt.com/menu",
    cuisine: "New Orleans",
    tags: ["Po' boys", "Cajun"]
  },
  "impeccable chicken": {
    cuisine: "Fried chicken",
    tags: ["Chicken", "Comfort food"]
  },
  "impeckable chicken": {
    cuisine: "Fried chicken",
    tags: ["Chicken", "Comfort food"]
  },
  "el gran taco": {
    cuisine: "Mexican",
    tags: ["Tacos"]
  },
  "birrieria pepe el toro": {
    cuisine: "Birria",
    tags: ["Tacos", "Birria"]
  },
  "el sabor boricua": {
    cuisine: "Puerto Rican",
    tags: ["Plantains"]
  },
  "tat's truck": {
    cuisine: "Sandwiches",
    tags: ["Cheesesteaks"]
  },
  "kaosamai": {
    cuisine: "Thai",
    tags: ["Thai"]
  },
  "kaosamai thai": {
    cuisine: "Thai",
    tags: ["Thai"]
  },
  "now make me a sandwich": {
    cuisine: "Sandwiches",
    tags: ["Sandwiches"]
  },
  "el pirata tortas y burritos / now make me a sandwich": {
    cuisine: "Mexican and sandwiches",
    tags: ["Tortas", "Burritos", "Sandwiches"]
  },
  "wich came first": {
    cuisine: "Sandwiches",
    tags: ["Lunch", "Sandwiches"]
  },
  "russo pizzarium": {
    cuisine: "Pizza",
    tags: ["Pizza"]
  },
  "tacos & beer": {
    cuisine: "Mexican",
    tags: ["Tacos"]
  },
  "tacos and beer": {
    cuisine: "Mexican",
    tags: ["Tacos"]
  },
  "the marigold wood fired pizza": {
    cuisine: "Pizza",
    tags: ["Pizza"]
  },
  "kottu seattle": {
    cuisine: "Sri Lankan",
    tags: ["Kottu"]
  },
  "off the rez": {
    cuisine: "Native American",
    tags: ["Fry bread"]
  },
  "georgia's greek": {
    cuisine: "Greek",
    tags: ["Greek"]
  },
  "9th and hennepin": {
    cuisine: "Breakfast sandwiches",
    tags: ["Breakfast", "Sandwiches"]
  },
  "empanadas el pachi": {
    cuisine: "Empanadas",
    tags: ["Empanadas"]
  },
  "burgerdom": {
    cuisine: "Burgers",
    tags: ["Burgers"]
  },
  "katmandu momocha": {
    cuisine: "Nepalese",
    tags: ["Momos"]
  },
  "alebrijes": {
    cuisine: "Mexican",
    tags: ["Mexican"]
  },
  "momo express": {
    cuisine: "Nepalese",
    tags: ["Momos"]
  },
  "la riviera maya": {
    cuisine: "Mexican",
    tags: ["Mexican"]
  },
  "burger planet": {
    cuisine: "Burgers",
    tags: ["Burgers"]
  },
  "oskar's pizza": {
    cuisine: "Pizza",
    tags: ["Pizza"]
  },
  "tummy yummy thai": {
    cuisine: "Thai",
    tags: ["Thai"]
  },
  "paparepas": {
    cuisine: "Arepas",
    tags: ["Arepas", "Venezuelan"]
  },
  "plaza garcia": {
    cuisine: "Mexican",
    tags: ["Mexican"]
  },
  "el koreano": {
    truckUrl: "https://www.elkoreano.com/",
    cuisine: "Korean-Mexican",
    tags: ["Korean", "Mexican"]
  },
  "llama fusion": {
    cuisine: "Peruvian fusion",
    tags: ["Peruvian"]
  },
  "tisket tasket": {
    cuisine: "Food truck",
    tags: ["Dinner"]
  },
  "vandalz taqueria": {
    cuisine: "Mexican",
    tags: ["Tacos"]
  },
  "panda dim sum": {
    cuisine: "Dim sum",
    tags: ["Dim sum"]
  }
};

const nonFoodEventPattern = /\b(trivia|raffle|yoga|fundraiser|mending|sour hour|pints and ponytails|world cup|game night|craft night|commander|barrel sessions|pride fest|event)\b/i;
const noTruckPattern = /\bno\s+(?:food\s+)?trucks?\b|\bclosed\b/i;
const truckAliases = {
  "kaosamai thai": "Kaosamai",
  "kaosamai": "Kaosamai",
  "albrijes": "Alebrijes",
  "alebrijes": "Alebrijes",
  "impeckable": "Impeccable Chicken",
  "impeckable chicken": "Impeccable Chicken",
  "impeccable chicken": "Impeccable Chicken",
  "la rivera": "La Riviera Maya",
  "la rivera maya": "La Riviera Maya",
  "la riviera maya": "La Riviera Maya"
};

function normalizeText(value = "") {
  return cheerio.load("<span></span>")("span").html(value).text().replace(/\s+/g, " ").trim();
}

function canonicalTruckName(value) {
  const name = normalizeText(value).replace(/[\u2018\u2019]/g, "'");
  const key = name.toLowerCase();
  return Object.hasOwn(truckAliases, key) ? truckAliases[key] : name;
}

function normalizeTruckName(value) {
  return canonicalTruckName(value).toLowerCase().replace(/&/g, "and");
}

function seattleDateTime(value) {
  const parts = Object.fromEntries(seattleFormatter.formatToParts(value).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function shiftDate(date, days) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function calendarDate(year, month, day) {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return null;
  return value.toISOString().slice(0, 10);
}

function calendarDateTime(value, allowFloating = false) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isNaN(new Date(value).getTime())) return null;
    return { ...seattleDateTime(value), timestamp: value };
  }
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/i);
  if (!match || !calendarDate(Number(match[1]), Number(match[2]), Number(match[3])) ||
      Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6] || 0) > 59) return null;
  if (!match[7]) return allowFloating ? { date: value.slice(0, 10), time: value.slice(11, 16) } : null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : { ...seattleDateTime(timestamp), timestamp };
}

function calendarResult(entries, label, issues = [], recognized = true) {
  const warning = issues.length ? `Skipped ${issues.length} malformed event(s): ${issues.join("; ")}` : "";
  if (warning) {
    for (const entry of entries) entry.notes = [...(entry.notes || []), warning];
  }
  return {
    entries,
    sourceStatus: entries.length ? (issues.length ? "partial" : "live") : (recognized && !issues.length ? "empty" : "error"),
    message: [
      recognized ? `Parsed ${entries.length} ${label} food truck events.` : `${label} calendar format was not recognized; previous data must be retained.`,
      warning
    ].filter(Boolean).join(" ")
  };
}

function resolveYear(month, day, now = new Date()) {
  const today = seattleDateTime(now).date;
  const currentYear = Number(today.slice(0, 4));
  const candidate = calendarDate(currentYear, month, day);
  if (candidate && candidate < shiftDate(today, -45)) return calendarDate(currentYear + 1, month, day);
  return candidate;
}

function parseYearlessDate(label, now = new Date()) {
  const cleaned = normalizeText(label).replace(/^[A-Za-z]+\s+/, "");
  const match = cleaned.match(/^(\d{1,2})[./](\d{1,2})$/);
  if (!match) return null;
  return resolveYear(Number(match[1]), Number(match[2]), now);
}

function parseTimePart(part) {
  const cleaned = normalizeText(part).toLowerCase().replace(/\./g, "");
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || "0");
  const meridiem = match[3];
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour < 1)) return null;
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return { hour, minute, hasMeridiem: Boolean(meridiem) };
}

function formatTimeValue(time) {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function parseTimeRange(label) {
  const cleaned = normalizeText(label)
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const [rawStart, rawEnd] = cleaned.split("-").map((part) => part.trim());
  if (!rawStart || !rawEnd) return null;
  const end = parseTimePart(rawEnd);
  if (!end) return null;
  let start = parseTimePart(rawStart);
  if (!start) return null;
  if (!start.hasMeridiem && end.hasMeridiem) {
    start = parseTimePart(`${rawStart}${end.hour >= 12 ? "pm" : "am"}`);
    if (start && start.hour > end.hour && end.hour >= 12) {
      start = parseTimePart(`${rawStart}am`);
    }
  }
  if (!start) return null;
  return {
    start: formatTimeValue(start),
    end: formatTimeValue(end)
  };
}

function buildEntry({ venue, date, timeRange, truck, sourceStatus = "live", sourceType = "venue_calendar", confidence = "venue", notes = [] }) {
  const enrichment = truckSources[normalizeTruckName(truck)] || {};
  const tags = [...new Set([...(enrichment.tags || []), inferMealTag(timeRange.start)])].filter(Boolean);
  return {
    date,
    start: timeRange.start,
    end: timeRange.end,
    truck: canonicalTruckName(truck),
    venue: venue.name,
    address: venue.address,
    cuisine: enrichment.cuisine || "Food truck",
    tags,
    source: venue.url,
    sourceType,
    sourceStatus,
    confidence,
    truckUrl: enrichment.truckUrl,
    menuUrl: enrichment.menuUrl,
    lastScrapedAt: new Date().toISOString(),
    notes
  };
}

function buildEntryFromDateRange({ venue, startDate, endDate, truck, confidence = "venue_calendar_api", notes = [], allowFloating = false }) {
  const start = calendarDateTime(startDate, allowFloating);
  const end = calendarDateTime(endDate, allowFloating);
  if (!start || !end || (start.timestamp !== undefined && end.timestamp !== undefined
    ? end.timestamp <= start.timestamp
    : `${end.date}T${end.time}` <= `${start.date}T${start.time}`)) {
    throw new Error(`Unable to parse calendar event range for ${truck}`);
  }
  return buildEntry({
    venue,
    date: start.date,
    timeRange: {
      start: start.time,
      end: end.time
    },
    truck,
    confidence,
    notes
  });
}

function inferMealTag(start) {
  const hour = Number(start.slice(0, 2));
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  return "Dinner";
}

function cleanEntry(entry) {
  return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined));
}

function isSuccessfulSourceStatus(status) {
  return ["live", "empty", "permanent_food"].includes(status);
}

function markEntries(entries, dataStatus, verifiedAt, staleReason = null) {
  return entries.map((entry) => cleanEntry({
    ...entry,
    dataStatus,
    lastVerifiedAt: entry.lastVerifiedAt || verifiedAt,
    notes: staleReason
      ? [...new Set([...(entry.notes || []), staleReason])]
      : entry.notes
  }));
}

function sourceForVenue(source, attemptedAt, previousSource = null) {
  const sourceStatus = source.sourceStatus;
  const successful = isSuccessfulSourceStatus(sourceStatus);
  return {
    ...source,
    dataStatus: successful ? "fresh" : "error",
    lastAttemptedAt: attemptedAt,
    lastSuccessfulAt: successful ? attemptedAt : previousSource?.lastSuccessfulAt,
    lastScrapedAt: successful ? attemptedAt : previousSource?.lastScrapedAt,
    staleReason: null,
    status: successful && sourceStatus === "live" ? "live" : sourceStatus === "error" ? "pending" : "pending"
  };
}

export function mergeScrapeResults({ results, previousSchedule = [], previousSources = [], now = new Date() }) {
  const attemptedAt = now.toISOString();
  const today = seattleDateTime(now).date;
  const cutoff = shiftDate(today, -STALE_RETENTION_DAYS);
  const previousByVenue = new Map(previousSources.map((source) => [source.id, source]));
  const mergedEntries = [];
  const mergedSources = [];

  for (const result of results) {
    const source = result.source;
    const previousSource = previousByVenue.get(source.id);
    if (isSuccessfulSourceStatus(source.sourceStatus)) {
      mergedEntries.push(...markEntries(result.entries.filter((entry) => entry.sourceType !== "homepage_today" || entry.date >= today), "fresh", attemptedAt));
      mergedSources.push(sourceForVenue(source, attemptedAt, previousSource));
      continue;
    }

    const partial = source.sourceStatus === "partial";
    const freshEntries = partial ? markEntries(result.entries, "fresh", attemptedAt) : [];
    const refreshedEntries = new Set(freshEntries.map((entry) => `${entry.date}|${entry.start}|${normalizeTruckName(entry.truck)}`));
    const staleReason = partial
      ? `Retained while ${source.name} refresh is incomplete.`
      : `Retained while ${source.name} refresh is unavailable.`;
    const retainedEntries = previousSchedule
      .filter((entry) => entry.venue === source.name && entry.date >= cutoff &&
        (entry.sourceType !== "homepage_today" || entry.date >= today) &&
        !refreshedEntries.has(`${entry.date}|${entry.start}|${normalizeTruckName(entry.truck)}`))
      .map((entry) => cleanEntry({
        ...entry,
        dataStatus: "stale",
        lastVerifiedAt: entry.lastVerifiedAt || entry.lastScrapedAt || previousSource?.lastSuccessfulAt,
        notes: [...new Set([...(entry.notes || []), staleReason])]
      }));
    mergedEntries.push(...freshEntries, ...retainedEntries);
    mergedSources.push({
      ...(previousSource || source),
      ...source,
      sourceStatus: source.sourceStatus,
      status: freshEntries.length ? "live" : previousSource?.status || "pending",
      dataStatus: retainedEntries.length || freshEntries.length ? "stale" : "error",
      lastAttemptedAt: attemptedAt,
      lastSuccessfulAt: previousSource?.lastSuccessfulAt,
      lastScrapedAt: previousSource?.lastScrapedAt,
      staleReason: retainedEntries.length ? staleReason : null,
      message: retainedEntries.length
        ? `${source.message} Showing the last successful data until this source recovers.`
        : source.message
    });
  }

  return {
    schedule: dedupeEntries(mergedEntries),
    sources: mergedSources,
    attemptedAt
  };
}

export function validateScrapeResults(results) {
  const rotatingVenues = venues.filter((venue) => (venue.adapter || venue.scrape) && !venue.foodUrl);
  const rotatingResults = results.filter((result) => rotatingVenues.some((venue) => venue.id === result.source.id));
  const successfulRotatingSources = rotatingResults.filter((result) => isSuccessfulSourceStatus(result.source.sourceStatus) ||
    (result.source.sourceStatus === "partial" && result.entries.length));
  if (!successfulRotatingSources.length) {
    throw new Error("All rotating venue sources failed; leaving the existing schedule unchanged.");
  }
  return true;
}

export async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function writeJsonAtomically(filePath, payload) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`);
  await rename(tempPath, filePath);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function dedupeEntries(entries) {
  const seen = new Map();
  for (const entry of entries) {
    const key = [entry.date, entry.start, entry.venue, normalizeTruckName(entry.truck)].join("|");
    if (!seen.has(key)) {
      seen.set(key, cleanEntry({ ...entry, truck: canonicalTruckName(entry.truck) }));
    }
  }
  return [...seen.values()].sort((a, b) => `${a.date}${a.start}${a.venue}`.localeCompare(`${b.date}${b.start}${b.venue}`));
}

export function parseStoup(html, venue, now = new Date()) {
  const $ = cheerio.load(html);
  const entries = [];
  const issues = [];
  const headings = $("h4").filter((_, el) => /[A-Za-z]{3}\s+\d{1,2}[./]\d{1,2}/.test($(el).text()));
  headings.each((_, heading) => {
    const date = parseYearlessDate($(heading).text(), now);
    const parent = $(heading).parent();
    const liveTime = parent.find(".hrs").first().text();
    const timeText = normalizeText(liveTime || $(heading).nextAll("p").first().text());
    const truck = normalizeText(liveTime
      ? parent
        .clone()
        .children("h4,.hrs,img,picture,figure")
        .remove()
        .end()
        .text()
      : $(heading).nextAll("p").eq(1).text()
    );
    if (noTruckPattern.test(truck) || nonFoodEventPattern.test(truck)) return;
    const timeRange = parseTimeRange(timeText);
    if (date && timeRange && truck) {
      entries.push(buildEntry({ venue, date, timeRange, truck }));
    } else {
      issues.push(`Stoup ${normalizeText($(heading).text())}: missing or invalid truck, date, or hours`);
    }
  });
  return calendarResult(entries, "Stoup", issues, headings.length > 0);
}

export function parseUrbanFamily(html, venue, now = new Date()) {
  const $ = cheerio.load(html);
  const events = $(".sugar-calendar-block__event-cell");
  const entries = [];
  const issues = [];
  events.each((index, element) => {
    const event = $(element);
    const truck = normalizeText(event.find(".sugar-calendar-block__event-cell__title").first().text() || event.attr("title") || "");
    if (noTruckPattern.test(truck) || nonFoodEventPattern.test(truck)) return;
    try {
      const calendars = JSON.parse(event.attr("data-calendarsinfo") || "null")?.calendars;
      if (!Array.isArray(calendars) || !calendars.length || calendars.some((calendar) => typeof calendar?.name !== "string")) {
        throw new Error("missing or invalid calendar categories");
      }
      if (!calendars.some((calendar) => /\bfood truck\b/i.test(calendar.name))) return;
      if (!truck) throw new Error("missing truck title");
      const times = event.find(".sugar-calendar-block__event-cell__time time");
      const dayDate = event.attr("data-daydate");
      const startDate = times.first().attr("datetime") || (dayDate ? JSON.parse(dayDate)?.start_date?.datetime : null);
      const endDate = times.eq(1).attr("datetime");
      entries.push(buildEntryFromDateRange({
        venue, startDate, endDate, truck,
        confidence: "venue",
        // Sugar Calendar explicitly labels these datetimes as floating venue-local times.
        allowFloating: true
      }));
    } catch (error) {
      issues.push(`Urban Family ${truck || `item ${index + 1}`}: ${error.message}`);
    }
  });
  return calendarResult(entries, "Urban Family", issues, events.length > 0);
}

export function parseObecHomepage(html, venue, now = new Date()) {
  const $ = cheerio.load(html);
  const widgets = $(".btIconWidgetTitle").map((_, element) => normalizeText($(element).text()).replace(/[\u2018\u2019]/g, "'")).get();
  const text = widgets.find((value) => /food\s+truck/i.test(value)) || "";
  const label = text.match(/^(?:(today|tomorrow)(?:'s)?\s+)?food\s+truck(?:\s+(today|tomorrow))?\s*:\s*(.*)$/i);
  if (!label) return calendarResult([], "Obec", [], false);
  let relativeDay = (label[1] || label[2] || "today").toLowerCase();
  let listing = label[3];
  const relativePrefix = listing.match(/^(today|tomorrow)\s*:\s*(.*)$/i);
  if (relativePrefix) {
    relativeDay = relativePrefix[1].toLowerCase();
    listing = relativePrefix[2];
  }
  const date = shiftDate(seattleDateTime(now).date, relativeDay === "tomorrow" ? 1 : 0);
  const hoursLabel = widgets.find((value) => /^(sun|mon|tue|wed|thu|fri|sat)[a-z.]*\s+hours?:/i.test(value));
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${date}T12:00:00Z`));
  if (relativeDay === "today" && hoursLabel && hoursLabel.slice(0, 3).toLowerCase() !== weekday.toLowerCase()) {
    return calendarResult([], "Obec", ["Homepage weekday does not match the Seattle listing date"], false);
  }
  if (noTruckPattern.test(listing)) return calendarResult([], "Obec");
  const match = listing.match(/^(.+?)\s+(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)$/i);
  if (!match) return calendarResult([], "Obec", ["Missing or invalid food truck hours"], false);
  const [, truck, start, end] = match;
  const timeRange = parseTimeRange(/[ap]\.?m/i.test(`${start} ${end}`) || Number(end.split(":")[0]) > 12
    ? `${start}-${end}` : `${start}pm-${end}pm`);
  if (!timeRange) return calendarResult([], "Obec", ["Invalid food truck time range"], false);
  const entry = buildEntry({
    venue,
    date,
    timeRange,
    truck,
    sourceType: "homepage_today",
    confidence: "today_only",
    notes: [`Obec homepage only exposes ${relativeDay}'s truck; date is in ${SEATTLE_TIME_ZONE}.`]
  });
  return {
    entries: [entry],
    sourceStatus: "live",
    message: `Parsed ${relativeDay}'s Obec food truck: ${entry.truck}.`
  };
}

export function parseBbycEvents(items, venue, now = new Date()) {
  if (!Array.isArray(items)) return calendarResult([], "BBYC", [], false);
  const cutoff = shiftDate(seattleDateTime(now).date, -1);
  const entries = [];
  const issues = [];
  for (const [index, item] of items.entries()) {
    try {
      if (!item || typeof item.title !== "string" || !normalizeText(item.title)) throw new Error("missing truck title");
      const title = normalizeText(item.title);
      if (nonFoodEventPattern.test(title) || noTruckPattern.test(title)) continue;
      const startDate = item.structuredContent?.startDate ?? item.startDate;
      const endDate = item.structuredContent?.endDate ?? item.endDate;
      const entry = buildEntryFromDateRange({
        venue, startDate, endDate, truck: title,
        notes: item.fullUrl ? [`Event page: ${new URL(item.fullUrl, venue.url).href}`] : []
      });
      if (entry.date >= cutoff) entries.push(entry);
    } catch (error) {
      issues.push(`BBYC item ${index + 1}: ${error.message}`);
    }
  }
  return calendarResult(entries, "BBYC", issues);
}

async function scrapeBbyc(venue, now = new Date()) {
  const today = seattleDateTime(now).date;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const months = [0, 1].map((offset) => {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${date.getUTCFullYear()}`;
  });
  const items = [];
  for (const month of months) {
    const url = `https://www.bbycballard.com/api/open/GetItemsByMonth?collectionId=${venue.collectionId}&month=${month}`;
    const response = await fetchWithRetry(url, {
      headers: {
        accept: "application/json",
        "user-agent": "BallardTruckFinder/0.1 (+local manual scraper)"
      }
    });
    if (!response.ok) throw new Error(`BBYC ${month}: ${response.status} ${response.statusText}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error(`BBYC ${month}: unrecognized calendar response; refusing an empty replacement.`);
    items.push(...payload);
  }
  return parseBbycEvents(items, venue, now);
}

function parseNeedsAdapter(html) {
  const hasCalendar = /food truck calendar|iframe|calendar/i.test(html);
  return {
    entries: [],
    sourceStatus: hasCalendar ? "needs_adapter" : "no_schedule_found",
    message: hasCalendar
      ? "Food truck calendar is present, but embedded calendar events were not extractable by the v1 HTML adapter."
      : "No extractable food truck calendar found."
  };
}

function parseNoScheduleFound() {
  return {
    entries: [],
    sourceStatus: "no_schedule_found",
    message: "No extractable rotating food truck schedule found."
  };
}

function parsePermanentFood(html) {
  const text = normalizeText(cheerio.load(html).text());
  const hasPermanentFood = /now serving|full menu|pub fare|food menu/i.test(text);
  return {
    entries: [],
    sourceStatus: hasPermanentFood ? "permanent_food" : "no_schedule_found",
    message: hasPermanentFood
      ? "Reuben's Eats kitchen available; no rotating food truck schedule."
      : "No rotating truck schedule found."
  };
}

export function parseFoodPartner(html, venue) {
  const text = normalizeText(cheerio.load(html).text());
  const hasFoodPartner = /food|kitchen|menu|partner|serving|onsite|on site/i.test(text);
  return {
    entries: [],
    sourceStatus: hasFoodPartner ? "permanent_food" : "no_schedule_found",
    message: hasFoodPartner
      ? `${venue.name} has onsite food or food partners; no rotating truck schedule emitted.`
      : "No onsite food partner signal found."
  };
}

function parseLuckyDate(label, now = new Date()) {
  const match = normalizeText(label).match(/^[A-Za-z]{3}\s+(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/);
  if (!match) return null;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  return calendarDate(year, Number(match[1]), Number(match[2]));
}

export function parseLuckyEnvelope(html, venue, now = new Date()) {
  const $ = cheerio.load(html);
  const entries = [];
  const issues = [];
  const blocks = $("[data-current-context]").filter((_, element) => {
    const context = $(element).attr("data-current-context") || "";
    return context.includes("userItems");
  });
  blocks.each((_, block) => {
    let context;
    try {
      context = JSON.parse($(block).attr("data-current-context"));
      if (!Array.isArray(context.userItems)) throw new Error("missing userItems array");
    } catch {
      issues.push("Lucky Envelope carousel data is malformed");
      return;
    }
    for (const item of context.userItems || []) {
      if (!item || typeof item.title !== "string") {
        issues.push("Lucky Envelope item has no truck title");
        continue;
      }
      const truck = normalizeText(item.title || "");
      const description = cheerio.load(item.description || "");
      description("br").replaceWith("\n");
      const paragraphs = description("p").toArray()
        .flatMap((p) => description(p).text().split(/\r?\n/))
        .map((line) => normalizeText(line)).filter(Boolean);
      const date = parseLuckyDate(paragraphs[0], now);
      const timeRange = parseTimeRange(paragraphs[1] || "");
      if (nonFoodEventPattern.test(truck) || noTruckPattern.test(truck)) continue;
      if (!truck || !date || !timeRange) {
        issues.push(`Lucky Envelope ${truck || "item"}: missing or invalid date, truck, or hours`);
        continue;
      }
      const entry = buildEntry({
        venue,
        date,
        timeRange,
        truck,
        confidence: "venue_homepage_carousel"
      });
      const website = description("a[href]").first().attr("href");
      if (website) {
        entry.truckUrl = website;
      }
      entries.push(entry);
    }
  });
  return calendarResult(entries, "Lucky Envelope", issues, blocks.length > 0);
}

async function fetchHtml(url) {
  const response = await fetchWithRetry(url, {
    headers: {
      "user-agent": "BallardTruckFinder/0.1 (+local manual scraper)"
    }
  });
  return response.text();
}

async function scrapeVenue(venue, now) {
  const attemptedAt = new Date().toISOString();
  try {
    if (venue.scrape) {
      const result = await venue.scrape(venue, now);
      return {
        entries: result.entries || [],
        source: {
          id: venue.id,
          name: venue.name,
          address: venue.address,
          status: result.sourceStatus === "live" ? "live" : "pending",
          sourceStatus: result.sourceStatus,
          source: venue.url,
          foodUrl: venue.foodUrl,
          message: result.message,
          dataStatus: isSuccessfulSourceStatus(result.sourceStatus) ? "fresh" : "error",
          lastAttemptedAt: attemptedAt,
          lastSuccessfulAt: isSuccessfulSourceStatus(result.sourceStatus) ? attemptedAt : null,
          lastScrapedAt: isSuccessfulSourceStatus(result.sourceStatus) ? attemptedAt : null
        }
      };
    }
    const html = process.env.USE_FIXTURES === "1"
      ? await readFile(join(fixtureDir, `${venue.id}.html`), "utf8")
      : await fetchHtml(venue.url);
    const result = venue.adapter(html, venue, now);
    return {
      entries: result.entries || [],
      source: {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        status: result.sourceStatus === "live" ? "live" : "pending",
        sourceStatus: result.sourceStatus,
        source: venue.url,
        foodUrl: venue.foodUrl,
        message: result.message,
        dataStatus: isSuccessfulSourceStatus(result.sourceStatus) ? "fresh" : "error",
        lastAttemptedAt: attemptedAt,
        lastSuccessfulAt: isSuccessfulSourceStatus(result.sourceStatus) ? attemptedAt : null,
        lastScrapedAt: isSuccessfulSourceStatus(result.sourceStatus) ? attemptedAt : null
      }
    };
  } catch (error) {
    return {
      entries: [],
      source: {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        status: "pending",
        sourceStatus: "error",
        source: venue.url,
        foodUrl: venue.foodUrl,
        message: `Scrape failed: ${error.message}`,
        dataStatus: "error",
        lastAttemptedAt: attemptedAt,
        lastSuccessfulAt: null,
        lastScrapedAt: null
      }
    };
  }
}

function buildSourceCards(sources) {
  const liveCount = sources.filter((source) => source.sourceStatus === "live").length;
  const generatedAt = new Date().toISOString();
  return [
    {
      title: "Manual scraper",
      body: `${liveCount} of ${sources.length} venue adapters produced current schedule data at ${generatedAt}.`,
      link: "data/schedule.json"
    },
    {
      title: "Venue first",
      body: "Venue calendars decide what appears; official truck pages only enrich confirmed stops.",
      link: "data/sources.json"
    },
    {
      title: "Adapter queue",
      body: "Sources marked needs adapter, no schedule found, onsite food, empty, or error are shown but not mixed into results.",
      link: "https://www.ballardfoodtrucks.com/"
    }
  ];
}

export async function runScrape({ now = new Date() } = {}) {
  const results = await Promise.all(venues.map((venue) => scrapeVenue(venue, now)));
  validateScrapeResults(results);
  const previousSchedule = await readJson(join(dataDir, "schedule.json"), []);
  const previousSourcesPayload = await readJson(join(dataDir, "sources.json"), { venues: [] });
  const merged = mergeScrapeResults({
    results,
    previousSchedule,
    previousSources: previousSourcesPayload.venues || [],
    now
  });
  const sourcePayload = {
    generatedAt: merged.attemptedAt,
    dataStatus: merged.sources.some((source) => ["stale", "error"].includes(source.dataStatus)) ? "partial" : "fresh",
    lastSuccessfulAt: merged.sources
      .map((source) => source.lastSuccessfulAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null,
    venues: merged.sources,
    sourceCards: buildSourceCards(merged.sources)
  };
  await mkdir(dataDir, { recursive: true });
  await writeJsonAtomically(join(dataDir, "schedule.json"), merged.schedule);
  await writeJsonAtomically(join(dataDir, "sources.json"), sourcePayload);
  return { schedule: merged.schedule, sources: merged.sources };
}

export function formatScrapeWarnings(sources) {
  const unavailable = sources.filter((source) => ["stale", "error"].includes(source.dataStatus) || ["partial", "error"].includes(source.sourceStatus));
  if (!unavailable.length) return "";
  return `## Food Truck Source Warnings\n\n${unavailable.map((source) =>
    `- **${source.name}** (${source.sourceStatus}): ${String(source.message || "Refresh incomplete.").replace(/[\r\n]/g, " ")}`
  ).join("\n")}\n\nValid results were saved; any retained entries are marked stale. Date-specific homepage listings expire after their Seattle date.\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { schedule, sources } = await runScrape();
  const liveSources = sources.filter((source) => source.sourceStatus === "live").length;
  console.log(`Wrote ${schedule.length} schedule entries from ${liveSources}/${sources.length} live venue adapters.`);
  for (const source of sources) {
    console.log(`- ${source.name}: ${source.sourceStatus} (${source.message})`);
  }
  const warnings = formatScrapeWarnings(sources);
  if (warnings && process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${warnings}`);
  }
}
