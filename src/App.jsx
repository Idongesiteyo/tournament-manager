import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Home from "./pages/Home";
import Stats from "./pages/Stats";
import TeamDetail from "./pages/TeamDetail";
import Teams from "./pages/Teams";
import AdminTournament from "./pages/AdminTournament";
import AdminTeam from "./pages/AdminTeam";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import SuperAdmin from "./pages/SuperAdmin";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/auth" replace />} />
          <Route path="auth" element={<Auth />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="dashboard/:tournamentId" element={<AdminTournament />} />
          <Route path="dashboard/:tournamentId/team/:teamId" element={<AdminTeam />} />
          <Route path="super-admin" element={<SuperAdmin />} />
          
          <Route path="t/:tournamentId" element={<Home />} />
          <Route path="t/:tournamentId/stats" element={<Stats />} />
          <Route path="t/:tournamentId/teams" element={<Teams />} />
          <Route path="t/:tournamentId/team/:teamId" element={<TeamDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
