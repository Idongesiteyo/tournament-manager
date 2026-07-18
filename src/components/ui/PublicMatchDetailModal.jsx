import React, { useState, useEffect } from "react";
import { X, Clock, Trophy } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { TeamColorBadge } from "../shared/TeamColorBadge";

export default function PublicMatchDetailModal({ isOpen, onClose, match, homeTeam, awayTeam }) {
  const [info, setInfo] = useState({
    goals: [],
    assists: [],
    yellow_cards: [],
    red_cards: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !match?.id) return;
    
    const fetchInfo = async () => {
      setLoading(true);
      const { data } = await supabase.from("match_info").select("*").eq("match_id", match.id).single();
      if (data) {
        // Sort events by minute (assuming null means unknown minute, so put at end)
        const sortByMin = (a, b) => {
          if (!a.minute && !b.minute) return 0;
          if (!a.minute) return 1;
          if (!b.minute) return -1;
          return a.minute - b.minute;
        };

        setInfo({
          goals: (data.goals || []).sort(sortByMin),
          assists: (data.assists || []).sort(sortByMin),
          yellow_cards: (data.yellow_cards || []).sort(sortByMin),
          red_cards: (data.red_cards || []).sort(sortByMin)
        });
      } else {
        setInfo({ goals: [], assists: [], yellow_cards: [], red_cards: [] });
      }
      setLoading(false);
    };
    
    fetchInfo();
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const hasAnyEvents = info.goals.length > 0 || info.assists.length > 0 || info.yellow_cards.length > 0 || info.red_cards.length > 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#090b14] border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        
        {/* Header - Scoreboard */}
        <div className="relative p-6 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center mb-6">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Match Details</h2>
            {match.match_date && (
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(match.match_date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between px-4">
            {/* Home */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <TeamColorBadge color={homeTeam?.color} size="lg" className="shadow-lg" />
              <span className="font-bold text-white text-center leading-tight">{homeTeam?.short_name}</span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center justify-center px-6">
              <div className="text-4xl font-black text-white tracking-tighter tabular-nums">
                {match.status === "completed" ? `${match.home_score} - ${match.away_score}` : "vs"}
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase mt-1 bg-white/5 px-2 py-0.5 rounded">
                {match.status === "completed" ? "FT" : match.status}
              </div>
            </div>

            {/* Away */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <TeamColorBadge color={awayTeam?.color} size="lg" className="shadow-lg" />
              <span className="font-bold text-white text-center leading-tight">{awayTeam?.short_name}</span>
            </div>
          </div>
        </div>

        {/* Content - Match Events */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="text-center text-slate-400 py-10">Loading match events...</div>
          ) : !hasAnyEvents ? (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <Trophy className="w-12 h-12 text-white/5 mb-3" />
              <p className="text-slate-500 font-medium">Match details not yet available.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* GOALS */}
              {info.goals.filter(g => !g.is_penalty_shootout).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-white/5 pb-1">⚽ Goals</h3>
                  <div className="space-y-2">
                    {info.goals.filter(g => !g.is_penalty_shootout).map(g => (
                      <div key={g.id} className="flex items-center gap-3 text-sm">
                        <span className="text-emerald-500/80 font-bold w-6 text-right">{g.minute ? `${g.minute}'` : ''}</span>
                        <span className="text-white font-medium">{g.player_name}</span>
                        <span className="text-slate-500 text-xs">({g.team_name})</span>
                        {g.is_penalty && <span className="text-[10px] text-emerald-400 font-bold ml-1">(Pen)</span>}
                        {g.is_own_goal && <span className="text-[10px] text-red-400 font-bold ml-1">(OG)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ASSISTS */}
              {info.assists.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 border-b border-white/5 pb-1">👟 Assists</h3>
                  <div className="space-y-2">
                    {info.assists.map(a => (
                      <div key={a.id} className="flex items-center gap-3 text-sm">
                        <span className="text-blue-500/80 font-bold w-6 text-right">{a.minute ? `${a.minute}'` : ''}</span>
                        <span className="text-white font-medium">{a.player_name}</span>
                        <span className="text-slate-500 text-xs">({a.team_name})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* YELLOW CARDS */}
              {info.yellow_cards.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-yellow-500 border-b border-white/5 pb-1">🟨 Yellow Cards</h3>
                  <div className="space-y-2">
                    {info.yellow_cards.map(c => (
                      <div key={c.id} className="flex items-center gap-3 text-sm">
                        <span className="text-yellow-500/80 font-bold w-6 text-right">{c.minute ? `${c.minute}'` : ''}</span>
                        <span className="text-white font-medium">{c.player_name}</span>
                        <span className="text-slate-500 text-xs">({c.team_name})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RED CARDS */}
              {info.red_cards.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 border-b border-white/5 pb-1">🟥 Red Cards</h3>
                  <div className="space-y-2">
                    {info.red_cards.map(c => (
                      <div key={c.id} className="flex items-center gap-3 text-sm">
                        <span className="text-red-500/80 font-bold w-6 text-right">{c.minute ? `${c.minute}'` : ''}</span>
                        <span className="text-white font-medium">{c.player_name}</span>
                        <span className="text-slate-500 text-xs">({c.team_name})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PENALTY SHOOTOUT */}
              {info.goals.filter(g => g.is_penalty_shootout).length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 border-b border-white/5 pb-1">🎯 Penalty Shootout</h3>
                  <div className="space-y-2">
                    {info.goals.filter(g => g.is_penalty_shootout).map(g => (
                      <div key={g.id} className={`flex items-center gap-3 text-sm ${g.shootout_result === 'missed' ? 'opacity-50' : ''}`}>
                        <span className="text-orange-500/80 font-bold w-6 text-right">{g.shootout_result === 'scored' ? '⚽' : '❌'}</span>
                        <span className={`font-medium ${g.shootout_result === 'missed' ? 'line-through text-slate-500' : 'text-white'}`}>{g.player_name}</span>
                        <span className="text-slate-500 text-xs">({g.team_name})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
