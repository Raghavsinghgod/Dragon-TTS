import React, { createContext, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Toaster } from "sonner"

export { Toaster }

type btnVariant = "default" | "outline" | "secondary" | "destructive" | "ghost"
type btnSize = "default" | "sm" | "lg" | "icon"

const btnV: Record<btnVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-border bg-transparent hover:bg-accent",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  ghost: "hover:bg-accent hover:text-accent-foreground",
}
const btnS: Record<btnSize, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
  icon: "h-9 w-9",
}

export function Button({
  variant = "default",
  size = "default",
  asChild = false,
  className = "",
  disabled,
  title,
  onClick,
  children,
}: {
  variant?: btnVariant
  size?: btnSize
  asChild?: boolean
  className?: string
  disabled?: boolean
  title?: string
  onClick?: () => void
  children?: React.ReactNode
}) {
  const cls = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${btnV[variant]} ${btnS[size]} ${className}`
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      className: `${cls} ${(children.props as { className?: string }).className ?? ""}`,
    })
  }
  return (
    <button className={cls} disabled={disabled} title={title} onClick={onClick}>
      {children}
    </button>
  )
}

export function Card({
  className = "",
  children,
  ...rest
}: {
  className?: string
  children?: React.ReactNode
  [k: string]: unknown
}) {
  return (
    <div className={`rounded-xl border bg-card ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({
  className = "",
  children,
  ...rest
}: {
  className?: string
  children?: React.ReactNode
  [k: string]: unknown
}) {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardTitle({
  className = "",
  children,
  ...rest
}: {
  className?: string
  children?: React.ReactNode
  [k: string]: unknown
}) {
  return (
    <div className={`font-semibold leading-none tracking-tight ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardContent({
  className = "",
  children,
  ...rest
}: {
  className?: string
  children?: React.ReactNode
  [k: string]: unknown
}) {
  return (
    <div className={`p-6 pt-0 ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function Badge({
  variant = "default",
  className = "",
  children,
  ...rest
}: {
  variant?: "default" | "outline"
  className?: string
  children?: React.ReactNode
  [k: string]: unknown
}) {
  const cls =
    variant === "outline"
      ? `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`
      : `inline-flex items-center rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-semibold text-primary ${className}`
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  )
}

export function Kbd({
  className = "",
  children,
  ...rest
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <kbd
      className={`pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium ${className}`}
      {...rest}
    >
      {children}
    </kbd>
  )
}

export function Skeleton({ className = "", ...rest }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} {...rest} />
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  )
}

const dialogCtx = createContext<{
  open: boolean
  onOpenChange: (v: boolean) => void
}>({ open: false, onOpenChange: () => {} })

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <dialogCtx.Provider value={{ open, onOpenChange }}>{children}</dialogCtx.Provider>
  )
}

export function DialogContent({
  className = "",
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const { open, onOpenChange } = useContext(dialogCtx)
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onOpenChange])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/80"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={`relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg ${className}`}
      >
        {children}
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 text-sm hover:opacity-100"
          onClick={() => onOpenChange(false)}
        >
          x
        </button>
      </div>
    </div>,
    document.body,
  )
}

export function DialogHeader({
  className = "",
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}
    >
      {children}
    </div>
  )
}

export function DialogTitle({
  className = "",
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={`text-lg font-semibold leading-none tracking-tight ${className}`}
    >
      {children}
    </div>
  )
}

export function DialogDescription({
  className = "",
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`text-sm text-muted-foreground ${className}`}>{children}</div>
  )
}

export function DialogFooter({
  className = "",
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}
    >
      {children}
    </div>
  )
}

const dropCtx = createContext<{
  open: boolean
  setOpen: (v: boolean) => void
}>({ open: false, setOpen: () => {} })

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])
  return (
    <div ref={ref} className="relative inline-flex">
      <dropCtx.Provider value={{ open, setOpen }}>{children}</dropCtx.Provider>
    </div>
  )
}

export function DropdownMenuTrigger({
  asChild = false,
  children,
}: {
  asChild?: boolean
  children: React.ReactNode
}) {
  const { open, setOpen } = useContext(dropCtx)
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<Record<string, unknown>>,
      { onClick: () => setOpen(!open) },
    )
  }
  return <button onClick={() => setOpen(!open)}>{children}</button>
}

export function DropdownMenuContent({
  className = "",
  align = "end",
  children,
}: {
  className?: string
  align?: "start" | "end"
  children: React.ReactNode
}) {
  const { open } = useContext(dropCtx)
  if (!open) return null
  return (
    <div
      className={`absolute top-full mt-1 z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${align === "end" ? "right-0" : "left-0"} ${className}`}
    >
      {children}
    </div>
  )
}

export function DropdownMenuItem({
  className = "",
  onClick,
  children,
}: {
  className?: string
  onClick?: () => void
  children: React.ReactNode
}) {
  const { setOpen } = useContext(dropCtx)
  return (
    <div
      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent ${className}`}
      onClick={() => {
        onClick?.()
        setOpen(false)
      }}
    >
      {children}
    </div>
  )
}

export function DropdownMenuSeparator({ className = "" }: { className?: string }) {
  return <div className={`-mx-1 my-1 h-px bg-muted ${className}`} />
}
