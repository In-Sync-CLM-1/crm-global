import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()]}));
const REF="ijwsnkuvytllytmmfkpp", ORG="61f7f96d-e80c-4d9b-a765-8eb32bd3c70d";
async function sql(q){const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:"POST",headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({query:q})});return r.json()}
const c = (await sql(`SELECT COALESCE(whatsapp_api_key, api_key) k, COALESCE(whatsapp_api_token, api_token) t, COALESCE(whatsapp_subdomain, subdomain) sd, COALESCE(whatsapp_account_sid, account_sid) sid, waba_id FROM exotel_settings WHERE org_id='${ORG}' AND is_active=true;`))[0];
const auth = Buffer.from(`${c.k}:${c.t}`).toString("base64");
const url = `https://${c.sd}/v2/accounts/${c.sid}/templates?waba_id=${c.waba_id}&limit=100`;
const r = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } });
const j = await r.json();
console.log("Top-level keys:", Object.keys(j));
console.log("Sample full structure (first item):", JSON.stringify(j.response?.whatsapp?.templates?.[0] || j.templates?.[0] || j.data?.[0] || j, null, 2).slice(0, 800));
console.log("\n=== Looking for worksync templates ===");
const all = j.response?.whatsapp?.templates || j.templates || j.data || [];
console.log("All template name fields:", all.slice(0, 5).map(t => Object.keys(t)).flat());
const ws = all.filter(t => JSON.stringify(t).toLowerCase().includes("worksync"));
console.log("Worksync matches:", ws.length);
for (const t of ws) console.log(JSON.stringify(t, null, 2));
