import { cn } from "../../lib/utils";

export function TeamColorBadge({ team, className }) {
  if (!team) return null;
  return (
    <div
      className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md border border-white/15",
        className
      )}
      style={{
        backgroundColor: team.color || "#475569",
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.7)",
      }}
    >
      {team.short_name?.slice(0, 3).toUpperCase()}
    </div>
  );
}
