import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";
import { Phone, Mail, Calendar, FileText, CheckCircle2, Clock, Video, MailOpen, RefreshCw, MessageSquare, Send, CheckCheck, XCircle, AlertTriangle, Eye, MousePointerClick } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { CallRecordingPlayer } from "./CallRecordingPlayer";
import { toast } from "@/hooks/use-toast";

interface Activity {
  id: string;
  activity_type: string;
  subject: string | null;
  description: string | null;
  created_at: string;
  call_duration: number | null;
  meeting_link: string | null;
  meeting_duration_minutes: number | null;
  scheduled_at: string | null;
  reminder_sent: boolean | null;
  next_action_date: string | null;
  next_action_notes: string | null;
  call_log_id?: string | null;
  recording_url?: string | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  call_dispositions: {
    name: string;
    category: string;
  } | null;
  activity_participants?: Array<{
    id: string;
    name: string;
    email: string;
    response_status: string;
    profiles: {
      first_name: string;
      last_name: string | null;
    } | null;
  }>;
}

interface EmailConversation {
  id: string;
  subject: string | null;
  email_content: string | null;
  sent_at: string;
  direction: string;
  status: string;
  from_email: string;
  to_email: string;
  is_read: boolean;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
  bounce_reason: string | null;
  open_count: number | null;
  click_count: number | null;
}

interface WhatsAppMessage {
  id: string;
  message_content: string | null;
  sent_at: string;
  status: string;
  direction: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  exotel_message_id: string | null;
  template_id: string | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface TimelineItem {
  id: string;
  type: 'activity' | 'email' | 'whatsapp';
  timestamp: string;
  activity?: Activity;
  email?: EmailConversation;
  whatsapp?: WhatsAppMessage;
}

interface CustomerJourneyProps {
  contactId: string;
  onResendWhatsApp?: (templateId: string | null) => void;
}

export const CustomerJourney = ({ contactId, onResendWhatsApp }: CustomerJourneyProps) => {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(3);
  const [isSyncing, setIsSyncing] = useState(false);
  const notify = useNotification();

  useEffect(() => {
    fetchTimeline();

    const activitiesChannel = supabase
      .channel(`contact_activities_${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_activities",
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          fetchTimeline();
        }
      )
      .subscribe();

    const emailsChannel = supabase
      .channel(`email_conversations_${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_conversations",
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          fetchTimeline();
        }
      )
      .subscribe();

    const whatsappChannel = supabase
      .channel(`whatsapp_messages_${contactId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          fetchTimeline();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activitiesChannel);
      supabase.removeChannel(emailsChannel);
      supabase.removeChannel(whatsappChannel);
    };
  }, [contactId]);

  const fetchTimeline = async () => {
    try {
      // Fetch activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("contact_activities")
        .select(
          `
          id,
          activity_type,
          subject,
          description,
          created_at,
          call_duration,
          meeting_link,
          meeting_duration_minutes,
          scheduled_at,
          reminder_sent,
          next_action_date,
          next_action_notes,
          profiles!contact_activities_created_by_fkey (
            first_name,
            last_name
          ),
          call_dispositions (
            name,
            category
          ),
          activity_participants (
            id,
            name,
            email,
            response_status,
            profiles:user_id (first_name, last_name)
          )
        `
        )
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (activitiesError) throw activitiesError;

      // Fetch call logs for activities with recordings
      const callActivityIds = (activitiesData || [])
        .filter(a => a.activity_type === 'call')
        .map(a => a.id);
      
      let callLogsMap = new Map<string, { id: string; recording_url: string | null }>();
      
      if (callActivityIds.length > 0) {
        const { data: callLogs } = await supabase
          .from('call_logs')
          .select('id, activity_id, recording_url')
          .in('activity_id', callActivityIds)
          .not('recording_url', 'is', null);
        
        if (callLogs) {
          callLogs.forEach(log => {
            if (log.activity_id) {
              callLogsMap.set(log.activity_id, { id: log.id, recording_url: log.recording_url });
            }
          });
        }
      }

      // Enrich activities with call log data
      const enrichedActivities = (activitiesData || []).map(act => {
        if (act.activity_type === 'call' && callLogsMap.has(act.id)) {
          const callLog = callLogsMap.get(act.id);
          return {
            ...act,
            call_log_id: callLog?.id,
            recording_url: callLog?.recording_url,
          };
        }
        return act;
      });

      // Fetch email conversations
      const { data: emailsData, error: emailsError } = await supabase
        .from("email_conversations")
        .select("id, subject, email_content, sent_at, direction, status, from_email, to_email, is_read, delivered_at, opened_at, bounced_at, bounce_reason, open_count, click_count")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false });

      if (emailsError) throw emailsError;

      // Fetch WhatsApp messages
      const { data: whatsappData, error: whatsappError } = await supabase
        .from("whatsapp_messages")
        .select("id, message_content, sent_at, status, direction, delivered_at, read_at, error_message, exotel_message_id, sent_by, template_id")
        .eq("contact_id", contactId)
        .order("sent_at", { ascending: false });

      if (whatsappError) throw whatsappError;

      // Resolve sender names via a single profiles lookup
      const senderIds = Array.from(
        new Set((whatsappData || []).map((m: any) => m.sent_by).filter(Boolean))
      );
      const profileMap = new Map<string, { first_name: string | null; last_name: string | null }>();
      if (senderIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", senderIds);
        (profilesData || []).forEach((p: any) => profileMap.set(p.id, { first_name: p.first_name, last_name: p.last_name }));
      }

      // Merge and create unified timeline.
      // Skip activity_type='whatsapp' contact_activities rows — the same send
      // is rendered from whatsapp_messages which carries the real delivery status.
      const activityItems: TimelineItem[] = enrichedActivities
        .filter(act => act.activity_type !== 'whatsapp')
        .map(act => ({
          id: `activity-${act.id}`,
          type: 'activity' as const,
          timestamp: act.created_at,
          activity: act,
        }));

      const emailItems: TimelineItem[] = (emailsData || []).map(email => ({
        id: `email-${email.id}`,
        type: 'email' as const,
        timestamp: email.sent_at,
        email,
      }));

      const whatsappItems: TimelineItem[] = (whatsappData || []).map((msg: any) => ({
        id: `whatsapp-${msg.id}`,
        type: 'whatsapp' as const,
        timestamp: msg.sent_at,
        whatsapp: { ...msg, profiles: msg.sent_by ? profileMap.get(msg.sent_by) || null : null },
      }));

      // Combine and sort by timestamp (newest first)
      const combinedTimeline = [...activityItems, ...emailItems, ...whatsappItems].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setTimeline(combinedTimeline);
    } catch (error: any) {
      console.error("Error fetching timeline:", error);
      notify.error("Error", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncRecordings = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('exotel-sync-call-logs');
      
      if (error) throw error;
      
      toast({
        title: "Recordings synced",
        description: "Call recordings have been synced from Exotel",
      });
      
      // Refetch timeline to show updated recordings
      await fetchTimeline();
    } catch (error) {
      console.error('Error syncing recordings:', error);
      toast({
        title: "Sync failed",
        description: "Failed to sync recordings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleEmailExpansion = (emailId: string) => {
    setExpandedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return Phone;
      case "email":
        return Mail;
      case "meeting":
        return Calendar;
      case "note":
        return FileText;
      default:
        return FileText;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "call":
        return "bg-blue-500";
      case "email":
        return "bg-purple-500";
      case "meeting":
        return "bg-green-500";
      case "note":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  // Map raw message statuses to a friendly label, icon, and color for the pill.
  const getWhatsAppStatusBadge = (status: string, hasError: boolean) => {
    const s = (status || "").toLowerCase();
    if (hasError || s === "failed") {
      return { label: "Failed", icon: XCircle, classes: "bg-red-100 text-red-700 border-red-200" };
    }
    if (s === "read") return { label: "Read", icon: CheckCheck, classes: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    if (s === "delivered") return { label: "Delivered", icon: CheckCircle2, classes: "bg-green-100 text-green-700 border-green-200" };
    if (s === "sent") return { label: "Sent", icon: Send, classes: "bg-blue-100 text-blue-700 border-blue-200" };
    if (s === "pending") return { label: "Pending", icon: Clock, classes: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    if (s === "scheduled") return { label: "Scheduled", icon: Clock, classes: "bg-amber-100 text-amber-700 border-amber-200" };
    return { label: status || "Unknown", icon: MessageSquare, classes: "bg-gray-100 text-gray-700 border-gray-200" };
  };

  const getEmailStatusBadge = (email: EmailConversation) => {
    if (email.direction === "inbound") {
      return { label: "Received", icon: MailOpen, classes: "bg-green-100 text-green-700 border-green-200" };
    }
    const s = (email.status || "").toLowerCase();
    if (s === "bounced" || s === "failed") {
      return { label: "Bounced", icon: XCircle, classes: "bg-red-100 text-red-700 border-red-200" };
    }
    if (s === "complained") {
      return { label: "Marked Spam", icon: AlertTriangle, classes: "bg-orange-100 text-orange-700 border-orange-200" };
    }
    if (s === "scheduled") {
      return { label: "Scheduled", icon: Clock, classes: "bg-amber-100 text-amber-700 border-amber-200" };
    }
    if (s === "opened" || (email.open_count && email.open_count > 0)) {
      return { label: "Opened", icon: Eye, classes: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    }
    if (s === "delivered" || email.delivered_at) {
      return { label: "Delivered", icon: CheckCircle2, classes: "bg-green-100 text-green-700 border-green-200" };
    }
    if (s === "sent") {
      return { label: "Sent", icon: Send, classes: "bg-blue-100 text-blue-700 border-blue-200" };
    }
    return { label: email.status || "Sent", icon: Send, classes: "bg-blue-100 text-blue-700 border-blue-200" };
  };

  const getDispositionColor = (category: string | undefined) => {
    switch (category) {
      case "positive":
        return "text-green-600";
      case "negative":
        return "text-red-600";
      case "follow_up":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No customer journey yet</p>
      </Card>
    );
  }

  const visibleTimeline = timeline.slice(0, displayCount);
  const hasMore = timeline.length > displayCount;

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 10);
  };

  return (
    <div className="space-y-4">
      {/* Header with Sync Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Customer Journey</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncRecordings}
          disabled={isSyncing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Recordings'}
        </Button>
      </div>

      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-6">
        {visibleTimeline.map((item, index) => {
          if (item.type === 'activity' && item.activity) {
            const activity = item.activity;
            const Icon = getActivityIcon(activity.activity_type);
            const colorClass = getActivityColor(activity.activity_type);

            return (
              <div key={item.id} className="relative pl-20">
                {/* Timeline dot and icon */}
                <div className={`absolute left-4 w-8 h-8 rounded-full ${colorClass} flex items-center justify-center shadow-lg`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>

                {/* Activity card */}
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-sm capitalize flex items-center gap-2">
                        {activity.activity_type}
                        {activity.call_dispositions && (
                          <CheckCircle2 className={`h-4 w-4 ${getDispositionColor(activity.call_dispositions.category)}`} />
                        )}
                      </h4>
                      {activity.subject && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-foreground">{activity.subject}</p>
                          {activity.activity_type === 'email' && activity.subject?.startsWith('Reply:') && (
                            <Badge variant="default" className="text-xs">Received</Badge>
                          )}
                          {activity.activity_type === 'email' && !activity.subject?.startsWith('Reply:') && (
                            <Badge variant="secondary" className="text-xs">Sent</Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="text-xs font-medium text-foreground">
                        {format(new Date(activity.created_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  {activity.description && (
                    <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {activity.profiles && (
                      <span>
                        By {activity.profiles.first_name} {activity.profiles.last_name}
                      </span>
                    )}
                    {activity.call_duration && (
                      <span>Duration: {Math.floor(activity.call_duration / 60)}:{(activity.call_duration % 60).toString().padStart(2, "0")}</span>
                    )}
                    {activity.call_dispositions && (
                      <span className={getDispositionColor(activity.call_dispositions.category)}>
                        {activity.call_dispositions.name}
                      </span>
                    )}
                  </div>

                  {/* Callback Reminder */}
                  {activity.next_action_date && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">Callback Scheduled</span>
                            <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 text-xs">
                              {format(new Date(activity.next_action_date), 'MMM d, yyyy h:mm a')}
                            </Badge>
                          </div>
                          {activity.next_action_notes && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">{activity.next_action_notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Call Recording Player */}
                  {activity.activity_type === 'call' && activity.call_log_id && activity.recording_url && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Recording:</span>
                      <CallRecordingPlayer callLogId={activity.call_log_id} variant="outline" size="sm" />
                    </div>
                  )}

                  {activity.activity_type === 'meeting' && (
                    <div className="mt-3 space-y-2">
                      {activity.meeting_link && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(activity.meeting_link!, '_blank')}
                            className="flex items-center gap-2"
                          >
                            <Video className="h-4 w-4" />
                            Join Meeting
                          </Button>
                          {activity.scheduled_at && new Date(activity.scheduled_at) > new Date() && (
                            <Badge variant="secondary">
                              {format(new Date(activity.scheduled_at), 'MMM d, h:mm a')}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {activity.activity_participants && activity.activity_participants.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {activity.activity_participants.map(p => (
                            <Badge key={p.id} variant="outline" className="text-xs">
                              {p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name || ''}` : p.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {activity.reminder_sent && (
                        <Badge variant="secondary" className="text-xs">
                          Reminder sent
                        </Badge>
                      )}
                    </div>
                  )}
                </Card>

                {/* Connector line to next item */}
                {index < timeline.length - 1 && (
                  <div className="absolute left-8 top-12 w-0.5 h-6 bg-border" />
                )}
              </div>
            );
          }

          // WhatsApp message rendering — show real delivery status from whatsapp_messages
          if (item.type === 'whatsapp' && item.whatsapp) {
            const msg = item.whatsapp;
            const isInbound = msg.direction === 'inbound';
            const badge = getWhatsAppStatusBadge(msg.status, !!msg.error_message);
            const StatusIcon = badge.icon;

            return (
              <div key={item.id} className="relative pl-20">
                <div className={`absolute left-4 w-8 h-8 rounded-full ${isInbound ? 'bg-green-500' : 'bg-green-600'} flex items-center justify-center shadow-lg`}>
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>

                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-sm">WhatsApp</h4>
                        <Badge variant="outline" className={`text-xs gap-1 ${badge.classes}`}>
                          <StatusIcon className="h-3 w-3" />
                          {badge.label}
                        </Badge>
                        {isInbound && (
                          <Badge variant="default" className="text-xs">Received</Badge>
                        )}
                      </div>
                      {msg.profiles && !isInbound && (
                        <div className="text-xs text-muted-foreground mt-1">
                          By {msg.profiles.first_name} {msg.profiles.last_name}
                        </div>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap ml-4">
                      <div className="text-xs font-medium text-foreground">
                        {format(new Date(msg.sent_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(msg.sent_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  {msg.message_content && (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded border whitespace-pre-wrap">
                      {msg.message_content}
                    </div>
                  )}

                  {msg.error_message && (
                    <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded border border-red-100">
                      Error: {msg.error_message}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 mt-2">
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {msg.delivered_at && (
                        <span>Delivered {format(new Date(msg.delivered_at), 'MMM d, h:mm a')}</span>
                      )}
                      {msg.read_at && (
                        <span>Read {format(new Date(msg.read_at), 'MMM d, h:mm a')}</span>
                      )}
                    </div>
                    {(badge.label === "Failed") && onResendWhatsApp && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => onResendWhatsApp(msg.template_id)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Resend
                      </Button>
                    )}
                  </div>
                </Card>

                {index < visibleTimeline.length - 1 && (
                  <div className="absolute left-8 top-12 w-0.5 h-6 bg-border" />
                )}
              </div>
            );
          }

          // Email conversation rendering
          if (item.type === 'email' && item.email) {
            const email = item.email;
            const isInbound = email.direction === 'inbound';
            const isExpanded = expandedEmails.has(email.id);
            const emailPreview = email.email_content?.substring(0, 150) || '';

            return (
              <div key={item.id} className="relative pl-20">
                {/* Timeline dot and icon */}
                <div className={`absolute left-4 w-8 h-8 rounded-full ${isInbound ? 'bg-green-500' : 'bg-blue-500'} flex items-center justify-center shadow-lg`}>
                  <Mail className="h-4 w-4 text-white" />
                </div>

                {/* Email card */}
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-sm">Email</h4>
                        {(() => {
                          const badge = getEmailStatusBadge(email);
                          const Icon = badge.icon;
                          return (
                            <Badge variant="outline" className={`text-xs gap-1 ${badge.classes}`}>
                              <Icon className="h-3 w-3" />
                              {badge.label}
                            </Badge>
                          );
                        })()}
                        {!isInbound && email.open_count && email.open_count > 0 && (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {email.open_count}
                          </span>
                        )}
                        {!isInbound && email.click_count && email.click_count > 0 && (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <MousePointerClick className="h-3 w-3" /> {email.click_count}
                          </span>
                        )}
                        {isInbound && !email.is_read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" title="Unread" />
                        )}
                      </div>
                      {email.subject && (
                        <p className="text-sm text-foreground font-medium">{email.subject}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{isInbound ? 'From' : 'To'}:</span>
                        <span className="font-mono">{isInbound ? email.from_email : email.to_email}</span>
                      </div>
                      {email.bounce_reason && (
                        <p className="text-xs text-red-600 mt-1">Bounce: {email.bounce_reason}</p>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap ml-4">
                      <div className="text-xs font-medium text-foreground">
                        {format(new Date(email.sent_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(email.sent_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  {email.email_content && (
                    <div className="mt-3">
                      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded border">
                        {isExpanded ? (
                          <div className="whitespace-pre-wrap">{email.email_content}</div>
                        ) : (
                          <div>{emailPreview}{email.email_content.length > 150 && '...'}</div>
                        )}
                      </div>
                      {email.email_content.length > 150 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEmailExpansion(email.id)}
                          className="mt-2 h-8 text-xs"
                        >
                          {isExpanded ? 'Show less' : 'Read more'}
                        </Button>
                      )}
                    </div>
                  )}
                </Card>

                {/* Connector line to next item */}
                {index < visibleTimeline.length - 1 && (
                  <div className="absolute left-8 top-12 w-0.5 h-6 bg-border" />
                )}
              </div>
            );
          }

          return null;
        })}

        {/* Load More Button */}
        {hasMore && (
          <div className="relative pl-20">
            <Card className="p-4 text-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                className="w-full"
              >
                Load More ({timeline.length - displayCount} more activities)
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};
