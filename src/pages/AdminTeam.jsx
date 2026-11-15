import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, UserPlus, Trash2, Check, X, Shield, Users, Edit2, Save, Camera, Loader2, Upload, FileSpreadsheet, Download } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import UnauthorizedAccess from "../components/ui/UnauthorizedAccess";
import PageLoader from "../components/ui/PageLoader";

const VALID_FORMATIONS = ["3-3-1", "3-2-2", "2-3-2", "2-4-1", "4-2-1"];

import { compressImageToWebp } from "../lib/imageUtils";

export default function AdminTeam() {
  const { tournamentId, teamId } = useParams();
  const navigate = useNavigate();
  
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNum, setNewPlayerNum] = useState("");
  const [newPlayerPos, setNewPlayerPos] = useState("Midfielder");

  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editData, setEditData] = useState({ name: "", jersey_number: "", position: "" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  const normalizePosition = (raw) => {
    const val = (raw || "").trim().toLowerCase();
    if (["forward", "fw", "fwd", "st", "striker", "cf", "att", "attacker", "winger"].includes(val)) return "Forward";
    if (["midfielder", "mid", "mf", "cm", "cam", "cdm", "lm", "rm", "midfield"].includes(val)) return "Midfielder";
    if (["defender", "def", "df", "cb", "lb", "rb", "defense", "defence", "back"].includes(val)) return "Defender";
    if (["goalkeeper", "gk", "goalie", "keeper"].includes(val)) return "Goalkeeper";
    return null;
  };

  const downloadCsvTemplate = () => {
    const csvContent = "name,number,position,starter\nJohn Doe,1,Goalkeeper,true\nJane Smith,4,Defender,true\nAlex Johnson,8,Midfielder,true\nSam Williams,9,Forward,false\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${(team?.name || "team").toLowerCase().replace(/\s+/g, "_")}_squad_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setUploadingCsv(true);
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        toast.error("The CSV file is empty.");
        return;
      }

      const splitCsvRow = (row) => {
        const delimiter = row.includes(";") && !row.includes(",") ? ";" : ",";
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === delimiter && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };

      const firstCols = splitCsvRow(lines[0]).map(c => c.toLowerCase());
      const hasHeader =
        firstCols.some(c => ["name", "player", "player name", "player_name", "number", "jersey", "jersey_number", "#", "position", "pos"].includes(c)) ||
        isNaN(parseInt(firstCols[1], 10));

      let nameIdx = 0, numIdx = 1, posIdx = 2, starterIdx = 3;
      if (hasHeader) {
        const findCol = (aliases, fallback) => {
          const idx = firstCols.findIndex(c => aliases.includes(c));
          return idx !== -1 ? idx : fallback;
        };
        nameIdx = findCol(["name", "player", "player name", "player_name", "fullname", "full name"], 0);
        numIdx = findCol(["number", "jersey", "jersey_number", "jersey number", "#", "no", "kit", "shirt"], 1);
        posIdx = findCol(["position", "pos", "role"], 2);
        starterIdx = findCol(["starter", "is_starter", "starting", "status", "lineup"], 3);
      }

      const dataLines = hasHeader ? lines.slice(1) : lines;
      if (dataLines.length === 0) {
        toast.error("No player rows found in CSV.");
        return;
      }

      let currentStartersCount = players.filter(p => p.is_starter).length;
      const toInsert = [];
      const skipped = [];

      dataLines.forEach((line, idx) => {
        const rowNum = hasHeader ? idx + 2 : idx + 1;
        const cols = splitCsvRow(line);
        const rawName = cols[nameIdx]?.trim();
        const rawNum = cols[numIdx]?.trim();
        const rawPos = cols[posIdx]?.trim();
        const rawStarter = cols[starterIdx]?.trim()?.toLowerCase();

        if (!rawName && !rawNum && !rawPos) return;

        const parsedNum = parseInt(rawNum, 10);
        const normalizedPos = normalizePosition(rawPos || "Midfielder");

        if (!rawName || isNaN(parsedNum) || !normalizedPos) {
          skipped.push(`Row ${rowNum}`);
          return;
        }

        let isStarter = ["true", "yes", "1", "y", "starter", "starting"].includes(rawStarter);
        if (isStarter && currentStartersCount >= 8) {
          isStarter = false;
        } else if (isStarter) {
          currentStartersCount += 1;
        }

        toInsert.push({
          team_id: teamId,
          name: rawName,
          jersey_number: parsedNum,
          position: normalizedPos,
          is_starter: isStarter,
        });
      });

      if (toInsert.length === 0) {
        toast.error("No valid players found. Expected columns: Name, Number, Position (Forward, Midfielder, Defender, Goalkeeper).");
        return;
      }

      const { error } = await supabase.from("players").insert(toInsert);
      if (error) throw error;

      const skippedMsg = skipped.length > 0 ? ` (${skipped.length} invalid row(s) skipped)` : "";
      toast.success(`Imported ${toInsert.length} player${toInsert.length > 1 ? "s" : ""} from CSV!${skippedMsg}`);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to import CSV: " + err.message);
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      toast.info("Preparing image...");

      const processedFile = await compressImageToWebp(file, 1);
      const fileName = `${teamId}-${Date.now()}.webp`;

      toast.info("Uploading picture to storage...");

      const { error: uploadError } = await supabase.storage
        .from('team_pictures')
        .upload(fileName, processedFile, { upsert: true, contentType: 'image/webp' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('team_pictures')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('teams')
        .update({ team_picture_url: publicUrl })
        .eq('id', teamId);

      if (updateError) throw updateError;

      toast.success("Team picture updated successfully!");
      setTeam({ ...team, team_picture_url: publicUrl });

    } catch (err) {
      console.error(err);
      toast.error("Error uploading picture: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setAuthError(true); setLoading(false); return; }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
    const isSuperAdmin = profile?.role === 'super_admin';

    const { data: tData, error: tErr } = await supabase
      .from("tournaments")
      .select("user_id")
      .eq("id", tournamentId)
      .single();
      
    if (tErr || !tData) {
      setAuthError(true);
      setLoading(false);
      return;
    }

    let isAuthorized = isSuperAdmin || tData.user_id === session.user.id;

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

    const [t, p] = await Promise.all([
      supabase.from("teams").select("*").eq("id", teamId).single(),
      supabase.from("players").select("*").eq("team_id", teamId)
    ]);
    
    if (t.data) setTeam(t.data);
    if (p.data) setPlayers(p.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    const channel = supabase.channel(`admin_team_${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `id=eq.${teamId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `team_id=eq.${teamId}` }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const updateFormation = async (formation) => {
    setTeam({ ...team, formation }); // Optimistic update
    const { error } = await supabase.from("teams").update({ formation }).eq("id", teamId);
    if (error) {
      toast.error("Failed to update formation. Have you run the SQL script?");
    } else {
      toast.success("Formation updated to " + formation);
    }
  };

  const addPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !newPlayerNum) return;
    
    const { error } = await supabase.from("players").insert([{
      team_id: teamId,
      name: newPlayerName.trim(),
      position: newPlayerPos,
      jersey_number: parseInt(newPlayerNum, 10),
      is_starter: false
    }]);
    
    if (error) {
      toast.error("Failed to add player: " + error.message);
      return;
    }
    
    setNewPlayerName("");
    setNewPlayerNum("");
    toast.success("Player added");
  };

  const deletePlayer = async (id) => {
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete player: " + error.message);
    } else {
      toast.success("Player deleted");
    }
  };

  const startEdit = (p) => {
    setEditingPlayerId(p.id);
    setEditData({ name: p.name, jersey_number: p.jersey_number, position: p.position });
  };

  const cancelEdit = () => {
    setEditingPlayerId(null);
    setEditData({ name: "", jersey_number: "", position: "" });
  };

  const saveEdit = async (id) => {
    if (!editData.name.trim() || !editData.jersey_number) return;
    
    const { error } = await supabase.from("players").update({
      name: editData.name.trim(),
      jersey_number: parseInt(editData.jersey_number, 10),
      position: editData.position
    }).eq("id", id);

    if (error) {
      toast.error("Failed to update player: " + error.message);
    } else {
      toast.success("Player updated");
      setEditingPlayerId(null);
    }
  };

  const toggleStarter = async (player) => {
    const isCurrentlyStarter = player.is_starter;
    
    if (!isCurrentlyStarter) {
      const currentStarters = players.filter(p => p.is_starter).length;
      if (currentStarters >= 8) {
        toast.error("You can only have a maximum of 8 starting players.");
        return;
      }
    }
    
    const { error } = await supabase.from("players").update({ is_starter: !isCurrentlyStarter }).eq("id", player.id);
    if (error) {
      toast.error("Failed to update player status.");
    }
  };

  if (authError) return <UnauthorizedAccess />;
  if (loading) return <PageLoader label="Loading Team Data" />;
  if (!team) return <div className="p-8 text-center text-destructive font-bold">Team not found</div>;

  const starters = players.filter(p => p.is_starter).sort((a,b) => a.jersey_number - b.jersey_number);
  const bench = players.filter(p => !p.is_starter).sort((a,b) => a.jersey_number - b.jersey_number);

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-3 sm:gap-4 mb-8">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back to Manage Tournament"
          title="Back to Manage Tournament"
          onClick={() => navigate(`/dashboard/${tournamentId}`)}
          className="hover:bg-white/5 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">{team.name} Squad</h1>
          <p className="text-sm text-slate-400">Manage starting VIII and substitutes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> Formation
              </CardTitle>
              <CardDescription>Select 8-a-side formation</CardDescription>
            </CardHeader>
            <CardContent>
              <select 
                className="w-full h-10 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                value={team.formation || "3-3-1"}
                onChange={(e) => updateFormation(e.target.value)}
              >
                {VALID_FORMATIONS.map(f => (
                  <option key={f} value={f} className="bg-[#0f1423] text-white">{f}</option>
                ))}
              </select>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-400" /> Team Picture
              </CardTitle>
              <CardDescription>Upload a cinematic banner</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {team.team_picture_url && (
                  <div className="w-full aspect-[16/7] rounded-md overflow-hidden border border-white/10">
                    <img src={team.team_picture_url} alt="Team" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <Button variant="outline" className="w-full bg-black/20 border-white/10 pointer-events-none" disabled={uploadingImage}>
                    {uploadingImage ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" /> {team.team_picture_url ? "Change Picture" : "Upload Picture"}</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" /> Add Player
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={addPlayer} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Name</label>
                  <Input 
                    placeholder="Player Name" 
                    value={newPlayerName} 
                    onChange={e => setNewPlayerName(e.target.value)} 
                    className="bg-black/20 border-white/10 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Number</label>
                    <Input 
                      type="number"
                      placeholder="#" 
                      value={newPlayerNum} 
                      onChange={e => setNewPlayerNum(e.target.value)} 
                      className="bg-black/20 border-white/10 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Position</label>
                    <select 
                      className="w-full h-10 mt-1 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={newPlayerPos}
                      onChange={e => setNewPlayerPos(e.target.value)}
                    >
                      <option className="bg-[#0f1423]">Forward</option>
                      <option className="bg-[#0f1423]">Midfielder</option>
                      <option className="bg-[#0f1423]">Defender</option>
                      <option className="bg-[#0f1423]">Goalkeeper</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full font-bold">Add Player</Button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-primary" /> Bulk Upload (CSV)
                  </span>
                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Download className="w-3 h-3" /> Template
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Columns: <span className="text-slate-200 font-medium">Name, Number, Position</span> (Forward, Midfielder, Defender, Goalkeeper), and optional <span className="text-slate-200 font-medium">Starter</span> (true/false).
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvUpload}
                    disabled={uploadingCsv}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <Button type="button" variant="outline" className="w-full bg-black/20 border-white/10 pointer-events-none" disabled={uploadingCsv}>
                    {uploadingCsv ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing CSV...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" /> Upload Players CSV</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" /> Starting VIII
                </CardTitle>
                <CardDescription>Must be exactly 8 players ({starters.length}/8)</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {starters.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm">No starters selected.</div>
              ) : (
                <div className="space-y-2">
                  {starters.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-white/[0.02] border border-white/5 border-l-2 border-l-primary gap-2">
                      {editingPlayerId === p.id ? (
                        <div className="flex-1 flex items-center gap-2 mr-2 sm:mr-4">
                          <Input className="h-8 bg-black/20" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} placeholder="Name" />
                          <Input type="number" className="h-8 w-16 sm:w-20 bg-black/20" value={editData.jersey_number} onChange={e => setEditData({...editData, jersey_number: e.target.value})} placeholder="#" />
                          <select className="h-8 rounded-md border border-white/10 bg-black/20 px-1 sm:px-2 text-white text-xs w-20 sm:w-auto" value={editData.position} onChange={e => setEditData({...editData, position: e.target.value})}>
                            <option className="bg-[#0f1423]">Forward</option>
                            <option className="bg-[#0f1423]">Midfielder</option>
                            <option className="bg-[#0f1423]">Defender</option>
                            <option className="bg-[#0f1423]">Goalkeeper</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                            {p.jersey_number}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white text-sm sm:text-base flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 leading-tight">
                              <span className="truncate">{p.name}</span>
                              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-primary/70 bg-primary/10 px-1 sm:px-1.5 py-0.5 rounded-sm w-fit shrink-0">
                                {p.position}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-0 sm:gap-1 md:gap-2 shrink-0">
                        {editingPlayerId === p.id ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => saveEdit(p.id)} className="text-emerald-400 hover:text-emerald-300 h-7 w-7 sm:h-8 sm:w-8"><Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={cancelEdit} className="text-slate-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8"><X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => toggleStarter(p)} className="h-7 sm:h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 whitespace-nowrap text-[10px] sm:text-xs px-2 sm:px-3">Bench</Button>
                            <Button variant="ghost" size="icon" onClick={() => startEdit(p)} className="text-slate-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8"><Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePlayer(p.id)} className="text-slate-500 hover:text-destructive h-7 w-7 sm:h-8 sm:w-8"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0f1423] border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" /> Bench Substitutes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bench.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm">Bench is empty.</div>
              ) : (
                <div className="space-y-2">
                  {bench.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-white/[0.02] border border-white/5 gap-2">
                      {editingPlayerId === p.id ? (
                        <div className="flex-1 flex items-center gap-2 mr-2 sm:mr-4">
                          <Input className="h-8 bg-black/20" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} placeholder="Name" />
                          <Input type="number" className="h-8 w-16 sm:w-20 bg-black/20" value={editData.jersey_number} onChange={e => setEditData({...editData, jersey_number: e.target.value})} placeholder="#" />
                          <select className="h-8 rounded-md border border-white/10 bg-black/20 px-1 sm:px-2 text-white text-xs w-20 sm:w-auto" value={editData.position} onChange={e => setEditData({...editData, position: e.target.value})}>
                            <option className="bg-[#0f1423]">Forward</option>
                            <option className="bg-[#0f1423]">Midfielder</option>
                            <option className="bg-[#0f1423]">Defender</option>
                            <option className="bg-[#0f1423]">Goalkeeper</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-white/5 text-slate-300 flex items-center justify-center font-bold text-xs">
                            {p.jersey_number}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-300 text-sm sm:text-base flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 leading-tight">
                              <span className="truncate">{p.name}</span>
                              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 bg-black/20 px-1 sm:px-1.5 py-0.5 rounded-sm w-fit shrink-0">
                                {p.position}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-0 sm:gap-1 md:gap-2 shrink-0">
                        {editingPlayerId === p.id ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => saveEdit(p.id)} className="text-emerald-400 hover:text-emerald-300 h-7 w-7 sm:h-8 sm:w-8"><Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={cancelEdit} className="text-slate-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8"><X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => toggleStarter(p)} className="h-7 sm:h-8 border-white/10 text-slate-400 hover:text-white hover:bg-white/5 whitespace-nowrap text-[10px] sm:text-xs px-2 sm:px-3">Move up</Button>
                            <Button variant="ghost" size="icon" onClick={() => startEdit(p)} className="text-slate-400 hover:text-white h-7 w-7 sm:h-8 sm:w-8"><Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePlayer(p.id)} className="text-slate-500 hover:text-destructive h-7 w-7 sm:h-8 sm:w-8"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
