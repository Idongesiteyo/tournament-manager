import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import FormationPitch from "../components/ui/FormationPitch";

export default function Teams() {
  const { tournamentId } = useParams();
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [tRes, pRes] = await Promise.all([
      supabase.from("teams").select("*").eq("tournament_id", tournamentId),
      supabase.from("players").select("*, teams!inner(tournament_id)").eq("teams.tournament_id", tournamentId)
    ]);
    
    if (tRes.data) setTeams(tRes.data);
    if (pRes.data) setPlayers(pRes.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!tournamentId) return;
    loadData();

    const channel = supabase.channel(`public_teams_${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadData) // would need complex filtering or just reload
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading teams...</div>;

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-black mb-2">Teams</h1>
        <p className="text-slate-400">All competing teams and their tactical formations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team => {
          const teamStarters = players.filter(p => p.team_id === team.id && p.is_starter);
          
          return (
            <Link key={team.id} to={`/t/${tournamentId}/team/${team.id}`} className="block group">
              <Card className="bg-[#0f1423] border-white/5 hover:border-primary/50 transition-colors h-full overflow-hidden flex flex-col">
                <div className="relative w-full aspect-[16/7]">
                  {team.team_picture_url ? (
                    <img 
                      src={team.team_picture_url} 
                      alt={team.name} 
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full bg-slate-800/50" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f1423] via-[#0f1423]/60 to-transparent" />
                  
                  <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3 z-10">
                    <div 
                      className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-black text-sm shadow-xl border-2 border-white/10"
                      style={{ backgroundColor: team.color || '#475569', color: '#fff' }}
                    >
                      {team.short_name?.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="mb-1">
                      <CardTitle className="text-xl text-white font-black group-hover:text-primary transition-colors tracking-tight line-clamp-1">{team.name}</CardTitle>
                      <p className="text-xs text-slate-300 font-medium">Formation: {team.formation || "3-3-1"}</p>
                    </div>
                  </div>
                </div>
                <CardContent className="pt-6 flex-1">
                  <FormationPitch 
                    teamColor={team.color} 
                    formation={team.formation || "3-3-1"} 
                    starters={teamStarters} 
                  />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
