import { useState } from "react";
import { useListRecommendations, getListRecommendationsQueryKey } from "@workspace/api-client-react";
import { ShieldCheck, Filter, AlertTriangle, Monitor, Server, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Recommendations() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const queryParams = {
    ...(categoryFilter !== "all" && { category: categoryFilter }),
    ...(platformFilter !== "all" && { platform: platformFilter }),
  };

  const { data: recommendations, isLoading } = useListRecommendations(queryParams, {
    query: { queryKey: getListRecommendationsQueryKey(queryParams) }
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Security Solutions
          </h1>
          <p className="text-muted-foreground mt-2">Vetted defenses and tools to secure your perimeter.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card/30 p-4 rounded-lg border border-border/50 backdrop-blur">
        <div className="flex items-center gap-2 flex-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filters</span>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="antivirus">Antivirus</SelectItem>
            <SelectItem value="firewall">Firewall</SelectItem>
            <SelectItem value="vpn">VPN</SelectItem>
            <SelectItem value="password-manager">Password Manager</SelectItem>
            <SelectItem value="endpoint-protection">Endpoint Protection</SelectItem>
            <SelectItem value="threat-intelligence">Threat Intelligence</SelectItem>
            <SelectItem value="siem">SIEM</SelectItem>
            <SelectItem value="vulnerability-scanner">Vulnerability Scanner</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-background">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="Windows">Windows</SelectItem>
            <SelectItem value="macOS">macOS</SelectItem>
            <SelectItem value="Linux">Linux</SelectItem>
            <SelectItem value="iOS">iOS</SelectItem>
            <SelectItem value="Android">Android</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl bg-card/50" />
          ))
        ) : recommendations?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card/20 rounded-xl border border-border/30 border-dashed">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No solutions match the current filters.</p>
          </div>
        ) : (
          recommendations?.map((rec) => (
            <Link key={rec.id} href={`/recommendations/${rec.id}`}>
              <Card className="h-full hover:border-primary/50 transition-all duration-200 cursor-pointer group bg-card/50 backdrop-blur hover:bg-card flex flex-col">
                <CardHeader className="pb-3 flex-none">
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="outline" className="font-mono text-[10px] bg-background/50 capitalize border-primary/20 text-primary">
                      {rec.category.replace("-", " ")}
                    </Badge>
                    <div className="flex items-center gap-1.5 bg-background/50 px-2 py-0.5 rounded border border-border/50 text-sm">
                      <span className="text-primary font-bold">{rec.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground text-xs">/10</span>
                    </div>
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors text-xl">
                    {rec.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="line-clamp-3 text-sm mb-4 flex-1">
                    {rec.description}
                  </CardDescription>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {rec.isFree ? "Free" : rec.price}
                      </span>
                    </div>
                    <div className="flex gap-1.5 text-muted-foreground">
                      {rec.platforms.includes("Windows") && <Monitor className="w-4 h-4" />}
                      {rec.platforms.includes("macOS") && <Monitor className="w-4 h-4" />}
                      {rec.platforms.includes("Linux") && <Server className="w-4 h-4" />}
                      {(rec.platforms.includes("iOS") || rec.platforms.includes("Android")) && <Smartphone className="w-4 h-4" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
