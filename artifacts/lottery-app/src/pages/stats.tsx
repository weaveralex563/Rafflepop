import { useGetUserStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { motion } from "framer-motion";
import { Ticket, Video, Users, Calendar, Flame, Trophy } from "lucide-react";

function StatCard({ title, value, icon: Icon, delay = 0, highlight = false }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`p-5 rounded-3xl border ${highlight ? 'bg-primary/10 border-primary/30 glow-primary' : 'bg-card border-white/5'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${highlight ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className={`text-sm font-medium ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>{title}</span>
      </div>
      <div className={`text-3xl font-display font-bold ${highlight ? 'text-white' : 'text-foreground'}`}>
        {value}
      </div>
    </motion.div>
  );
}

export default function Stats() {
  const { data: stats, isLoading } = useGetUserStats();

  if (isLoading) return <Layout><LoadingScreen /></Layout>;

  return (
    <Layout>
      <div className="p-4 pt-8 pb-10 space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Your Stats</h1>
          <p className="text-muted-foreground">Track your performance and earnings.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard 
            title="Today's Tickets" 
            value={stats?.todayTickets || 0} 
            icon={Ticket} 
            highlight 
            delay={0.1}
          />
          <StatCard 
            title="Current Streak" 
            value={`${stats?.currentStreak || 0} days`} 
            icon={Flame} 
            highlight 
            delay={0.2}
          />
          <StatCard 
            title="Ads Watched" 
            value={stats?.todayAdsWatched || 0} 
            icon={Video} 
            delay={0.3}
          />
          <StatCard 
            title="Week Tickets" 
            value={stats?.weekTickets || 0} 
            icon={Calendar} 
            delay={0.4}
          />
        </div>

        <div className="pt-4 border-t border-white/5">
          <h2 className="text-lg font-bold mb-4 px-1">All-Time Achievements</h2>
          <div className="space-y-4">
            <div className="bg-card border border-white/5 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold">Total Tickets</div>
                  <div className="text-sm text-muted-foreground">Across all draws</div>
                </div>
              </div>
              <div className="text-xl font-display font-bold">{stats?.totalTickets || 0}</div>
            </div>

            <div className="bg-card border border-white/5 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold">Total Referrals</div>
                  <div className="text-sm text-muted-foreground">Friends invited</div>
                </div>
              </div>
              <div className="text-xl font-display font-bold">{stats?.totalReferrals || 0}</div>
            </div>

            <div className="bg-card border border-white/5 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold">Longest Streak</div>
                  <div className="text-sm text-muted-foreground">Best consecutive days</div>
                </div>
              </div>
              <div className="text-xl font-display font-bold">{stats?.longestStreak || 0}</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
