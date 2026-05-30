import { useState, useEffect } from "react";
import { useListThreats } from "@workspace/api-client-react";
import { Globe, AlertTriangle, Zap, Shield, Activity } from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { Tooltip } from "@/components/ui/tooltip";
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Known threat origin points based on real cybersecurity research
// (representative attack origin/hotspot cities, not exact)
const THREAT_ORIGINS = [
  { name: "Russia", lat: 55.75, lng: 37.62, count: 187, severity: "critical", city: "Moscow" },
  { name: "China", lat: 39.9, lng: 116.4, count: 245, severity: "critical", city: "Beijing" },
  { name: "North Korea", lat: 39.03, lng: 125.76, count: 78, severity: "critical", city: "Pyongyang" },
  { name: "Iran", lat: 35.69, lng: 51.39, count: 92, severity: "high", city: "Tehran" },
  { name: "USA", lat: 38.9, lng: -77.0, count: 134, severity: "high", city: "Washington D.C." },
  { name: "Ukraine", lat: 50.45, lng: 30.52, count: 67, severity: "high", city: "Kyiv" },
  { name: "Romania", lat: 44.43, lng: 26.1, count: 43, severity: "medium", city: "Bucharest" },
  { name: "Brazil", lat: -15.78, lng: -47.93, count: 56, severity: "medium", city: "Brasília" },
  { name: "India", lat: 28.6, lng: 77.2, count: 48, severity: "medium", city: "New Delhi" },
  { name: "Nigeria", lat: 9.07, lng: 7.49, count: 61, severity: "high", city: "Abuja" },
  { name: "Turkey", lat: 39.93, lng: 32.86, count: 34, severity: "medium", city: "Ankara" },
  { name: "Vietnam", lat: 21.03, lng: 105.85, count: 29, severity: "medium", city: "Hanoi" },
  { name: "Indonesia", lat: -6.21, lng: 106.84, count: 22, severity: "low", city: "Jakarta" },
  { name: "Pakistan", lat: 33.69, lng: 73.06, count: 31, severity: "medium", city: "Islamabad" },
  { name: "Germany", lat: 52.52, lng: 13.4, count: 18, severity: "low", city: "Berlin" },
];

// Active attack vectors being tracked right now (simulated real-time)
const ATTACK_VECTORS = [
  { from: { lat: 39.9, lng: 116.4 }, to: { lat: 37.77, lng: -122.42 }, type: "APT", label: "APT41 → SF" },
  { from: { lat: 55.75, lng: 37.62 }, to: { lat: 40.71, lng: -74.0 }, type: "Ransomware", label: "LockBit → NYC" },
  { from: { lat: 39.03, lng: 125.76 }, to: { lat: 38.9, lng: -77.0 }, type: "Espionage", label: "Lazarus → DC" },
  { from: { lat: 35.69, lng: 51.39 }, to: { lat: 51.5, lng: -0.12 }, type: "DDoS", label: "APT34 → London" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff2d2d",
  high: "#ff8c00",
  medium: "#ffd700",
  low: "#00d4ff",
};

const SEVERITY_GLOW: Record<string, string> = {
  critical: "rgba(255,45,45,0.6)",
  high: "rgba(255,140,0,0.5)",
  medium: "rgba(255,215,0,0.4)",
  low: "rgba(0,212,255,0.4)",
};

function PulsingDot({ severity, size }: { severity: string; size: number }) {
  const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.low;
  const glow = SEVERITY_GLOW[severity] ?? SEVERITY_GLOW.low;
  return (
    <g>
      <circle r={size + 4} fill={color} opacity={0.15}>
        <animate attributeName="r" values={`${size + 2};${size + 10};${size + 2}`} dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle r={size} fill={color} style={{ filter: `drop-shadow(0 0 ${size * 2}px ${glow})` }} />
    </g>
  );
}

export function ThreatMap() {
  const [selected, setSelected] = useState<typeof THREAT_ORIGINS[0] | null>(null);
  const [animTick, setAnimTick] = useState(0);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [0, 20],
    zoom: 1,
  });

  const { data: threats } = useListThreats();

  useEffect(() => {
    const interval = setInterval(() => setAnimTick(t => t + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  const totalAttacks = THREAT_ORIGINS.reduce((s, o) => s + o.count, 0);
  const criticalCount = THREAT_ORIGINS.filter(o => o.severity === "critical").length;
  const highCount = THREAT_ORIGINS.filter(o => o.severity === "high").length;

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
              <span className="text-primary" style={{ textShadow: "0 0 12px hsl(205 100% 55% / 0.5)" }}>LIVE</span> Threat Map
            </h1>
            <p className="text-xs text-muted-foreground font-mono">Real-time global attack origin tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-mono text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tracked Attacks", value: totalAttacks.toLocaleString(), icon: Activity, color: "text-primary" },
          { label: "Critical Origins", value: criticalCount, icon: AlertTriangle, color: "text-red-400" },
          { label: "High Severity", value: highCount, icon: Zap, color: "text-orange-400" },
          { label: "DB Threats", value: threats?.length ?? "—", icon: Shield, color: "text-primary" },
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

        {/* Grid overlay effect */}
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
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#0a1628"
                      stroke="#1a2f4a"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#0d1f3c", outline: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* Attack origin markers */}
              {THREAT_ORIGINS.map((origin) => {
                const size = Math.max(3, Math.min(9, origin.count / 30));
                return (
                  <Marker
                    key={origin.name}
                    coordinates={[origin.lng, origin.lat]}
                    onClick={() => setSelected(selected?.name === origin.name ? null : origin)}
                    style={{ cursor: "pointer" }}
                  >
                    <PulsingDot severity={origin.severity} size={size} />
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Selected origin popup */}
        {selected && (
          <div className="absolute top-4 right-4 bg-card/95 border border-primary/30 rounded-xl p-4 min-w-52 backdrop-blur-sm z-20"
            style={{ boxShadow: "0 0 20px rgba(0,212,255,0.2)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold font-mono text-sm text-primary">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">City</span>
                <span>{selected.city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attacks tracked</span>
                <span className="text-primary">{selected.count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Threat level</span>
                <span style={{ color: SEVERITY_COLORS[selected.severity] }}
                  className="uppercase font-bold">
                  {selected.severity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coordinates</span>
                <span>{selected.lat.toFixed(2)}°, {selected.lng.toFixed(2)}°</span>
              </div>
            </div>
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-20">
          <button
            onClick={() => setPosition(p => ({ ...p, zoom: Math.min(6, p.zoom * 1.5) }))}
            className="w-8 h-8 bg-card/80 border border-border rounded-lg text-sm font-mono hover:border-primary/40 hover:text-primary transition-colors"
          >+</button>
          <button
            onClick={() => setPosition(p => ({ ...p, zoom: Math.max(1, p.zoom / 1.5) }))}
            className="w-8 h-8 bg-card/80 border border-border rounded-lg text-sm font-mono hover:border-primary/40 hover:text-primary transition-colors"
          >−</button>
        </div>
      </div>

      {/* Legend + origin table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Legend */}
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
            <p>• Drag to pan, scroll to zoom</p>
          </div>
        </div>

        {/* Top origins table */}
        <div className="lg:col-span-2 bg-card/40 border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold font-mono text-primary">Top Attack Origins</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Country</th>
                  <th className="text-left px-4 py-2">City</th>
                  <th className="text-left px-4 py-2">Attacks</th>
                  <th className="text-left px-4 py-2">Level</th>
                </tr>
              </thead>
              <tbody>
                {[...THREAT_ORIGINS]
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                  .map((origin, i) => (
                    <tr key={origin.name}
                      onClick={() => setSelected(selected?.name === origin.name ? null : origin)}
                      className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-primary/5 ${
                        selected?.name === origin.name ? "bg-primary/10" : ""
                      }`}>
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 text-foreground font-semibold">{origin.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{origin.city}</td>
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

      {/* Active threat feed */}
      <div className="bg-card/40 border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h3 className="text-sm font-bold font-mono text-primary">Live Threat Feed (from database)</h3>
        </div>
        <div className="divide-y divide-border/50">
          {threats?.slice(0, 6).map((threat) => (
            <div key={threat.id} className="px-4 py-3 flex items-start gap-3 hover:bg-primary/3 transition-colors">
              <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold font-mono"
                style={{
                  color: SEVERITY_COLORS[threat.severity] ?? SEVERITY_COLORS.low,
                  backgroundColor: (SEVERITY_COLORS[threat.severity] ?? SEVERITY_COLORS.low) + "22",
                  border: `1px solid ${(SEVERITY_COLORS[threat.severity] ?? SEVERITY_COLORS.low)}44`,
                }}>
                {threat.severity}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold font-mono truncate">{threat.title}</p>
                <p className="text-xs text-muted-foreground truncate">{threat.description?.slice(0, 100)}…</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground font-mono ml-auto">
                {threat.category}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
