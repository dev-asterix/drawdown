'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useReducedMotion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils/utils';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Tweens a number to its new value whenever it changes. Text is written
 * straight to the DOM node, so re-renders are not triggered per frame.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  duration = 0.55,
  from = 0,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  duration?: number;
  from?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number>(from);
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce || !Number.isFinite(value) || !Number.isFinite(prev.current)) {
      node.textContent = formatRef.current(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: EASE_OUT_EXPO,
      onUpdate: (v) => {
        node.textContent = formatRef.current(v);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  // The initial text is frozen so React never fights the tween mid-flight.
  const [initialText] = useState(() => format(reduce ? value : from));

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {initialText}
    </span>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0 } },
};

const itemVariants: Variants = {
  // Opacity + transform only: both are compositor properties (no repaint)
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT_EXPO } },
};

/** Staggers the entrance of its <Reveal> children. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={containerVariants} initial={reduce ? false : 'hidden'} animate="show">
      {children}
    </motion.div>
  );
}

export function Reveal({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const Comp = as === 'section' ? motion.section : motion.div;
  return (
    <Comp className={className} variants={itemVariants}>
      {children}
    </Comp>
  );
}

/** Circular progress gauge (0–100). */
export function Ring({
  value,
  size = 64,
  stroke = 6,
  className,
  trackClassName = 'stroke-muted',
  indicatorClassName = 'stroke-primary',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClassName} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={indicatorClassName}
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - pct / 100) : c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: reduce ? 0 : 0.7, ease: EASE_OUT_EXPO }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Horizontal bar that grows to `value` percent. */
export function GrowBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-sunken shadow-inset', className)}>
      <motion.div
        className={cn('h-full rounded-full bg-primary', barClassName)}
        initial={{ width: reduce ? `${pct}%` : 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: reduce ? 0 : 0.55, ease: EASE_OUT_EXPO }}
      />
    </div>
  );
}
