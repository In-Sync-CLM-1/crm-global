import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";

interface ErrorLog {
  id: string;
  org_id: string;
  user_id: string | null;
  error_type: string;
  error_message: string;
  error_details: any;
  page_url: string | null;
  created_at: string;
  organization?: { name: string };
  profile?: { first_name: string; last_name: string };
}

export function PlatformErrorLogs() {
  const notify = useNotification();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 15;

  const fetchLogs = async (page: number = 1) => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const [{ count }, { data, error }] = await Promise.all([
        supabase.from("error_logs").select("*", { count: "exact", head: true }),
        supabase
          .from("error_logs")
          .select(`*, organizations!error_logs_org_id_fkey(name), profiles!error_logs_user_id_fkey(first_name, last_name)`)
          .order("created_at", { ascending: false })
          .range(from, to),
      ]);

      if (error) throw error;

      const formatted = data?.map((log) => ({
        ...log,
        organization: log.organizations,
        profile: log.profiles,
      })) as ErrorLog[];

      setLogs(formatted || []);
      setTotalPages(Math.ceil((count || 0) / pageSize));
      setCurrentPage(page);
      setLoaded(true);
    } catch (error: any) {
      notify.error("Error loading logs", error);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeVariant = (type: string) => {
    const lower = type.toLowerCase();
    if (lower === "critical" || lower === "fatal") return "destructive" as const;
    if (lower === "warning") return "default" as const;
    return "secondary" as const;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Error Logs
        </CardTitle>
        <Button onClick={() => fetchLogs(1)} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loaded ? "Refresh" : "Load Logs"}
        </Button>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm">Click "Load Logs" to view system error logs</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm">No error logs found</p>
          </div>
        ) : (
          <>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Timestamp</TableHead>
                    <TableHead className="min-w-[120px]">Organization</TableHead>
                    <TableHead className="min-w-[100px]">User</TableHead>
                    <TableHead className="min-w-[80px]">Type</TableHead>
                    <TableHead className="min-w-[250px]">Message</TableHead>
                    <TableHead className="min-w-[120px]">Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.organization?.name || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.profile
                          ? `${log.profile.first_name} ${log.profile.last_name}`
                          : "Anonymous"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariant(log.error_type)} className="text-xs">
                          {log.error_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-sm">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm truncate block cursor-help">{log.error_message}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md break-all">
                              {log.error_message}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.page_url ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block cursor-help max-w-[120px]">
                                  {(() => { try { return new URL(log.page_url).pathname; } catch { return log.page_url; } })()}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md break-all">
                                {log.page_url}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={(e) => { e.preventDefault(); if (currentPage > 1) fetchLogs(currentPage - 1); }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={(e) => { e.preventDefault(); fetchLogs(page); }}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) fetchLogs(currentPage + 1); }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
