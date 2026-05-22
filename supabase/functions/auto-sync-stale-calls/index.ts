import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = getSupabaseClient();

    // Find calls stuck in 'in-progress' or 'ringing' for more than 10 minutes
    const staleThreshold = new Date();
    staleThreshold.setMinutes(staleThreshold.getMinutes() - 10);

    const { data: staleCalls, error: staleError } = await supabaseClient
      .from('call_logs')
      .select('*')
      .in('status', ['in-progress', 'ringing', 'initiating', 'queued'])
      .lt('created_at', staleThreshold.toISOString())
      .is('activity_id', null);

    if (staleError) {
      console.error('Error fetching stale calls:', staleError);
      throw staleError;
    }

    if (!staleCalls || staleCalls.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No stale calls found', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${staleCalls.length} stale calls to sync`);

    // Get unique org settings
    const orgSettings = new Map();
    for (const call of staleCalls) {
      if (!orgSettings.has(call.org_id)) {
        const { data: settings } = await supabaseClient
          .from('exotel_settings')
          .select('*')
          .eq('org_id', call.org_id)
          .eq('is_active', true)
          .single();
        
        if (settings) {
          orgSettings.set(call.org_id, settings);
        }
      }
    }

    let syncedCount = 0;
    let activitiesCreated = 0;

    // Helper function to parse Exotel IST times to UTC
    const parseExotelTime = (timeStr: string | null) => {
      if (!timeStr) return null;
      const istDate = new Date(timeStr + ' GMT+0530');
      return istDate.toISOString();
    };

    for (const callLog of staleCalls) {
      const settings = orgSettings.get(callLog.org_id);
      if (!settings) {
        console.log(`No active Exotel settings for org ${callLog.org_id}`);
        continue;
      }

      try {
        // Fetch call details from Exotel API
        const exotelUrl = `https://${settings.subdomain}/v1/Accounts/${settings.account_sid}/Calls/${callLog.exotel_call_sid}.json`;
        const auth = btoa(`${settings.api_key}:${settings.api_token}`);

        const response = await fetch(exotelUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        });

        if (!response.ok) {
          console.error(`Failed to fetch call ${callLog.exotel_call_sid} from Exotel:`, await response.text());
          continue;
        }

        const data = await response.json();
        const call = data.Call;

        if (!call) {
          console.error(`No call data in response for ${callLog.exotel_call_sid}`);
          continue;
        }

        const callStatus = call.Status?.toLowerCase() || 'unknown';
        const isTerminal = 
          ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus) ||
          callStatus.startsWith('completed') ||
          callStatus.startsWith('failed');

        console.log(`Call ${callLog.exotel_call_sid}: Exotel status = ${callStatus}, isTerminal = ${isTerminal}`);

        // Update call log with latest data
        await supabaseClient
          .from('call_logs')
          .update({
            status: callStatus,
            call_duration: call.Duration ? parseInt(call.Duration) : null,
            conversation_duration: call.ConversationDuration ? parseInt(call.ConversationDuration) : null,
            started_at: parseExotelTime(call.StartTime),
            answered_at: parseExotelTime(call.AnswerTime),
            ended_at: parseExotelTime(call.EndTime),
            recording_url: call.RecordingUrl,
            exotel_raw_data: call,
          })
          .eq('id', callLog.id);

        syncedCount++;

        // Create activity for terminal calls
        if (isTerminal && callLog.contact_id && !callLog.activity_id) {
          const callType = callLog.call_type === 'inbound' ? 'Inbound' : 'Outbound';
          const conversationDuration = call.ConversationDuration ? parseInt(call.ConversationDuration) : 0;
          const formattedDuration = conversationDuration > 0 
            ? `${Math.floor(conversationDuration / 60)}m ${conversationDuration % 60}s` 
            : '0s';

          const { data: activity, error: activityError } = await supabaseClient
            .from('contact_activities')
            .insert({
              org_id: callLog.org_id,
              contact_id: callLog.contact_id,
              activity_type: 'call',
              subject: `${callType} call - ${callStatus}`,
              description: `Call duration: ${formattedDuration}. Recording auto-synced.`,
              created_by: callLog.agent_id,
              completed_at: parseExotelTime(call.EndTime) || new Date().toISOString(),
              call_duration: conversationDuration,
            })
            .select('id')
            .single();

          if (activity && !activityError) {
            await supabaseClient
              .from('call_logs')
              .update({ activity_id: activity.id })
              .eq('id', callLog.id);
            
            activitiesCreated++;
            console.log(`Created activity ${activity.id} for stale call ${callLog.exotel_call_sid}`);
          } else if (activityError) {
            console.error(`Failed to create activity for call ${callLog.exotel_call_sid}:`, activityError);
          }
        }

        // Close stuck agent sessions
        if (isTerminal) {
          await supabaseClient
            .from('agent_call_sessions')
            .update({
              status: 'ended',
              ended_at: parseExotelTime(call.EndTime) || new Date().toISOString(),
            })
            .eq('exotel_call_sid', callLog.exotel_call_sid)
            .neq('status', 'ended');
        }
      } catch (error) {
        console.error(`Error syncing call ${callLog.exotel_call_sid}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        stale_calls_found: staleCalls.length,
        synced: syncedCount,
        activities_created: activitiesCreated 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-sync-stale-calls:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
