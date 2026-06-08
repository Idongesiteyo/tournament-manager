import React, { useState, useEffect } from 'react';

export function MatchTimer({ match }) {
  const [timeDisplay, setTimeDisplay] = useState('');
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    let intervalId;

    const updateTimer = () => {
      if (!match) return;

      const now = new Date().getTime();
      const halfDurationMs = (match.half_duration || 45) * 60 * 1000;

      if (match.status === 'first_half') {
        const start = match.first_half_start ? new Date(match.first_half_start).getTime() : now;
        const elapsed = Math.max(0, now - start);
        const totalSeconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        setTimeDisplay(`FH ${minutes}:${seconds.toString().padStart(2, '0')}`);
        setIsPulsing(true);
      } else if (match.status === 'halftime') {
        setTimeDisplay('HT');
        setIsPulsing(false);
      } else if (match.status === 'second_half') {
        const start = match.second_half_start ? new Date(match.second_half_start).getTime() : now;
        const elapsed = Math.max(0, now - start);
        const totalElapsed = halfDurationMs + elapsed;
        const totalSeconds = Math.floor(totalElapsed / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        setTimeDisplay(`SH ${minutes}:${seconds.toString().padStart(2, '0')}`);
        setIsPulsing(true);
      } else if (match.status === 'completed') {
        if (match.match_end && match.second_half_start) {
          const end = new Date(match.match_end).getTime();
          const start = new Date(match.second_half_start).getTime();
          const elapsed = Math.max(0, end - start);
          const totalElapsed = halfDurationMs + elapsed;
          const fullTimeMs = halfDurationMs * 2;
          
          if (totalElapsed > fullTimeMs + 60000) { // More than 1 min added time
            const addedMinutes = Math.floor((totalElapsed - fullTimeMs) / 60000);
            setTimeDisplay(`FT ${match.half_duration * 2} + ${addedMinutes}`);
          } else {
            setTimeDisplay('FT');
          }
        } else {
          setTimeDisplay('FT');
        }
        setIsPulsing(false);
      } else {
        setTimeDisplay('');
        setIsPulsing(false);
      }
    };

    updateTimer();
    
    if (match?.status === 'first_half' || match?.status === 'second_half') {
      intervalId = setInterval(updateTimer, 1000);
    }

    return () => clearInterval(intervalId);
  }, [match]);

  if (!timeDisplay) return null;

  return (
    <div className="absolute -top-3 flex items-center justify-center z-10 w-full">
      {isPulsing ? (
        <div className="flex items-center gap-1.5 bg-[#0f1423] px-2 py-0.5 rounded-full border border-red-500/30">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
          </span>
          <span className="text-[10px] font-black text-red-500 tracking-wider font-mono">{timeDisplay}</span>
        </div>
      ) : (
        <span className={`text-[10px] font-black uppercase bg-[#0f1423] px-2 py-0.5 rounded border ${match.status === 'completed' ? 'text-slate-400 border-white/5' : 'text-amber-500 border-amber-500/20'}`}>
          {timeDisplay}
        </span>
      )}
    </div>
  );
}
