import { Link, useLocation } from "wouter";
import { Shield, MessageSquare, Globe } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Command Center", icon: null },
    { href: "/threats", label: "Threat Research", icon: null },
    { href: "/threat-map", label: "Threat Map", icon: Globe },
    { href: "/recommendations", label: "Security Tools", icon: null },
    { href: "/chat", label: "AI Advisor", icon: MessageSquare },
  ];

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-50"
      style={{ boxShadow: "0 1px 0 0 hsl(205 100% 55% / 0.12), 0 4px 20px hsl(205 100% 55% / 0.05)" }}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-primary/30 group-hover:border-primary/70 transition-all duration-200"
            style={{ background: "hsl(205 100% 55% / 0.1)", boxShadow: "0 0 12px hsl(205 100% 55% / 0.25)" }}>
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-mono font-bold tracking-tight text-lg">
            <span className="text-primary" style={{ textShadow: "0 0 12px hsl(205 100% 55% / 0.7)" }}>CYBER</span>
            <span className="text-foreground">AI</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-mono rounded-md transition-all duration-200 ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                style={isActive ? { textShadow: "0 0 8px hsl(205 100% 55% / 0.6)", boxShadow: "0 0 0 1px hsl(205 100% 55% / 0.2)" } : {}}
              >
                {link.icon && <link.icon className="inline w-3.5 h-3.5" />}
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-primary"
                    style={{ boxShadow: "0 0 6px hsl(205 100% 55%)" }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile nav */}
        <nav className="flex md:hidden items-center gap-1">
          {links.map((link) => {
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 py-1 text-xs font-mono rounded transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                {link.label === "Command Center" ? "Home" : link.label === "Threat Research" ? "Threats" : link.label === "Security Tools" ? "Tools" : "AI"}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
