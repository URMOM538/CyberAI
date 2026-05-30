import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Navbar } from "@/components/layout/Navbar";
import { Home } from "@/pages/home";
import { Threats } from "@/pages/threats";
import { ThreatDetail } from "@/pages/threat-detail";
import { Recommendations } from "@/pages/recommendations";
import { RecommendationDetail } from "@/pages/recommendation-detail";
import { Chat } from "@/pages/chat";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/threats" component={Threats} />
      <Route path="/threats/:id" component={ThreatDetail} />
      <Route path="/recommendations" component={Recommendations} />
      <Route path="/recommendations/:id" component={RecommendationDetail} />
      <Route path="/chat" component={Chat} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Router />
            </main>
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
