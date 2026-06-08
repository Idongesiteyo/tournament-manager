import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Button } from "./button";
import { useNavigate } from "react-router-dom";

export default function UnauthorizedAccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#0f1423] border-red-500/20 shadow-2xl animate-in zoom-in-95">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-black text-white">Unauthorized Access</CardTitle>
          <CardDescription className="text-slate-400 text-base mt-2">
            You do not have permission to manage this tournament.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center mt-4">
          <p className="text-sm text-slate-500 mb-6">
            If you believe this is an error, please contact the tournament creator or a platform Super Admin to request assignment access.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="w-full" variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
