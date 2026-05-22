import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()]}));
const REF="ijwsnkuvytllytmmfkpp", ORG="61f7f96d-e80c-4d9b-a765-8eb32bd3c70d";
async function sql(q){const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:"POST",headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({query:q})});return r.json()}
const c = (await sql(`SELECT COALESCE(whatsapp_api_key, api_key) k, COALESCE(whatsapp_api_token, api_token) t, COALESCE(whatsapp_subdomain, subdomain) sd, COALESCE(whatsapp_account_sid, account_sid) sid, waba_id FROM exotel_settings WHERE org_id='${ORG}' AND is_active=true;`))[0];
const auth = Buffer.from(`${c.k}:${c.t}`).toString("base64");

const endpoints = [
  `https://${c.sd}/v2/accounts/${c.sid}/whatsapp/phones?waba_id=${c.waba_id}`,
  `https://${c.sd}/v2/accounts/${c.sid}/phones?waba_id=${c.waba_id}`,
  `https://${c.sd}/v2/accounts/${c.sid}/whatsapp/senders?waba_id=${c.waba_id}`,
  `https://${c.sd}/v2/accounts/${c.sid}/whatsapp/numbers?waba_id=${c.waba_id}`,
  `https://${c.sd}/v2/accounts/${c.sid}/wabas/${c.waba_id}/phones`,
];
for (const u of endpoints) {
  const r = await fetch(u, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } });
  console.log(`\n${u}\n  status=${r.status}`);
  console.log("  body:", (await r.text()).slice(0, 400));
}
