import {
  EDITOR_PREVIEW_FRACTION,
  EDITOR_PREVIEW_MIN_PX,
  EDITOR_SIDEBAR_MIN_PX,
  EDITOR_SIDEBAR_WIDTH_PX,
} from '#/constants.ts'
import { useEffect, useState } from 'react'

// How the editor's three panes share the space under the toolbar: the plan,
// the 3D view and the sidebar. A pane stands alone, or a split puts two
// parts beside each other ('row') or one over the other ('col'), the first
// taking `share` of the room the two have.

export type PaneId = 'plan' | 'view' | 'side'
export type Split = { dir: 'row' | 'col'; share: number; a: Layout; b: Layout }
export type Layout = PaneId | Split
export type Side = 'left' | 'right' | 'top' | 'bottom'
export type Rect = { x: number; y: number; w: number; h: number }

export const PANES: PaneId[] = ['plan', 'view', 'side']
// Room between two panes, which is where the handle to resize them sits.
export const PANE_GAP_PX = 16
// The share a pane takes of the place it is dropped beside.
const DROPPED_SHARE = 1 / 3

const MIN_PX: Record<PaneId, number> = {
  plan: EDITOR_PREVIEW_MIN_PX,
  view: EDITOR_PREVIEW_MIN_PX,
  side: EDITOR_SIDEBAR_MIN_PX,
}

// The plan over the view, and the sidebar at its usual width on the right.
// The width is a share, so it is worked out from the room there is.
export function defaultLayout(width: number): Layout {
  const room = width - PANE_GAP_PX
  const share = room > 0 ? Math.min(Math.max((room - EDITOR_SIDEBAR_WIDTH_PX) / room, 0.3), 0.85) : 0.7
  return { dir: 'row', share, a: { dir: 'col', share: 1 - EDITOR_PREVIEW_FRACTION, a: 'plan', b: 'view' }, b: 'side' }
}

// The layout without one pane, its neighbor taking its place.
export function without(layout: Layout, id: PaneId): Layout | null {
  if (typeof layout === 'string') return layout === id ? null : layout
  const a = without(layout.a, id)
  const b = without(layout.b, id)
  if (!a) return b
  if (!b) return a
  return { ...layout, a, b }
}

function beside(node: Layout, side: Side, id: PaneId): Split {
  const first = side === 'left' || side === 'top'
  return {
    dir: side === 'left' || side === 'right' ? 'row' : 'col',
    share: first ? DROPPED_SHARE : 1 - DROPPED_SHARE,
    a: first ? id : node,
    b: first ? node : id,
  }
}

// Moves a pane beside another one, or along the outer edge when there is
// no target, where it takes the whole width or height.
export function moved(layout: Layout, id: PaneId, target: PaneId | null, side: Side): Layout {
  const rest = without(layout, id)
  if (!rest) return layout
  if (!target) return beside(rest, side, id)
  const put = (node: Layout): Layout => {
    if (node === target) return beside(node, side, id)
    if (typeof node === 'string') return node
    return { ...node, a: put(node.a), b: put(node.b) }
  }
  return put(rest)
}

// The least room a part needs along a direction.
function least(node: Layout, dir: 'row' | 'col'): number {
  if (typeof node === 'string') return MIN_PX[node]
  const a = least(node.a, dir)
  const b = least(node.b, dir)
  return node.dir === dir ? a + b + PANE_GAP_PX : Math.max(a, b)
}

// The share a split can take, keeping both of its parts above their least.
export function clampShare(split: Split, share: number, size: number): number {
  const room = size - PANE_GAP_PX
  if (room <= 0) return split.share
  const lo = least(split.a, split.dir) / room
  const hi = 1 - least(split.b, split.dir) / room
  if (lo > hi) return 0.5
  return Math.min(Math.max(share, lo), hi)
}

// The panes in a part, in order.
export function leaves(node: Layout): PaneId[] {
  return typeof node === 'string' ? [node] : [...leaves(node.a), ...leaves(node.b)]
}

// Where each pane goes, and where the handle of each split sits, with the
// panes on either side of it, to find the split again when it is dragged.
export type Handle = { split: Split; a: PaneId[]; b: PaneId[]; rect: Rect; size: number }
export function place(layout: Layout, box: Rect) {
  const panes: Partial<Record<PaneId, Rect>> = {}
  const handles: Handle[] = []
  const walk = (node: Layout, r: Rect) => {
    if (typeof node === 'string') {
      panes[node] = r
      return
    }
    const row = node.dir === 'row'
    const size = row ? r.w : r.h
    const first = Math.max(0, (size - PANE_GAP_PX) * node.share)
    const second = Math.max(0, size - PANE_GAP_PX - first)
    const handle = { split: node, a: leaves(node.a), b: leaves(node.b), size }
    if (row) {
      walk(node.a, { x: r.x, y: r.y, w: first, h: r.h })
      walk(node.b, { x: r.x + first + PANE_GAP_PX, y: r.y, w: second, h: r.h })
      handles.push({ ...handle, rect: { x: r.x + first, y: r.y, w: PANE_GAP_PX, h: r.h } })
    } else {
      walk(node.a, { x: r.x, y: r.y, w: r.w, h: first })
      walk(node.b, { x: r.x, y: r.y + first + PANE_GAP_PX, w: r.w, h: second })
      handles.push({ ...handle, rect: { x: r.x, y: r.y + first, w: r.w, h: PANE_GAP_PX } })
    }
  }
  walk(layout, box)
  return { panes, handles }
}

// The layout with a new share for the split between these panes. A pane
// that is hidden is left out on both sides, so a split dragged while the 3D
// view is hidden is still found in the whole layout.
export function reshared(layout: Layout, a: PaneId[], b: PaneId[], share: number): Layout {
  if (typeof layout === 'string') return layout
  const shown = new Set([...a, ...b])
  const part = (node: Layout) =>
    leaves(node)
      .filter(id => shown.has(id))
      .join()
  if (part(layout.a) === a.join() && part(layout.b) === b.join()) return { ...layout, share }
  return { ...layout, a: reshared(layout.a, a, b, share), b: reshared(layout.b, a, b, share) }
}

// Where dropping a pane at a point would put it, and the part of the
// editor it would take, to show before it is let go. Near the outer edge it
// goes along that edge, over another pane it takes the half it is over.
const EDGE_PX = 28
export type Drop = { target: PaneId | null; side: Side; rect: Rect }
export function dropAt(x: number, y: number, box: Rect, panes: Partial<Record<PaneId, Rect>>, moving: PaneId) {
  const halves = (r: Rect, side: Side, part: number): Rect =>
    side === 'left'
      ? { ...r, w: r.w * part }
      : side === 'right'
        ? { ...r, x: r.x + r.w * (1 - part), w: r.w * part }
        : side === 'top'
          ? { ...r, h: r.h * part }
          : { ...r, y: r.y + r.h * (1 - part), h: r.h * part }
  const edges: [Side, number][] = [
    ['left', x - box.x],
    ['right', box.x + box.w - x],
    ['top', y - box.y],
    ['bottom', box.y + box.h - y],
  ]
  const [edge, away] = edges.sort((p, q) => p[1] - q[1])[0]
  if (away < -EDGE_PX * 2) return null
  if (away < EDGE_PX) return { target: null, side: edge, rect: halves(box, edge, DROPPED_SHARE) } satisfies Drop
  for (const id of PANES) {
    const r = panes[id]
    if (!r || id === moving) continue
    if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue
    const fx = (x - r.x) / r.w - 0.5
    const fy = (y - r.y) / r.h - 0.5
    const side: Side = Math.abs(fx) > Math.abs(fy) ? (fx < 0 ? 'left' : 'right') : fy < 0 ? 'top' : 'bottom'
    return { target: id, side, rect: halves(r, side, 0.5) } satisfies Drop
  }
  return null
}

// Each pane exactly once, and every share a number between 0 and 1.
function valid(node: unknown, seen: Set<string>): boolean {
  if (typeof node === 'string') {
    if (!PANES.includes(node as PaneId) || seen.has(node)) return false
    seen.add(node)
    return true
  }
  if (!node || typeof node !== 'object') return false
  const s = node as Partial<Split>
  return (
    (s.dir === 'row' || s.dir === 'col') &&
    typeof s.share === 'number' &&
    s.share > 0 &&
    s.share < 1 &&
    valid(s.a, seen) &&
    valid(s.b, seen)
  )
}

// Kept on the device, since a wall tablet and a laptop have screens of
// their own, and never in the card. Null is the default layout.
const KEY = 'ha-diorama-editor-layout'

function load(): Layout | null {
  try {
    const stored = localStorage.getItem(KEY)
    if (!stored) return null
    const layout: unknown = JSON.parse(stored)
    const seen = new Set<string>()
    return valid(layout, seen) && seen.size === PANES.length ? (layout as Layout) : null
  } catch {
    return null
  }
}

export function useLayout() {
  const [layout, setLayout] = useState<Layout | null>(load)
  useEffect(() => {
    try {
      if (layout) localStorage.setItem(KEY, JSON.stringify(layout))
      else localStorage.removeItem(KEY)
    } catch {
      // Storage can be blocked. The layout then lasts until the editor closes.
    }
  }, [layout])
  return [layout, setLayout] as const
}
