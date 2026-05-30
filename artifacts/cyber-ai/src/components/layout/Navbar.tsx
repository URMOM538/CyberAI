import { Link, useLocation } from "wouter";
import { Shield, ShieldAlert, Zap } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Command Center" },
    { href: "/threats", label: "Threat Research" },
    { href: "/recommendations", label: "Security Tools" },
  ];

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/50 transition-colors">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <span className="font-mono font-bold tracking-tight text-lg text-primary">
            CYBER<span className="text-foreground">AI</span>
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          {links.map((link) => {
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={`text-sm font-mono transition-colors hover:text-primary ${isActive ? 'text-primary border-b-2 border-primary py-5' : 'text-muted-foreground'}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
