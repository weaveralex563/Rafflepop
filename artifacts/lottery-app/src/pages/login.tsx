import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Login() {
  const { login, isLoading } = useAuth();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-background">
      <div 
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/noise-texture.png)` }}
      />
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="w-24 h-24 mb-8 relative">
          <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse" />
          <img 
            src={`${import.meta.env.BASE_URL}images/gold-ticket.png`} 
            alt="AdJackpot Logo" 
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,180,0,0.5)]"
          />
        </div>

        <h1 className="text-4xl font-display font-bold text-foreground mb-3">
          Ad<span className="text-gradient-gold">Jackpot</span>
        </h1>
        
        <p className="text-muted-foreground mb-10 max-w-[260px] text-sm leading-relaxed">
          Watch daily ads, build your streak, and win real cash in our daily and Sunday draws.
        </p>

        <Button 
          onClick={login}
          disabled={isLoading}
          className="w-full max-w-[280px] h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-[0_0_20px_-5px_hsl(var(--primary))] hover:shadow-[0_0_30px_-5px_hsl(var(--primary))] transition-all duration-300"
        >
          {isLoading ? "Connecting..." : "Continue with Replit"}
        </Button>
      </motion.div>
    </div>
  );
}
