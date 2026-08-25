import { Link } from "react-router"
import { Button } from "@/ui"
import { DragonGlyph } from "@/pages/landing"

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{
          background:
            "radial-gradient(640px circle at 50% 12%, oklch(0.72 0.21 46 / 0.14), transparent 65%)",
        }}
      />
      <main className="relative flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full py-20">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">error 404</p>
          <DragonGlyph className="w-16 h-16 mx-auto mt-8 mb-6 text-primary/30" />
          <h1 className="text-5xl font-bold tracking-tighter">gone in the smoke</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            this route does not exist — not on this device, not anywhere else.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="px-8 h-12 text-base">
              <Link to="/">back home</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-8 h-12 text-base">
              <Link to="/studio">open studio</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
