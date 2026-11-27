"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils/utils"

export interface TabItem {
  id: string
  label: string
  icon?: LucideIcon
}

interface CustomTabsProps {
  items: TabItem[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  size?: "sm" | "md"
  /** Hide labels below the sm breakpoint (icons only). */
  compact?: boolean
}

/**
 * Segmented control with a spring-animated active indicator.
 */
export function CustomTabs({ items, value, onValueChange, className, size = "md", compact }: CustomTabsProps) {
  const id = React.useId()
  const reduce = useReducedMotion()

  return (
    <div
      role="tablist"
      className={cn(
        "relative flex w-fit items-center gap-0.5 rounded-xl bg-sunken p-1 shadow-inset",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.id)}
            className={cn(
              "relative flex select-none items-center gap-1.5 rounded-lg font-medium outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring/60",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-indicator-${id}`}
                className="absolute inset-0 rounded-lg bg-card shadow-elev-1 ring-1 ring-border/60"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 45, mass: 0.6 }}
              />
            )}
            {Icon && <Icon className="relative h-3.5 w-3.5" />}
            <span className={cn("relative", compact && Icon && "hidden sm:inline")}>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
