import { motion } from "framer-motion";
import { Trophy, Calendar } from "lucide-react";
import { useGetDraws } from "@workspace/api-client-react";
import { format } from "date-fns";
import LoadingScreen from "@/components/LoadingScreen";

export default function Winners() {
  const { data: draws, isLoading } = useGetDraws({ limit: 20 });

  if (isLoading) return <LoadingScreen />;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 pt-8 pb-8"
    >
      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Past Winners</h1>
          <p className="text-xs text-muted-foreground">Hall of fame</p>
        </div>
      </header>

      {!draws || draws.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-2xl">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No winners yet.</p>
          <p className="text-xs mt-1">Be the first!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {draws.map((draw, i) => (
            <motion.div 
              key={draw.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group flex items-center gap-4 bg-card border border-white/5 rounded-2xl p-4 hover:border-primary/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-2xl flex-shrink-0 border border-secondary/20">
                {draw.winnerEmoji || "😎"}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base truncate text-white group-hover:text-primary transition-colors">
                  {draw.winnerUsername}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(draw.date), "MMM d, yyyy")}
                </div>
              </div>
              
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-0.5">Won</div>
                <div className="font-display font-bold text-lg text-white">
                  ₦{draw.prize.toLocaleString()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
