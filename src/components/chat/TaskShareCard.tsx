import { CheckSquare, ExternalLink } from "lucide-react";

interface TaskShareCardProps {
  taskId: string;
}

export function TaskShareCard({ taskId }: TaskShareCardProps) {
  return (
    <a
      href="https://task.in-sync.co.in"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 bg-background/50 rounded-lg hover:bg-background/80 transition-colors"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <CheckSquare className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Shared Task</p>
        <p className="text-xs text-muted-foreground">View on Tasks platform</p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
    </a>
  );
}
