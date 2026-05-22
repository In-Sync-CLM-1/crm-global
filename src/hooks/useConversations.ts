 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthProvider";
 import { useOrgContext } from "@/hooks/useOrgContext";
 import { useEffect, useRef } from "react";
 import { useLocation } from "react-router-dom";

 // Soft "ping" for incoming chat messages — pleasant ascending two-tone
 function playChatNotificationSound() {
   try {
     const Ctor = window.AudioContext || (window as any).webkitAudioContext;
     if (!Ctor) return;
     const ctx = new Ctor();
     const osc = ctx.createOscillator();
     const gain = ctx.createGain();
     osc.connect(gain);
     gain.connect(ctx.destination);

     osc.type = "sine";
     osc.frequency.setValueAtTime(880, ctx.currentTime);
     osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);

     gain.gain.setValueAtTime(0, ctx.currentTime);
     gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
     gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

     osc.start(ctx.currentTime);
     osc.stop(ctx.currentTime + 0.4);
   } catch {
     // Audio not available; ignore
   }
 }
 
 export interface ConversationParticipant {
   user_id: string;
   is_admin: boolean;
   last_read_at: string;
   profile: {
     id: string;
     full_name: string | null;
     avatar_url: string | null;
   } | null;
 }
 
 export interface Conversation {
   id: string;
   org_id: string;
   conversation_type: "direct" | "group";
   name: string | null;
   created_by: string | null;
   last_message_at: string;
   created_at: string;
   participants: ConversationParticipant[];
   last_message?: {
     content: string | null;
     message_type: string;
     sender_id: string;
     created_at: string;
   } | null;
   unread_count: number;
 }
 
 export function useConversations() {
   const { user } = useAuth();
   const { effectiveOrgId } = useOrgContext();
   const queryClient = useQueryClient();
 
   const query = useQuery({
     queryKey: ["chat-conversations", user?.id, effectiveOrgId],
     queryFn: async (): Promise<Conversation[]> => {
       if (!user?.id || !effectiveOrgId) return [];
 
       // Get conversations where user is a participant
       const { data: participantData, error: participantError } = await supabase
         .from("chat_participants")
         .select("conversation_id")
         .eq("user_id", user.id);
 
       if (participantError) throw participantError;
       if (!participantData?.length) return [];
 
       const conversationIds = participantData.map((p) => p.conversation_id);
 
       // Get conversations with all details
       const { data: conversations, error: convError } = await supabase
         .from("chat_conversations")
         .select("*")
         .in("id", conversationIds)
         .eq("org_id", effectiveOrgId)
         .order("last_message_at", { ascending: false });
 
       if (convError) throw convError;
       if (!conversations?.length) return [];
 
       // Get all participants for these conversations
       const { data: allParticipants, error: partError } = await supabase
         .from("chat_participants")
         .select("*")
         .in("conversation_id", conversationIds);
 
       if (partError) throw partError;
 
       // Get profiles for all participants
       const userIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];
       const { data: profiles, error: profileError } = await supabase
         .from("profiles")
         .select("id, first_name, last_name, avatar_url")
         .in("id", userIds);
 
       if (profileError) throw profileError;
 
       const profileMap = new Map(
         profiles?.map((p) => [
           p.id,
           {
             id: p.id,
             full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || null,
             avatar_url: p.avatar_url,
           },
         ])
       );
 
       // Get last message for each conversation
       const lastMessages = await Promise.all(
         conversationIds.map(async (convId) => {
           const { data } = await supabase
             .from("chat_messages")
             .select("content, message_type, sender_id, created_at")
             .eq("conversation_id", convId)
             .order("created_at", { ascending: false })
             .limit(1)
             .single();
           return { convId, message: data };
         })
       );
 
       const lastMessageMap = new Map(
         lastMessages.map((lm) => [lm.convId, lm.message])
       );
 
       // Get unread counts
       const userParticipantMap = new Map(
         allParticipants
           ?.filter((p) => p.user_id === user.id)
           .map((p) => [p.conversation_id, p.last_read_at])
       );
 
       const unreadCounts = await Promise.all(
         conversationIds.map(async (convId) => {
           const lastReadAt = userParticipantMap.get(convId);
           const { count } = await supabase
             .from("chat_messages")
             .select("*", { count: "exact", head: true })
             .eq("conversation_id", convId)
             .neq("sender_id", user.id)
             .gt("created_at", lastReadAt || "1970-01-01");
           return { convId, count: count || 0 };
         })
       );
 
       const unreadCountMap = new Map(
         unreadCounts.map((uc) => [uc.convId, uc.count])
       );
 
       // Build final conversation objects
       return conversations.map((conv) => {
         const participants: ConversationParticipant[] =
           allParticipants
             ?.filter((p) => p.conversation_id === conv.id)
             .map((p) => ({
               user_id: p.user_id,
               is_admin: p.is_admin || false,
               last_read_at: p.last_read_at || "",
               profile: profileMap.get(p.user_id) || null,
             })) || [];
 
         return {
           id: conv.id,
           org_id: conv.org_id,
           conversation_type: conv.conversation_type as "direct" | "group",
           name: conv.name,
           created_by: conv.created_by,
           last_message_at: conv.last_message_at || conv.created_at,
           created_at: conv.created_at,
           participants,
           last_message: lastMessageMap.get(conv.id) || null,
           unread_count: unreadCountMap.get(conv.id) || 0,
         };
       });
     },
     enabled: !!user?.id && !!effectiveOrgId,
     staleTime: 30000,
   });
 
   // Refs let realtime callback see the current location without re-subscribing
   const location = useLocation();
   const locationRef = useRef(location);
   locationRef.current = location;

   // Real-time subscription for conversation updates
   useEffect(() => {
     if (!user?.id || !effectiveOrgId) return;

     const channel = supabase
       .channel("chat-conversations-changes")
       .on(
         "postgres_changes",
         { event: "*", schema: "public", table: "chat_messages" },
         (payload) => {
           queryClient.invalidateQueries({
             queryKey: ["chat-conversations", user.id, effectiveOrgId],
           });

           if (payload.eventType !== "INSERT") return;
           const newMsg = payload.new as { sender_id?: string; conversation_id?: string };
           if (!newMsg || newMsg.sender_id === user.id) return;
           if (locationRef.current.pathname === `/chat/${newMsg.conversation_id}`) return;

           playChatNotificationSound();
         }
       )
       .on(
         "postgres_changes",
         { event: "*", schema: "public", table: "chat_participants" },
         () => {
           queryClient.invalidateQueries({
             queryKey: ["chat-conversations", user.id, effectiveOrgId],
           });
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [user?.id, effectiveOrgId, queryClient]);
 
   const createConversationMutation = useMutation({
     mutationFn: async ({
       type,
       participantIds,
       name,
     }: {
       type: "direct" | "group";
       participantIds: string[];
       name?: string;
     }) => {
       if (!user?.id || !effectiveOrgId) throw new Error("Not authenticated");
 
       // For direct messages, check if conversation already exists
       if (type === "direct" && participantIds.length === 1) {
         const otherUserId = participantIds[0];
 
         // Get user's direct conversations
         const { data: userConvs } = await supabase
           .from("chat_participants")
           .select("conversation_id")
           .eq("user_id", user.id);
 
         if (userConvs?.length) {
           const convIds = userConvs.map((c) => c.conversation_id);
 
           // Check if other user is in any of these as a direct conversation
           const { data: otherUserConvs } = await supabase
             .from("chat_participants")
             .select("conversation_id")
             .eq("user_id", otherUserId)
             .in("conversation_id", convIds);
 
           if (otherUserConvs?.length) {
             // Check if any of these are direct conversations
             const { data: directConv } = await supabase
               .from("chat_conversations")
               .select("id")
               .in(
                 "id",
                 otherUserConvs.map((c) => c.conversation_id)
               )
               .eq("conversation_type", "direct")
               .eq("org_id", effectiveOrgId)
               .limit(1)
               .single();
 
             if (directConv) {
               return directConv.id; // Return existing conversation
             }
           }
         }
       }
 
       // Create new conversation
       const { data: conv, error: convError } = await supabase
         .from("chat_conversations")
         .insert({
           org_id: effectiveOrgId,
           conversation_type: type,
           name: type === "group" ? name : null,
           created_by: user.id,
         })
         .select()
         .single();
 
       if (convError) throw convError;
 
       // Add creator as admin participant
       const { error: creatorError } = await supabase
         .from("chat_participants")
         .insert({
           conversation_id: conv.id,
           user_id: user.id,
           is_admin: true,
         });
 
       if (creatorError) throw creatorError;
 
       // Add other participants
       if (participantIds.length > 0) {
         const { error: partError } = await supabase
           .from("chat_participants")
           .insert(
             participantIds.map((uid) => ({
               conversation_id: conv.id,
               user_id: uid,
               is_admin: false,
             }))
           );
 
         if (partError) throw partError;
       }
 
       return conv.id;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({
         queryKey: ["chat-conversations", user?.id, effectiveOrgId],
       });
     },
   });
 
   return {
     conversations: query.data || [],
     isLoading: query.isLoading,
     error: query.error,
     refetch: query.refetch,
     createConversation: createConversationMutation.mutateAsync,
     isCreating: createConversationMutation.isPending,
   };
 }
 
 export function useTotalUnreadCount() {
   const { conversations } = useConversations();
   return conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
 }