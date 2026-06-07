export function TeamColorBadge({ team, className }) {
  if (!team) return null;
  return (
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 ${className || ""}`}
      style={{ backgroundColor: team.color || "#475569" }}
    >
      {team.short_name?.slice(0, 3).toUpperCase()}
    </div>
  );
}
