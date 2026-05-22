import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface RealtimeSyncOptions {
  table: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  filter?: string;
  enabled?: boolean;
}

/**
 * Hook for real-time database synchronization
 * Automatically subscribes to table changes and handles cleanup
 * 
 * PERFORMANCE: Uses refs to stabilize callbacks and prevent subscription churn
 */
export function useRealtimeSync({
  table,
  onInsert,
  onUpdate,
  onDelete,
  filter,
  enabled = true,
}: RealtimeSyncOptions) {
  // Use refs to store callbacks to prevent subscription churn
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  // Update refs when callbacks change (but don't trigger re-subscription)
  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onDeleteRef.current = onDelete;
  }, [onDelete]);

  // Stable handler that uses refs
  const handleChange = useCallback((payload: any) => {
    console.log(`[Realtime] ${table} change:`, payload.eventType);
    
    switch (payload.eventType) {
      case "INSERT":
        onInsertRef.current?.(payload);
        break;
      case "UPDATE":
        onUpdateRef.current?.(payload);
        break;
      case "DELETE":
        onDeleteRef.current?.(payload);
        break;
    }
  }, [table]);

  useEffect(() => {
    if (!enabled) return;

    const channelName = filter 
      ? `${table}-changes-${filter}` 
      : `${table}-changes`;

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: table,
          filter: filter,
        },
        handleChange
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] Subscribed to ${table} changes`);
        }
      });

    return () => {
      console.log(`[Realtime] Unsubscribing from ${table} changes`);
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled, handleChange]);
}
