import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Shield, ShieldAlert, CheckCircle2, Clock, Users, Trophy, Activity, Trash2, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
    const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setAuditLogs(data);
  };

  const updateUserRole = async (userId, newRole) => {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    if (error) {
      toast.error("Failed to update user role");
    } else {
      toast.success(`User updated to ${newRole}`);
      fetchUsers();
    }
  };

  const handleAssignAdmin = async (tournamentId, adminId) => {
    if (!adminId) return;
    const { error } = await supabase.from("tournament_admins").insert({
      tournament_id: tournamentId,
      admin_id: adminId,
      assigned_by: (await supabase.auth.getSession()).data.session.user.id
    });
    
    if (error) {
      if (error.code === '23505') toast.error("Admin is already assigned to this tournament.");
      else toast.error("Failed to assign admin.");
    } else {
      toast.success("Admin assigned successfully!");
      fetchTournamentAdmins();
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
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

  if (!isSuperAdmin && !isAdmin && !loading) return null;
  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading Super Admin Panel...</div>;

  const pendingUsers = users.filter(u => u.role === "pending");
  const adminUsers = users.filter(u => u.role === "admin");
  const superAdmins = users.filter(u => u.role === "super_admin");
  const tournamentManagers = users.filter(u => u.role === "tournament_manager");
  const declinedUsers = users.filter(u => u.role === "declined");

  const getUserEmail = (id) => users.find(u => u.id === id)?.email || "Unknown User";

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-primary flex items-center gap-3">
          <ShieldAlert className="w-8 h-8" /> {isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}
        </h1>
      </div>

      {/* Stats Cards */}
      {isSuperAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <Card className="bg-white/[0.02] border-white/5">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-full text-amber-500">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                <h2 className="text-2xl font-black">{pendingUsers.length}</h2>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.02] border-white/5">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-full text-emerald-500">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Admins</p>
                <h2 className="text-2xl font-black">{adminUsers.length}</h2>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/[0.02] border-white/5">
            <CardContent className="p-4 md:p-6 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 bg-blue-500/20 rounded-full text-blue-500">
                <Briefcase className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground leading-tight">Tournament Managers</p>
                <h2 className="text-2xl font-black">{tournamentManagers.length}</h2>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full text-primary">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Super Admins</p>
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
            <Users className="w-4 h-4" /> Users
          </button>
        )}
        <button 
          onClick={() => setActiveTab("tournaments")} 
          className={`px-4 py-3 font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'tournaments' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}
        >
          <Trophy className="w-4 h-4" /> Tournaments
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
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Approve, decline, or upgrade user accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map(user => (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 gap-4">
                  <div>
                    <p className="font-bold text-white">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">ID: {user.id.substring(0, 8)}</span>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm ${
                        user.role === 'super_admin' ? 'bg-primary/20 text-primary' :
                        user.role === 'admin' ? 'bg-emerald-500/20 text-emerald-400' :
                        user.role === 'tournament_manager' ? 'bg-blue-500/20 text-blue-400' :
                        user.role === 'declined' ? 'bg-red-500/20 text-red-400' :
                        'bg-amber-500/20 text-amber-500'
                      }`}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                  
                  {user.role === 'pending' && (
                    <div className="flex gap-2">
                      <Button onClick={() => updateUserRole(user.id, 'admin')} className="bg-emerald-500 hover:bg-emerald-600 text-white">Approve as Admin</Button>
                      <Button onClick={() => updateUserRole(user.id, 'tournament_manager')} className="bg-blue-500 hover:bg-blue-600 text-white">Approve as Manager</Button>
                      <Button onClick={() => updateUserRole(user.id, 'declined')} variant="destructive">Decline</Button>
                    </div>
                  )}
                  {user.role === 'admin' && (
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={() => updateUserRole(user.id, 'pending')} className="opacity-50 hover:opacity-100">Revoke Access</Button>
                      <Button variant="outline" onClick={() => { if(confirm("Make Super Admin?")) updateUserRole(user.id, 'super_admin'); }} className="border-primary/50 text-primary hover:bg-primary/10">Make Super Admin</Button>
                    </div>
                  )}
                  {user.role === 'declined' && (
                    <Button variant="outline" onClick={() => updateUserRole(user.id, 'pending')} className="border-amber-500/50 text-amber-500">Restore to Pending</Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TOURNAMENTS TAB */}
      {activeTab === "tournaments" && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Tournaments</CardTitle>
            <CardDescription>View all tournaments and assign admins to manage them.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(isSuperAdmin ? tournaments : tournaments.filter(t => t.user_id === currentUserId)).map(t => {
                const creator = getUserEmail(t.user_id);
                const assigned = tournamentAdmins.filter(ta => ta.tournament_id === t.id);

                return (
                  <div key={t.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-white">{t.name}</h3>
                        <p className="text-xs text-muted-foreground">Created by: <span className="text-white">{creator}</span></p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/dashboard/${t.id}`)}>
                        Manage Tournament
                      </Button>
                    </div>

                    <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Assigned Admins</h4>
                      {assigned.length === 0 ? (
                        <p className="text-xs text-slate-500 italic mb-3">No additional admins assigned.</p>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {assigned.map(a => (
                            <div key={a.id} className="flex items-center justify-between bg-white/5 px-3 py-1.5 rounded">
                              <span className="text-sm font-medium">{getUserEmail(a.admin_id)}</span>
                              <button onClick={() => handleRemoveAssignment(a.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <select id={`assign-${t.id}`} className="bg-[#0f1423] border border-white/10 rounded-md text-sm px-3 py-1 flex-1 text-white">
                          <option value="">Select an Admin or Manager...</option>
                          {users.filter(u => (u.role === 'admin' || u.role === 'tournament_manager') && u.id !== t.user_id).map(u => (
                            <option key={u.id} value={u.id}>{u.email} ({u.role === 'tournament_manager' ? 'Manager' : 'Admin'})</option>
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
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === "audit" && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Logs</CardTitle>
            <CardDescription>Automatically recorded database changes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditLogs.length === 0 || (!isSuperAdmin && auditLogs.filter(log => log.user_id === currentUserId).length === 0) ? (
                <p className="text-muted-foreground text-center py-4">No audit logs found.</p>
              ) : (
                (isSuperAdmin ? auditLogs : auditLogs.filter(log => log.user_id === currentUserId)).map(log => (
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
                          <span className="text-slate-500 text-xs truncate max-w-[100px]">{log.entity_id}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Actor: <span className="text-white">{getUserEmail(log.user_id)}</span></p>
                      </div>
                      <div className="text-xs text-slate-500 text-right shrink-0">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                    {renderDiff(log)}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
