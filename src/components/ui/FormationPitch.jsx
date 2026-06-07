import React from 'react';

const FormationPitch = ({ teamColor = '#eab308', formation = '3-3-1', starters = [] }) => {
  // Parse formation
  const lines = formation.split('-').map(Number);
  
  // Categorize starters by position
  const gks = starters.filter(p => p.position === 'Goalkeeper');
  const defs = starters.filter(p => p.position === 'Defender');
  const mids = starters.filter(p => p.position === 'Midfielder');
  const fwds = starters.filter(p => p.position === 'Forward');

  const getPlayerDisplay = (playersList, index) => {
    const player = playersList[index];
    if (player) {
      return { num: player.jersey_number, pos: player.position };
    }
    return { num: '?', pos: '' };
  };

  const PlayerIcon = ({ num, posLabel, top, left }) => (
    <div 
      className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2"
      style={{ top: `${top}%`, left: `${left}%` }}
    >
      <div 
        className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md border-2 border-white/80 z-10"
        style={{ backgroundColor: teamColor, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
      >
        {num}
      </div>
      <div className="bg-[#111827] text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 border border-white/10 z-10">
        {posLabel}
      </div>
    </div>
  );

  // Render a line of players
  const renderRow = (count, playersList, topPercent, posLabel) => {
    const icons = [];
    for (let i = 0; i < count; i++) {
      // distribute evenly
      const left = ((i + 1) / (count + 1)) * 100;
      const display = getPlayerDisplay(playersList, i);
      icons.push(
        <PlayerIcon key={`${topPercent}-${i}`} num={display.num} posLabel={posLabel} top={topPercent} left={left} />
      );
    }
    return icons;
  };

  return (
    <div className="w-full aspect-[2/3] bg-[#1a6642] relative rounded-xl overflow-hidden border-4 border-[#124a2e] shadow-inner">
      {/* Pitch Markings */}
      {/* Center Line */}
      <div className="absolute top-1/2 left-0 w-full border-t-2 border-white/30" />
      {/* Center Circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-white/30" />
      {/* Center Spot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/40" />
      
      {/* Top Penalty Area */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-b-2 border-x-2 border-white/30" />
      {/* Top 6-yard box */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-[6%] border-b-2 border-x-2 border-white/30" />
      
      {/* Bottom Penalty Area */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-t-2 border-x-2 border-white/30" />
      {/* Bottom 6-yard box */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/4 h-[6%] border-t-2 border-x-2 border-white/30" />

      {/* Players */}
      {/* FWD Row (Top) */}
      {lines[2] && renderRow(lines[2], fwds, 25, 'FWD')}
      
      {/* MID Row (Middle) */}
      {lines[1] && renderRow(lines[1], mids, 50, 'MID')}
      
      {/* DEF Row (Bottom) */}
      {lines[0] && renderRow(lines[0], defs, 75, 'DEF')}
      
      {/* Goalkeeper (Very Bottom) */}
      <PlayerIcon 
        num={getPlayerDisplay(gks, 0).num} 
        posLabel="GK" 
        top={90} 
        left={50} 
      />
    </div>
  );
};

export default FormationPitch;
