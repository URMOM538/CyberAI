import { useState } from "react";
import { useListThreats, getListThreatsQueryKey } from "@workspace/api-client-react";
import { ShieldAlert, AlertTriangle, Filter, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function Threats() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const queryParams = {
    ...(severityFilter !== "all" && { severity: severityFilter }),
    ...(categoryFilter !== "all" && { category: categoryFilter }),
  };

  const { data: threats, isLoading } = useListThreats(queryParams, {
    query: { queryKey: getListThreatsQueryKey(queryParams) }
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-mono flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-primary" />
            Threat Intelligence
          </h1>
          <p className="text-muted-foreground mt-2">Active vulnerabilities, zero-days, and security advisories.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card/30 p-4 rounded-lg border border-border/50 backdrop-blur">
        <div className="flex items-center gap-2 flex-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filters</span>
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-background">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-background">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="vulnerability">Vulnerability</SelectItem>
            <SelectItem value="malware">Malware</SelectItem>
            <SelectItem value="phishing">Phishing</SelectItem>
            <SelectItem value="ransomware">Ransomware</SelectItem>
            <SelectItem value="zero-day">Zero-Day</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl bg-card/50" />
          ))
        ) : threats?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card/20 rounded-xl border border-border/30 border-dashed">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No threats match the current filters.</p>
          </div>
        ) : (
          threats?.map((threat) => (
            <Link key={threat.id} href={`/threats/${threat.id}`}>
              <Card className="h-full hover:border-primary/50 transition-all duration-200 cursor-pointer group bg-card/50 backdrop-blur hover:bg-card">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="outline" className="font-mono text-[10px] bg-background/50">
                      {threat.cveId || threat.category.toUpperCase()}
                    </Badge>
                    <Badge 
                      variant="secondary" 
                      className={`font-mono text-xs ${
                        threat.severity === 'critical' ? 'bg-destructive/20 text-destructive border-destructive/30' :
                        threat.severity === 'high' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' :
                        threat.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                        'bg-blue-500/20 text-blue-500 border-blue-500/30'
                      }`}
                    >
                      {threat.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors text-lg line-clamp-2 leading-tight">
                    {threat.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-3 text-sm mb-4">
                    {threat.description}
                  </CardDescription>
                  <div className="flex items-center text-xs text-muted-foreground font-mono">
                    <span className="opacity-70">PUBLISHED: </span>
                    <span className="ml-2 text-foreground/80">{new Date(threat.publishedAt).toLocaleDateString()}</span>
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
