import { useState } from "react";
import { useGetDailyWinners, useGetSundayWinners } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Trophy } from "lucide-react";

export default function Winners() {
  const [tab, setTab] = useState<'daily' | 'sunday'>('daily');
  
  const { data: dailyData, isLoading: loadDaily } = useGetDailyWinners({ limit: 20 });
  const { data: sundayData, isLoading: loadSunday } = useGetSundayWinners({ limit: 20 });

  if (loadDaily || loadSunday) return <Layout><LoadingScreen /></Layout>;

  const winners = tab === 'daily' ? dailyData?.winners : sundayData?.winners;

  return (
    <Layout>
      <div className="p-4 pt-8 space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Hall of Fame</h1>
          <p className="text-muted-foreground">Recent lucky winners.</p>
        </div>

        {/* Custom Tabs */}
        <div className="flex bg-secondary p-1 rounded-2xl border border-white/5">
          <button
            onClick={() => setTab('daily')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tab === 'daily' ? 'bg-card shadow-lg text-foreground border border-white/5' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Daily Draws
          </button>
          <button
            onClick={() => setTab('sunday')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tab === 'sunday' ? 'bg-card shadow-lg text-primary border border-primary/20 glow-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Sunday Jackpots
          </button>
        </div>

        {/* Winners List */}
        <div className="space-y-4 pt-2 pb-10">
          {winners?.length === 0 ? (
             <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-3xl">
               <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
               <p>No winners yet.</p>
             </div>
          ) : (
            winners?.map((winner, idx) => (
              <motion.div
                key={`${winner.userId}-${winner.drawDate}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="relative bg-card border border-white/5 rounded-3xl p-4 flex items-center gap-4 overflow-hidden"
              >
                {idx === 0 && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -mr-10 -mt-10" />
                )}
                
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-secondary border-2 border-primary/30 flex items-center justify-center overflow-hidden">
                    {winner.profileImage ? (
                      <img src={winner.profileImage} alt={winner.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-lg text-primary">{winner.username.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {idx === 0 && (
                    <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-background">
                      1
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="font-bold text-lg">{winner.username}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(winner.wonAt), "MMM do, yyyy")}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm uppercase tracking-wider text-primary font-bold text-[10px] mb-1">Won</div>
                  <div className="font-display font-black text-xl text-white">
                    {formatCurrency(winner.prizeAmount)}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
