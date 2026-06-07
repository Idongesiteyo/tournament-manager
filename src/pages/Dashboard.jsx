import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Plus, Trophy, ArrowRight, LogOut, Clock } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

export default function Dashboard() {
  const [tournaments, setTournaments] = useState([]);
  const [newTournamentName, setNewTournamentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
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
            fetchTournaments(session.user.id);
          } else {
            setLoading(false);
          }
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const fetchTournaments = async (userId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setTournaments(data);
    }
    setLoading(false);
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!newTournamentName || !user) return;
    
    const { data, error } = await supabase
      .from("tournaments")
      .insert([{ name: newTournamentName, user_id: user.id }])
      .select();
      
    if (!error && data) {
      setNewTournamentName("");
      setTournaments([data[0], ...tournaments]);
      navigate(`/dashboard/${data[0].id}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;

  if (userRole === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-black">Account Pending Approval</h2>
        <p className="text-muted-foreground max-w-md">
          Your account has been created successfully, but it requires approval from a Super Admin before you can create and manage tournaments.
        </p>
        <Button variant="outline" onClick={handleLogout} className="mt-4 border-white/10">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-primary flex items-center gap-3">
          <Trophy className="w-8 h-8" /> My Tournaments
        </h1>
        <Button variant="outline" onClick={handleLogout} className="border-white/10 hover:bg-white/5">
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Create Tournament</CardTitle>
            <CardDescription>Start a new 4-team league</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTournament} className="space-y-4">
              <Input 
                placeholder="Tournament Name" 
                value={newTournamentName}
                onChange={e => setNewTournamentName(e.target.value)}
                className="bg-background/50 border-white/10"
              />
              <Button type="submit" className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Create New
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-bold">Your Leagues</h2>
          {tournaments.length === 0 ? (
            <div className="text-center p-8 bg-white/[0.02] rounded-2xl border border-white/5 text-muted-foreground">
              You haven't created any tournaments yet.
            </div>
          ) : (
            tournaments.map(t => (
              <Card key={t.id} className="bg-white/[0.02] border-white/5 hover:border-primary/50 transition-colors">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{t.name}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <Link to={`/t/${t.id}`} className="text-sm text-primary hover:underline">
                        Public Standings Page
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => navigate(`/dashboard/${t.id}`)}>
                    Manage <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
