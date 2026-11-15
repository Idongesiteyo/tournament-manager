import { useEffect, useState, useRef } from "react";
import {
  Save,
  Settings,
  Trash2,
  CalendarPlus,
  Check,
  X,
  ArrowLeft,
  ShieldAlert,
  ImagePlus,
  Edit2,
  UserCog,
  Info,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Copy,
  MoreHorizontal,
  FastForward,
  Trophy,
  ExternalLink,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { generateSchedule, isSeasonComplete, computeStandings, isTopTied, sortMatches } from "../lib/logic";
import { useStandingsConfig } from "../lib/useStandingsConfig";
import TieBreakerManager from "../components/admin/TieBreakerManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { TeamColorBadge } from "../components/shared/TeamColorBadge";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import AdminMatchInfoModal from "../components/admin/AdminMatchInfoModal";
import UnauthorizedAccess from "../components/ui/UnauthorizedAccess";
import PageLoader from "../components/ui/PageLoader";

export default function AdminTournament() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [settings, setSettings] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);

  // Settings form state
  const [tName, setTName] = useState("");
  const [tFormat, setTFormat] = useState("playoff");
  const [tImage, setTImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Teams state
  const [newTeam, setNewTeam] = useState({ name: "", short_name: "", color: "#eab308" });
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamData, setEditTeamData] = useState({ name: "", short_name: "", color: "" });
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [copiedTeamId, setCopiedTeamId] = useState(null);

  // Matches state
  const [editingMatch, setEditingMatch] = useState(null);
  const [editScores, setEditScores] = useState({ home: "", away: "", match_date: "" });
  const [infoMatch, setInfoMatch] = useState(null);
  const [halfDurations, setHalfDurations] = useState({});
  const [collapsedMatchdays, setCollapsedMatchdays] = useState({});
  const [openMatchMenuId, setOpenMatchMenuId] = useState(null);
  const [matchToReset, setMatchToReset] = useState(null);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);

  // Destructive & advanced state
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [confirmResetMatches, setConfirmResetMatches] = useState(false);
  const [confirmFullReset, setConfirmFullReset] = useState(false);
  const [fullResetConfirmText, setFullResetConfirmText] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const standingsConfig = useStandingsConfig(tournamentId, teams, matches);

  const isSettingsDirty = settings && (
    tName.trim() !== (settings.name || "") ||
    tFormat !== (settings.format || "playoff")
  );

  // Warn before browser tab unload if settings are dirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isSettingsDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSettingsDirty]);

  // Close match overflow menu when clicking outside
  useEffect(() => {
    if (!openMatchMenuId) return;
    const handleClickOutside = () => setOpenMatchMenuId(null);
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMatchMenuId]);

  // Restore scroll position when returning from public page or team page
  useEffect(() => {
    if (!loading) {
      const savedScroll = sessionStorage.getItem(`admin_scroll_${tournamentId}`);
      if (savedScroll) {
        window.scrollTo(0, parseInt(savedScroll, 10));
      }
    }
  }, [loading, tournamentId]);

  useEffect(() => {
    const onScroll = () => {
      sessionStorage.setItem(`admin_scroll_${tournamentId}`, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tournamentId]);

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
      const userIsSuperAdmin = profile?.role === 'super_admin';
      setIsSuperAdmin(userIsSuperAdmin);
      
      const { data: tData, error: tErr } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .single();
        
      if (tErr || !tData) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      let isAuthorized = userIsSuperAdmin || tData.user_id === session.user.id;

      if (!isAuthorized) {
        const { data: assignment } = await supabase
          .from("tournament_admins")
          .select("id")
          .eq("tournament_id", tournamentId)
          .eq("admin_id", session.user.id)
          .maybeSingle();
        if (assignment) isAuthorized = true;
      }
        
      if (!isAuthorized) {
        setAuthError(true);
        setLoading(false);
        return;
      }
      
      setSettings(tData);
      setTName(tData.name);
      setTFormat(tData.format || "playoff");
      setTImage(tData.image_url);
      
      await loadData();
      setLoading(false);
    };
    
    checkAuthAndLoad();

    const channel = supabase.channel(`admin_${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` }, (payload) => {
        setSettings(payload.new);
        if (payload.new.name) setTName(payload.new.name);
        if (payload.new.format) setTFormat(payload.new.format);
        if (payload.new.image_url !== undefined) setTImage(payload.new.image_url);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, navigate]);

  const loadData = async () => {
    const [teamsRes, matchesRes] = await Promise.all([
      supabase.from("teams").select("*").eq("tournament_id", tournamentId),
      supabase.from("matches").select("*").eq("tournament_id", tournamentId)
    ]);
    
    if (teamsRes.data) setTeams(teamsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);
  };

  const getTeam = (id) => teams.find(t => t.id === id);

  const saveTournamentSettings = async (e) => {
    if (e) e.preventDefault();
    const trimmed = tName.trim();
    if (!trimmed) {
      toast.error("Tournament name cannot be blank.");
      return;
    }

    const currentFormat = settings?.format || "playoff";
    if (tFormat !== currentFormat && matches.length > 0) {
      const ok = window.confirm(
        `Matches have already been scheduled (${matches.length} matches). Are you sure you want to switch the competition format to "${tFormat === "league" ? "League Only" : "League + Playoff Final"}"?`
      );
      if (!ok) {
        setTFormat(currentFormat);
        return;
      }
    }

    setSavingSettings(true);
    const { error } = await supabase
      .from("tournaments")
      .update({ name: trimmed, format: tFormat })
      .eq("id", tournamentId);
    setSavingSettings(false);

    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      setSettings(prev => ({ ...prev, name: trimmed, format: tFormat }));
      toast.success("Tournament settings saved!");
    }
  };

  const uploadTournamentImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${tournamentId}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('tournaments')
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Failed to upload image: " + uploadError.message);
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from('tournaments').getPublicUrl(filePath);
    
    const { error: dbErr } = await supabase.from("tournaments").update({ image_url: data.publicUrl }).eq("id", tournamentId);
    if (dbErr) {
      toast.error("Failed to update logo URL");
    } else {
      setTImage(data.publicUrl);
      toast.success("Tournament logo updated!");
    }
    setIsUploading(false);
  };

  const addTeam = async (e) => {
    e.preventDefault();
    if (teams.length >= 4) return;
    
    if (!newTeam.name.trim() || !newTeam.short_name.trim()) {
      toast.error("Please provide both a team name and a 3-letter short code.");
      return;
    }
    if (newTeam.short_name.trim().length > 3) {
      toast.error("Short code cannot exceed 3 characters.");
      return;
    }

    const isDuplicate = teams.some(t => 
      t.name.toLowerCase() === newTeam.name.trim().toLowerCase() || 
      t.short_name.toLowerCase() === newTeam.short_name.trim().toLowerCase()
    );
    if (isDuplicate) {
      toast.error("A team with this name or code already exists!");
      return;
    }
    
    const { error } = await supabase.from("teams").insert([{
      ...newTeam,
      name: newTeam.name.trim(),
      short_name: newTeam.short_name.trim().toUpperCase(),
      tournament_id: tournamentId
    }]);

    if (error) {
      toast.error("Failed to add team: " + error.message);
      return;
    }

    setNewTeam({ name: "", short_name: "", color: "#eab308" });
    toast.success("Team added successfully!");
  };

  const saveEditedTeam = async (id) => {
    if (!editTeamData.name.trim() || !editTeamData.short_name.trim()) {
      toast.error("Team name and short code cannot be blank.");
      return;
    }
    const { error } = await supabase.from("teams").update({
      name: editTeamData.name.trim(),
      short_name: editTeamData.short_name.trim().toUpperCase().slice(0, 3),
      color: editTeamData.color
    }).eq("id", id);

    if (error) {
      toast.error("Failed to update team: " + error.message);
    } else {
      toast.success("Team updated!");
      setEditingTeam(null);
    }
  };

  const confirmDeleteTeam = async () => {
    if (!teamToDelete) return;
    const { error } = await supabase.from("teams").delete().eq("id", teamToDelete.id);
    if (error) {
      toast.error("Failed to delete team: " + error.message);
    } else {
      toast.success(`"${teamToDelete.name}" deleted.`);
    }
    setTeamToDelete(null);
  };

  const handleGenerateSchedule = async () => {
    if (teams.length !== 4) return;
    const schedule = generateSchedule(teams).map(m => ({
      tournament_id: tournamentId,
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      matchday: m.matchday,
      status: m.status,
      stage: m.stage
    }));
    const { error } = await supabase.from("matches").insert(schedule);
    if (error) {
      toast.error("Failed to generate schedule: " + error.message);
    } else {
      toast.success("12-match schedule generated!");
    }
  };

  const saveMatchScore = async (matchId, originalStatus) => {
    const updates = {};
    
    if (editScores.match_date) {
      const parsedDate = new Date(editScores.match_date);
      if (isNaN(parsedDate.getTime())) {
        toast.error("Invalid date format provided.");
        return;
      }
      updates.match_date = parsedDate.toISOString();
    } else {
      updates.match_date = null;
    }

    if (editScores.home !== "" && editScores.away !== "") {
      updates.home_score = parseInt(editScores.home, 10);
      updates.away_score = parseInt(editScores.away, 10);
      if (originalStatus === "scheduled") {
        updates.status = "completed";
      }
    }

    const { error } = await supabase.from("matches").update(updates).eq("id", matchId);
    
    if (error) {
      console.error(error);
      toast.error("Failed to save match: " + error.message);
      return;
    }
    
    const match = matches.find(m => m.id === matchId);
    setEditingMatch(null);
    toast.success("Match saved successfully!");
    if (match?.stage === 'final') {
      const hScore = parseInt(editScores.home, 10);
      const aScore = parseInt(editScores.away, 10);
      if (!isNaN(hScore) && !isNaN(aScore) && hScore !== aScore) {
        const winnerId = hScore > aScore ? match.home_team_id : match.away_team_id;
        await supabase.from("tournaments").update({ champion_team_id: winnerId }).eq("id", tournamentId);
      }
    }
  };

  const updateMatchStatus = async (matchId, status, extraFields = {}) => {
    const { error } = await supabase.from("matches").update({ status, ...extraFields }).eq("id", matchId);
    if (error) {
      toast.error("Failed to update status: " + error.message);
    } else {
      toast.success("Match status updated to " + status.replace(/_/g, " "));
      
      const match = matches.find(m => m.id === matchId);
      if (status === 'completed' && match?.stage === 'final') {
        const hScore = match.home_score ?? 0;
        const aScore = match.away_score ?? 0;
        if (hScore !== aScore) {
          const winnerId = hScore > aScore ? match.home_team_id : match.away_team_id;
          await supabase.from("tournaments").update({ champion_team_id: winnerId }).eq("id", tournamentId);
        }
      }
    }
  };

  const confirmResetSingleMatch = async () => {
    if (!matchToReset) return;
    const matchId = matchToReset.id;
    const { error: matchError } = await supabase.from("matches").update({
      status: "scheduled",
      home_score: null,
      away_score: null,
      first_half_start: null,
      second_half_start: null,
      match_end: null
    }).eq("id", matchId);
    
    if (matchError) {
      toast.error("Failed to reset match: " + matchError.message);
      setMatchToReset(null);
      return;
    }

    await supabase.from("match_info").delete().eq("match_id", matchId);
    setMatchToReset(null);
    toast.success("Match reset to scheduled!");
  };

  const generateFinal = async () => {
    if (teams.length < 2) return;
    const standings = computeStandings(teams, matches, standingsConfig);
    if (standings.length < 2) return;
    if (isTopTied(standings)) {
      toast.error("Top places are tied. Resolve the tie in the Tie-Breakers section first.");
      return;
    }
    
    const { error } = await supabase.from("matches").insert([{
      tournament_id: tournamentId,
      home_team_id: standings[0].team.id,
      away_team_id: standings[1].team.id,
      matchday: 99,
      status: "scheduled",
      stage: "final"
    }]);
    if (error) {
      toast.error("Failed to generate Playoff Final: " + error.message);
    } else {
      toast.success("Playoff Final generated!");
    }
  };

  const setManualChampion = async (winnerId) => {
    const { error } = await supabase.from("tournaments").update({ champion_team_id: winnerId || null }).eq("id", tournamentId);
    if (error) {
      toast.error("Failed to update champion: " + error.message);
    } else {
      toast.success(winnerId ? "Champion updated!" : "Champion cleared");
    }
  };

  const handleResetMatches = async () => {
    const { error } = await supabase.from("matches").delete().eq("tournament_id", tournamentId);
    await supabase.from("tournaments").update({ champion_team_id: null }).eq("id", tournamentId);
    setConfirmResetMatches(false);
    if (error) {
      toast.error("Failed to delete matches: " + error.message);
    } else {
      toast.success("All matches for this tournament have been deleted.");
    }
  };

  const handleFullReset = async () => {
    if (fullResetConfirmText.trim() !== settings?.name) return;
    await supabase.from("matches").delete().eq("tournament_id", tournamentId);
    await supabase.from("teams").delete().eq("tournament_id", tournamentId);
    const { error } = await supabase.from("tournaments").update({ champion_team_id: null, image_url: null }).eq("id", tournamentId);
    setConfirmFullReset(false);
    setFullResetConfirmText("");
    if (error) {
      toast.error("Failed to reset tournament: " + error.message);
    } else {
      toast.success(`"${settings?.name}" has been completely reset.`);
    }
  };

  const isLeagueOnly = settings?.format === "league";

  // League-only format: the table topper is automatically crowned once all regular matches are done
  useEffect(() => {
    if (loading || !settings || !isLeagueOnly) return;
    const complete = isSeasonComplete(matches);
    const standings = complete ? computeStandings(teams, matches, standingsConfig) : [];
    const topId = standings.length > 0 && !isTopTied(standings) ? standings[0].team.id : null;
    if (complete && !settings.champion_team_id && topId) {
      supabase.from("tournaments").update({ champion_team_id: topId }).eq("id", tournamentId).then(({ error }) => {
        if (!error) toast.success("Tournament complete! Table topper crowned champion.");
      });
    } else if (!complete && settings.champion_team_id) {
      supabase.from("tournaments").update({ champion_team_id: null }).eq("id", tournamentId);
    }
  }, [loading, settings?.format, settings?.champion_team_id, matches, teams, standingsConfig]);

  if (authError) return <UnauthorizedAccess />;
  if (loading) return <PageLoader label="Loading Tournament Manager" />;

  const seasonComplete = isSeasonComplete(matches);
  const standings = computeStandings(teams, matches, standingsConfig);
  const finalMatch = matches.find(m => m.stage === "final");
  const regularMatches = matches.filter(m => m.stage === "regular");
  const completedRegular = regularMatches.filter(m => m.status === "completed").length;
  const hasPlayedMatches = completedRegular > 0;

  // Find latest MD6 date for champion card helper
  const md6Dates = regularMatches
    .filter(m => m.matchday === 6 && m.match_date)
    .map(m => new Date(m.match_date))
    .sort((a, b) => b - a);
  const lastMdDate = md6Dates[0] || null;

  const formatDateForInput = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  // Group matches by matchday (plus Final)
  const sortedAllMatches = [...matches].sort(sortMatches);
  const matchesByGroup = sortedAllMatches.reduce((acc, m) => {
    const key = m.stage === "final" ? "FINAL" : `MD_${m.matchday}`;
    acc[key] = acc[key] || [];
    acc[key].push(m);
    return acc;
  }, {});

  const jumpToNextUnplayed = () => {
    const nextMatch = sortedAllMatches.find(m => m.status !== "completed");
    if (!nextMatch) {
      toast.info("All scheduled matches have been completed!");
      return;
    }
    const groupKey = nextMatch.stage === "final" ? "FINAL" : `MD_${nextMatch.matchday}`;
    setCollapsedMatchdays(prev => ({ ...prev, [groupKey]: false }));
    setTimeout(() => {
      const el = document.getElementById(`match-row-${nextMatch.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to My Tournaments"
            title="Back to My Tournaments"
            className="shrink-0"
            onClick={() => {
              if (isSettingsDirty && !window.confirm("You have unsaved tournament settings. Leave without saving?")) return;
              navigate("/dashboard");
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-primary flex items-center gap-2 sm:gap-3 leading-tight">
              <Settings className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" /> Manage Tournament
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">{settings?.name}</p>
          </div>
        </div>
        <Button variant="outline" asChild className="border-white/10 hover:bg-white/5 whitespace-nowrap text-xs sm:text-sm px-3 shrink-0">
          <Link to={`/t/${tournamentId}`}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Public Standings
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Teams", value: `${teams.length} / 4` },
          { label: "Total Matches", value: matches.length },
          { label: "Completed", value: completedRegular, color: "text-emerald-400" },
          { label: "Remaining", value: regularMatches.length - completedRegular },
        ].map(s => (
          <Card key={s.label} className="bg-white/[0.02]">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
              <div className={`text-2xl font-black ${s.color || ""}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Tournament Settings</CardTitle>
              <CardDescription>Configure tournament name, format, and branding</CardDescription>
            </div>
            {isSettingsDirty && (
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Unsaved changes
              </span>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={saveTournamentSettings} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="tournament-name-input" className="text-xs font-semibold text-slate-300">
                    Tournament Name
                  </label>
                  <Input 
                    id="tournament-name-input"
                    value={tName} 
                    onChange={(e) => setTName(e.target.value)} 
                    placeholder="Tournament Name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="tournament-format-select" className="text-xs font-semibold text-slate-300">
                    Competition Format
                  </label>
                  <select
                    id="tournament-format-select"
                    value={tFormat}
                    onChange={(e) => setTFormat(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="playoff" className="bg-[#0f1423]">League + Playoff Final (top 2 play final)</option>
                    <option value="league" className="bg-[#0f1423]">League Only (table topper wins)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/5">
                <div className="flex items-center gap-4">
                  {tImage ? (
                    <img src={tImage} alt="Tournament Logo" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-muted-foreground bg-white/5">
                      <ImagePlus className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <label htmlFor="tournament-logo-upload" className="text-xs font-semibold text-slate-300 block mb-1">
                      Tournament Logo
                    </label>
                    <input 
                      id="tournament-logo-upload"
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={uploadTournamentImage}
                    />
                    <Button type="button" size="sm" variant="outline" className="border-white/10" onClick={() => fileInputRef.current.click()} disabled={isUploading}>
                      {isUploading ? "Uploading..." : tImage ? "Change Logo" : "Upload Logo"}
                    </Button>
                  </div>
                </div>

                <Button type="submit" disabled={!isSettingsDirty || savingSettings} className="font-bold">
                  <Save className="w-4 h-4 mr-2" /> {savingSettings ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {isLeagueOnly ? (
          <Card className="md:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="w-4 h-4 text-primary" /> Tournament Champion
              </CardTitle>
              <CardDescription className="text-xs">
                {lastMdDate
                  ? `Decided after MD6 – ${lastMdDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                  : "1st place after all 12 regular matches"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!seasonComplete ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Season Progress</span>
                    <span className="font-bold text-white">{completedRegular} / 12 played</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(completedRegular / 12) * 100}%` }} />
                  </div>
                  {hasPlayedMatches && standings[0] && (
                    <p className="text-xs text-slate-400 pt-1">
                      Current leader: <span className="text-white font-semibold">{standings[0].team.name}</span> ({standings[0].pts} pts)
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {settings?.champion_team_id ? (
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-center text-primary font-bold text-xs tracking-wider uppercase">
                      Champion: {getTeam(settings.champion_team_id)?.name}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-500 text-xs text-center font-bold">
                      Top teams are tied. Resolve via Tie-Breakers or select below.
                    </div>
                  )}
                  <div className="space-y-1">
                    <label htmlFor="league-champion-select" className="text-xs text-muted-foreground block">
                      Set / Override Champion
                    </label>
                    <select
                      id="league-champion-select"
                      className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={settings?.champion_team_id || ""}
                      onChange={(e) => setManualChampion(e.target.value || null)}
                    >
                      <option value="">-- Select Champion --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="md:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="w-4 h-4 text-primary" /> Playoff Final
              </CardTitle>
              <CardDescription className="text-xs">
                Top 2 teams after 12 matches play the final
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!seasonComplete && !finalMatch && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Regular Season</span>
                    <span className="font-bold text-white">{completedRegular} / 12 played</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(completedRegular / 12) * 100}%` }} />
                  </div>
                </div>
              )}
              {seasonComplete && !finalMatch && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-emerald-400">Regular season complete!</span>
                  <Button onClick={generateFinal} size="sm">
                    Generate Final
                  </Button>
                </div>
              )}
              {finalMatch && (
                <div className="space-y-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-xs text-slate-300">
                    Final scheduled in Match Results below.
                  </p>
                  {finalMatch.status === "completed" && (
                    <div className="space-y-2 pt-2 border-t border-primary/20">
                      <label htmlFor="playoff-champion-select" className="text-xs text-muted-foreground block">
                        Set / Override Champion
                      </label>
                      <select 
                        id="playoff-champion-select"
                        className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        value={settings?.champion_team_id || ""}
                        onChange={(e) => setManualChampion(e.target.value)}
                      >
                        <option value="">-- Select Champion --</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <TieBreakerManager
        settings={settings}
        tournamentId={tournamentId}
        standings={standings}
        hasPlayedMatches={hasPlayedMatches}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Teams Manager</CardTitle>
            <CardDescription>Register the 4 competing teams and manage their squads</CardDescription>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
            {teams.length} / 4 Teams
          </span>
        </CardHeader>
        <CardContent>
          {teams.length < 4 ? (
            <form onSubmit={addTeam} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="sm:col-span-6 space-y-1">
                <label htmlFor="new-team-name" className="text-xs font-semibold text-slate-300">
                  Team Name
                </label>
                <Input 
                  id="new-team-name"
                  placeholder="e.g. Team Chairman" 
                  value={newTeam.name} 
                  onChange={(e) => setNewTeam({...newTeam, name: e.target.value})} 
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label htmlFor="new-team-code" className="text-xs font-semibold text-slate-300">
                  Short Code (max 3)
                </label>
                <Input 
                  id="new-team-code"
                  placeholder="e.g. TC" 
                  value={newTeam.short_name} 
                  onChange={(e) => setNewTeam({...newTeam, short_name: e.target.value.toUpperCase().slice(0, 3)})} 
                  className="uppercase font-bold"
                  maxLength={3}
                />
              </div>
              <div className="sm:col-span-1 space-y-1">
                <label htmlFor="new-team-color" className="text-xs font-semibold text-slate-300 block">
                  Colour
                </label>
                <input 
                  id="new-team-color"
                  type="color" 
                  value={newTeam.color} 
                  onChange={(e) => setNewTeam({...newTeam, color: e.target.value})}
                  className="w-full h-10 rounded-md border border-white/10 cursor-pointer bg-transparent p-1"
                  title="Pick team badge colour"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full font-bold">
                  Add Team
                </Button>
              </div>
            </form>
          ) : (
            <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-between">
              <span>All 4 tournament team slots are filled (4/4).</span>
              {matches.length === 0 && <span>Ready to generate the match schedule below!</span>}
            </div>
          )}

          <div className="space-y-2">
            {teams.map(t => {
              const isEditing = editingTeam === t.id;
              
              return (
                <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 gap-3">
                  {isEditing ? (
                    <div className="flex flex-wrap flex-1 gap-2 items-center">
                      <Input 
                        aria-label="Edit team name"
                        value={editTeamData.name} 
                        onChange={e => setEditTeamData({...editTeamData, name: e.target.value})} 
                        className="flex-1 min-w-[140px]"
                      />
                      <Input 
                        aria-label="Edit short code"
                        value={editTeamData.short_name} 
                        onChange={e => setEditTeamData({...editTeamData, short_name: e.target.value.toUpperCase().slice(0, 3)})} 
                        className="w-20 uppercase font-bold"
                        maxLength={3}
                      />
                      <input 
                        aria-label="Edit team colour"
                        type="color" 
                        value={editTeamData.color} 
                        onChange={e => setEditTeamData({...editTeamData, color: e.target.value})}
                        className="w-9 h-9 rounded border border-white/10 cursor-pointer bg-transparent p-0.5"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <TeamColorBadge team={t} />
                      <div>
                        <p className="font-bold text-white">{t.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-semibold text-slate-300">{t.short_name}</span>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(t.id);
                              setCopiedTeamId(t.id);
                              toast.success("Team ID copied");
                              setTimeout(() => setCopiedTeamId(null), 1500);
                            }}
                            title={`Copy Team ID (${t.id})`}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                          >
                            {copiedTeamId === t.id ? (
                              <><Check className="w-3 h-3 text-emerald-400" /> Copied ID</>
                            ) : (
                              <><Copy className="w-3 h-3" /> Copy ID</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {isEditing ? (
                      <>
                        <Button size="sm" onClick={() => saveEditedTeam(t.id)}>
                          <Check className="w-4 h-4 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/10" onClick={() => setEditingTeam(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          asChild
                          className="h-8 text-xs border-white/10 hover:bg-white/5"
                        >
                          <Link to={`/dashboard/${tournamentId}/team/${t.id}`}>
                            <UserCog className="w-3.5 h-3.5 mr-1.5 text-primary" /> Squad
                          </Link>
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          aria-label={`Edit ${t.name}`}
                          title={`Edit ${t.name}`}
                          onClick={() => {
                            setEditingTeam(t.id);
                            setEditTeamData({ name: t.name, short_name: t.short_name, color: t.color });
                          }} 
                          className="h-8 text-xs border-white/10 hover:bg-white/5 px-2.5"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`Delete ${t.name}`}
                          title={`Delete ${t.name}`}
                          onClick={() => setTeamToDelete(t)}
                          className="h-8 w-8 border-white/10 text-slate-400 hover:text-destructive hover:border-destructive/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {teams.length === 4 && matches.length === 0 && (
            <div className="mt-6 pt-6 border-t border-white/10 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground text-center">
                You have 4 teams registered. Generate the 12-match double round-robin schedule now.
              </p>
              <Button size="lg" className="w-full sm:w-auto font-bold" onClick={handleGenerateSchedule}>
                <CalendarPlus className="w-5 h-5 mr-2" /> Generate 12-Match Schedule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Match Results Manager</CardTitle>
              <CardDescription>Grouped by matchday in chronological kick-off order</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {completedRegular < regularMatches.length && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={jumpToNextUnplayed}
                  className="border-primary/40 text-primary hover:bg-primary/10 text-xs h-8"
                >
                  <FastForward className="w-3.5 h-3.5 mr-1.5" /> Next Unplayed
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const allKeys = Object.keys(matchesByGroup);
                  const allCollapsed = allKeys.every(k => collapsedMatchdays[k]);
                  const next = {};
                  allKeys.forEach(k => { next[k] = !allCollapsed; });
                  setCollapsedMatchdays(next);
                }}
                className="text-xs h-8 text-slate-400 hover:text-white"
              >
                {Object.keys(matchesByGroup).every(k => collapsedMatchdays[k]) ? "Expand All" : "Collapse All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(matchesByGroup).map(([groupKey, groupMatches]) => {
              const isCollapsed = !!collapsedMatchdays[groupKey];
              const doneCount = groupMatches.filter(m => m.status === "completed").length;
              const groupTitle = groupKey === "FINAL" ? "Playoff Final" : `Matchday ${groupKey.replace("MD_", "")}`;

              return (
                <div key={groupKey} className="rounded-xl border border-white/10 bg-white/[0.01]">
                  <button
                    type="button"
                    onClick={() => setCollapsedMatchdays(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                    className={`w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left rounded-t-xl ${
                      isCollapsed ? "rounded-b-xl" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      <span className="text-xs font-black uppercase tracking-widest text-white">{groupTitle}</span>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      doneCount === groupMatches.length
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/5 text-slate-400"
                    }`}>
                      {doneCount} / {groupMatches.length} completed
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-white/5 p-3 space-y-2">
                      {groupMatches.map(match => {
                        const home = getTeam(match.home_team_id);
                        const away = getTeam(match.away_team_id);
                        const isEditing = editingMatch?.id === match.id;
                        const isCompleted = match.status === "completed";
                        const isLive = ["first_half", "halftime", "second_half"].includes(match.status);

                        return (
                          <div
                            id={`match-row-${match.id}`}
                            key={match.id}
                            className={`flex flex-col lg:flex-row lg:items-center justify-between p-3.5 rounded-xl border gap-4 transition-colors ${
                              isEditing
                                ? "bg-white/5 border-primary/40"
                                : isCompleted
                                ? "bg-emerald-500/[0.03] border-emerald-500/15"
                                : isLive
                                ? "bg-blue-500/[0.05] border-blue-500/30"
                                : "bg-white/[0.02] border-white/5"
                            }`}
                          >
                            {/* Kickoff Date & Status Badge */}
                            <div className="flex items-center justify-between lg:flex-col lg:items-start gap-2 lg:w-36 shrink-0">
                              <div className="flex items-center gap-2">
                                {isCompleted ? (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    FT
                                  </span>
                                ) : isLive ? (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">
                                    {match.status.replace("_", " ")}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-400">
                                    Scheduled
                                  </span>
                                )}
                              </div>
                              {!isEditing && (
                                <div className="text-xs text-slate-300 font-medium">
                                  {match.match_date
                                    ? new Date(match.match_date).toLocaleDateString("en-GB", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : <span className="text-slate-500">Date TBD</span>}
                                </div>
                              )}
                            </div>

                            {/* Teams & Score / Inline Editor */}
                            {isEditing ? (
                              <div className="flex-1 bg-black/30 p-3 rounded-lg border border-white/10 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                  <div>
                                    <label htmlFor={`edit-date-${match.id}`} className="text-[11px] font-semibold text-slate-300 block mb-1">
                                      Kick-off Date & Time (WAT)
                                    </label>
                                    <input 
                                      id={`edit-date-${match.id}`}
                                      type="datetime-local" 
                                      className="flex h-9 w-full rounded-md border border-white/15 bg-black/40 px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                      value={editScores.match_date}
                                      onChange={e => setEditScores({...editScores, match_date: e.target.value})}
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`edit-home-${match.id}`} className="text-[11px] font-semibold text-slate-300 block mb-1 truncate">
                                      {home?.name} Goals
                                    </label>
                                    <Input 
                                      id={`edit-home-${match.id}`}
                                      type="number" 
                                      min="0"
                                      className="h-9 text-center font-bold bg-black/40" 
                                      value={editScores.home} 
                                      onChange={e => setEditScores({...editScores, home: e.target.value})}
                                      onKeyDown={e => e.key === 'Enter' && saveMatchScore(match.id, match.status)}
                                      placeholder="0"
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`edit-away-${match.id}`} className="text-[11px] font-semibold text-slate-300 block mb-1 truncate">
                                      {away?.name} Goals
                                    </label>
                                    <Input 
                                      id={`edit-away-${match.id}`}
                                      type="number" 
                                      min="0"
                                      className="h-9 text-center font-bold bg-black/40" 
                                      value={editScores.away} 
                                      onChange={e => setEditScores({...editScores, away: e.target.value})}
                                      onKeyDown={e => e.key === 'Enter' && saveMatchScore(match.id, match.status)}
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <Button size="sm" variant="outline" className="h-8 text-xs border-white/10" onClick={() => setEditingMatch(null)}>
                                    Cancel
                                  </Button>
                                  <Button size="sm" className="h-8 text-xs font-bold" onClick={() => saveMatchScore(match.id, match.status)}>
                                    <Check className="w-3.5 h-3.5 mr-1" /> Save Match
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between sm:justify-center gap-3 flex-1 w-full">
                                <div className="flex items-center gap-2.5 justify-end flex-1 min-w-0">
                                  <span className="font-bold text-sm text-white truncate text-right">{home?.name}</span>
                                  <TeamColorBadge team={home} />
                                </div>
                                
                                <div className={`px-3.5 py-1.5 rounded-lg border font-black text-base shrink-0 min-w-[68px] text-center ${
                                  isCompleted
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                    : isLive
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                    : "bg-black/30 border-white/10 text-slate-400 text-xs"
                                }`}>
                                  {isCompleted || isLive ? `${match.home_score ?? 0} – ${match.away_score ?? 0}` : "VS"}
                                </div>

                                <div className="flex items-center gap-2.5 justify-start flex-1 min-w-0">
                                  <TeamColorBadge team={away} />
                                  <span className="font-bold text-sm text-white truncate">{away?.name}</span>
                                </div>
                              </div>
                            )}

                            {/* Streamlined Actions */}
                            {!isEditing && (
                              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                                {match.status === 'scheduled' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                                    onClick={() => {
                                      const halfMins = halfDurations[match.id] || 45;
                                      setPendingStatusChange({
                                        matchId: match.id,
                                        status: 'first_half',
                                        getExtraFields: () => ({ half_duration: halfMins, first_half_start: new Date().toISOString() }),
                                        title: "Start 1st Half?",
                                        matchLabel: `${home?.name} vs ${away?.name}`,
                                        description: `Start the live timer for the 1st half (${halfMins} mins per half).`,
                                        confirmLabel: `Start (${halfMins}m)`,
                                      });
                                    }}
                                  >
                                    Start ({halfDurations[match.id] || 45}m)
                                  </Button>
                                )}
                                {match.status === 'first_half' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs border-amber-500/50 text-amber-400"
                                      onClick={() =>
                                        setPendingStatusChange({
                                          matchId: match.id,
                                          status: 'halftime',
                                          getExtraFields: () => ({}),
                                          title: "Call Half-Time (HT)?",
                                          matchLabel: `${home?.name} vs ${away?.name}`,
                                          description: "Pause the match at Half-Time and end the 1st half.",
                                          confirmLabel: "Call Half-Time",
                                        })
                                      }
                                    >
                                      HT
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs border-emerald-500/50 text-emerald-400"
                                      onClick={() =>
                                        setPendingStatusChange({
                                          matchId: match.id,
                                          status: 'completed',
                                          getExtraFields: () => ({ match_end: new Date().toISOString() }),
                                          title: "End Match at Full-Time?",
                                          matchLabel: `${home?.name} vs ${away?.name}`,
                                          description: `Mark this match as Full-Time (${match.home_score ?? 0} – ${match.away_score ?? 0}) and finalize its result in the standings.`,
                                          confirmLabel: "End Match (FT)",
                                        })
                                      }
                                    >
                                      End FT
                                    </Button>
                                  </>
                                )}
                                {match.status === 'halftime' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs border-emerald-500/50 text-emerald-400"
                                      onClick={() =>
                                        setPendingStatusChange({
                                          matchId: match.id,
                                          status: 'second_half',
                                          getExtraFields: () => ({ second_half_start: new Date().toISOString() }),
                                          title: "Start 2nd Half?",
                                          matchLabel: `${home?.name} vs ${away?.name}`,
                                          description: "Kick off the 2nd half and resume the live match timer.",
                                          confirmLabel: "Start 2nd Half",
                                        })
                                      }
                                    >
                                      2nd Half
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs border-blue-500/50 text-blue-400"
                                      onClick={() =>
                                        setPendingStatusChange({
                                          matchId: match.id,
                                          status: 'completed',
                                          getExtraFields: () => ({ match_end: new Date().toISOString() }),
                                          title: "End Match at Full-Time?",
                                          matchLabel: `${home?.name} vs ${away?.name}`,
                                          description: `Mark this match as Full-Time (${match.home_score ?? 0} – ${match.away_score ?? 0}) and finalize its result in the standings.`,
                                          confirmLabel: "End Match (FT)",
                                        })
                                      }
                                    >
                                      End FT
                                    </Button>
                                  </>
                                )}
                                {match.status === 'second_half' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs border-emerald-500/50 text-emerald-400"
                                    onClick={() =>
                                      setPendingStatusChange({
                                        matchId: match.id,
                                        status: 'completed',
                                        getExtraFields: () => ({ match_end: new Date().toISOString() }),
                                        title: "End Match at Full-Time?",
                                        matchLabel: `${home?.name} vs ${away?.name}`,
                                        description: `Mark this match as Full-Time (${match.home_score ?? 0} – ${match.away_score ?? 0}) and finalize its result in the standings.`,
                                        confirmLabel: "End Match (FT)",
                                      })
                                    }
                                  >
                                    End FT
                                  </Button>
                                )}

                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 text-xs border-white/10 hover:bg-white/5"
                                  onClick={() => {
                                    setEditingMatch(match);
                                    setEditScores({ 
                                      home: match.home_score ?? "", 
                                      away: match.away_score ?? "",
                                      match_date: formatDateForInput(match.match_date)
                                    });
                                  }}
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1.5" /> {isCompleted ? "Edit Result" : "Enter Result"}
                                </Button>

                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 text-xs border-white/10 hover:bg-white/5"
                                  title="Record goals, assists, and cards"
                                  onClick={() => setInfoMatch({ matchId: match.id, homeTeam: home, awayTeam: away, stage: match.stage, status: match.status })}
                                >
                                  <Info className="w-3.5 h-3.5 mr-1 text-primary" /> Events
                                </Button>

                                {/* Overflow "⋯" menu for secondary options (half duration, reset) */}
                                <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    aria-label="More match actions"
                                    title="More match options"
                                    className="h-8 w-8 text-slate-400 hover:text-white"
                                    onClick={() => setOpenMatchMenuId(openMatchMenuId === match.id ? null : match.id)}
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                  {openMatchMenuId === match.id && (
                                    <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[#0f1423] border border-white/15 shadow-2xl p-2 z-40 space-y-2 animate-in fade-in zoom-in-95">
                                      {match.status === "scheduled" && (
                                        <div className="px-2 py-1">
                                          <label htmlFor={`half-dur-${match.id}`} className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                            Half Length (mins)
                                          </label>
                                          <select
                                            id={`half-dur-${match.id}`}
                                            className="w-full h-8 bg-black/40 border border-white/10 rounded px-2 text-xs text-white"
                                            value={halfDurations[match.id] || 45}
                                            onChange={(e) => {
                                              setHalfDurations({ ...halfDurations, [match.id]: parseInt(e.target.value, 10) });
                                              setOpenMatchMenuId(null);
                                            }}
                                          >
                                            {[10, 15, 20, 25, 30, 35, 40, 45].map(m => (
                                              <option key={m} value={m} className="bg-[#0f1423] text-white">{m} mins per half</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                      {match.status !== "scheduled" && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenMatchMenuId(null);
                                            setMatchToReset({ id: match.id, label: `${home?.name} vs ${away?.name}` });
                                          }}
                                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" /> Reset Match
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Collapsed Advanced / Danger Zone Section */}
      <div className="pt-6 border-t border-white/10">
        <button
          type="button"
          onClick={() => setShowDangerZone(!showDangerZone)}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
        >
          {showDangerZone ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <ShieldAlert className="w-4 h-4 text-destructive" />
          Advanced & Danger Zone
        </button>

        {showDangerZone && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 animate-in fade-in">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive text-base">Delete All Matches</CardTitle>
                <CardDescription>
                  Deletes all {matches.length} scheduled and completed matches in <strong>{settings?.name}</strong> while keeping the 4 registered teams and their squads.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  disabled={matches.length === 0}
                  onClick={() => setConfirmResetMatches(true)}
                >
                  Delete All Matches ({matches.length})
                </Button>
              </CardContent>
            </Card>

            {isSuperAdmin && (
              <Card className="border-destructive/50 bg-destructive/10">
                <CardHeader>
                  <CardTitle className="text-destructive font-black flex items-center gap-2 text-base">
                    <ShieldAlert className="w-5 h-5" /> Reset This Tournament
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Permanently deletes all teams, players, matches, and scores inside <strong>{settings?.name}</strong> only (other tournaments on the platform are not affected).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => {
                      setFullResetConfirmText("");
                      setConfirmFullReset(true);
                    }}
                  >
                    Reset Tournament Data
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Confirm Delete Team Modal */}
      {teamToDelete && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setTeamToDelete(null); }}
        >
          <div className="bg-[#0f1423] border border-red-500/20 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Team "{teamToDelete.name}"?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Deleting <strong>{teamToDelete.name}</strong> will permanently remove the team and all of its squad players from this tournament.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="border-white/10" onClick={() => setTeamToDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDeleteTeam}>Delete Team</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Match Status Change Modal (Start, HT, 2nd Half, End FT) */}
      {pendingStatusChange && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPendingStatusChange(null); }}
        >
          <div className="bg-[#0f1423] border border-primary/25 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="text-lg font-bold text-white">{pendingStatusChange.title}</h3>
              <p className="text-xs font-semibold text-primary mt-0.5">{pendingStatusChange.matchLabel}</p>
            </div>
            <p className="text-sm text-slate-300">
              {pendingStatusChange.description}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="border-white/10" onClick={() => setPendingStatusChange(null)}>
                Cancel
              </Button>
              <Button
                className="font-bold"
                onClick={async () => {
                  const { matchId, status, getExtraFields } = pendingStatusChange;
                  setPendingStatusChange(null);
                  await updateMatchStatus(matchId, status, getExtraFields ? getExtraFields() : {});
                }}
              >
                {pendingStatusChange.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Single Match Modal */}
      {matchToReset && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setMatchToReset(null); }}
        >
          <div className="bg-[#0f1423] border border-red-500/20 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Reset Match?</h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to reset <strong>{matchToReset.label}</strong>? Its scoreline, match timer, goals, assists, and cards will be permanently cleared.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="border-white/10" onClick={() => setMatchToReset(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmResetSingleMatch}>Reset Match</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete All Matches Modal */}
      {confirmResetMatches && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmResetMatches(false); }}
        >
          <div className="bg-[#0f1423] border border-red-500/20 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete All {matches.length} Matches?</h3>
                <p className="text-xs text-slate-400">Affects "{settings?.name}" only</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              All <strong>{matches.length} matches</strong> (including scores, goals, assists, and cards) in <strong>{settings?.name}</strong> will be permanently deleted. Your 4 teams and their players will be kept.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="border-white/10" onClick={() => setConfirmResetMatches(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleResetMatches}>Yes, Delete {matches.length} Matches</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Full Tournament Reset Modal (requires typing tournament name) */}
      {confirmFullReset && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmFullReset(false); }}
        >
          <div className="bg-[#0f1423] border border-red-500/20 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Reset This Tournament</h3>
                <p className="text-xs text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              This will permanently wipe all <strong>{teams.length} teams</strong>, their squad players, and all <strong>{matches.length} matches</strong> inside <strong>{settings?.name}</strong>. Other tournaments are not affected.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="confirm-reset-name" className="text-xs text-slate-300 block">
                Type <span className="font-bold text-white">{settings?.name}</span> to confirm:
              </label>
              <Input
                id="confirm-reset-name"
                value={fullResetConfirmText}
                onChange={(e) => setFullResetConfirmText(e.target.value)}
                placeholder={settings?.name}
                className="bg-black/40 border-white/15"
              />
            </div>
            <div className="flex gap-3 w-full pt-2">
              <Button variant="outline" className="flex-1 border-white/10" onClick={() => setConfirmFullReset(false)}>Cancel</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={fullResetConfirmText.trim() !== settings?.name}
                onClick={handleFullReset}
              >
                Wipe Tournament Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {infoMatch && (
        <AdminMatchInfoModal 
          isOpen={!!infoMatch}
          onClose={() => setInfoMatch(null)}
          matchId={infoMatch.matchId}
          homeTeam={infoMatch.homeTeam}
          awayTeam={infoMatch.awayTeam}
          stage={infoMatch.stage}
          status={infoMatch.status}
          onSaveSuccess={(mId, hScore, aScore) => {
            setMatches(prev => prev.map(m => m.id === mId ? { ...m, home_score: hScore, away_score: aScore } : m));
          }}
        />
      )}
    </div>
  );
}
