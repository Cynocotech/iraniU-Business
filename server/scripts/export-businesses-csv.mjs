#!/usr/bin/env node
/**
 * CLI wrapper — uses the same logic as GET /api/admin/businesses/export-csv
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.join(__dirname, ".."));

await import("../src/env.js");
const { exportIraniuBusinessesCsv } = await import("../src/exportBusinessesCsv.js");

function parseArgs() {
  const argv = process.argv.slice(2);
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) out = argv[++i];
  }
  return { out };
}

const { out: outArg } = parseArgs();
const { csvText, rowCount } = exportIraniuBusinessesCsv();
const outPath =
  outArg ||
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "data",
    `businesses-export-iraniu-${new Date().toISOString().slice(0, 10)}.csv`
  );

fs.writeFileSync(outPath, csvText, "utf8");
console.log(`Wrote ${rowCount} rows → ${outPath}`);
