'use client';

import { useState } from 'react';
import { CalendarIcon, ChevronRight, Undo2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomTabs } from '@/components/ui/custom-tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { RANGE_PRESETS, describeRange, matchPreset, type Range } from '@/lib/analytics/range';
import { cn } from '@/lib/utils/utils';

interface RangeBarProps {
  range: Range | undefined;
  onChange: (range: Range | undefined) => void;
  /** Ranges the user drilled through, oldest first (for breadcrumbs). */
  trail: (Range | undefined)[];
  onBack: () => void;
}

const QUICK = RANGE_PRESETS.filter((p) => p.short);

export function RangeBar({ range, onChange, trail, onBack }: RangeBarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const preset = matchPreset(range);
  const quickValue = QUICK.some((q) => q.id === preset) ? preset! : '';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <CustomTabs
          size="sm"
          items={QUICK.map((p) => ({ id: p.id, label: p.short! }))}
          value={quickValue}
          onValueChange={(id) => onChange(RANGE_PRESETS.find((p) => p.id === id)?.resolve(new Date()))}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant="outline"
              className={cn(
                'h-[34px] justify-start gap-2 px-3 text-xs font-medium',
                !quickValue && 'border-primary/50 text-foreground',
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {quickValue ? 'Custom' : describeRange(range)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align={isMobile ? 'center' : 'end'}>
            <div className="flex flex-col md:flex-row">
              <div className="grid grid-cols-3 gap-1 border-b p-2 md:flex md:flex-col md:gap-1 md:border-b-0 md:border-r md:p-3">
                {RANGE_PRESETS.filter((p) => !p.short || p.id === 'all').map((p) => (
                  <Button
                    key={p.id}
                    variant="ghost"
                    className={cn('h-auto justify-center px-2 py-1.5 text-xs font-normal md:justify-start md:text-sm', preset === p.id && 'bg-accent text-accent-foreground')}
                    onClick={() => { onChange(p.resolve(new Date())); setOpen(false); }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="p-3">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={range?.from}
                  selected={range as DateRange | undefined}
                  onSelect={(r) => {
                    if (r?.from) onChange({ from: r.from, to: r.to ?? r.from });
                    else onChange(undefined);
                  }}
                  numberOfMonths={isMobile ? 1 : 2}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {trail.length > 0 && (
        <nav aria-label="Drill-down path" className="flex flex-wrap items-center gap-1 text-xs">
          <button onClick={onBack} className="mr-1 inline-flex items-center gap-1 pressable rounded-lg border border-border bg-card px-2 py-1 font-medium text-muted-foreground hover:text-foreground">
            <Undo2 className="h-3 w-3" /> Back
          </button>
          {trail.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-muted-foreground">
              {describeRange(r)} <ChevronRight className="h-3 w-3" />
            </span>
          ))}
          <span className="font-semibold text-foreground">{describeRange(range)}</span>
        </nav>
      )}
    </div>
  );
}
