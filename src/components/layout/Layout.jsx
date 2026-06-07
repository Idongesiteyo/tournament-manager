import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { Trophy, LayoutDashboard, BarChart3, Settings, ShieldAlert, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Toaster } from "../ui/sonner";

export default function Layout() {
  const { pathname } = useLocation();
  const { tournamentId } = useParams();
  const [tournamentName, setTournamentName] = useState("Tournament");
  const [tournamentImage, setTournamentImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
        if (data) setUserRole(data.role);
      }
    };
    fetchUserRole();

    if (!tournamentId) {
      setTournamentName("Football tournament manager");
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      const { data } = await supabase.from("tournaments").select("name, image_url").eq("id", tournamentId).single();
      if (data) {
        setTournamentName(data.name);
        setTournamentImage(data.image_url);
      }
      setLoading(false);
    };

    fetchSettings();

    const channel = supabase.channel(`public_layout_${tournamentId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` }, (payload) => {
        if (payload.new.name) setTournamentName(payload.new.name);
        if (payload.new.image_url !== undefined) setTournamentImage(payload.new.image_url);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  const publicNavItems = [
    { label: "Standings", path: `/t/${tournamentId}`, icon: LayoutDashboard },
    { label: "Teams", path: `/t/${tournamentId}/teams`, icon: Users },
    { label: "Stats", path: `/t/${tournamentId}/stats`, icon: BarChart3 },
  ];

  const adminNavItems = [
    { label: "Dashboard", path: `/dashboard`, icon: LayoutDashboard },
  ];

  if (userRole === "super_admin") {
    adminNavItems.push({ label: "Super Admin", path: `/super-admin`, icon: ShieldAlert });
  }

  const isDashboard = pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin");
  const navItems = isDashboard ? adminNavItems : publicNavItems;

  return (
    <div className="min-h-screen bg-[#090b14] text-foreground font-sans selection:bg-primary/30">
      <nav className="border-b border-white/5 bg-[#090b14]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={isDashboard ? "/dashboard" : `/t/${tournamentId}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {tournamentImage ? (
              <img src={tournamentImage} alt="Tournament Logo" className="w-8 h-8 rounded-lg object-cover shadow-lg shadow-primary/20" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <Trophy className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
            <span 
              className={`font-black text-lg md:text-xl tracking-tight text-white transition-all ${!isTitleExpanded ? 'truncate max-w-[140px] sm:max-w-xs md:max-w-md' : 'whitespace-normal'}`}
              title={tournamentName}
              onClick={(e) => {
                e.preventDefault();
                setIsTitleExpanded(!isTitleExpanded);
              }}
            >
              {loading ? "..." : tournamentName}
            </span>
          </Link>
          
          <div className="flex items-center gap-1 sm:gap-4">
            {tournamentId || isDashboard ? navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold transition-all ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            }) : null}
            
            {!isDashboard && tournamentId && (
              <Link 
                to={`/dashboard/${tournamentId}`}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all ml-2 border border-white/5"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            {!isDashboard && !tournamentId && (
              <Link 
                to={`/dashboard`}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all ml-2 border border-white/5"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Admin Dashboard</span>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
        <Outlet />
      </main>

      <Toaster theme="dark" />
    </div>
  );
}
