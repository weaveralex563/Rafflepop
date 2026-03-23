import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, BarChart2, Trophy, Flame, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/stats", icon: BarChart2, label: "Stats" },
  { href: "/winners", icon: Trophy, label: "Winners" },
  { href: "/streak", icon: Flame, label: "Streak" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="relative mx-auto min-h-[100dvh] w-full max-w-[430px] bg-background shadow-2xl sm:border-x border-white/5 overflow-x-hidden flex flex-col">
      {/* Texture overlay for premium feel */}
      <div 
        className="texture-overlay" 
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/noise-texture.png)` }}
      />
      
      <main className="flex-1 pb-24 relative z-10 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 flex flex-col h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-[430px]">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-white/10" />
        <div className="relative flex justify-between items-center px-6 py-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} className="relative flex flex-col items-center gap-1">
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}>
                  <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
