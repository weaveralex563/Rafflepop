import { motion } from "framer-motion";
import { User, Gift, ChevronRight, HelpCircle, MessageSquare, LogOut, Copy } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import LoadingScreen from "@/components/LoadingScreen";

export default function Profile() {
  const { data: user, isLoading } = useGetMe();
  const { toast } = useToast();

  if (isLoading) return <LoadingScreen />;
  if (!user) return null;

  const handleCopyRef = () => {
    navigator.clipboard.writeText(`https://rafflepop.app/join/${user.username}`);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
  };

  const menuItems = [
    { icon: HelpCircle, label: "How it Works / FAQ", action: () => toast({ title: "Coming soon" }) },
    { icon: MessageSquare, label: "Contact Support", action: () => toast({ title: "Coming soon" }) },
    { icon: LogOut, label: "Log Out", action: () => toast({ title: "Logged out" }), color: "text-destructive" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 pt-8 pb-8"
    >
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-800 flex items-center justify-center text-3xl mb-3 shadow-[0_0_30px_rgba(138,51,224,0.3)] border-2 border-white/10">
          👾
        </div>
        <h1 className="font-display text-2xl font-bold text-white">{user.username}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Joined {format(new Date(user.createdAt), "MMMM yyyy")}
        </p>
      </div>

      {/* Winnings Card */}
      <div className="bg-gradient-to-r from-secondary/20 to-orange-500/10 border border-secondary/30 rounded-2xl p-5 flex items-center justify-between mb-6 shadow-lg shadow-secondary/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
            <Gift className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">Total Winnings</div>
            <div className="font-display text-2xl font-bold text-white">
              ₦{user.totalWinnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Referral Section */}
      <div className="bg-card border border-white/5 rounded-2xl p-5 mb-6">
        <h3 className="font-bold mb-1 text-white">Refer a Friend</h3>
        <p className="text-xs text-muted-foreground mb-4">Get +50 tickets for every friend that joins and plays.</p>
        
        <div className="flex items-center gap-2 bg-background border border-white/10 rounded-xl p-2">
          <div className="flex-1 truncate text-xs text-muted-foreground font-mono px-2">
            rafflepop.app/join/{user.username}
          </div>
          <button 
            onClick={handleCopyRef}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Menu */}
      <div className="bg-card border border-white/5 rounded-2xl overflow-hidden">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
          >
            <div className="flex items-center gap-3">
              <item.icon className={`w-5 h-5 ${item.color || "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${item.color || "text-white"}`}>
                {item.label}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          </button>
        ))}
      </div>

    </motion.div>
  );
}
