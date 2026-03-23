import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useEffect } from "react";

// Pages
import Login from "@/pages/login";
import Home from "@/pages/home";
import Stats from "@/pages/stats";
import Winners from "@/pages/winners";
import Streak from "@/pages/streak";
import Profile from "@/pages/profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <LoadingScreen />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <RequireAuth><Home /></RequireAuth>
      </Route>
      <Route path="/stats">
        <RequireAuth><Stats /></RequireAuth>
      </Route>
      <Route path="/winners">
        <RequireAuth><Winners /></RequireAuth>
      </Route>
      <Route path="/streak">
        <RequireAuth><Streak /></RequireAuth>
      </Route>
      <Route path="/profile">
        <RequireAuth><Profile /></RequireAuth>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
