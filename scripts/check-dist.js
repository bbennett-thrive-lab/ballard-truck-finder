import { access, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const distDir = join(rootDir, "dist");

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "assets/ballard-food-truck-evening.png",
  "data/schedule.json",
  "data/sources.json"
];

for (const file of requiredFiles) {
  await access(join(distDir, file));
}

const [indexHtml, scheduleJson, sourcesJson] = await Promise.all([
  readFile(join(distDir, "index.html"), "utf8"),
  readFile(join(distDir, "data", "schedule.json"), "utf8"),
  readFile(join(distDir, "data", "sources.json"), "utf8")
]);

if (!indexHtml.includes("app.js?v=venue-badge-1")) {
  throw new Error("dist/index.html is missing the expected cache-busted app script.");
}

if (!indexHtml.includes("styles.css?v=venue-badge-1")) {
  throw new Error("dist/index.html is missing the expected cache-busted stylesheet.");
}

if (!indexHtml.includes("Schedules change. Please confirm with the venue or food truck before heading out.")) {
  throw new Error("dist/index.html is missing the public beta disclaimer.");
}

const schedule = JSON.parse(scheduleJson);
const sources = JSON.parse(sourcesJson);

if (!Array.isArray(schedule)) {
  throw new Error("dist/data/schedule.json must contain an array.");
}

if (!sources || !Array.isArray(sources.venues)) {
  throw new Error("dist/data/sources.json must contain a venues array.");
}

const distStats = await stat(distDir);
if (!distStats.isDirectory()) {
  throw new Error("dist must be a directory.");
}

console.log(`Verified ${requiredFiles.length} required files in ${distDir}`);
