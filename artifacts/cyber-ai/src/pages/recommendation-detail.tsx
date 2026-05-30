import { useRoute } from "wouter";
import { useGetRecommendation, getGetRecommendationQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, ExternalLink, ShieldCheck, Monitor, Server, Smartphone, Check, X, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import NotFound from "./not-found";

export function RecommendationDetail() {
  const [, params] = useRoute("/recommendations/:id");
  const id = params?.id ? parseInt(params.id) : undefined;

  const { data: rec, isLoading, error } = useGetRecommendation(id!, {
    query: { 
      enabled: !!id,
      queryKey: getGetRecommendationQueryKey(id!)
    }
  });

  if (error) {
    return <NotFound />;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <Skeleton className="h-8 w-32" />
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!rec) return null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
      <Link href="/recommendations" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        BACK TO SOLUTIONS
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono px-3 py-1 text-sm bg-primary/10 text-primary border-primary/20 capitalize">
                {rec.category.replace("-", " ")}
              </Badge>
              {rec.isFeatured && (
                <Badge variant="secondary" className="font-mono px-3 py-1 text-sm bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                  <Star className="w-3 h-3 mr-1 fill-current" /> FEATURED
                </Badge>
              )}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
              {rec.name}
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              {rec.description}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-lg font-mono flex items-center gap-2 text-primary">
                  <Check className="w-5 h-5" /> Pros
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-3">
                  {rec.pros?.map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {pro}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-lg font-mono flex items-center gap-2 text-destructive">
                  <X className="w-5 h-5" /> Cons
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-3">
                  {rec.cons?.map((con, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                      {con}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="bg-card/50 backdrop-blur border-primary/20 shadow-lg shadow-primary/5">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-mono">Overview</CardTitle>
                <div className="w-12 h-12 rounded-full bg-background border-2 border-primary flex items-center justify-center font-bold text-lg text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                  {rec.rating.toFixed(1)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div>
                <span className="block text-muted-foreground font-mono text-xs mb-1">PRICING</span>
                <span className="text-2xl font-bold font-mono text-foreground">
                  {rec.isFree ? "Free" : rec.price}
                </span>
              </div>
              
              <Separator className="bg-border/50" />
              
              <div>
                <span className="block text-muted-foreground font-mono text-xs mb-2">PLATFORMS</span>
                <div className="flex flex-wrap gap-2">
                  {rec.platforms.map(platform => {
                    let Icon = Monitor;
                    if (platform === "Linux") Icon = Server;
                    if (platform === "iOS" || platform === "Android") Icon = Smartphone;
                    
                    return (
                      <Badge key={platform} variant="outline" className="font-mono text-xs bg-background">
                        <Icon className="w-3 h-3 mr-1 opacity-70" /> {platform}
                      </Badge>
                    )
                  })}
                </div>
              </div>

              {rec.bestFor && (
                <>
                  <Separator className="bg-border/50" />
                  <div>
                    <span className="block text-muted-foreground font-mono text-xs mb-1">BEST FOR</span>
                    <span className="text-sm font-medium">{rec.bestFor}</span>
                  </div>
                </>
              )}

              {rec.websiteUrl && (
                <a 
                  href={rec.websiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="mt-6 flex items-center justify-center w-full rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2 font-mono"
                >
                  Visit Official Website <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
