import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import { addDays, addMonths, format, parse, setYear } from "date-fns";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const dataDir = join(rootDir, "data");
const fixtureDir = join(rootDir, "test", "fixtures");

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

function normalizeText(value = "") {
  return cheerio.load("<span></span>")("span").html(value).text().replace(/\s+/g, " ").trim();
}

function normalizeTruckName(value) {
  return normalizeText(value).toLowerCase().replace(/&/g, "and");
}

function parseYearlessDate(label, now = new Date()) {
  const cleaned = normalizeText(label).replace(/^[A-Za-z]+\s+/, "");
  let parsed = parse(cleaned, "MM.dd", now);
  if (Number.isNaN(parsed.getTime())) {
    parsed = parse(cleaned, "MM/dd", now);
  }
  if (Number.isNaN(parsed.getTime())) return null;
  let withYear = setYear(parsed, now.getFullYear());
  if (withYear < addDays(now, -45)) {
    withYear = setYear(parsed, now.getFullYear() + 1);
  }
  return format(withYear, "yyyy-MM-dd");
}

function parseMonthDay(monthName, day, now = new Date()) {
  const parsed = parse(`${monthName} ${day}`, "MMMM d", now);
  if (Number.isNaN(parsed.getTime())) return null;
  let withYear = setYear(parsed, now.getFullYear());
  if (withYear < addDays(now, -45)) {
    withYear = setYear(parsed, now.getFullYear() + 1);
  }
  return format(withYear, "yyyy-MM-dd");
}

function parseTimePart(part) {
  const cleaned = normalizeText(part).toLowerCase().replace(/\./g, "");
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || "0");
  const meridiem = match[3];
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
    truck: normalizeText(truck),
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

function buildEntryFromDateRange({ venue, startDate, endDate, truck, confidence = "venue_calendar_api", notes = [] }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return buildEntry({
    venue,
    date: format(start, "yyyy-MM-dd"),
    timeRange: {
      start: format(start, "HH:mm"),
      end: format(end, "HH:mm")
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

export function dedupeEntries(entries) {
  const seen = new Map();
  for (const entry of entries) {
    const key = [entry.date, entry.start, entry.venue, normalizeTruckName(entry.truck)].join("|");
    if (!seen.has(key)) {
      seen.set(key, cleanEntry(entry));
    }
  }
  return [...seen.values()].sort((a, b) => `${a.date}${a.start}${a.venue}`.localeCompare(`${b.date}${b.start}${b.venue}`));
}

export function parseStoup(html, venue, now = new Date()) {
  const $ = cheerio.load(html);
  const entries = [];
  const headings = $("h4").filter((_, el) => /[A-Za-z]{3}\s+\d{2}[./]\d{2}/.test($(el).text()));
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
    const timeRange = parseTimeRange(timeText);
    if (date && timeRange && truck) {
      entries.push(buildEntry({ venue, date, timeRange, truck }));
    }
  });
  return {
    entries,
    sourceStatus: entries.length ? "live" : "empty",
    message: entries.length ? `Parsed ${entries.length} Stoup food truck events.` : "No Stoup food truck events found."
  };
}

export function parseUrbanFamily(html, venue, now = new Date()) {
  const text = normalizeText(cheerio.load(html).text()).split(" ");
  const monthIndex = text.findIndex((token, index) => token === "June" && text[index + 1] === "Jun");
  const month = monthIndex >= 0 ? text[monthIndex] : format(now, "MMMM");
  const entries = [];
  let currentDay = null;
  for (let i = 0; i < text.length; i += 1) {
    if (/^\d{1,2}$/.test(text[i])) {
      currentDay = Number(text[i]);
      continue;
    }
    const timeCandidate = `${text[i]} ${text[i + 1]} ${text[i + 2]} ${text[i + 3]} ${text[i + 4]}`;
    const timeMatch = timeCandidate.match(/^(\d{1,2}:\d{2}\s+[ap]\.?m\.?)\s+-\s+(\d{1,2}:\d{2}\s+[ap]\.?m\.?)/i);
    if (!currentDay || !timeMatch) continue;
    const date = parseMonthDay(month, currentDay, now);
    const timeRange = parseTimeRange(`${timeMatch[1]} - ${timeMatch[2]}`);
    if (!date || !timeRange) continue;
    const consumed = timeMatch[0].split(" ").length;
    const nameTokens = [];
    for (let j = i + consumed; j < text.length; j += 1) {
      const upcomingTime = `${text[j]} ${text[j + 1]} ${text[j + 2]} ${text[j + 3]} ${text[j + 4]}`;
      if (/^\d{1,2}$/.test(text[j]) || /^\d{1,2}:\d{2}\s+[ap]\.?m\.?\s+-\s+\d{1,2}:\d{2}\s+[ap]\.?m\.?/i.test(upcomingTime)) break;
      nameTokens.push(text[j]);
      if (nameTokens.length >= 7) break;
    }
    const truck = normalizeText(nameTokens.join(" "));
    if (truck && !nonFoodEventPattern.test(truck)) {
      entries.push(buildEntry({ venue, date, timeRange, truck }));
    }
  }
  return {
    entries,
    sourceStatus: entries.length ? "live" : "empty",
    message: entries.length ? `Parsed ${entries.length} Urban Family food truck events.` : "No Urban Family food truck events found after filtering non-food events."
  };
}

export function parseObecHomepage(html, venue, now = new Date()) {
  const text = normalizeText(cheerio.load(html).text());
  const match = text.match(/Food truck:\s+(.+?)\s+(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/i);
  if (!match) {
    return {
      entries: [],
      sourceStatus: "empty",
      message: "No current Obec food truck text found on the homepage."
    };
  }
  const [, truck, start, end] = match;
  const timeRange = parseTimeRange(`${start}pm-${end}pm`);
  if (!timeRange) {
    return {
      entries: [],
      sourceStatus: "empty",
      message: "Obec food truck text was present, but the time range could not be parsed."
    };
  }
  const entry = buildEntry({
    venue,
    date: format(now, "yyyy-MM-dd"),
    timeRange,
    truck,
    sourceType: "homepage_today",
    confidence: "today_only",
    notes: ["Obec homepage only exposes today's truck."]
  });
  return {
    entries: [entry],
    sourceStatus: "live",
    message: `Parsed today's Obec food truck: ${entry.truck}.`
  };
}

export function parseBbycEvents(items, venue, now = new Date()) {
  const cutoff = format(addDays(now, -1), "yyyy-MM-dd");
  const entries = [];
  for (const item of items) {
    const title = normalizeText(item.title || "");
    const startDate = item.startDate || item.structuredContent?.startDate;
    const endDate = item.endDate || item.structuredContent?.endDate;
    if (!title || !startDate || !endDate) continue;
    if (nonFoodEventPattern.test(title)) continue;
    const entry = buildEntryFromDateRange({
      venue,
      startDate,
      endDate,
      truck: title,
      notes: item.fullUrl ? [`Event page: https://www.bbycballard.com${item.fullUrl}`] : []
    });
    if (entry.date >= cutoff) {
      entries.push(entry);
    }
  }
  return {
    entries,
    sourceStatus: entries.length ? "live" : "empty",
    message: entries.length ? `Parsed ${entries.length} BBYC calendar events.` : "No current BBYC food truck events found."
  };
}

async function scrapeBbyc(venue, now = new Date()) {
  const months = [now, addMonths(now, 1)].map((date) => format(date, "MM-yyyy"));
  const items = [];
  for (const month of months) {
    const url = `https://www.bbycballard.com/api/open/GetItemsByMonth?collectionId=${venue.collectionId}&month=${month}`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "BallardTruckFinder/0.1 (+local manual scraper)"
      }
    });
    if (!response.ok) throw new Error(`BBYC ${month}: ${response.status} ${response.statusText}`);
    items.push(...await response.json());
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
  const parsed = parse(normalizeText(label), "EEE M/d/yy", now);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "yyyy-MM-dd");
}

export function parseLuckyEnvelope(html, venue, now = new Date()) {
  const $ = cheerio.load(html);
  const entries = [];
  const blocks = $("[data-current-context]").filter((_, element) => {
    const context = $(element).attr("data-current-context") || "";
    return context.includes("userItems");
  });
  blocks.each((_, block) => {
    let context;
    try {
      context = JSON.parse($(block).attr("data-current-context"));
    } catch {
      return;
    }
    for (const item of context.userItems || []) {
      const truck = normalizeText(item.title || "");
      const description = cheerio.load(item.description || "");
      const paragraphs = description("p").map((__, p) => normalizeText(description(p).text())).get().filter(Boolean);
      const date = parseLuckyDate(paragraphs[0], now);
      const timeRange = parseTimeRange(paragraphs[1] || "");
      if (!truck || !date || !timeRange || nonFoodEventPattern.test(truck)) continue;
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
  return {
    entries,
    sourceStatus: entries.length ? "live" : "empty",
    message: entries.length ? `Parsed ${entries.length} Lucky Envelope food truck events.` : "No Lucky Envelope food truck events found."
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "BallardTruckFinder/0.1 (+local manual scraper)"
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function scrapeVenue(venue, now) {
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
          lastScrapedAt: new Date().toISOString()
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
        lastScrapedAt: new Date().toISOString()
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
        lastScrapedAt: new Date().toISOString()
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
  const results = [];
  for (const venue of venues) {
    results.push(await scrapeVenue(venue, now));
  }
  const schedule = dedupeEntries(results.flatMap((result) => result.entries));
  const sources = results.map((result) => result.source);
  const sourcePayload = {
    generatedAt: new Date().toISOString(),
    venues: sources,
    sourceCards: buildSourceCards(sources)
  };
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "schedule.json"), `${JSON.stringify(schedule, null, 2)}\n`);
  await writeFile(join(dataDir, "sources.json"), `${JSON.stringify(sourcePayload, null, 2)}\n`);
  return { schedule, sources };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { schedule, sources } = await runScrape();
  const liveSources = sources.filter((source) => source.sourceStatus === "live").length;
  console.log(`Wrote ${schedule.length} schedule entries from ${liveSources}/${sources.length} live venue adapters.`);
  for (const source of sources) {
    console.log(`- ${source.name}: ${source.sourceStatus} (${source.message})`);
  }
}
