import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Shield, ShieldAlert, CheckCircle2, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function SuperAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if current user is a super admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!profile || profile.role !== "super_admin") {
        navigate("/dashboard");
        return;
      }

      setIsSuperAdmin(true);
      fetchUsers();
    };

    checkAuthAndLoad();
  }, [navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const updateUserRole = async (userId, newRole) => {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      toast.error("Failed to update user role");
    } else {
      toast.success(`User upgraded to ${newRole}`);
      fetchUsers();
    }
  };

  if (!isSuperAdmin && !loading) return null;
  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading Super Admin Panel...</div>;

  const pendingUsers = users.filter(u => u.role === "pending");
  const adminUsers = users.filter(u => u.role === "admin");
  const superAdmins = users.filter(u => u.role === "super_admin");

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-primary flex items-center gap-3">
          <ShieldAlert className="w-8 h-8" /> Super Admin Panel
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> User Management
          </CardTitle>
          <CardDescription>Approve new signups to allow them to create and manage tournaments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No users found.</p>
            ) : (
              users.map(user => (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 gap-4">
                  <div>
                    <p className="font-bold">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">ID: {user.id.substring(0, 8)}...</span>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm ${
                        user.role === 'super_admin' ? 'bg-primary/20 text-primary' :
                        user.role === 'admin' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-amber-500/20 text-amber-500'
                      }`}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                  
                  {user.role === 'pending' && (
                    <Button 
                      onClick={() => updateUserRole(user.id, 'admin')}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      Approve as Admin
                    </Button>
                  )}
                  {user.role === 'admin' && (
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive"
                        onClick={() => updateUserRole(user.id, 'pending')}
                        className="opacity-50 hover:opacity-100"
                      >
                        Revoke Access
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          if(confirm("Are you sure you want to make this user a Super Admin? They will have full access to manage all users.")) {
                            updateUserRole(user.id, 'super_admin');
                          }
                        }}
                        className="border-primary/50 text-primary hover:bg-primary/10"
                      >
                        Make Super Admin
                      </Button>
                    </div>
                  )}
                  {user.role === 'super_admin' && (
                    <span className="text-sm text-muted-foreground italic px-4">Full Access</span>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
