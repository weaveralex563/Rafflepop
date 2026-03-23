import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import { 
  useGetDailyJackpot, 
  useGetAdProgress, 
  useGetSundayJackpot, 
  useGetReferralCode,
  useRecordAdWatch,
  getGetAdProgressQueryKey,
  getGetDailyJackpotQueryKey,
  getGetStreakQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { formatCurrency } from "@/lib/utils";
import { Ticket, Users, Clock, PlayCircle, Share2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { data: jackpot, isLoading: loadingJackpot } = useGetDailyJackpot();
  const { data: progress, isLoading: loadingProgress } = useGetAdProgress();
  const { data: sunday, isLoading: loadingSunday } = useGetSundayJackpot();
  const { data: referral, isLoading: loadingRef } = useGetReferralCode();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(0);

  const { mutate: recordAd } = useRecordAdWatch({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetAdProgressQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDailyJackpotQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStreakQueryKey() });
        
        if (res.dailyComplete) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#F59E0B', '#FCD34D', '#FFFFFF']
          });
          toast({
            title: "🎉 Daily Goal Complete!",
            description: res.message,
          });
        } else {
          toast({
            title: "Tickets Earned!",
            description: `You got ${res.ticketsEarned} tickets. ${res.adsWatchedToday}/7 completed.`,
          });
        }
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: err.error || "Failed to record ad watch",
          variant: "destructive"
        });
      }
    }
  });

  // Mock ad watching experience
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isWatchingAd && adCountdown > 0) {
      timer = setTimeout(() => setAdCountdown(prev => prev - 1), 1000);
    } else if (isWatchingAd && adCountdown === 0) {
      setIsWatchingAd(false);
      recordAd();
    }
    return () => clearTimeout(timer);
  }, [isWatchingAd, adCountdown, recordAd]);

  const handleWatchAd = () => {
    if (progress?.dailyComplete) return;
    setIsWatchingAd(true);
    setAdCountdown(4); // 4 seconds simulated ad
  };

  const copyReferral = () => {
    if (referral?.code) {
      navigator.clipboard.writeText(referral.code);
      toast({ title: "Copied!", description: "Referral code copied to clipboard" });
    }
  };

  if (loadingJackpot || loadingProgress || loadingSunday || loadingRef) {
    return <Layout><LoadingScreen /></Layout>;
  }

  const adsWatched = progress?.adsWatchedToday || 0;
  const totalAds = progress?.totalAdsRequired || 7;

  return (
    <Layout>
      <div className="p-4 space-y-6 pt-8">
        {/* Header */}
        <div className="flex justify-between items-center px-2">
          <div>
            <h1 className="text-2xl font-display font-bold">Today's Draw</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(jackpot?.drawTime || new Date()), "EEEE, MMM do")}
            </p>
          </div>
          <div className="bg-secondary/50 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
            <Ticket className="w-4 h-4 text-primary" />
            <span className="font-bold">{progress?.totalTicketsToday || 0}</span>
          </div>
        </div>

        {/* Daily Jackpot Card */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative glass-panel rounded-3xl p-6 overflow-hidden glow-primary"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <span className="text-sm uppercase tracking-wider text-primary font-bold mb-2">Current Prize Pool</span>
            <div className="text-5xl font-display font-black text-white drop-shadow-lg mb-6">
              {formatCurrency(jackpot?.prizeAmount || 0)}
            </div>
            
            <div className="flex w-full justify-between items-center border-t border-white/10 pt-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Users className="w-3 h-3" />
                  <span className="text-xs">Participants</span>
                </div>
                <span className="font-semibold text-sm">{jackpot?.totalParticipants || 0}</span>
              </div>
              
              <div className="h-8 w-px bg-white/10" />
              
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">Draws at</span>
                </div>
                <span className="font-semibold text-sm">
                  {jackpot?.drawTime ? format(new Date(jackpot.drawTime), "HH:mm") : "--:--"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Ad Progress Section */}
        <div className="bg-card rounded-3xl p-6 border border-white/5">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-lg font-bold">Daily Tasks</h2>
              <p className="text-sm text-muted-foreground">Watch ads to earn tickets</p>
            </div>
            <div className="text-primary font-bold">
              {adsWatched} <span className="text-muted-foreground text-sm font-normal">/ {totalAds}</span>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            {Array.from({ length: totalAds }).map((_, i) => (
              <div 
                key={i} 
                className="h-2 flex-1 rounded-full overflow-hidden bg-secondary relative"
              >
                {i < adsWatched && (
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    className="absolute inset-0 bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                  />
                )}
              </div>
            ))}
          </div>

          <Button 
            onClick={handleWatchAd}
            disabled={progress?.dailyComplete || isWatchingAd}
            className="w-full h-14 rounded-2xl text-lg font-bold relative overflow-hidden transition-all"
            variant={progress?.dailyComplete ? "secondary" : "default"}
          >
            <AnimatePresence mode="wait">
              {isWatchingAd ? (
                <motion.div
                  key="watching"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Playing Ad... {adCountdown}s
                </motion.div>
              ) : progress?.dailyComplete ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/50 flex items-center gap-2"
                >
                  Completed for Today
                </motion.div>
              ) : (
                <motion.div
                  key="watch"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <PlayCircle className="w-5 h-5" />
                  Watch Ad (+5 Tickets)
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </div>

        {/* Referrals */}
        <div className="flex gap-4">
          <div className="flex-1 bg-accent/10 border border-accent/20 rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-accent/5 pointer-events-none" />
            <h3 className="text-sm text-accent font-bold mb-1 uppercase tracking-wider">Refer Friends</h3>
            <p className="text-2xl font-bold mb-4">+25 <span className="text-base text-muted-foreground font-normal">Tix/ea</span></p>
            <Button onClick={copyReferral} variant="outline" className="w-full h-10 rounded-xl border-accent/30 hover:bg-accent/20 text-accent gap-2">
              <Share2 className="w-4 h-4" /> Share Code
            </Button>
          </div>

          {/* Sunday Teaser */}
          <div className="flex-1 bg-gradient-to-br from-card to-card border border-white/5 rounded-3xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-primary mb-1">
                <Flame className="w-4 h-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Sunday Draw</h3>
              </div>
              <div className="text-xl font-bold">{formatCurrency(sunday?.prizeAmount || 0)}</div>
            </div>
            
            <div className="mt-4">
              {sunday?.userIsQualified ? (
                <span className="inline-flex items-center rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500 ring-1 ring-inset ring-green-500/20">
                  Qualified
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-white/40 ring-1 ring-inset ring-white/10">
                  Not Qualified
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
