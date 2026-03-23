import { useGetUserProfile, useGetReferralCode } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Layout } from "@/components/layout";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { LogOut, Copy, Ticket, Flame, CalendarDays, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { data: profile, isLoading: loadProfile } = useGetUserProfile();
  const { data: ref, isLoading: loadRef } = useGetReferralCode();
  const { logout } = useAuth();
  const { toast } = useToast();

  if (loadProfile || loadRef) return <Layout><LoadingScreen /></Layout>;

  const copyRef = () => {
    if (ref?.code) {
      navigator.clipboard.writeText(ref.code);
      toast({ title: "Code Copied", description: "Share this code with friends!" });
    }
  };

  return (
    <Layout>
      <div className="p-4 pt-8 space-y-6 pb-12">
        
        {/* Header/Avatar */}
        <div className="flex flex-col items-center text-center mt-4 mb-8">
          <div className="w-24 h-24 rounded-full bg-secondary border-4 border-card shadow-xl overflow-hidden mb-4 relative">
            {profile?.profileImage ? (
              <img src={profile.profileImage} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-display font-bold text-muted-foreground">
                {profile?.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold">{(profile?.firstName && profile?.lastName) ? `${profile.firstName} ${profile.lastName}` : profile?.username}</h1>
          <p className="text-muted-foreground text-sm">@{profile?.username}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/50 text-xs font-medium text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" />
            Joined {profile?.memberSince ? format(new Date(profile.memberSince), "MMM yyyy") : 'Recently'}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center">
            <Ticket className="w-5 h-5 text-primary mb-2" />
            <div className="text-2xl font-bold">{profile?.totalTicketsEarned || 0}</div>
            <div className="text-xs text-muted-foreground">Total Tickets</div>
          </div>
          <div className="bg-card border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center">
            <Award className="w-5 h-5 text-accent mb-2" />
            <div className="text-2xl font-bold">{profile?.sundayQualifications || 0}</div>
            <div className="text-xs text-muted-foreground">Banked Sundays</div>
          </div>
        </div>

        {/* Referral Section */}
        <div className="bg-gradient-to-br from-secondary/50 to-card border border-white/5 rounded-3xl p-5">
          <h3 className="font-bold mb-1">Your Referral Code</h3>
          <p className="text-sm text-muted-foreground mb-4">Invite friends to get 25 bonus tickets today.</p>
          
          <div className="flex items-center gap-2 bg-background border border-white/10 rounded-xl p-2 pl-4">
            <code className="flex-1 font-mono text-primary font-bold tracking-widest">{ref?.code}</code>
            <Button onClick={copyRef} size="icon" variant="ghost" className="rounded-lg hover:bg-white/10">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Account Details */}
        <div className="bg-card border border-white/5 rounded-3xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Longest Streak</span>
            <div className="flex items-center gap-1 font-bold">
              {profile?.longestStreakDays || 0} <Flame className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Available Heats</span>
            <span className="font-bold text-blue-400">{profile?.heatsAvailable || 0}</span>
          </div>
          <div className="p-4 flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Total Ads Watched</span>
            <span className="font-bold">{profile?.totalAdsWatched || 0}</span>
          </div>
        </div>

        <Button 
          onClick={logout}
          variant="outline" 
          className="w-full h-14 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive border-white/5"
        >
          <LogOut className="w-5 h-5 mr-2" /> Sign Out
        </Button>

      </div>
    </Layout>
  );
}
