import { backingsFor, wallOffset } from '#/decoration/backing.ts'
import { decorationKind } from '#/decoration/catalog.ts'
import { group, groupTitle, note } from '#/editor/look.ts'
import { cn } from '#/lib/utils.ts'
import type { DecorationConfig } from '#/types.ts'

type Props = {
  item: DecorationConfig
  decorations: DecorationConfig[]
  accent: string
  onUpdate: (id: string, patch: Partial<DecorationConfig>) => void
  // The piece whose name the pointer is over, or null once it leaves.
  onPoint: (id: string | null) => void
}

// What a wall piece hangs on: the wall itself, or another wall piece on the
// same wall it then hangs in front of. Nothing for a piece with nothing
// else on its wall to hang on.
export default function HangingOn({ item, decorations, accent, onUpdate, onPoint }: Props) {
  const backings = backingsFor(item, decorations)
  if (backings.length === 0) return null
  const name = (back: DecorationConfig) => {
    const label = decorationKind(back.kind)?.label ?? back.kind
    const same = backings.filter(b => b.kind === back.kind)
    return same.length > 1 ? `${label} ${same.indexOf(back) + 1}` : label
  }
  const current = backings.find(b => b.id === item.on)?.id ?? null
  const out = wallOffset(item, decorations)
  const chip = (id: string | null, label: string) => {
    const on = current === id
    return (
      <button
        key={id ?? 'wall'}
        type="button"
        aria-pressed={on}
        onClick={() => onUpdate(item.id, { on: id ?? undefined })}
        onPointerEnter={() => onPoint(id)}
        onFocus={() => onPoint(id)}
        onBlur={() => onPoint(null)}
        className={cn(
          'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
          on ? 'text-white' : 'bg-fill-strong hover:bg-fill-stronger text-label-2 hover:text-(--primary-text-color)',
        )}
        style={on ? { backgroundColor: accent } : undefined}
      >
        {label}
      </button>
    )
  }
  return (
    <div className={group}>
      <p className={groupTitle}>Hanging on</p>
      <div className="flex flex-wrap gap-1.5" onPointerLeave={() => onPoint(null)}>
        {chip(null, 'The wall')}
        {backings.map(back => chip(back.id, name(back)))}
      </div>
      <p className={note}>
        {out > 0
          ? `Hangs ${Math.round(out * 100)} cm out from the wall, in front of what is behind it.`
          : 'Drag it over another piece on the wall, or pick one above, to hang it in front of that piece.'}
      </p>
    </div>
  )
}
