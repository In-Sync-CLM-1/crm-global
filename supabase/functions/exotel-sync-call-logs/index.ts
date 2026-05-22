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

    // Get all active Exotel settings
    const { data: allSettings } = await supabaseClient
      .from('exotel_settings')
      .select('*')
      .eq('is_active', true);

    if (!allSettings || allSettings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active Exotel configurations found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const settings of allSettings) {
      try {
        // Get calls from last 7 days
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7);
        
        const exotelUrl = `https://${settings.subdomain}/v1/Accounts/${settings.account_sid}/Calls.json`;
        const auth = btoa(`${settings.api_key}:${settings.api_token}`);

        const response = await fetch(
          `${exotelUrl}?StartTime>=${fromDate.toISOString()}&PageSize=100`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
            },
          }
        );

        if (!response.ok) {
          console.error(`Failed to fetch calls for org ${settings.org_id}`);
          results.push({ org_id: settings.org_id, status: 'error', error: await response.text() });
          continue;
        }

        const data = await response.json();
        const calls = data.Calls || [];

        let syncedCount = 0;
        let activitiesCreated = 0;

        for (const call of calls) {
          // Check if call already exists
          const { data: existingLog } = await supabaseClient
            .from('call_logs')
            .select('id, activity_id, contact_id, agent_id, org_id, caller_type')
            .eq('exotel_call_sid', call.Sid)
            .single();

          // AI calls are owned by the Bolna webhook — skip overwriting them.
          // Exotel's Calls API doesn't return ConversationDuration for Bolna-routed
          // legs, so re-syncing would clear the duration the webhook just wrote.
          if (existingLog?.caller_type === 'ai') {
            continue;
          }

          // Exotel sends times in IST (UTC+5:30), convert to UTC
          const parseExotelTime = (timeStr: string | null) => {
            if (!timeStr) return null;
            const istDate = new Date(timeStr + ' GMT+0530');
            return istDate.toISOString();
          };

          const callStatus = call.Status?.toLowerCase() || 'unknown';
          const isTerminal = 
            ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus) ||
            callStatus.startsWith('completed') ||
            callStatus.startsWith('failed');

          if (existingLog) {
            // Update existing log
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
              .eq('id', existingLog.id);
            
            // Create missing contact activity for terminal calls
            if (isTerminal && !existingLog.activity_id && existingLog.contact_id) {
              console.log(`Creating missing activity for CallSid ${call.Sid}, contact ${existingLog.contact_id}`);
              
              const callType = call.Direction?.includes('incoming') ? 'Inbound' : 'Outbound';
              const conversationDuration = call.ConversationDuration ? parseInt(call.ConversationDuration) : 0;
              const formattedDuration = conversationDuration > 0 
                ? `${Math.floor(conversationDuration / 60)}m ${conversationDuration % 60}s` 
                : '0s';
              
              const { data: activity, error: activityError } = await supabaseClient
                .from('contact_activities')
                .insert({
                  org_id: existingLog.org_id,
                  contact_id: existingLog.contact_id,
                  activity_type: 'call',
                  subject: `${callType} call - ${callStatus}`,
                  description: `Call duration: ${formattedDuration}. Recording synced from Exotel.`,
                  created_by: existingLog.agent_id,
                  completed_at: parseExotelTime(call.EndTime) || new Date().toISOString(),
                  call_duration: conversationDuration,
                })
                .select('id')
                .single();

              if (activity && !activityError) {
                // Link activity to call log
                await supabaseClient
                  .from('call_logs')
                  .update({ activity_id: activity.id })
                  .eq('id', existingLog.id);
                
                activitiesCreated++;
                console.log(`Created activity ${activity.id} for call ${call.Sid}`);
              } else if (activityError) {
                console.error(`Failed to create activity for call ${call.Sid}:`, activityError);
              }
            }
            
            // Close stuck agent_call_sessions if call is terminal
            if (isTerminal) {
              const { data: session } = await supabaseClient
                .from('agent_call_sessions')
                .select('*')
                .eq('exotel_call_sid', call.Sid)
                .neq('status', 'ended')
                .single();
              
              if (session) {
                console.log(`Closing stuck session for CallSid ${call.Sid}`);
                await supabaseClient
                  .from('agent_call_sessions')
                  .update({
                    status: 'ended',
                    ended_at: call.EndTime ? new Date(call.EndTime).toISOString() : new Date().toISOString(),
                  })
                  .eq('id', session.id);
              }
            }
          } else {
            // Try to match contact by phone number
            const { data: contact } = await supabaseClient
              .from('contacts')
              .select('id')
              .eq('org_id', settings.org_id)
              .eq('phone', call.To || call.From)
              .single();

            // Create new log
            const { data: newLog } = await supabaseClient
              .from('call_logs')
              .insert({
                org_id: settings.org_id,
                exotel_call_sid: call.Sid,
                exotel_conversation_uuid: call.ConversationUuid,
                call_type: call.Direction?.includes('incoming') ? 'inbound' : 'outbound',
                from_number: call.From,
                to_number: call.To,
                direction: call.Direction,
                status: callStatus,
                call_duration: call.Duration ? parseInt(call.Duration) : null,
                conversation_duration: call.ConversationDuration ? parseInt(call.ConversationDuration) : null,
                started_at: parseExotelTime(call.StartTime),
                answered_at: parseExotelTime(call.AnswerTime),
                ended_at: parseExotelTime(call.EndTime),
                recording_url: call.RecordingUrl,
                contact_id: contact?.id,
                exotel_raw_data: call,
              })
              .select('id')
              .single();
            
            // Create contact activity for terminal calls with contact
            if (isTerminal && contact?.id && newLog) {
              console.log(`Creating activity for new call ${call.Sid}, contact ${contact.id}`);
              
              const callType = call.Direction?.includes('incoming') ? 'Inbound' : 'Outbound';
              const conversationDuration = call.ConversationDuration ? parseInt(call.ConversationDuration) : 0;
              const formattedDuration = conversationDuration > 0 
                ? `${Math.floor(conversationDuration / 60)}m ${conversationDuration % 60}s` 
                : '0s';
              
              const { data: activity, error: activityError } = await supabaseClient
                .from('contact_activities')
                .insert({
                  org_id: settings.org_id,
                  contact_id: contact.id,
                  activity_type: 'call',
                  subject: `${callType} call - ${callStatus}`,
                  description: `Call duration: ${formattedDuration}. Synced from Exotel.`,
                  completed_at: parseExotelTime(call.EndTime) || new Date().toISOString(),
                  call_duration: conversationDuration,
                })
                .select('id')
                .single();

              if (activity && !activityError) {
                // Link activity to call log
                await supabaseClient
                  .from('call_logs')
                  .update({ activity_id: activity.id })
                  .eq('id', newLog.id);
                
                activitiesCreated++;
                console.log(`Created activity ${activity.id} for new call ${call.Sid}`);
              } else if (activityError) {
                console.error(`Failed to create activity for new call ${call.Sid}:`, activityError);
              }
            }
            
            // Close stuck agent_call_sessions if call is terminal
            if (isTerminal) {
              const { data: session } = await supabaseClient
                .from('agent_call_sessions')
                .select('*')
                .eq('exotel_call_sid', call.Sid)
                .neq('status', 'ended')
                .single();
              
              if (session) {
                console.log(`Closing stuck session for CallSid ${call.Sid} (new log)`);
                await supabaseClient
                  .from('agent_call_sessions')
                  .update({
                    status: 'ended',
                    ended_at: call.EndTime ? new Date(call.EndTime).toISOString() : new Date().toISOString(),
                  })
                  .eq('id', session.id);
              }
            }
          }
          syncedCount++;
        }

        results.push({ 
          org_id: settings.org_id, 
          status: 'success', 
          synced_count: syncedCount,
          activities_created: activitiesCreated
        });
      } catch (error) {
        console.error(`Error syncing calls for org ${settings.org_id}:`, error);
        results.push({ org_id: settings.org_id, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in exotel-sync-call-logs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
