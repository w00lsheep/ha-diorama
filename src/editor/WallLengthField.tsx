// The field a wall's length is typed into, opened by a double click on the
// wall. It sits where the wall's length is written, shows the room as it
// would come out while the length is typed, and holds the lock for the wall.
import { toScreen, type View } from '#/editor/view.ts'
import { field, floating, iconButton } from '#/editor/look.ts'
import {
  defaultEnd,
  formatLength,
  isLocked,
  parseLength,
  setWallLength,
  wallLength,
  type WallEnd,
} from '#/editor/wallLength.ts'
import { cn } from '#/lib/utils.ts'
import { EDITOR_SELECTED_COLOR } from '#/theme.ts'
import type { Point, RoomConfig } from '#/types.ts'
import { faArrowRightArrowLeft, faCheck, faLock, faLockOpen, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useRef, useState } from 'react'

const WIDTH = 236
const HEIGHT = 40
const ERROR_HEIGHT = 26

// Marks the field, so a press inside it is not taken for one beside it.
export const WALL_FIELD_ATTR = 'data-wall-field'

type Props = {
  room: RoomConfig
  index: number
  view: View
  // The outlines of the other rooms on the floor, which the room must not
  // run into.
  others: Point[][]
  onApply: (points: Point[]) => void
  onLock: (locked: boolean) => void
  onClose: () => void
}

const REASONS = {
  parse: 'Type a length like 3.65 or 365 cm',
  short: 'A wall is at least 10 cm long',
  locked: 'A locked wall would change. Move the other end.',
  invalid: 'The room would fold or overlap another',
}

export default function WallLengthField({ room, index, view, others, onApply, onLock, onClose }: Props) {
  const n = room.points.length
  const current = wallLength(room.points, index)
  const [text, setText] = useState(formatLength(current))
  const [end, setEnd] = useState<WallEnd>(() => defaultEnd(room, index))
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // Focused once the field is in place, so the page does not jump to it.
    const id = requestAnimationFrame(() => {
      input.current?.focus({ preventScroll: true })
      input.current?.select()
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const length = parseLength(text)
  const result = length === null ? null : setWallLength(room, index, length, end, others)
  const error = length === null ? REASONS.parse : result && !result.ok ? REASONS[result.reason] : null
  const changed = result?.ok === true && length !== null && Math.abs(length - current) >= 0.005
  const locked = isLocked(room, index)

  const apply = () => {
    if (result?.ok && changed) onApply(result.points)
    onClose()
  }

  const a = room.points[index]
  const b = room.points[(index + 1) % n]
  const [ax, ay] = toScreen(view, a)
  const [bx, by] = toScreen(view, b)
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  // The corner that moves, with an arrow pointing the way the wall runs out.
  const [ex, ey] = end === 'end' ? [bx, by] : [ax, ay]
  const span = Math.hypot(bx - ax, by - ay) || 1
  const dx = ((end === 'end' ? 1 : -1) * (bx - ax)) / span
  const dy = ((end === 'end' ? 1 : -1) * (by - ay)) / span
  const tip: Point = [ex + dx * 26, ey + dy * 26]
  const head = (side: number): Point => [tip[0] - dx * 7 - side * dy * 5, tip[1] - dy * 7 + side * dx * 5]

  const preview = result?.ok && changed ? result.points.map(p => toScreen(view, p).join(',')).join(' ') : null
  const height = HEIGHT + (error ? ERROR_HEIGHT : 0)

  return (
    <g>
      {preview && (
        <polygon
          points={preview}
          fill={EDITOR_SELECTED_COLOR}
          fillOpacity={0.05}
          stroke={EDITOR_SELECTED_COLOR}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          strokeLinejoin="round"
          className="pointer-events-none"
        />
      )}
      <line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke={EDITOR_SELECTED_COLOR}
        strokeWidth={4}
        strokeLinecap="round"
        className="pointer-events-none"
      />
      <g className="pointer-events-none" stroke={EDITOR_SELECTED_COLOR} strokeWidth={2} fill="none">
        <circle cx={ex} cy={ey} r={12} strokeDasharray="3 3" />
        <line x1={ex + dx * 14} y1={ey + dy * 14} x2={tip[0]} y2={tip[1]} strokeLinecap="round" />
        <polygon points={[tip, head(1), head(-1)].map(p => p.join(',')).join(' ')} fill={EDITOR_SELECTED_COLOR} />
      </g>
      <foreignObject
        x={mx - WIDTH / 2}
        y={my - HEIGHT / 2}
        width={WIDTH}
        height={height}
        {...{ [WALL_FIELD_ATTR]: '' }}
        className="overflow-visible"
      >
        <div
          className={cn(floating, 'font-system mx-auto flex w-fit flex-col gap-1 p-1')}
          onPointerDown={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          onContextMenu={e => e.stopPropagation()}
          // The buttons leave the focus in the field, so Enter and Escape
          // still reach it, and not the editor's own shortcuts.
          onMouseDown={e => {
            if (e.target !== input.current) e.preventDefault()
          }}
        >
          <form
            className="flex items-center gap-0.5"
            onSubmit={e => {
              e.preventDefault()
              apply()
            }}
          >
            <button
              type="button"
              title="Swap the end that moves"
              aria-label="Swap the end that moves"
              className={cn(iconButton, 'size-7 shrink-0')}
              onClick={() => setEnd(end === 'end' ? 'start' : 'end')}
            >
              <FontAwesomeIcon icon={faArrowRightArrowLeft} className="size-3" />
            </button>
            <input
              ref={input}
              aria-label="Wall length in meters"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              className={cn(
                field,
                'h-7 w-[72px] px-2 text-right font-semibold tabular-nums',
                error && 'ring-3 ring-(--error-color)/40 focus:ring-(--error-color)/40',
              )}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  onClose()
                }
              }}
            />
            <span className="text-label-2 pr-1 pl-0.5 text-[13px]">m</span>
            <button
              type="button"
              title={locked ? 'Unlock the length' : 'Lock the length'}
              aria-label={locked ? 'Unlock the length' : 'Lock the length'}
              aria-pressed={locked}
              className={cn(iconButton, 'size-7 shrink-0', locked && 'text-tint')}
              onClick={() => onLock(!locked)}
            >
              <FontAwesomeIcon icon={locked ? faLock : faLockOpen} className="size-3" />
            </button>
            <button
              type="submit"
              title="Apply"
              aria-label="Apply"
              disabled={!!error}
              className={cn(iconButton, 'text-tint size-7 shrink-0')}
            >
              <FontAwesomeIcon icon={faCheck} className="size-3.5" />
            </button>
            <button
              type="button"
              title="Cancel"
              aria-label="Cancel"
              className={cn(iconButton, 'size-7 shrink-0')}
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} className="size-3.5" />
            </button>
          </form>
          {error && <div className="px-1.5 pb-0.5 text-[11px] leading-tight text-(--error-color)">{error}</div>}
        </div>
      </foreignObject>
    </g>
  )
}
