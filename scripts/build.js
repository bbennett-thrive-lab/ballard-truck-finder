import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const distDir = join(rootDir, "dist");

const publicEntries = [
  "index.html",
  "styles.css",
  "app.js",
  "assets",
  "data"
];

async function copyEntry(source, destination) {
  const sourceStats = await stat(source);
  if (sourceStats.isDirectory()) {
    await mkdir(destination, { recursive: true });
    const entries = await readdir(source);
    for (const entry of entries) {
      await copyEntry(join(source, entry), join(destination, entry));
    }
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

for (const entry of publicEntries) {
  await copyEntry(join(rootDir, entry), join(distDir, entry));
}

console.log(`Built static site in ${distDir}`);
