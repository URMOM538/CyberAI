import { useGetThreatsSummary, getGetThreatsSummaryQueryKey, useGetFeaturedRecommendations, getGetFeaturedRecommendationsQueryKey } from "@workspace/api-client-react";
import { ShieldAlert, ShieldCheck, Activity, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export function Home() {
  const { data: summary, isLoading: isLoadingSummary } = useGetThreatsSummary({
    query: { queryKey: getGetThreatsSummaryQueryKey() }
  });

  const { data: featured, isLoading: isLoadingFeatured } = useGetFeaturedRecommendations({
    query: { queryKey: getGetFeaturedRecommendationsQueryKey() }
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-card border border-border p-8 md:p-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-6">
          <Badge variant="outline" className="border-primary/50 text-primary uppercase font-mono tracking-widest bg-primary/5">
            System Online
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Navigate the <span className="text-primary">Threat Landscape.</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl">
            Real-time cybersecurity intelligence, zero-day tracking, and authoritative recommendations for your digital perimeter.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <Link href="/threats" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 py-2">
              View Active Threats
            </Link>
            <Link href="/recommendations" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-8 py-2">
              Explore Solutions
            </Link>
          </div>
        </div>
      </section>

      {/* Global Threat Status */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-semibold font-mono">Global Threat Status</h2>
        </div>
        
        {isLoadingSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground font-mono">Total Tracked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{summary.total}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground font-mono">Recent Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{summary.recentCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground font-mono">Critical Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{summary.bySeverity?.critical || 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground font-mono">High Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">{summary.bySeverity?.high || 0}</div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      {/* Recommended Solutions */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-semibold font-mono">Featured Defenses</h2>
          </div>
          <Link href="/recommendations" className="text-sm text-primary hover:underline font-mono">
            View All →
          </Link>
        </div>

        {isLoadingFeatured ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : featured ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featured.map((rec) => (
              <Link key={rec.id} href={`/recommendations/${rec.id}`}>
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group bg-card/50 backdrop-blur">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {rec.category}
                      </Badge>
                      <div className="flex items-center gap-1 text-primary">
                        <Terminal className="w-4 h-4" />
                        <span className="font-mono font-bold">{rec.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <CardTitle className="group-hover:text-primary transition-colors">{rec.name}</CardTitle>
                    <CardDescription className="line-clamp-2">{rec.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {rec.platforms.slice(0, 3).map(p => (
                        <Badge key={p} variant="outline" className="text-xs opacity-70">
                          {p}
                        </Badge>
                      ))}
                      {rec.platforms.length > 3 && (
                        <Badge variant="outline" className="text-xs opacity-70">+{rec.platforms.length - 3}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
