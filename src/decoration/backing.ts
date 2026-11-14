import { decorationKind, footprint, mountHeight, paramValue, type DecorationKind } from '#/decoration/catalog.ts'
import { isModelKind } from '#/decoration/models.ts'
import type { DecorationConfig, Point } from '#/types.ts'

// Things that hang on other things on a wall. A wall piece names the wall
// piece behind it with `on`, an acoustic panel under a picture say, and
// then hangs in front of it rather than in it. Height and where it is along
// the wall stay its own; only how far out from the wall it hangs follows
// from what is behind it, so a stack can go several deep.

const MAX_DEPTH = 6

// Openings in the wall and pieces that stand on the floor against it have
// no face to hang anything on.
const NO_BACKING = new Set(['door', 'sliding_door', 'garage_door', 'window', 'radiator'])

const isWall = (kind: DecorationKind | undefined): kind is DecorationKind => kind?.mount === 'wall'

// Whether other wall pieces can hang on a piece of this kind.
export const canBack = (kind: DecorationKind) => isWall(kind) && !NO_BACKING.has(kind.id)

// The way along the wall and the way into the room, on the plan, for a wall
// piece turned `rotation` degrees. A wall piece faces plan -y at zero.
function axes(rotation: number | undefined): { along: Point; inward: Point } {
  const a = ((rotation ?? 0) * Math.PI) / 180
  return { along: [Math.cos(a), Math.sin(a)], inward: [Math.sin(a), -Math.cos(a)] }
}

const dot = (p: Point, q: Point) => p[0] * q[0] + p[1] * q[1]

// Whether two wall pieces hang on the same stretch of the same wall: facing
// the same way and on one line.
function sameWall(a: DecorationConfig, b: DecorationConfig) {
  const turn = ((((a.rotation ?? 0) - (b.rotation ?? 0)) % 360) + 360) % 360
  if (Math.min(turn, 360 - turn) > 1) return false
  const { inward } = axes(b.rotation)
  const gap: Point = [a.position[0] - b.position[0], a.position[1] - b.position[1]]
  return a.room === b.room && Math.abs(dot(gap, inward)) < 0.03
}

// The wall piece `item` hangs on, when it names one that still has a face
// for it on the same wall.
function backingOf(item: DecorationConfig, all: DecorationConfig[]): DecorationConfig | undefined {
  if (!item.on || !isWall(decorationKind(item.kind))) return undefined
  const back = all.find(d => d.id === item.on)
  const kind = back ? decorationKind(back.kind) : undefined
  return back && kind && canBack(kind) && sameWall(item, back) ? back : undefined
}

// How far a wall piece stands out from what it hangs on. An imported model
// and a piece with a depth of its own say; the rest, a mirror, a clock, a
// tablet, are a few centimeters, whatever their plan footprint makes of
// their size.
function thickness(item: DecorationConfig) {
  const kind = decorationKind(item.kind)
  if (!kind) return 0
  if (isModelKind(kind) || kind.params.some(p => p.id === 'depth')) return paramValue(kind, item.params, 'depth', item.variant)
  return 0.04
}

// How far out from the wall line a wall piece hangs: the depth of every
// piece behind it.
export function wallOffset(item: DecorationConfig, all: DecorationConfig[], depth = 0): number {
  const back = depth < MAX_DEPTH ? backingOf(item, all) : undefined
  return back ? wallOffset(back, all, depth + 1) + thickness(back) : 0
}

// Where a wall piece hangs on the plan, moved out from the wall line by
// whatever is behind it.
export function hungAt(item: DecorationConfig, all: DecorationConfig[]): Point {
  const out = wallOffset(item, all)
  if (out === 0) return item.position
  const { inward } = axes(item.rotation)
  return [item.position[0] + inward[0] * out, item.position[1] + inward[1] * out]
}

// From how high to how high a wall piece reaches, when that is known. An
// imported model hangs by its bottom edge and is as tall as its height; a
// piece from the catalog is drawn round its height its own way, so it is
// left unknown.
function span(item: DecorationConfig): [number, number] | null {
  const kind = decorationKind(item.kind)
  if (!kind || !isModelKind(kind)) return null
  const sill = paramValue(kind, item.params, 'sill', item.variant)
  return [sill, sill + paramValue(kind, item.params, 'height', item.variant)]
}

// The wall pieces hanging on an item, directly or further out.
function hangersOf(id: string, all: DecorationConfig[]): Set<string> {
  const out = new Set<string>([id])
  for (let depth = 0, grew = true; grew && depth < MAX_DEPTH; depth++) {
    grew = false
    for (const d of all) {
      if (d.on && out.has(d.on) && !out.has(d.id) && isWall(decorationKind(d.kind))) {
        out.add(d.id)
        grew = true
      }
    }
  }
  return out
}

// Every wall piece `item` could hang on where it is: on the same wall, never
// itself and never one hanging on it, nearest the wall first.
export function backingsFor(item: DecorationConfig, all: DecorationConfig[]): DecorationConfig[] {
  if (!isWall(decorationKind(item.kind))) return []
  const own = hangersOf(item.id, all)
  return all
    .filter(other => {
      const kind = decorationKind(other.kind)
      return !own.has(other.id) && !!kind && canBack(kind) && sameWall(item, other)
    })
    .sort((a, b) => wallOffset(a, all) - wallOffset(b, all))
}

// What a wall piece dragged to where it is should hang on: the frontmost
// piece behind it that it overlaps along the wall and in height. Only a
// piece whose height is known is found this way; anything else is picked
// in the panel. A piece already hanging on one it still overlaps stays on
// that one.
export function backingUnder(item: DecorationConfig, all: DecorationConfig[]): DecorationConfig | null {
  const kind = decorationKind(item.kind)
  if (!isWall(kind)) return null
  const width = footprint(kind, item.params, item.variant)[0]
  // Where its height is not known, how high it hangs has to be on the piece
  // behind it. A light builds itself at full height, its height param being
  // how high it hangs.
  const mine = span(item)
  const low =
    kind.family === 'light' ? paramValue(kind, item.params, 'height', item.variant) : mountHeight(kind, item.params)
  const { along } = axes(item.rotation)
  const overlaps = (other: DecorationConfig) => {
    const otherKind = decorationKind(other.kind)
    const theirs = span(other)
    if (!otherKind || !theirs) return false
    const reach = (width + footprint(otherKind, other.params, other.variant)[0]) / 2 - 0.01
    const gap: Point = [item.position[0] - other.position[0], item.position[1] - other.position[1]]
    if (Math.abs(dot(gap, along)) >= reach) return false
    return mine ? mine[0] < theirs[1] - 0.01 && theirs[0] < mine[1] - 0.01 : theirs[0] <= low && low <= theirs[1]
  }
  const under = backingsFor(item, all).filter(overlaps)
  return under.find(other => other.id === item.on) ?? under.at(-1) ?? null
}

// Moves a piece hanging on `before` along with it to `after`, keeping where
// it is on that piece, so a panel taken to another wall takes what hangs on
// it round the corner too.
export function carryHanger(hanger: DecorationConfig, before: DecorationConfig, after: DecorationConfig) {
  const turn = (after.rotation ?? 0) - (before.rotation ?? 0)
  const a = (turn * Math.PI) / 180
  const dx = hanger.position[0] - before.position[0]
  const dy = hanger.position[1] - before.position[1]
  const round = (n: number) => Math.round(n * 100) / 100
  return {
    ...hanger,
    room: after.room,
    position: [
      round(after.position[0] + dx * Math.cos(a) - dy * Math.sin(a)),
      round(after.position[1] + dx * Math.sin(a) + dy * Math.cos(a)),
    ] as Point,
    rotation: ((((hanger.rotation ?? 0) + turn) % 360) + 360) % 360,
  }
}
