import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Shield, ShieldAlert, CheckCircle2, Clock, Users, Trophy, Activity, Trash2, Briefcase, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import PageLoader from "../components/ui/PageLoader";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  tournament_manager: "Tournament Manager",
  pending: "Pending Approval",
  declined: "Declined",
};

const PAGE_SIZE = 10;

export default function SuperAdmin() {
  const [users, setUsers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [tournamentAdmins, setTournamentAdmins] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [activeTab, setActiveTab] = useState("users");

  // Search, filter & pagination state
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);

  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditPage, setAuditPage] = useState(1);

  // Confirm modal state
  const [confirmRoleAction, setConfirmRoleAction] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
        navigate("/dashboard");
        return;
      }

      setIsSuperAdmin(profile.role === "super_admin");
      setIsAdmin(profile.role === "admin");
      setCurrentUserId(session.user.id);
      if (profile.role !== "super_admin" && activeTab === "users") {
        setActiveTab("tournaments");
      }
      await Promise.all([
        fetchUsers(),
        fetchTournaments(),
        fetchTournamentAdmins(),
        fetchAuditLogs()
      ]);
      setLoading(false);
    };

    checkAuthAndLoad();
  }, [navigate]);

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) setUsers(data);
  };

  const fetchTournaments = async () => {
    const { data } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
    if (data) setTournaments(data);
  };

  const fetchTournamentAdmins = async () => {
    const { data } = await supabase.from("tournament_admins").select("*");
    if (data) setTournamentAdmins(data);
  };

  const fetchAuditLogs = async () => {
    const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setAuditLogs(data);
  };

  const updateUserRole = async (userId, newRole) => {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    if (error) {
      toast.error("Failed to update user role: " + error.message);
    } else {
      toast.success(`User role updated to ${ROLE_LABELS[newRole] || newRole}`);
      fetchUsers();
    }
    setConfirmRoleAction(null);
  };

  const handleAssignAdmin = async (tournamentId, adminId) => {
    if (!adminId) return;
    const { error } = await supabase.from("tournament_admins").insert({
      tournament_id: tournamentId,
      admin_id: adminId,
      assigned_by: (await supabase.auth.getSession()).data.session.user.id
    });
    
    if (error) {
      if (error.code === '23505') toast.error("User is already assigned to this tournament.");
      else toast.error("Failed to assign user.");
    } else {
      toast.success("Tournament access assigned!");
      fetchTournamentAdmins();
    }
  };

  const handleRemoveAssignment = async (assignmentId, email) => {
    if (!window.confirm(`Remove ${email} from managing this tournament?`)) return;
    const { error } = await supabase.from("tournament_admins").delete().eq("id", assignmentId);
    if (error) {
      toast.error("Failed to remove assignment.");
    } else {
      toast.success("Assignment removed.");
      fetchTournamentAdmins();
    }
  };

  const renderDiff = (log) => {
    if (log.action === 'UPDATE' && log.old_data && log.new_data) {
      const changes = [];
      for (const key in log.new_data) {
        if (JSON.stringify(log.old_data[key]) !== JSON.stringify(log.new_data[key])) {
          changes.push({
            key,
            oldVal: JSON.stringify(log.old_data[key]),
            newVal: JSON.stringify(log.new_data[key])
          });
        }
      }
      if (changes.length > 0) {
        return (
          <div className="mt-2 space-y-1 bg-black/20 p-2 rounded border border-white/5">
            <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Changes detected</p>
            {changes.map(c => (
              <div key={c.key} className="flex flex-col sm:flex-row sm:items-start sm:items-center gap-1 sm:gap-2 text-xs">
                <span className="font-mono text-slate-400">{c.key}:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-red-500/10 text-red-400 px-1 rounded line-through break-all">{c.oldVal}</span>
                  <span className="text-slate-500">→</span>
                  <span className="bg-emerald-500/10 text-emerald-400 px-1 rounded break-all">{c.newVal}</span>
                </div>
              </div>
            ))}
          </div>
        );
      }
    }
    return null;
  };

  const getUserEmail = (id) => users.find(u => u.id === id)?.email || "Unknown User";

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesEmail = (u.email || "").toLowerCase().includes(userSearch.trim().toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesEmail && matchesRole;
    });
  }, [users, userSearch, roleFilter]);

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(l => {
      const actor = getUserEmail(l.user_id).toLowerCase();
      const entity = (l.entity_type || "").toLowerCase();
      const q = auditSearch.trim().toLowerCase();
      const matchesQuery = !q || actor.includes(q) || entity.includes(q);
      const matchesAction = auditActionFilter === "all" || l.action === auditActionFilter;
      return matchesQuery && matchesAction;
    });
  }, [auditLogs, users, auditSearch, auditActionFilter]);

  const totalAuditPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = filteredLogs.slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE);

  if (!isSuperAdmin && !isAdmin && !loading) return null;
  if (loading) return <PageLoader label="Loading Super Admin" />;

  const pendingUsers = users.filter(u => u.role === "pending");
  const adminUsers = users.filter(u => u.role === "admin");
  const superAdmins = users.filter(u => u.role === "super_admin");
  const tournamentManagers = users.filter(u => u.role === "tournament_manager");

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <ShieldAlert className="w-8 h-8" /> {isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage user roles, tournament access assignments, and audit trails</p>
        </div>
      </div>

      {/* Stats Cards */}
      {isSuperAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <Card className="bg-white/[0.02] border-white/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-full text-amber-500">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pending Approval</p>
                <h2 className="text-2xl font-black">{pendingUsers.length}</h2>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.02] border-white/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-full text-emerald-500">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Admins</p>
                <h2 className="text-2xl font-black">{adminUsers.length}</h2>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.02] border-white/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-full text-blue-500">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground leading-tight">Tournament Managers</p>
                <h2 className="text-2xl font-black">{tournamentManagers.length}</h2>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full text-primary">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Super Admins</p>
                <h2 className="text-2xl font-black text-primary">{superAdmins.length}</h2>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10">
        {isSuperAdmin && (
          <button 
            onClick={() => setActiveTab("users")} 
            className={`px-4 py-3 font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> Users ({users.length})
          </button>
        )}
        <button 
          onClick={() => setActiveTab("tournaments")} 
          className={`px-4 py-3 font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'tournaments' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}
        >
          <Trophy className="w-4 h-4" /> Tournaments ({tournaments.length})
        </button>
        <button 
          onClick={() => setActiveTab("audit")} 
          className={`px-4 py-3 font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'audit' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}
        >
          <Activity className="w-4 h-4" /> Audit Logs
        </button>
      </div>

      {/* USERS TAB */}
      {activeTab === "users" && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Approve, promote, or revoke access for registered accounts.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  aria-label="Search users by email"
                  placeholder="Search email..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                  className="h-9 pl-8 text-xs bg-white/[0.02] border-white/10 w-48"
                />
              </div>
              <select
                aria-label="Filter users by role"
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setUserPage(1); }}
                className="h-9 rounded-md border border-white/10 bg-[#0f1423] px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Roles</option>
                <option value="pending">Pending Approval</option>
                <option value="admin">Admin</option>
                <option value="tournament_manager">Tournament Manager</option>
                <option value="super_admin">Super Admin</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {paginatedUsers.map(user => (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 gap-4">
                  <div>
                    <p className="font-bold text-white">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-full border ${
                        user.role === 'super_admin' ? 'bg-primary/15 text-primary border-primary/30' :
                        user.role === 'admin' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                        user.role === 'tournament_manager' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                        user.role === 'declined' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                        'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                      {user.id === currentUserId && (
                        <span className="text-[11px] text-slate-400 font-medium">(You)</span>
                      )}
                    </div>
                  </div>
                  
                  {user.role === 'pending' && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => updateUserRole(user.id, 'admin')}>Approve as Admin</Button>
                      <Button size="sm" variant="outline" className="border-white/15" onClick={() => updateUserRole(user.id, 'tournament_manager')}>Approve as Manager</Button>
                      <Button size="sm" variant="destructive" onClick={() => setConfirmRoleAction({ user, newRole: 'declined', title: `Decline ${user.email}?`, description: "This user will be marked as Declined and will not have access to any tournaments." })}>Decline</Button>
                    </div>
                  )}

                  {user.role === 'admin' && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/15 text-xs"
                        onClick={() => updateUserRole(user.id, 'tournament_manager')}
                      >
                        Change to Manager
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-primary/40 text-primary hover:bg-primary/10 text-xs"
                        onClick={() => setConfirmRoleAction({ user, newRole: 'super_admin', title: `Promote ${user.email} to Super Admin?`, description: "Super Admins have full control over all users, tournaments, and settings across the platform." })}
                      >
                        Make Super Admin
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white text-xs"
                        onClick={() => setConfirmRoleAction({ user, newRole: 'pending', title: `Revoke access for ${user.email}?`, description: "Their role will be reset to Pending Approval and they will lose access to the dashboard until re-approved." })}
                      >
                        Revoke Access
                      </Button>
                    </div>
                  )}

                  {user.role === 'tournament_manager' && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/15 text-xs"
                        onClick={() => updateUserRole(user.id, 'admin')}
                      >
                        Promote to Admin
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white text-xs"
                        onClick={() => setConfirmRoleAction({ user, newRole: 'pending', title: `Revoke access for ${user.email}?`, description: "Their role will be reset to Pending Approval and they will no longer be able to manage assigned tournaments." })}
                      >
                        Revoke Access
                      </Button>
                    </div>
                  )}

                  {user.role === 'super_admin' && user.id !== currentUserId && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/15 text-xs"
                        onClick={() => setConfirmRoleAction({ user, newRole: 'admin', title: `Demote ${user.email} to Admin?`, description: "They will remain an Admin for their own tournaments but lose Super Admin privileges." })}
                      >
                        Change to Admin
                      </Button>
                    </div>
                  )}

                  {user.role === 'declined' && (
                    <Button size="sm" variant="outline" onClick={() => updateUserRole(user.id, 'pending')} className="border-amber-500/50 text-amber-400">
                      Restore to Pending
                    </Button>
                  )}
                </div>
              ))}

              {paginatedUsers.length === 0 && (
                <p className="text-center text-sm text-slate-500 py-8">No users match your filter criteria.</p>
              )}
            </div>

            {totalUserPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-slate-400">
                <span>Page {userPage} of {totalUserPages} ({filteredUsers.length} users)</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 border-white/10" disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 border-white/10" disabled={userPage >= totalUserPages} onClick={() => setUserPage(p => p + 1)}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TOURNAMENTS TAB */}
      {activeTab === "tournaments" && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Tournaments</CardTitle>
            <CardDescription>View all tournaments and assign Admins or Tournament Managers to manage them.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(isSuperAdmin ? tournaments : tournaments.filter(t => t.user_id === currentUserId)).map(t => {
                const creator = getUserEmail(t.user_id);
                const assigned = tournamentAdmins.filter(ta => ta.tournament_id === t.id);

                return (
                  <div key={t.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 className="font-bold text-lg text-white">{t.name}</h3>
                        <p className="text-xs text-muted-foreground">Owner: <span className="text-white">{creator}</span></p>
                      </div>
                      <Button variant="outline" size="sm" className="border-white/15" onClick={() => navigate(`/dashboard/${t.id}`)}>
                        Manage Tournament
                      </Button>
                    </div>

                    <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Assigned Managers</h4>
                      {assigned.length === 0 ? (
                        <p className="text-xs text-slate-500 italic mb-3">No additional managers assigned.</p>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {assigned.map(a => {
                            const email = getUserEmail(a.admin_id);
                            return (
                              <div key={a.id} className="flex items-center justify-between bg-white/5 px-3 py-1.5 rounded">
                                <span className="text-sm font-medium">{email}</span>
                                <button
                                  type="button"
                                  aria-label={`Remove ${email}`}
                                  title="Remove assignment"
                                  onClick={() => handleRemoveAssignment(a.id, email)}
                                  className="text-red-400 hover:text-red-300 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <label htmlFor={`assign-${t.id}`} className="sr-only">Assign an Admin or Tournament Manager</label>
                        <select id={`assign-${t.id}`} className="bg-[#0f1423] border border-white/10 rounded-md text-sm px-3 py-1.5 flex-1 text-white">
                          <option value="">Select an Admin or Tournament Manager...</option>
                          {users.filter(u => (isSuperAdmin ? (u.role === 'admin' || u.role === 'tournament_manager') : u.role === 'tournament_manager') && u.id !== t.user_id).map(u => (
                            <option key={u.id} value={u.id}>{u.email} ({ROLE_LABELS[u.role] || u.role})</option>
                          ))}
                        </select>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-primary/50 text-primary hover:bg-primary/10"
                          onClick={() => {
                            const sel = document.getElementById(`assign-${t.id}`);
                            handleAssignAdmin(t.id, sel.value);
                            sel.value = "";
                          }}
                        >
                          Assign
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === "audit" && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Recent Audit Logs</CardTitle>
              <CardDescription>Automatically recorded database changes.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  aria-label="Search audit logs"
                  placeholder="Search actor or table..."
                  value={auditSearch}
                  onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                  className="h-9 pl-8 text-xs bg-white/[0.02] border-white/10 w-48"
                />
              </div>
              <select
                aria-label="Filter logs by action"
                value={auditActionFilter}
                onChange={(e) => { setAuditActionFilter(e.target.value); setAuditPage(1); }}
                className="h-9 rounded-md border border-white/10 bg-[#0f1423] px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Actions</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {paginatedLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">No audit logs found.</p>
              ) : (
                paginatedLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.action === 'INSERT' ? 'bg-emerald-500/20 text-emerald-400' :
                            log.action === 'UPDATE' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {log.action}
                          </span>
                          <span className="font-bold text-white">{log.entity_type}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Actor: <span className="text-white">{getUserEmail(log.user_id)}</span></p>
                      </div>
                      <div className="text-xs text-slate-400 text-right shrink-0">
                        {new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    {renderDiff(log)}
                  </div>
                ))
              )}
            </div>

            {totalAuditPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-slate-400">
                <span>Page {auditPage} of {totalAuditPages} ({filteredLogs.length} logs)</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 border-white/10" disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 border-white/10" disabled={auditPage >= totalAuditPages} onClick={() => setAuditPage(p => p + 1)}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Modal for Role / Access Changes */}
      {confirmRoleAction && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmRoleAction(null); }}
        >
          <div className="bg-[#0f1423] border border-white/15 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">{confirmRoleAction.title}</h3>
            <p className="text-sm text-slate-300">{confirmRoleAction.description}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="border-white/10" onClick={() => setConfirmRoleAction(null)}>Cancel</Button>
              <Button
                variant={confirmRoleAction.newRole === "pending" || confirmRoleAction.newRole === "declined" ? "destructive" : "default"}
                onClick={() => updateUserRole(confirmRoleAction.user.id, confirmRoleAction.newRole)}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
