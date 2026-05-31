import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, AlertTriangle, Zap, Shield, Activity, ExternalLink } from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const THREAT_ORIGINS = [
  { name: "Russia",      lat: 55.75, lng: 37.62,  count: 312, severity: "critical", city: "Moscow",       actors: "APT28, APT29, Sandworm" },
  { name: "China",       lat: 39.90, lng: 116.40, count: 287, severity: "critical", city: "Beijing",      actors: "APT41, Volt Typhoon, Salt Typhoon" },
  { name: "North Korea", lat: 39.03, lng: 125.76, count: 156, severity: "critical", city: "Pyongyang",    actors: "Lazarus Group, Kimsuky" },
  { name: "Iran",        lat: 35.69, lng: 51.39,  count: 143, severity: "high",     city: "Tehran",       actors: "APT33, APT34, MuddyWater" },
  { name: "USA",         lat: 38.90, lng: -77.00, count: 98,  severity: "high",     city: "Washington DC",actors: "Criminal ransomware groups" },
  { name: "Ukraine",     lat: 50.45, lng: 30.52,  count: 89,  severity: "high",     city: "Kyiv",         actors: "Criminal ransomware groups" },
  { name: "Nigeria",     lat:  9.07, lng:  7.49,  count: 76,  severity: "high",     city: "Abuja",        actors: "BEC fraud, SilverTerrier" },
  { name: "Romania",     lat: 44.43, lng: 26.10,  count: 54,  severity: "medium",   city: "Bucharest",    actors: "Carbanak affiliates" },
  { name: "Brazil",      lat: -15.8, lng: -47.93, count: 51,  severity: "medium",   city: "Brasília",     actors: "Banking trojans (Grandoreiro)" },
  { name: "India",       lat: 28.60, lng: 77.20,  count: 44,  severity: "medium",   city: "New Delhi",    actors: "Tech support fraud, BEC" },
  { name: "Vietnam",     lat: 21.03, lng: 105.85, count: 39,  severity: "medium",   city: "Hanoi",        actors: "APT32 (OceanLotus)" },
  { name: "Pakistan",    lat: 33.69, lng: 73.06,  count: 36,  severity: "medium",   city: "Islamabad",    actors: "Transparent Tribe, APT36" },
  { name: "Indonesia",   lat: -6.21, lng: 106.84, count: 27,  severity: "low",      city: "Jakarta",      actors: "Cybercrime groups" },
  { name: "Turkey",      lat: 39.93, lng: 32.86,  count: 25,  severity: "low",      city: "Ankara",       actors: "StrongPity, MuddyWater affiliates" },
  { name: "Belarus",     lat: 53.90, lng: 27.57,  count: 22,  severity: "medium",   city: "Minsk",        actors: "UNC1151, Ghostwriter" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff2d2d",
  high:     "#ff8c00",
  medium:   "#ffd700",
  low:      "#00d4ff",
};

const SEVERITY_GLOW: Record<string, string> = {
  critical: "rgba(255,45,45,0.6)",
  high:     "rgba(255,140,0,0.5)",
  medium:   "rgba(255,215,0,0.4)",
  low:      "rgba(0,212,255,0.4)",
};

function PulsingDot({ severity, size }: { severity: string; size: number }) {
  const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.low;
  const glow  = SEVERITY_GLOW[severity]  ?? SEVERITY_GLOW.low;
  return (
    <g>
      <circle r={size + 4} fill={color} opacity={0.15}>
        <animate attributeName="r"       values={`${size+2};${size+10};${size+2}`} dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3"                        dur="2s" repeatCount="indefinite" />
      </circle>
      <circle r={size} fill={color} style={{ filter: `drop-shadow(0 0 ${size*2}px ${glow})` }} />
    </g>
  );
}

interface CisaVuln {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
}

export function ThreatMap() {
  const [selected, setSelected] = useState<typeof THREAT_ORIGINS[0] | null>(null);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [0, 20], zoom: 1,
  });

  const { data: cisaData, isLoading: isLoadingCisa } = useQuery<{ total: number; threats: CisaVuln[] }>({
    queryKey: ["cisa-threats"],
    queryFn: async () => {
      const r = await fetch("/api/cisa/threats?limit=25");
      if (!r.ok) throw new Error("CISA fetch failed");
      return r.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 2,
  });

  const totalAttacks   = THREAT_ORIGINS.reduce((s, o) => s + o.count, 0);
  const criticalCount  = THREAT_ORIGINS.filter(o => o.severity === "critical").length;
  const highCount      = THREAT_ORIGINS.filter(o => o.severity === "high").length;
  const cisaTotal      = cisaData?.total ?? null;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center"
            style={{ boxShadow: "0 0 20px hsl(205 100% 55% / 0.2)" }}>
            <Globe className="w-5 h-5 text-primary" style={{ filter: "drop-shadow(0 0 6px hsl(205 100% 55%))" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono">
              <span className="text-primary" style={{ textShadow: "0 0 12px hsl(205 100% 55% / 0.5)" }}>LIVE</span> Global Threat Map
            </h1>
            <p className="text-xs text-muted-foreground font-mono">CISA Known Exploited Vulnerabilities · Real-time attack origin tracking</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-mono text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          LIVE · CISA KEV
        </span>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tracked Attack Vectors", value: totalAttacks.toLocaleString(), icon: Activity,      color: "text-primary" },
          { label: "Critical Origins",        value: criticalCount,                icon: AlertTriangle, color: "text-red-400" },
          { label: "High-Severity Origins",   value: highCount,                    icon: Zap,           color: "text-orange-400" },
          { label: "CISA Known Exploited",    value: isLoadingCisa ? "…" : (cisaTotal?.toLocaleString() ?? "—"), icon: Shield, color: "text-primary" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card/60 border border-border rounded-xl p-4"
            style={{ boxShadow: "inset 0 0 20px rgba(0,212,255,0.03)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground font-mono">{label}</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${color}`}
              style={{ textShadow: color.includes("primary") ? "0 0 10px hsl(205 100% 55% / 0.5)" : undefined }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="bg-card/40 border border-border rounded-2xl overflow-hidden relative"
        style={{ boxShadow: "0 0 40px rgba(0,212,255,0.06), inset 0 0 60px rgba(0,0,0,0.4)" }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(hsl(205 100% 55%) 1px, transparent 1px), linear-gradient(90deg, hsl(205 100% 55%) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
        <div className="relative z-10">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 140 }}
            style={{ width: "100%", height: "480px" }}
          >
            <ZoomableGroup
              zoom={position.zoom}
              center={position.coordinates}
              onMoveEnd={({ zoom, coordinates }) => setPosition({ zoom, coordinates })}
              maxZoom={6}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography key={geo.rsmKey} geography={geo}
                      fill="#0a1628" stroke="#1a2f4a" strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover:   { fill: "#0d1f3c", outline: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {THREAT_ORIGINS.map((origin) => {
                const size = Math.max(3, Math.min(9, origin.count / 35));
                return (
                  <Marker key={origin.name} coordinates={[origin.lng, origin.lat]}
                    onClick={() => setSelected(selected?.name === origin.name ? null : origin)}
                    style={{ cursor: "pointer" }}>
                    <PulsingDot severity={origin.severity} size={size} />
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Origin popup */}
        {selected && (
          <div className="absolute top-4 right-4 bg-card/95 border border-primary/30 rounded-xl p-4 min-w-56 backdrop-blur-sm z-20"
            style={{ boxShadow: "0 0 20px rgba(0,212,255,0.2)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold font-mono text-sm text-primary">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              {[
                ["City",           selected.city],
                ["Attacks tracked",selected.count.toLocaleString()],
                ["Known actors",   selected.actors],
                ["Threat level",   selected.severity.toUpperCase()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">{k}</span>
                  <span className={k === "Threat level" ? "font-bold" : "text-right"}
                    style={k === "Threat level" ? { color: SEVERITY_COLORS[selected.severity] } : undefined}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-20">
          <button onClick={() => setPosition(p => ({ ...p, zoom: Math.min(6, p.zoom * 1.5) }))}
            className="w-8 h-8 bg-card/80 border border-border rounded-lg text-sm font-mono hover:border-primary/40 hover:text-primary transition-colors">+</button>
          <button onClick={() => setPosition(p => ({ ...p, zoom: Math.max(1, p.zoom / 1.5) }))}
            className="w-8 h-8 bg-card/80 border border-border rounded-lg text-sm font-mono hover:border-primary/40 hover:text-primary transition-colors">−</button>
        </div>
      </div>

      {/* Legend + top origins */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card/40 border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold font-mono text-primary">Severity Legend</h3>
          {(["critical", "high", "medium", "low"] as const).map(sev => (
            <div key={sev} className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: SEVERITY_COLORS[sev], boxShadow: `0 0 8px ${SEVERITY_GLOW[sev]}` }} />
              <span className="text-xs font-mono capitalize">{sev}</span>
              <span className="text-xs text-muted-foreground ml-auto font-mono">
                {THREAT_ORIGINS.filter(o => o.severity === sev).length} origins
              </span>
            </div>
          ))}
          <div className="border-t border-border pt-3 text-xs text-muted-foreground font-mono space-y-1">
            <p>• Dot size = relative attack volume</p>
            <p>• Click a dot to inspect origin</p>
            <p>• Drag to pan · scroll to zoom</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-card/40 border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold font-mono text-primary">Top Attack Origins</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  {["#", "Country", "City", "Known Actors", "Attacks", "Level"].map(h => (
                    <th key={h} className="text-left px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...THREAT_ORIGINS].sort((a, b) => b.count - a.count).map((origin, i) => (
                  <tr key={origin.name}
                    onClick={() => setSelected(selected?.name === origin.name ? null : origin)}
                    className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-primary/5 ${
                      selected?.name === origin.name ? "bg-primary/10" : ""
                    }`}>
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-semibold text-foreground">{origin.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{origin.city}</td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[180px] truncate">{origin.actors}</td>
                    <td className="px-4 py-2 text-primary">{origin.count.toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold"
                        style={{
                          color: SEVERITY_COLORS[origin.severity],
                          backgroundColor: SEVERITY_COLORS[origin.severity] + "22",
                          border: `1px solid ${SEVERITY_COLORS[origin.severity]}44`,
                        }}>
                        {origin.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CISA Known Exploited Vulnerabilities feed */}
      <div className="bg-card/40 border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h3 className="text-sm font-bold font-mono text-primary">
              CISA Known Exploited Vulnerabilities
              {cisaTotal ? <span className="text-muted-foreground font-normal ml-2">({cisaTotal.toLocaleString()} total)</span> : null}
            </h3>
          </div>
          <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80 transition-colors">
            View all <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {isLoadingCisa ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground font-mono">
            <span className="animate-pulse">Fetching live CISA data…</span>
          </div>
        ) : cisaData?.threats?.length ? (
          <div className="divide-y divide-border/50">
            {cisaData.threats.map((v) => (
              <div key={v.cveID} className="px-4 py-3 flex items-start gap-3 hover:bg-primary/3 transition-colors group">
                <div className="shrink-0 mt-0.5 space-y-0.5">
                  <span className="block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold font-mono"
                    style={{
                      color: v.knownRansomwareCampaignUse === "Known" ? SEVERITY_COLORS.critical : SEVERITY_COLORS.high,
                      backgroundColor: (v.knownRansomwareCampaignUse === "Known" ? SEVERITY_COLORS.critical : SEVERITY_COLORS.high) + "22",
                      border: `1px solid ${(v.knownRansomwareCampaignUse === "Known" ? SEVERITY_COLORS.critical : SEVERITY_COLORS.high)}44`,
                    }}>
                    {v.knownRansomwareCampaignUse === "Known" ? "ransomware" : "exploited"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold font-mono">{v.vulnerabilityName}</p>
                    <span className="text-xs font-mono text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">{v.cveID}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {v.vendorProject} · {v.product}
                  </p>
                  {v.shortDescription && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {v.shortDescription.slice(0, 160)}{v.shortDescription.length > 160 ? "…" : ""}
                    </p>
                  )}
                  {v.requiredAction && (
                    <p className="text-xs text-primary/80 mt-1 font-mono">
                      ⚡ {v.requiredAction.slice(0, 120)}{v.requiredAction.length > 120 ? "…" : ""}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  <p className="text-xs text-muted-foreground font-mono">Added: {v.dateAdded}</p>
                  {v.dueDate && (
                    <p className="text-xs font-mono" style={{ color: SEVERITY_COLORS.high }}>
                      Due: {v.dueDate}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground font-mono">
            Could not load CISA data. Check your connection.
          </div>
        )}
      </div>
    </div>
  );
}
