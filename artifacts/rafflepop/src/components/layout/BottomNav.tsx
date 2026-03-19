import { Link, useLocation } from "wouter";
import { Home, BarChart3, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/stats", label: "Stats", icon: BarChart3 },
    { path: "/winners", label: "Winners", icon: Trophy },
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-background via-background/90 to-transparent">
      <div className="glass-panel rounded-full px-2 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-full min-w-[64px] transition-all duration-300",
                isActive 
                  ? "text-white bg-primary/20 shadow-[0_0_15px_rgba(138,51,224,0.3)]" 
                  : "text-muted-foreground hover:text-white/80 hover:bg-white/5"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "fill-primary/20")} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn("text-[10px] font-bold tracking-wide", isActive && "text-primary-foreground")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
