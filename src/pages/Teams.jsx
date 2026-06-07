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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` }, loadData)
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
              <Card className="bg-[#0f1423] border-white/5 hover:border-primary/50 transition-colors h-full">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-lg border border-white/10"
                      style={{ backgroundColor: team.color, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    >
                      {team.short_name}
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white group-hover:text-primary transition-colors">{team.name}</CardTitle>
                      <CardDescription>Formation: {team.formation || "3-3-1"}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
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
