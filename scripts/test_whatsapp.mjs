import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()]}));
const REF="ijwsnkuvytllytmmfkpp", ORG="61f7f96d-e80c-4d9b-a765-8eb32bd3c70d";
async function sql(q){const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:"POST",headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({query:q})});return r.json()}
const c = (await sql(`SELECT COALESCE(whatsapp_api_key, api_key) k, COALESCE(whatsapp_api_token, api_token) t, COALESCE(whatsapp_subdomain, subdomain) sd, COALESCE(whatsapp_account_sid, account_sid) sid, whatsapp_source_number src FROM exotel_settings WHERE org_id='${ORG}' AND is_active=true;`))[0];
const auth = Buffer.from(`${c.k}:${c.t}`).toString("base64");
const PHONE = "+917738919680";
const url = `https://${c.sd}/v2/accounts/${c.sid}/messages`;
const cb = `https://${REF}.supabase.co/functions/v1/whatsapp-webhook`;

// Realistic test values aligned to email variables
const PROSPECT_FIRST = "Anshuman";   // {{prospect_name}} → first name only for WhatsApp
const CALLER = "Angel";              // {{caller_name}} → SDR who made the call
const DEMO_DAY_DATE = "Thursday, 21 May 2026";  // {{demo_day}} + {{demo_date}}
const DEMO_TIME = "3:30 PM";          // {{demo_time}}

async function send(label, name, params) {
  const r = await fetch(url, { method:"POST", headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/json"}, body: JSON.stringify({
    custom_data: label,
    status_callback: cb,
    whatsapp: { messages: [{ from: c.src, to: PHONE, content: { type:"template", template:{
      name, language:{code:"en"},
      components: [{ type:"body", parameters: params.map(p => ({ type:"text", text:p })) }],
    }}}]}
  }) });
  const t = await r.text();
  console.log(`\n${label}: status=${r.status}`);
  try { const j = JSON.parse(t); console.log("SID:", j?.response?.whatsapp?.messages?.[0]?.data?.sid); } catch { console.log("Body:", t.slice(0,200)); }
}

await send("intro", "worksync_intro_post_call", [PROSPECT_FIRST, CALLER]);
await send("demo", "worksync_demo_confirmation", [PROSPECT_FIRST, CALLER, DEMO_DAY_DATE, DEMO_TIME]);

console.log("\nVariable alignment:");
console.log("  intro {{1}}=prospect first name, {{2}}=SDR caller name");
console.log("  demo  {{1}}=prospect first name, {{2}}=SDR caller name, {{3}}=demo date, {{4}}=demo time");
