/**
 * GeoNames → Supabase GeoPlace import (Phase 1.5 — real geocoding).
 * Run:  bun db/geonames-import.ts            → places (India full + world cities500)
 *       bun db/geonames-import.ts --hindi    → Hindi alternate names update pass
 * Source data: db/geodata/ (CC BY 4.0, credit shown in app About).
 * Idempotent: INSERT … ON CONFLICT DO NOTHING / UPDATE-only Hindi pass.
 */

import { db } from "../src/lib/db";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// GeoNames dumps live OUTSIDE the project dir (Turbopack must never watch
// 100MB+ data files): /home/z/geodata. Falls back to db/geodata.
const CANDIDATE_DIRS = [
  "/home/z/geodata",
  join(dirname(fileURLToPath(import.meta.url)), "geodata"),
];
const GEO_DIR = CANDIDATE_DIRS.find((d) => existsSync(join(d, "IN.txt"))) ?? CANDIDATE_DIRS[0];

const esc = (s: string): string => s.replace(/'/g, "''").replace(/\0/g, "");
const num = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface Row {
  geonameId: number;
  name: string;
  asciiName: string | null;
  searchText: string;
  countryCode: string;
  countryName: string | null;
  admin1: string | null;
  admin1Name: string | null;
  admin2: string | null;
  admin2Name: string | null;
  featureCode: string;
  population: number;
  latitude: number;
  longitude: number;
  timezone: string;
}

function loadRefMaps() {
  // country code → name
  const country = new Map<string, string>();
  for (const line of readFileSync(join(GEO_DIR, "countryInfo.txt"), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const f = line.split("\t");
    if (f.length > 4 && f[0].length === 2) country.set(f[0], f[4]);
  }
  // "CC.N" → admin1 (state) name
  const admin1 = new Map<string, string>();
  for (const line of readFileSync(join(GEO_DIR, "admin1CodesASCII.txt"), "utf8").split("\n")) {
    if (!line) continue;
    const f = line.split("\t");
    if (f.length >= 2) admin1.set(f[0], f[1]);
  }
  // "CC.N.M" → admin2 (district) name
  const admin2 = new Map<string, string>();
  for (const line of readFileSync(join(GEO_DIR, "admin2Codes.txt"), "utf8").split("\n")) {
    if (!line) continue;
    const f = line.split("\t");
    if (f.length >= 2) admin2.set(f[0], f[1]);
  }
  return { country, admin1, admin2 };
}

/** Parse one GeoNames dump line → Row | null. */
function parseLine(
  line: string,
  refs: { country: Map<string, string>; admin1: Map<string, string>; admin2: Map<string, string> },
): Row | null {
  if (!line) return null;
  const f = line.replace(/\r/g, "").split("\t");
  if (f.length < 18) return null;
  const geonameId = num(f[0]);
  const latitude = num(f[4]);
  const longitude = num(f[5]);
  if (geonameId === null || latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const name = f[1]?.trim();
  if (!name) return null;
  const asciiName = f[2]?.trim() || null;
  const countryCode = f[8]?.trim() || "??";
  const admin1Code = f[10]?.trim() || null;
  const admin2Code = f[11]?.trim() || null;
  const key1 = `${countryCode}.${admin1Code}`;
  const key2 = `${countryCode}.${admin1Code}.${admin2Code}`;
  return {
    geonameId,
    name,
    asciiName,
    searchText: `${name} ${asciiName ?? ""}`.toLowerCase(),
    countryCode,
    countryName: refs.country.get(countryCode) ?? null,
    admin1: admin1Code,
    admin1Name: admin1Code ? refs.admin1.get(key1) ?? null : null,
    admin2: admin2Code,
    admin2Name: admin2Code ? refs.admin2.get(key2) ?? null : null,
    featureCode: f[7]?.trim() || "PPL",
    population: num(f[14]) ?? 0,
    latitude,
    longitude,
    timezone: f[17]?.trim() || "UTC",
  };
}

function toValues(r: Row): string {
  return `(${r.geonameId},'${esc(r.name)}',${r.asciiName ? `'${esc(r.asciiName)}'` : "NULL"},'${esc(r.searchText)}','${r.countryCode}',${r.countryName ? `'${esc(r.countryName)}'` : "NULL"},${r.admin1 ? `'${esc(r.admin1)}'` : "NULL"},${r.admin1Name ? `'${esc(r.admin1Name)}'` : "NULL"},${r.admin2 ? `'${esc(r.admin2)}'` : "NULL"},${r.admin2Name ? `'${esc(r.admin2Name)}'` : "NULL"},'${esc(r.featureCode)}',${r.population},${r.latitude},${r.longitude},'${esc(r.timezone)}')`;
}

async function insertBatch(rows: Row[], batchNo: number, total: number): Promise<number> {
  if (!rows.length) return 0;
  const values = rows.map(toValues).join(",");
  const sql = `INSERT INTO "GeoPlace" ("geonameId","name","asciiName","searchText","countryCode","countryName","admin1","admin1Name","admin2","admin2Name","featureCode","population","latitude","longitude","timezone") VALUES ${values} ON CONFLICT ("geonameId") DO NOTHING`;
  const n = await db.$executeRawUnsafe(sql);
  if (batchNo % 20 === 0 || batchNo === total) {
    console.log(`  batch ${batchNo}/${total} — inserted ${n} (cumulative rows sent ${batchNo * rows.length})`);
  }
  return n;
}

async function importPlaces() {
  const refs = loadRefMaps();
  console.log(`refs: ${refs.country.size} countries, ${refs.admin1.size} admin1, ${refs.admin2.size} admin2`);

  // 1) world cities (population ≥ 500), excluding India (India imported full below)
  console.log("parsing cities500.txt (world, ex-India)…");
  const world: Row[] = [];
  for (const line of readFileSync(join(GEO_DIR, "cities500.txt"), "utf8").split("\n")) {
    if (!line) continue;
    if (line.includes("\tIN\t")) continue;
    const row = parseLine(line, refs);
    if (row) world.push(row);
  }
  console.log(`  → ${world.length} world places`);

  // 2) India full P-class (cities, towns, villages)
  console.log("parsing IN.txt (India full, feature class P)…");
  const india: Row[] = [];
  for (const line of readFileSync(join(GEO_DIR, "IN.txt"), "utf8").split("\n")) {
    const f = line.split("\t");
    if (f.length < 18 || f[6] !== "P") continue;
    const row = parseLine(line, refs);
    if (row) india.push(row);
  }
  console.log(`  → ${india.length} India places (villages/towns/cities)`);

  const BATCH = 2000;
  console.log(`inserting ${world.length + india.length} rows in batches of ${BATCH}…`);
  let total = 0;
  let batchNo = 0;
  const batchesWorld = Math.ceil(world.length / BATCH);
  for (let i = 0; i < world.length; i += BATCH) {
    total += await insertBatch(world.slice(i, i + BATCH), ++batchNo, batchesWorld + Math.ceil(india.length / BATCH));
  }
  for (let i = 0; i < india.length; i += BATCH) {
    total += await insertBatch(india.slice(i, i + BATCH), ++batchNo, batchesWorld + Math.ceil(india.length / BATCH));
  }
  console.log(`DONE places: ${total} rows inserted`);

  // 3) trigram search infrastructure
  console.log("creating pg_trgm extension + GIN index…");
  await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS geoplace_search_trgm ON "GeoPlace" USING gin ("searchText" gin_trgm_ops)`);
  await db.$executeRawUnsafe(`ANALYZE "GeoPlace"`);
  const size = await db.$queryRawUnsafe<{ size: string }[]>(`SELECT pg_size_pretty(pg_total_relation_size('"GeoPlace"')) AS size`);
  const count = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "GeoPlace"`);
  console.log(`GeoPlace: ${count[0].n} rows, total size ${size[0].size}`);
}

/**
 * Hindi + Devanagari alternate names → altNamesHi + appended into
 * searchText (bilingual search). Sources:
 *  1. db/geodata/hi-lines.txt — alternateNames v2 rows with lang=hi
 *     (pre-filtered with: rg $'\thi\t' alternateNames.txt > hi-lines.txt;
 *     v2 columns: alternatenameid, geonameid, isolanguage, name, …)
 *  2. IN.txt / cities500.txt column 4 alternate names — Devanagari tokens
 */
async function importHindi() {
  const hi = new Map<number, string[]>();
  const DEVANAGARI = /[\u0900-\u097F]/;
  const add = (gid: number, nm: string) => {
    nm = nm.trim();
    if (!nm || !Number.isFinite(gid)) return;
    const arr = hi.get(gid);
    if (arr) {
      if (!arr.includes(nm) && arr.length < 6) arr.push(nm);
    } else {
      hi.set(gid, [nm]);
    }
  };

  // 1) labelled 'hi' rows
  const hiPath = join(GEO_DIR, "hi-lines.txt");
  if (existsSync(hiPath)) {
    for (const line of readFileSync(hiPath, "utf8").split("\n")) {
      if (!line) continue;
      const f = line.split("\t");
      if (f.length < 4 || f[2] !== "hi") continue;
      if (f[6] === "1" || f[7] === "1") continue; // colloquial / historic
      add(num(f[1]) ?? -1, f[3]);
    }
    console.log(`  hi-lines.txt: ${hi.size} ids so far`);
  } else {
    console.log("  (hi-lines.txt missing — skipping labelled source)");
  }

  // 2) Devanagari tokens in the main dumps' alternate-names column
  for (const file of ["IN.txt", "cities500.txt"]) {
    const path = join(GEO_DIR, file);
    if (!existsSync(path)) continue;
    let found = 0;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.includes("\t")) continue;
      const f = line.split("\t");
      if (f.length < 4 || !f[3]) continue;
      for (const tok of f[3].split(",")) {
        if (DEVANAGARI.test(tok)) {
          const gid = num(f[0]);
          if (gid !== null) {
            add(gid, tok);
            found++;
          }
        }
      }
    }
    console.log(`  ${file}: ${found} Devanagari tokens`);
  }

  const ids = [...hi.keys()];
  console.log(`  total: ${ids.length} geonameIds with Hindi names`);
  const BATCH = 1000;
  let updated = 0;
  const batches = Math.ceil(ids.length / BATCH);
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const values = slice
      .map((gid) => {
        const joined = esc(hi.get(gid)!.join(" | "));
        return `(${gid}::int,'${joined}'::text)`;
      })
      .join(",");
    const sql = `UPDATE "GeoPlace" SET "altNamesHi" = v.hi, "searchText" = "searchText" || ' ' || lower(v.hi) FROM (VALUES ${values}) AS v(gid, hi) WHERE "GeoPlace"."geonameId" = v.gid`;
    updated += await db.$executeRawUnsafe(sql);
  }
  console.log(`DONE hindi: ${updated} rows updated (batches: ${batches}); Devanagari search now live for major towns`);
  await db.$disconnect();
}

const hindiFlag = process.argv.includes("--hindi");
if (hindiFlag) {
  await importHindi();
} else {
  await importPlaces();
  await db.$disconnect();
}
