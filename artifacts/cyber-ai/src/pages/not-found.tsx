import { Link } from "wouter";
import { Terminal } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-16 h-16 rounded-xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
        <Terminal className="w-8 h-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold font-mono tracking-tighter">404_NOT_FOUND</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          The sector you are trying to access does not exist or has been redacted.
        </p>
      </div>
      <Link 
        href="/"
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 font-mono"
      >
        Return to Command Center
      </Link>
    </div>
  );
}
