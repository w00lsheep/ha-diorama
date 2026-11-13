import {
  clampShare,
  defaultLayout,
  dropAt,
  moved,
  PANE_GAP_PX,
  PANES,
  place,
  reshared,
  without,
  type Drop,
  type Layout,
  type PaneId,
  type Rect,
} from '#/editor/layout.ts'
import { plainButton } from '#/editor/look.ts'
import { ToolButton } from '#/editor/Toolbar.tsx'
import { cn } from '#/lib/utils.ts'
import { EDITOR_TINT_COLOR } from '#/theme.ts'
import { faGripVertical, faRotateLeft, faTableColumns } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

const NAMES: Record<PaneId, string> = { plan: 'Plan', view: '3D view', side: 'Sidebar' }

const at = (r: Rect): CSSProperties => ({ left: r.x, top: r.y, width: r.w, height: r.h })

type Props = {
  // Null is the default layout.
  layout: Layout | null
  onLayout: (layout: Layout) => void
  // What each pane shows. A pane left out is hidden, and the others close
  // up over its place until it is back.
  panes: Partial<Record<PaneId, ReactNode>>
  // While arranging, each pane carries a tag to drag it somewhere else.
  arranging: boolean
}

// The plan, the 3D view and the sidebar, laid out as the layout says. Each
// pane is placed on its own and never moved in the tree of elements, so
// rearranging them keeps the 3D view running instead of building it again.
export default function Panes({ layout, onLayout, panes, arranging }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const whole = layout ?? defaultLayout(size.w)
  let shown: Layout | null = whole
  for (const id of PANES) if (!panes[id] && shown) shown = without(shown, id)
  const area = { x: 0, y: 0, w: size.w, h: size.h }
  const placed = shown ? place(shown, area) : { panes: {}, handles: [] }

  // A pane on its way somewhere else, where the pointer is, and where it
  // would land.
  const [moving, setMoving] = useState<{ id: PaneId; x: number; y: number; drop: Drop | null } | null>(null)
  const pointIn = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const resize = useRef<{ start: number; share: number } | null>(null)

  return (
    <div ref={box} className="relative min-h-0 min-w-0 flex-1">
      {PANES.map(id => {
        const rect = placed.panes[id]
        if (!panes[id] || !rect) return null
        return (
          <div key={id} className={cn('absolute flex', moving?.id === id && 'opacity-40')} style={at(rect)}>
            {panes[id]}
            {arranging && (
              // Over the pane while arranging, so a press moves the pane
              // and does not edit what is in it.
              <div className="bg-tint/6 outline-tint/55 absolute inset-0 z-30 rounded-2xl outline-2 -outline-offset-2 outline-dashed">
                <button
                  type="button"
                  aria-label={`Move the ${NAMES[id].toLowerCase()}`}
                  className="border-separator absolute top-3 left-3 flex h-8 cursor-grab touch-none items-center gap-2 rounded-full border bg-(--card-background-color)/85 pr-3.5 pl-3 text-[13px] font-semibold text-(--primary-text-color) shadow-[0_2px_8px_rgba(0,0,0,0.18)] backdrop-blur-xl active:cursor-grabbing"
                  onPointerDown={e => {
                    if (e.button !== 0) return
                    e.preventDefault()
                    e.currentTarget.setPointerCapture(e.pointerId)
                    const p = pointIn(e)
                    setMoving({ id, ...p, drop: null })
                  }}
                  onPointerMove={e => {
                    if (!moving || moving.id !== id) return
                    const p = pointIn(e)
                    setMoving({ id, ...p, drop: dropAt(p.x, p.y, area, placed.panes, id) })
                  }}
                  onPointerUp={e => {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                    if (moving?.drop) onLayout(moved(whole, id, moving.drop.target, moving.drop.side))
                    setMoving(null)
                  }}
                  onPointerCancel={() => setMoving(null)}
                >
                  <FontAwesomeIcon icon={faGripVertical} className="text-label-2 size-3" />
                  {NAMES[id]}
                </button>
              </div>
            )}
          </div>
        )
      })}
      {/* Drag to share the room between the panes on either side. */}
      {placed.handles.map(h => {
        const row = h.split.dir === 'row'
        return (
          <div
            key={`${h.a.join()}|${h.b.join()}`}
            className={cn(
              'group absolute z-20 flex touch-none items-center justify-center',
              row ? 'cursor-col-resize' : 'cursor-row-resize',
            )}
            style={at(h.rect)}
            onPointerDown={e => {
              if (e.button !== 0) return
              e.currentTarget.setPointerCapture(e.pointerId)
              resize.current = { start: row ? e.clientX : e.clientY, share: h.split.share }
            }}
            onPointerMove={e => {
              const d = resize.current
              if (!d) return
              const delta = (row ? e.clientX : e.clientY) - d.start
              const share = clampShare(h.split, d.share + delta / Math.max(1, h.size - PANE_GAP_PX), h.size)
              onLayout(reshared(whole, h.a, h.b, share))
            }}
            onPointerUp={e => {
              resize.current = null
              e.currentTarget.releasePointerCapture(e.pointerId)
            }}
          >
            <span
              className={cn(
                'bg-fill-stronger group-hover:bg-label-2 rounded-full transition-colors',
                row ? 'h-10 w-[5px]' : 'h-[5px] w-10',
              )}
            />
          </div>
        )
      })}
      {moving?.drop && (
        <div
          className="border-tint bg-tint/18 pointer-events-none absolute z-40 rounded-2xl border-2 transition-all duration-100"
          style={at(moving.drop.rect)}
        />
      )}
      {moving && (
        <div
          className="bg-tint-fill pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-[130%] rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
          style={{ left: moving.x, top: moving.y }}
        >
          {NAMES[moving.id]}
        </div>
      )}
    </div>
  )
}

// The toolbar's way into arranging the panes, and while arranging, back to
// the layout the editor comes with.
export function ArrangeButtons({
  arranging,
  onArrange,
  custom,
  onReset,
}: {
  arranging: boolean
  onArrange: () => void
  // Whether the layout is not the default, which is when it can be reset.
  custom: boolean
  onReset: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <ToolButton
        action={{
          id: 'arrange',
          icon: faTableColumns,
          title: 'Arrange',
          description: 'Drag the plan, the 3D view and the sidebar where you want them. Kept on this device.',
          shortcut: 'A',
        }}
        active={arranging}
        color={EDITOR_TINT_COLOR}
        toggle
        onClick={onArrange}
      />
      {arranging && (
        <button type="button" onClick={onReset} disabled={!custom} className={plainButton}>
          <FontAwesomeIcon icon={faRotateLeft} className="size-3" />
          Default layout
        </button>
      )}
    </div>
  )
}
