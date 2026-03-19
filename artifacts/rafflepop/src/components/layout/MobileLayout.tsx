import { ReactNode } from "react";
import BottomNav from "./BottomNav";

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#030108] sm:py-8 sm:px-4 flex items-center justify-center">
      {/* 
        This wrapper mimics a mobile phone screen on desktop, 
        and fills the screen on actual mobile devices.
      */}
      <div className="w-full h-[100dvh] sm:h-[850px] max-w-[420px] bg-background relative overflow-hidden sm:rounded-[2.5rem] sm:border-[6px] sm:border-white/10 sm:shadow-2xl shadow-black flex flex-col">
        
        {/* Abstract Background Glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[80px] pointer-events-none z-0" />
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto hide-scrollbar relative z-10 pb-24">
          {children}
        </main>

        {/* Fixed Navigation */}
        <BottomNav />
      </div>
    </div>
  );
}
