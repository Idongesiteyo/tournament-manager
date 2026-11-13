import { useEffect, useState, useRef } from "react";
import { Link, Outlet, useLocation, useParams, useNavigate } from "react-router-dom";
import { Trophy, LayoutDashboard, BarChart3, Settings, ShieldAlert, Users, Info, LogOut, User, ChevronDown } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Toaster } from "../ui/sonner";

export default function Layout() {
  const { pathname } = useLocation();
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tournamentName, setTournamentName] = useState("Football Tournament Manager");
  const [tournamentImage, setTournamentImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserEmail(session.user.email);
        const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
        if (data) setUserRole(data.role);
      } else {
        setUserEmail(null);
        setUserRole(null);
      }
    };
    fetchUserRole();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUserEmail(session.user.email);
        supabase.from("profiles").select("role").eq("id", session.user.id).single().then(({ data }) => {
          if (data) setUserRole(data.role);
        });
      } else {
        setUserEmail(null);
        setUserRole(null);
      }
    });

    if (!tournamentId) {
      setTournamentName("Football Tournament Manager");
      setTournamentImage(null);
      setLoading(false);
      return () => authSub?.subscription?.unsubscribe();
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
      authSub?.subscription?.unsubscribe();
    };
  }, [tournamentId]);

  // Dynamic document title per page
  useEffect(() => {
    const appTitle = "Football Tournament Manager";
    if (pathname.startsWith("/auth")) {
      document.title = `Sign In | ${appTitle}`;
    } else if (pathname.startsWith("/super-admin")) {
      document.title = `Super Admin Panel | ${appTitle}`;
    } else if (pathname === "/dashboard") {
      document.title = `Dashboard | ${appTitle}`;
    } else if (pathname.startsWith("/dashboard/") && pathname.includes("/team/")) {
      document.title = `Manage Squad – ${tournamentName} | ${appTitle}`;
    } else if (pathname.startsWith("/dashboard/")) {
      document.title = `Manage – ${tournamentName} | ${appTitle}`;
    } else if (pathname.endsWith("/teams")) {
      document.title = `Teams – ${tournamentName} | ${appTitle}`;
    } else if (pathname.includes("/team/")) {
      document.title = `Team Profile – ${tournamentName} | ${appTitle}`;
    } else if (pathname.endsWith("/stats")) {
      document.title = `Statistics – ${tournamentName} | ${appTitle}`;
    } else if (pathname.endsWith("/about")) {
      document.title = `About – ${tournamentName} | ${appTitle}`;
    } else if (tournamentId) {
      document.title = `Standings – ${tournamentName} | ${appTitle}`;
    } else {
      document.title = appTitle;
    }
  }, [pathname, tournamentName, tournamentId]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const publicNavItems = [
    { label: "Standings", path: `/t/${tournamentId}`, icon: LayoutDashboard },
    { label: "Teams", path: `/t/${tournamentId}/teams`, icon: Users },
    { label: "Stats", path: `/t/${tournamentId}/stats`, icon: BarChart3 },
    { label: "About", path: `/t/${tournamentId}/about`, icon: Info },
  ];

  const adminNavItems = [
    { label: "Tournaments", path: `/dashboard`, icon: LayoutDashboard },
  ];

  if (userRole === "super_admin") {
    adminNavItems.push({ label: "Super Admin", path: `/super-admin`, icon: ShieldAlert });
  } else if (userRole === "admin") {
    adminNavItems.push({ label: "Admin Panel", path: `/super-admin`, icon: ShieldAlert });
  }

  const isDashboard = pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin");
  const navItems = isDashboard ? adminNavItems : publicNavItems;
  const isApprovedUser = userRole && !["pending", "declined"].includes(userRole);

  return (
    <div className="min-h-screen flex flex-col bg-[#090b14] text-foreground font-sans selection:bg-primary/30">
      <nav className="border-b border-white/5 bg-[#090b14]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={isDashboard ? "/dashboard" : tournamentId ? `/t/${tournamentId}` : "/auth"} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
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
                if (window.innerWidth < 640) {
                  e.preventDefault();
                  setIsTitleExpanded(!isTitleExpanded);
                }
              }}
            >
              {loading ? "Football Tournament Manager" : tournamentName}
            </span>
          </Link>
          
          <div className="flex items-center gap-1 sm:gap-3">
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
            
            {/* Only show Admin shortcut in header if user is already signed in as an approved admin */}
            {!isDashboard && tournamentId && isApprovedUser && (
              <Link 
                to={`/dashboard/${tournamentId}`}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all ml-1 border border-white/10"
                title="Manage this tournament"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Manage</span>
              </Link>
            )}

            {/* User / Avatar menu when signed in */}
            {userEmail && (
              <div className="relative ml-1" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label="Account menu"
                  title={userEmail}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black uppercase">
                    {userEmail[0]}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0f1423] border border-white/10 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-2 border-b border-white/5">
                      <p className="text-xs font-bold text-white truncate">{userEmail}</p>
                      {userRole && (
                        <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mt-0.5">
                          {userRole.replace(/_/g, " ")}
                        </p>
                      )}
                    </div>
                    <Link
                      to="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" /> My Tournaments
                    </Link>
                    {(userRole === "super_admin" || userRole === "admin") && (
                      <Link
                        to="/super-admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> {userRole === "super_admin" ? "Super Admin Panel" : "Admin Panel"}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border-t border-white/5 mt-1 pt-2"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl w-full mx-auto px-4 py-8 relative flex-1">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
        <Outlet />
      </main>

      {!isDashboard && (
        <footer className="border-t border-white/5 py-6 px-4 text-center text-xs text-slate-500 flex items-center justify-between max-w-6xl w-full mx-auto">
          <span>Football Tournament Manager</span>
          <Link to={tournamentId ? `/dashboard/${tournamentId}` : "/auth"} className="text-slate-500 hover:text-slate-300 transition-colors">
            {userEmail ? "Admin Dashboard" : "Admin Login"}
          </Link>
        </footer>
      )}

      <Toaster theme="dark" />
    </div>
  );
}
