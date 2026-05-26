// globalcrm external scheduler.
//
// The in-database pg_net crons intermittently fail DNS ("Couldn't resolve host
// name", ~98% of calls), so the edge functions they trigger barely fire. This
// Worker runs every minute from Cloudflare's edge (where DNS works) and POSTs to
// the critical functions directly, authenticating with the service-role key (a
// Worker secret) so it passes verify_jwt where required (ai-bulk-call).
//
// Functions triggered each tick (each is idempotent / no-ops when there's
// nothing to do, and self-gates on calling window + wallet internally):
//   - pipeline-action-dispatcher : send queued WhatsApp + stage-driven calls
//   - ai-bulk-call               : dialer tick (queue + dispatch within window)
//   - transliterate-pending      : convert newly-uploaded names to Devanagari
const BASE = "https://ejzjrvazegaxrhqizgaa.supabase.co/functions/v1";
const FUNCTIONS = ["pipeline-action-dispatcher", "ai-bulk-call", "transliterate-pending"];

export default {
  async scheduled(_event, env, _ctx) {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    await Promise.allSettled(
      FUNCTIONS.map((fn) =>
        fetch(`${BASE}/${fn}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: "{}",
        })
      ),
    );
  },

  // Lets us trigger a tick on demand (GET) for testing / manual kicks.
  async fetch(_req, env) {
    await this.scheduled(null, env, null);
    return new Response("ticked\n");
  },
};
