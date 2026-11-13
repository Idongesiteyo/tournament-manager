import React from "react";

export default function PageLoader({ label = "Loading", compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center w-full select-none animate-in fade-in duration-300 ${
        compact ? "py-10" : "min-h-[60vh] py-16"
      }`}
    >
      <div className="relative flex items-center justify-center w-20 h-20">
        {/* Ambient golden glow */}
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-xl animate-pulse" />

        {/* Outer rotating gold arc */}
        <div className="absolute inset-0 rounded-full border-2 border-white/5 border-t-primary border-r-primary/40 animate-spin" />

        {/* Inner counter-rotating ring */}
        <div
          className="absolute inset-2.5 rounded-full border border-white/5 border-b-emerald-400/70 animate-spin"
          style={{ animationDirection: "reverse", animationDuration: "1.6s" }}
        />

        {/* Center football SVG */}
        <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#0f1423] border border-white/10 shadow-inner">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-5 h-5 text-primary animate-pulse"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon
              points="12 7.5 15.8 10.2 14.3 14.6 9.7 14.6 8.2 10.2"
              fill="currentColor"
              fillOpacity="0.2"
            />
            <line x1="12" y1="7.5" x2="12" y2="2" />
            <line x1="15.8" y1="10.2" x2="21.3" y2="8.5" />
            <line x1="14.3" y1="14.6" x2="17.9" y2="19.9" />
            <line x1="9.7" y1="14.6" x2="6.1" y2="19.9" />
            <line x1="8.2" y1="10.2" x2="2.7" y2="8.5" />
          </svg>
        </div>
      </div>

      {label && (
        <div className="mt-4 flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
            {label}
          </span>
          <span className="flex items-center gap-1 ml-0.5">
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce" />
          </span>
        </div>
      )}
    </div>
  );
}
