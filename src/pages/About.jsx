import { Code2, ExternalLink, Mail } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">About the Developer</h1>
        <p className="text-lg text-slate-400 font-medium max-w-2xl mx-auto">
          Building tools to make tournament management easier, faster, and more exciting.
        </p>
      </div>

      {/* Main Content Card */}
      <Card className="border-white/10 bg-[#0f1423]/50 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[100px] rounded-full pointer-events-none -z-10" />
        <CardContent className="p-8 md:p-12 space-y-10">
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-20 h-20 shrink-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
              <Code2 className="w-10 h-10 text-primary" />
            </div>
            
            <div className="space-y-6 flex-1 text-slate-300 leading-relaxed text-[15px] md:text-base">
              <h2 className="text-2xl font-black text-white tracking-tight">Idongesit</h2>
              
              <p>
                I build software that solves real operational problems. With a background in software quality engineering, I focus on creating intuitive, reliable, and high-performance applications that people can trust.
              </p>
              <p>
                I believe technology should simplify processes, eliminate manual work, and provide a better user experience. That mindset led me to build the Football Tournament Manager, a platform designed to help local clubs and leagues organize competitions professionally, automate standings and fixtures, and move away from error-prone spreadsheets.
              </p>
              <p>
                My approach combines product thinking, software engineering, and quality assurance to deliver solutions that are both useful and dependable.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <a 
              href="https://idongesit-portfolio.netlify.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-primary/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-white group-hover:text-primary transition-colors">View My Portfolio</h3>
                <p className="text-xs text-slate-400 mt-1 truncate max-w-[200px] sm:max-w-[250px]">idongesit-portfolio.netlify.app</p>
              </div>
            </a>

            <a 
              href="https://idongesit-portfolio.netlify.app/#contact" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mail className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">Get in Touch</h3>
                <p className="text-xs text-slate-400 mt-1">Contact me via my portfolio</p>
              </div>
            </a>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
