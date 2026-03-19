import { motion } from "framer-motion";
import { BarChart3, Users, Ticket, Target, Info } from "lucide-react";
import { useGetRaffleStats } from "@workspace/api-client-react";
import LoadingScreen from "@/components/LoadingScreen";

export default function Stats() {
  const { data: stats, isLoading } = useGetRaffleStats();

  if (isLoading) return <LoadingScreen />;
  if (!stats) return <div className="p-6 text-center text-muted-foreground">No stats available right now.</div>;

  const statCards = [
    {
      title: "Total Pool",
      value: stats.totalTickets.toLocaleString(),
      icon: Ticket,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20"
    },
    {
      title: "Participants",
      value: stats.uniqueParticipants.toLocaleString(),
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      border: "border-blue-400/20"
    },
    {
      title: "My Tickets",
      value: stats.myTickets.toLocaleString(),
      icon: Target,
      color: "text-secondary",
      bg: "bg-secondary/10",
      border: "border-secondary/20"
    },
    {
      title: "My Odds",
      value: `${stats.myOdds.toFixed(4)}%`,
      icon: BarChart3,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20"
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 pt-8 pb-8"
    >
      <header className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Statistics</h1>
          <p className="text-xs text-muted-foreground">Today's draw insights</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {statCards.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border ${stat.border} bg-card p-4 flex flex-col justify-between aspect-square`}
          >
            <div className={`w-8 h-8 rounded-full ${stat.bg} flex items-center justify-center mb-2`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-white mb-0.5">
                {stat.value}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {stat.title}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-5">
        <h3 className="font-bold flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-primary" />
          How it works
        </h3>
        <ul className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <li className="flex gap-2">
            <span className="text-secondary">•</span>
            The jackpot grows by ₦5 for every ticket added to the pool.
          </li>
          <li className="flex gap-2">
            <span className="text-secondary">•</span>
            Draws happen daily at exactly Midnight West Africa Time (UTC+1).
          </li>
          <li className="flex gap-2">
            <span className="text-secondary">•</span>
            Winners are selected completely at random. More tickets = higher chance to win.
          </li>
        </ul>
      </div>

    </motion.div>
  );
}
