/**
 * Behaviour tags are stored inline in the entry's notes as lowercase words,
 * matching what the trading journal already writes (e.g. "revenge").
 */
export interface BehaviorTag {
  id: string;
  label: string;
  /** true when the tag describes something the trader wants to do more of */
  good?: boolean;
}

export const BEHAVIOR_TAGS: BehaviorTag[] = [
  { id: 'rule-followed', label: 'Rule-followed', good: true },
  { id: 'revenge', label: 'Revenge' },
  { id: 'oversize', label: 'Oversize' },
  { id: 'late entry', label: 'Late entry' },
  { id: 'overtrade', label: 'Overtrade' },
  { id: 'fomo', label: 'FOMO' },
];

function escape(re: string) {
  return re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasTag(notes: string | undefined, tagId: string): boolean {
  if (!notes) return false;
  return new RegExp(`(^|[^a-z-])${escape(tagId)}([^a-z-]|$)`, 'i').test(notes);
}

export function toggleTag(notes: string | undefined, tagId: string): string {
  const current = notes ?? '';
  if (hasTag(current, tagId)) {
    return current
      .replace(new RegExp(`(^|[^a-z-])${escape(tagId)}(?=[^a-z-]|$)`, 'gi'), '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return current ? `${current.trim()} ${tagId}` : tagId;
}

export function tagsIn(notes: string | undefined): string[] {
  return BEHAVIOR_TAGS.filter((t) => hasTag(notes, t.id)).map((t) => t.id);
}

/** Notes with tag words stripped, for display alongside tag chips. */
export function stripTags(notes: string | undefined): string {
  let out = notes ?? '';
  for (const t of BEHAVIOR_TAGS) {
    out = out.replace(new RegExp(`(^|[^a-z-])${escape(t.id)}(?=[^a-z-]|$)`, 'gi'), '$1');
  }
  return out.replace(/\s+/g, ' ').trim();
}

export interface TagStat {
  id: string;
  label: string;
  good: boolean;
  count: number;
  total: number;
  average: number;
  winRate: number;
}

export function tagStats(days: { pnl: number; notes?: string }[]): TagStat[] {
  return BEHAVIOR_TAGS.map((t) => {
    const tagged = days.filter((d) => hasTag(d.notes, t.id));
    const total = tagged.reduce((s, d) => s + d.pnl, 0);
    const wins = tagged.filter((d) => d.pnl > 0).length;
    return {
      id: t.id,
      label: t.label,
      good: !!t.good,
      count: tagged.length,
      total,
      average: tagged.length ? total / tagged.length : 0,
      winRate: tagged.length ? (wins / tagged.length) * 100 : 0,
    };
  }).filter((s) => s.count > 0);
}
