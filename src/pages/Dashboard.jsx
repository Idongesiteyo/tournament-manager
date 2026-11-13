import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Plus,
  Trophy,
  ArrowRight,
  LogOut,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Search,
  Calendar,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-9 w-56 bg-white/5 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 h-72 bg-white/5 rounded-2xl border border-white/5" />
        <div className="md:col-span-2 space-y-4">
          <div className="h-10 w-full bg-white/5 rounded-lg" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl border border-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [tournaments, setTournaments] = useState([]);
  const [matchesByTournament, setMatchesByTournament] = useState({});
  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentFormat, setNewTournamentFormat] = useState("playoff");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");

  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
          
        if (profile) {
          setUserRole(profile.role);
          if (profile.role !== "pending") {
            fetchTournaments(session.user.id, profile.role);
          } else {
            setLoading(false);
          }
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const fetchTournaments = async (userId, role) => {
    setLoading(true);
    let allTournaments = [];
    
    if (role === 'super_admin') {
      const { data } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
      if (data) allTournaments = data;
    } else {
      const { data: owned } = await supabase.from("tournaments").select("*").eq("user_id", userId);
      const { data: assignments } = await supabase.from("tournament_admins").select("tournament_id").eq("admin_id", userId);
      const assignedIds = assignments?.map(a => a.tournament_id) || [];
      
      let assigned = [];
      if (assignedIds.length > 0) {
        const { data } = await supabase.from("tournaments").select("*").in("id", assignedIds);
        if (data) assigned = data;
      }
      
      const map = new Map();
      [...(owned || []), ...assigned].forEach(t => map.set(t.id, t));
      allTournaments = Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    setTournaments(allTournaments);

    // Fetch match summaries for status & next fixture
    const ids = allTournaments.map(t => t.id);
    if (ids.length > 0) {
      const { data: matchRows } = await supabase
        .from("matches")
        .select("id, tournament_id, status, stage, match_date")
        .in("tournament_id", ids);
      const grouped = {};
      (matchRows || []).forEach(m => {
        grouped[m.tournament_id] = grouped[m.tournament_id] || [];
        grouped[m.tournament_id].push(m);
      });
      setMatchesByTournament(grouped);
    }

    setLoading(false);
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    const trimmedName = newTournamentName.trim();
    if (!trimmedName) {
      setNameError("Tournament name cannot be blank.");
      return;
    }
    if (!user || creating) return;
    setNameError("");
    setCreating(true);
    
    const { data, error } = await supabase
      .from("tournaments")
      .insert([{ name: trimmedName, user_id: user.id, format: newTournamentFormat }])
      .select();
    
    setCreating(false);
    if (error) {
      toast.error("Failed to create tournament: " + error.message);
      return;
    }
    if (data && data[0]) {
      toast.success(`"${trimmedName}" created!`);
      setNewTournamentName("");
      setTournaments([data[0], ...tournaments]);
      navigate(`/dashboard/${data[0].id}`);
    }
  };

  const handleCopyPublicLink = (id) => {
    const url = `${window.location.origin}/t/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Public standings link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getTournamentStatus = (t) => {
    const tMatches = matchesByTournament[t.id] || [];
    const regular = tMatches.filter(m => m.stage === "regular");
    const completedRegular = regular.filter(m => m.status === "completed").length;
    const totalRegular = regular.length || 12;

    const upcomingDates = tMatches
      .filter(m => m.status !== "completed" && m.match_date)
      .map(m => new Date(m.match_date))
      .sort((a, b) => a - b);
    const nextFixture = upcomingDates[0] || null;

    if (t.champion_team_id || (regular.length === 12 && completedRegular === 12 && t.format === "league")) {
      return { key: "completed", label: "Completed", badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", completedRegular, totalRegular, nextFixture: null };
    }
    if (completedRegular > 0 || tMatches.some(m => ["first_half", "halftime", "second_half"].includes(m.status))) {
      return { key: "in_progress", label: `In progress (${completedRegular}/${totalRegular} played)`, badgeClass: "bg-primary/15 text-primary border-primary/30", completedRegular, totalRegular, nextFixture };
    }
    return { key: "not_started", label: "Not started", badgeClass: "bg-slate-500/15 text-slate-300 border-white/10", completedRegular: 0, totalRegular, nextFixture };
  };

  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      const matchesName = t.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesFormat = formatFilter === "all" || (t.format || "playoff") === formatFilter;
      const statusObj = getTournamentStatus(t);
      const matchesStatus = statusFilter === "all" || statusObj.key === statusFilter;
      return matchesName && matchesFormat && matchesStatus;
    });
  }, [tournaments, matchesByTournament, searchQuery, statusFilter, formatFilter]);

  if (loading) return <DashboardSkeleton />;

  if (userRole === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-black">Account Pending Approval</h2>
        <p className="text-muted-foreground max-w-md">
          Your account has been created, but it requires approval from a Super Admin before you can create and manage tournaments.
        </p>
        <Button variant="outline" onClick={handleLogout} className="mt-4 border-white/10">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-primary flex items-center gap-3">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8" /> {userRole === 'super_admin' ? 'All Tournaments' : 'My Tournaments'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {userRole === 'super_admin'
              ? 'Viewing all tournaments across the platform'
              : 'Create and manage your 4-team tournaments'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {userRole !== 'tournament_manager' && (
          <Card className="md:col-span-1 border-primary/20 bg-primary/5 md:sticky md:top-24">
            <CardHeader className="pb-4">
              <CardTitle>Create Tournament</CardTitle>
              <CardDescription>4-team double round-robin tournament (12 regular season matches)</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTournament} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="new-tournament-name" className="text-xs font-semibold text-slate-300">
                    Tournament Name
                  </label>
                  <Input 
                    id="new-tournament-name"
                    placeholder="e.g. GFC EOY League 2026" 
                    value={newTournamentName}
                    onChange={e => { setNewTournamentName(e.target.value); if (nameError) setNameError(""); }}
                    className={`bg-background/50 ${nameError ? "border-destructive" : "border-white/10"}`}
                    maxLength={100}
                  />
                  {nameError && <p className="text-destructive text-xs font-medium">{nameError}</p>}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-tournament-format" className="text-xs font-semibold text-slate-300">
                    Competition Format
                  </label>
                  <select
                    id="new-tournament-format"
                    value={newTournamentFormat}
                    onChange={e => setNewTournamentFormat(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="playoff" className="bg-[#0f1423]">League + Playoff Final</option>
                    <option value="league" className="bg-[#0f1423]">League Only (Table Topper)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {newTournamentFormat === "league"
                      ? "1st place after all 12 regular matches is crowned champion."
                      : "Top 2 teams after 12 regular matches advance to a one-off Championship Final."}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full font-bold"
                  disabled={!newTournamentName.trim() || creating}
                >
                  <Plus className="w-4 h-4 mr-2" /> {creating ? "Creating..." : "Create Tournament"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className={`${userRole !== 'tournament_manager' ? 'md:col-span-2' : 'md:col-span-3'} space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">
              Tournaments <span className="text-sm font-normal text-slate-400">({filteredTournaments.length})</span>
            </h2>

            {tournaments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    aria-label="Search tournaments"
                    placeholder="Search tournaments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-xs bg-white/[0.02] border-white/10"
                  />
                </div>
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-md border border-white/10 bg-[#0f1423] px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                <select
                  aria-label="Filter by format"
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                  className="h-9 rounded-md border border-white/10 bg-[#0f1423] px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Formats</option>
                  <option value="playoff">League + Playoff</option>
                  <option value="league">League Only</option>
                </select>
              </div>
            )}
          </div>

          {filteredTournaments.length === 0 ? (
            <Card className="bg-white/[0.02] border-dashed border-white/10">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Trophy className="w-12 h-12 mb-4 opacity-20" />
                {tournaments.length === 0 ? (
                  <>
                    <p>You don't have any tournaments yet.</p>
                    {userRole !== 'tournament_manager' && <p className="text-sm">Use the form to create your first tournament.</p>}
                  </>
                ) : (
                  <p>No tournaments match your current search or filters.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTournaments.map(t => {
                const status = getTournamentStatus(t);
                const formattedCreated = new Date(t.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                });

                return (
                  <Card key={t.id} className="hover:border-white/20 transition-colors">
                    <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-lg text-white truncate">{t.name}</h3>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${status.badgeClass}`}>
                            {status.label}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                            {t.format === "league" ? "League Only" : "League + Playoff"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span>Created {formattedCreated}</span>
                          {status.nextFixture && (
                            <span className="inline-flex items-center gap-1 text-primary font-medium">
                              <Calendar className="w-3.5 h-3.5" />
                              Next fixture: {status.nextFixture.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <Link
                            to={`/t/${t.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Public Standings
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleCopyPublicLink(t.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                            title="Copy public standings link"
                          >
                            {copiedId === t.id ? (
                              <><Check className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-emerald-400">Copied</span></>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" /> Copy Link</>
                            )}
                          </button>
                        </div>
                      </div>

                      <Button asChild className="shrink-0">
                        <Link to={`/dashboard/${t.id}`}>
                          Manage <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
