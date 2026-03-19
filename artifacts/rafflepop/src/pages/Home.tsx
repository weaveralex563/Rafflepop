import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Clock, Flame, Ticket, Loader2, Trophy } from "lucide-react";
import { useGetMe, useGetRaffleStats, useWatchAd, useClaimStreak } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCountdown } from "@/hooks/use-countdown";
import LoadingScreen from "@/components/LoadingScreen";
import WinPopup from "@/components/WinPopup";

export default function Home() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: stats, isLoading: isStatsLoading } = useGetRaffleStats();
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [showWinPopup, setShowWinPopup] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const countdown = useCountdown();

  const watchAdMutation = useWatchAd({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Ticket Earned! 🎉", description: data.message });
        queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/raffle/stats"] });
      },
      onError: () => {
        toast({ title: "Oops!", description: "Failed to load ad. Try again.", variant: "destructive" });
      }
    }
  });

  const claimStreakMutation = useClaimStreak({
    mutation: {
      onSuccess: (data) => {
        if (data.alreadyClaimed) {
          toast({ title: "Already Claimed", description: "Come back tomorrow to keep your streak alive!" });
        } else {
          toast({ title: "Streak Claimed! 🔥", description: `+10 tickets added. You are on a ${data.streakDays} day streak!` });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/raffle/stats"] });
      }
    }
  });

  const handleWatchAd = () => {
    if (isWatchingAd) return;
    setIsWatchingAd(true);
    // Simulate a 3-second ad experience
    setTimeout(() => {
      watchAdMutation.mutate({});
      setIsWatchingAd(false);
    }, 3000);
  };

  const handleClaimStreak = () => {
    claimStreakMutation.mutate({});
  };

  if (isUserLoading || isStatsLoading) return <LoadingScreen />;
  if (!user || !stats) return <div className="p-6 text-center">Failed to load data.</div>;

  const streakProgress = Math.min((user.streakDays % 7) / 7 * 100, 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 pt-6 pb-8 flex flex-col gap-5"
    >
      <WinPopup 
        isOpen={showWinPopup} 
        onClose={() => setShowWinPopup(false)} 
        prizeAmount={stats.jackpot * 0.5} 
      />

      {/* Header */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-900 flex items-center justify-center text-xl shadow-[0_4px_16px_rgba(138,51,224,0.4)]">
            🎱
          </div>
          <div>
            <h1 className="font-display font-extrabold text-lg leading-none">RafflePop</h1>
            <p className="text-[11px] text-muted-foreground">Watch to Play</p>
          </div>
        </div>
        <div 
          className="bg-card border border-white/5 rounded-full px-3 py-1.5 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => setShowWinPopup(true)} // Hidden trigger for demo
        >
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {user.username}
          </span>
        </div>
      </header>

      {/* Jackpot Area */}
      <div className="text-center py-2 relative z-10">
        <div className="inline-flex items-center gap-2 mb-3 bg-secondary/10 border border-secondary/20 text-secondary px-3 py-1 rounded-full text-xs font-bold">
          <Trophy className="w-3.5 h-3.5" />
          Today's Jackpot
        </div>
        <div className="relative inline-block">
          <div className="font-display text-5xl sm:text-6xl font-extrabold tracking-tighter text-gradient-gold">
            ₦{stats.jackpot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[80px] bg-secondary/20 blur-[40px] rounded-full -z-10" />
        </div>
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground mt-3 text-sm">
          <Ticket className="w-4 h-4" />
          <span className="text-white font-medium">{stats.totalTickets.toLocaleString()}</span> tickets in play
        </div>
      </div>

      {/* Ticket Card */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 to-transparent p-6 text-center z-10 shadow-2xl shadow-primary/10">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/30 blur-[50px] pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-full bg-primary/20">
            <Ticket className="w-4 h-4 text-primary" />
          </div>
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Your Tickets
          </span>
        </div>
        
        <div className="font-display text-6xl font-extrabold text-white mb-6">
          {user.tickets}
        </div>
        
        <button
          onClick={handleWatchAd}
          disabled={isWatchingAd || watchAdMutation.isPending}
          className="relative w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-purple-600 hover:from-purple-500 hover:to-primary shadow-[0_4px_24px_rgba(138,51,224,0.4)] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none overflow-hidden group"
        >
          {isWatchingAd ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Watching Ad...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2 text-lg">
              📺 Watch to Play <span className="text-white/70 text-sm font-normal ml-1">(+1 Ticket)</span>
            </span>
          )}
          {/* Shine effect */}
          <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-[shine_1.5s] hidden group-hover:block" />
        </button>
        <p className="mt-3 text-[11px] text-white/40">Watch a short ad to earn a free ticket for today's draw.</p>
      </div>

      {/* Countdown Card */}
      <div className="bg-card border border-white/5 rounded-2xl p-5 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <div className="font-bold text-sm">Next Draw</div>
              <div className="text-[10px] text-muted-foreground">Daily at midnight (WAT)</div>
            </div>
          </div>
          {countdown.isSoon && (
            <span className="bg-secondary/20 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
              Soon!
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-center gap-2">
          <div className="text-center">
            <div className="font-display text-3xl font-extrabold bg-[#1a1330] rounded-lg min-w-[56px] py-2 px-1">
              {countdown.hours}
            </div>
            <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">hrs</div>
          </div>
          <div className="font-display text-2xl text-primary/50 mb-4">:</div>
          <div className="text-center">
            <div className="font-display text-3xl font-extrabold bg-[#1a1330] rounded-lg min-w-[56px] py-2 px-1">
              {countdown.minutes}
            </div>
            <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">min</div>
          </div>
          <div className="font-display text-2xl text-primary/50 mb-4">:</div>
          <div className="text-center">
            <div className="font-display text-3xl font-extrabold bg-[#1a1330] rounded-lg min-w-[56px] py-2 px-1">
              {countdown.seconds}
            </div>
            <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">sec</div>
          </div>
        </div>
      </div>

      {/* Streak Tracker */}
      <div className="bg-card border border-white/5 rounded-2xl p-5 z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <div className="font-bold text-sm">Daily Streak</div>
              <div className="text-[10px] text-muted-foreground">Best: {user.bestStreak} days</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-extrabold text-orange-500 leading-none">
              {user.streakDays}
            </div>
            <div className="text-[10px] text-muted-foreground">days</div>
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-between gap-1 mb-4">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const isFilled = day <= (user.streakDays % 7 || (user.streakDays > 0 ? 7 : 0));
            return (
              <div key={day} className="flex flex-col items-center gap-1.5 flex-1">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300",
                  isFilled 
                    ? "bg-gradient-to-br from-orange-500 to-orange-600 border-orange-400 text-black shadow-[0_0_10px_rgba(249,115,22,0.4)]" 
                    : "bg-background border-white/10 text-muted-foreground"
                )}>
                  {day}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between text-[11px] mb-2">
          <span className="text-muted-foreground">Next milestone: <span className="text-white">7 days</span></span>
          <span className="text-orange-500 font-semibold">+70 tickets</span>
        </div>
        
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${streakProgress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-orange-600 to-yellow-400 rounded-full" 
          />
        </div>

        <button
          onClick={handleClaimStreak}
          disabled={claimStreakMutation.isPending}
          className="w-full py-3 rounded-xl font-bold text-black bg-gradient-to-r from-orange-500 to-yellow-500 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
        >
          <Flame className="w-4 h-4" fill="currentColor" />
          Claim Daily Streak (+10)
        </button>
      </div>

    </motion.div>
  );
}
