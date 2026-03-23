import { useGetStreak, useHeatStreak, getGetStreakQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Flame, Snowflake, CheckCircle2, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Streak() {
  const { data: streak, isLoading } = useGetStreak();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: heat, isPending: heating } = useHeatStreak({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetStreakQueryKey() });
        toast({ title: "Streak Heated! 🔥", description: res.message });
      },
      onError: (err) => {
        toast({ title: "Failed", description: err.error, variant: "destructive" });
      }
    }
  });

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      <div className="p-4 pt-8 pb-10 flex flex-col items-center">
        
        {/* Status Header */}
        <div className="text-center mb-8 w-full">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-secondary/50 border-4 border-card relative mb-4 shadow-xl">
            {streak?.isFrozen ? (
              <Snowflake className="w-10 h-10 text-blue-400" />
            ) : (
              <Flame className="w-12 h-12 text-primary" />
            )}
            <div className="absolute -bottom-3 px-3 py-1 bg-background border border-white/10 rounded-full text-xs font-bold shadow-lg">
              {streak?.currentStreak} DAYS
            </div>
          </div>
          
          <h1 className="text-3xl font-display font-bold mb-2">
            {streak?.isFrozen ? "Streak Frozen!" : "You're on Fire!"}
          </h1>
          <p className="text-muted-foreground max-w-[280px] mx-auto text-sm">
            {streak?.isFrozen 
              ? "You missed a day. Use a heat to save your progress before it resets."
              : "Keep completing your daily ads to reach milestones and bank Sundays."}
          </p>
        </div>

        {/* Heat Action */}
        {streak?.isFrozen && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full bg-blue-500/10 border border-blue-500/20 rounded-3xl p-5 mb-8 flex flex-col items-center text-center"
          >
            <div className="text-blue-400 font-bold mb-1">Frozen for {streak.frozenSinceDays} days</div>
            <div className="text-sm text-muted-foreground mb-4">You have {streak.heatsAvailable} heats available</div>
            <Button 
              onClick={() => heat()}
              disabled={heating || streak.heatsAvailable <= 0}
              className="w-full rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 glow-primary border-none"
            >
              {heating ? "Heating..." : "Heat it Up!"}
            </Button>
          </motion.div>
        )}

        {/* Roadmap */}
        <div className="w-full bg-card border border-white/5 rounded-3xl p-6 relative">
          <h2 className="font-bold text-lg mb-6">Roadmap to Day 365</h2>
          
          <div className="relative border-l-2 border-white/10 ml-4 space-y-8 pb-4">
            {streak?.milestones.map((ms, i) => {
              const isCurrent = ms.isNext && !streak.isFrozen;
              
              return (
                <div key={ms.day} className="relative pl-8">
                  {/* Node */}
                  <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-card flex items-center justify-center
                    ${ms.isReached ? 'bg-primary' : isCurrent ? 'bg-background border-primary' : 'bg-secondary'}`}
                  >
                    {isCurrent && <div className="w-2 h-2 bg-primary rounded-full animate-ping" />}
                  </div>

                  {/* Content */}
                  <div className={`flex flex-col ${!ms.isReached && !isCurrent ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold ${isCurrent ? 'text-primary' : ''}`}>Day {ms.day}</span>
                      {ms.isReached && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      {!ms.isReached && !isCurrent && <Lock className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <div className="text-sm font-medium text-foreground">{ms.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{ms.reward}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Layout>
  );
}
