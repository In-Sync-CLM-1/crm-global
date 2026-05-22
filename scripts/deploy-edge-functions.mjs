// Deploys edge functions via Supabase Management API.
// Usage: node scripts/deploy-edge-functions.mjs <slug> [<slug>...]
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

const slugs = process.argv.slice(2);
if (slugs.length === 0) {
  console.error("Pass at least one function slug.");
  process.exit(1);
}

const FUNCTIONS_DIR = resolve(__dirname, "..", "supabase", "functions");

async function loadShared(slug) {
  const indexPath = resolve(FUNCTIONS_DIR, slug, "index.ts");
  const src = await readFile(indexPath, "utf8");
  const sharedImports = [...src.matchAll(/from\s+['"]\.\.\/_shared\/([^'"]+)['"]/g)].map(m => m[1]);
  const sharedFiles = [];
  for (const file of new Set(sharedImports)) {
    const sharedPath = resolve(FUNCTIONS_DIR, "_shared", file);
    const content = await readFile(sharedPath, "utf8");
    sharedFiles.push({ name: `../_shared/${file}`, content });
  }
  return { src, sharedFiles };
}

for (const slug of slugs) {
  console.log(`\n=== Deploying ${slug} ===`);
  const { src, sharedFiles } = await loadShared(slug);
  const fd = new FormData();
  fd.append(
    "metadata",
    JSON.stringify({ name: slug, verify_jwt: ["email-inbound-webhook", "setup-resend-webhook"].includes(slug) ? false : true, entrypoint_path: "index.ts" })
  );
  fd.append("file", new Blob([src], { type: "application/typescript" }), "index.ts");
  for (const shared of sharedFiles) {
    fd.append(
      "file",
      new Blob([shared.content], { type: "application/typescript" }),
      shared.name
    );
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${slug}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: fd,
    }
  );
  const body = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(body);
  if (!res.ok) process.exit(1);
}
