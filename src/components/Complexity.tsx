import { cn } from '../lib/cn';
import { COMPLEXITY_LABEL } from '../lib/meta';

/** Five-step bar: how big / tangled a project is. Neutral ink on purpose —
 *  complexity isn't good or bad, so it must not borrow status colours. */
export function ComplexityPips({
  level,
  showLabel = true,
  className,
}: {
  level: number;
  showLabel?: boolean;
  className?: string;
}) {
  if (!level) return null;
  const label = COMPLEXITY_LABEL[level];
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      title={`複雜度：${label}（${level}/5）`}
      aria-label={`複雜度 ${label}`}
    >
      <span className="inline-flex items-end gap-px" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cn('w-1 rounded-[1px]', i <= level ? 'bg-text-secondary' : 'bg-border-raised')}
            style={{ height: 4 + i * 2 }}
          />
        ))}
      </span>
      {showLabel && <span className="zh-body-xxs text-text-muted">{label}</span>}
    </span>
  );
}
