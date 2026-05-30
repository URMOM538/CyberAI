import { useRoute } from "wouter";
import { useGetThreat, getGetThreatQueryKey } from "@workspace/api-client-react";
import { ShieldAlert, ArrowLeft, ExternalLink, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import NotFound from "./not-found";

export function ThreatDetail() {
  const [, params] = useRoute("/threats/:id");
  const id = params?.id ? parseInt(params.id) : undefined;

  const { data: threat, isLoading, error } = useGetThreat(id!, {
    query: { 
      enabled: !!id,
      queryKey: getGetThreatQueryKey(id!)
    }
  });

  if (error) {
    return <NotFound />;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
        <div className="grid md:grid-cols-3 gap-8">
          <Skeleton className="h-96 col-span-2" />
          <Skeleton className="h-96 col-span-1" />
        </div>
      </div>
    );
  }

  if (!threat) return null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">
      <Link href="/threats" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        BACK TO THREATS
      </Link>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge 
            variant="secondary" 
            className={`font-mono px-3 py-1 text-sm ${
              threat.severity === 'critical' ? 'bg-destructive/20 text-destructive border-destructive/30' :
              threat.severity === 'high' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' :
              threat.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
              'bg-blue-500/20 text-blue-500 border-blue-500/30'
            }`}
          >
            {threat.severity.toUpperCase()} SEVERITY
          </Badge>
          {threat.cveId && (
            <Badge variant="outline" className="font-mono px-3 py-1 text-sm bg-card">
              {threat.cveId}
            </Badge>
          )}
          <Badge variant="outline" className="font-mono px-3 py-1 text-sm bg-card capitalize">
            {threat.category}
          </Badge>
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
          {threat.title}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold font-mono flex items-center gap-2 border-b border-border/50 pb-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Description
            </h2>
            <div className="prose prose-invert max-w-none prose-p:text-muted-foreground prose-p:leading-relaxed">
              <p>{threat.description}</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold font-mono flex items-center gap-2 border-b border-border/50 pb-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Mitigations & Fixes
            </h2>
            {threat.mitigations && threat.mitigations.length > 0 ? (
              <ul className="space-y-3">
                {threat.mitigations.map((mitigation, idx) => (
                  <li key={idx} className="flex items-start gap-3 bg-card/30 p-4 rounded-lg border border-border/50">
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
                      <span className="text-xs font-mono text-primary">{idx + 1}</span>
                    </div>
                    <span className="text-muted-foreground">{mitigation}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground italic">No official mitigations available yet.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="block text-muted-foreground font-mono text-xs mb-1">PUBLISHED</span>
                <span className="font-medium">{new Date(threat.publishedAt).toLocaleString()}</span>
              </div>
              <Separator className="bg-border/50" />
              <div>
                <span className="block text-muted-foreground font-mono text-xs mb-1">SOURCE</span>
                <span className="font-medium">{threat.source}</span>
                {threat.sourceUrl && (
                  <a href={threat.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center text-primary hover:underline font-mono text-xs">
                    View Advisory <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4" /> Affected Systems
              </CardTitle>
            </CardHeader>
            <CardContent>
              {threat.affectedSystems && threat.affectedSystems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {threat.affectedSystems.map(system => (
                    <Badge key={system} variant="secondary" className="font-mono text-xs bg-secondary/50">
                      {system}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground text-sm italic">Unknown</span>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
