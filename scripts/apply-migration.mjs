// Applies a migration SQL file via Supabase Management API.
// Usage: node scripts/apply-migration.mjs <path/to/file.sql>
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!PROJECT_REF || !TOKEN) {
  console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN in .env");
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error("Pass the path to a .sql file.");
  process.exit(1);
}
const sqlPath = resolve(process.cwd(), arg);
const sql = await readFile(sqlPath, "utf8");

console.log(`Applying ${sqlPath} (${sql.length} chars) to project ${PROJECT_REF}…`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);
const body = await res.text();
console.log(`HTTP ${res.status}`);
console.log(body);
if (!res.ok) process.exit(1);
