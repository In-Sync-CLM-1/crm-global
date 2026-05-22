import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "./useRealtimeSync";
import { useOrgContext } from "./useOrgContext";
import { toast } from "./use-toast";
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
  metadata: any;
  created_at: string;
  expires_at: string;
}

// Play notification sound for urgent reminders
function playUrgentNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    
    // Create a pleasant two-tone alert
    setTimeout(() => {
      oscillator.frequency.value = 1000;
    }, 150);
    
    setTimeout(() => {
      oscillator.frequency.value = 800;
    }, 300);
    
    setTimeout(() => {
      oscillator.frequency.value = 1000;
    }, 450);
    
    setTimeout(() => {
      oscillator.stop();
    }, 600);
  } catch (err) {
    console.log('Audio notification not supported');
  }
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { effectiveOrgId } = useOrgContext();
  const location = useLocation();
  const navigate = useNavigate();

  // Use ref to store queryClient to prevent callback recreation
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  // Refs let the realtime callback see the current location without re-subscribing
  const locationRef = useRef(location);
  locationRef.current = location;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Request browser notification permission once
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications", effectiveOrgId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("org_id", effectiveOrgId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
    enabled: !!effectiveOrgId,
  });

  // Count unread notifications
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications" as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClientRef.current.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications" as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("org_id", effectiveOrgId)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClientRef.current.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Stable callback using useCallback with empty deps
  const handleInsert = useCallback((payload: any) => {
    queryClientRef.current.invalidateQueries({ queryKey: ["notifications"] });

    const notification = payload.new;
    if (!notification || notification.is_read) return;

    // For chat messages, suppress in-app toast when the user is already viewing that conversation
    let suppressInAppToast = false;
    if (notification.type === "chat_message") {
      const convId = notification.metadata?.conversation_id || notification.entity_id;
      if (convId && locationRef.current.pathname === `/chat/${convId}`) {
        suppressInAppToast = true;
      }
    }

    // Check if it's an urgent callback reminder
    const isUrgentCallback =
      (notification.type === 'next_action_urgent' || notification.type === 'callback_reminder') &&
      notification.metadata?.is_callback_reminder;

    if (!suppressInAppToast) {
      if (isUrgentCallback) {
        playUrgentNotificationSound();
        toast({
          title: "🔔 " + notification.title,
          description: notification.message,
          duration: 10000,
        });
      } else {
        toast({
          title: notification.title,
          description: notification.message,
        });
      }
    }

    // Fire browser notification when the tab is hidden or unfocused
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      (document.hidden || !document.hasFocus())
    ) {
      try {
        const browserNotif = new Notification(notification.title, {
          body: notification.message,
          icon: "/favicon.ico",
          tag: notification.id,
        });
        browserNotif.onclick = () => {
          window.focus();
          if (notification.action_url) {
            navigateRef.current(notification.action_url);
          }
          browserNotif.close();
        };
      } catch {
        // ignore - some browsers throw on construction
      }
    }
  }, []);

  // Stable callback for updates
  const handleUpdate = useCallback(() => {
    queryClientRef.current.invalidateQueries({ queryKey: ["notifications"] });
  }, []);

  // Real-time subscription for new notifications
  useRealtimeSync({
    table: "notifications",
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    filter: effectiveOrgId ? `org_id=eq.${effectiveOrgId}` : undefined,
    enabled: !!effectiveOrgId,
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
}
