import Link from 'next/link';
import { Github, Mail } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card transition-colors">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="text-xs text-muted-foreground">
            <p>© {currentYear} Drawdown. <Link href="https://github.com/ric-v/drawdown/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline transition-colors">GPL v3 License</Link></p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-4 text-xs">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="https://github.com/ric-v/drawdown" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <Github className="w-4 h-4" />
            </Link>
            <a href="mailto:support@astrx.dev" className="text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
