import { Link, NavLink } from "react-router"
import { DragonGlyph } from "@/pages/landing"

const links = [
  ["/studio", "studio"],
  ["/dashboard", "console"],
  ["/docs", "docs"],
  ["/history", "history"],
  ["/model", "model"],
]

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background">
        <nav className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary transition-opacity hover:opacity-80">
            <DragonGlyph className="w-5 h-5" />
            <span className="font-semibold tracking-wide">dragon stt</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground sm:gap-4 sm:text-sm">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `transition-colors ${isActive ? "text-primary" : "hover:text-foreground"}`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8">{children}</main>
      <footer className="border-t border-border/60 py-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        offline · local only · nothing phones home
      </footer>
    </div>
  )
}
