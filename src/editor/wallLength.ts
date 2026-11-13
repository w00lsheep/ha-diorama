// Walls set to an exact length, and walls whose length is locked.
//
// Wall i of a room runs from its corner i to corner i + 1. A locked wall
// keeps its length while corners and walls around it are dragged: a drag
// that would change it is held back. Typing a length into a wall is always
// allowed, locked or not, since that is a change made on purpose.
import { round } from '#/editor/view.ts'
import { isValidRoom } from '#/geometry/overlap.ts'
import type { Point, RoomConfig } from '#/types.ts'

// The shortest wall that can be typed in, in meters.
export const WALL_LEAST_M = 0.1
// How far a locked wall may drift from its length, to allow for rounding.
const HOLD_M = 0.0015

// Which end of a wall moves when its length is set: its first corner or
// the one after it.
export type WallEnd = 'start' | 'end'

export type WallLengthResult = { ok: true; points: Point[] } | { ok: false; reason: 'short' | 'locked' | 'invalid' }

export const wallLength = (points: Point[], index: number) => {
  const a = points[index]
  const b = points[(index + 1) % points.length]
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

export const isLocked = (room: RoomConfig, index: number) => room.locked_walls?.includes(index) ?? false

// Reads a length as typed: meters by default, with a comma or a point,
// or in centimeters or millimeters when it says so. Rounded to the
// centimeter. Anything else is null.
export function parseLength(text: string): number | null {
  const match = text
    .trim()
    .toLowerCase()
    .replace(',', '.')
    .match(/^(\d+(?:\.\d*)?|\.\d+)\s*(m|cm|mm)?$/)
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = match[2] ?? 'm'
  const meters = unit === 'cm' ? value / 100 : unit === 'mm' ? value / 1000 : value
  return Math.round(meters * 100) / 100
}

export const formatLength = (meters: number) => meters.toFixed(2)

// Whether every locked wall of a room is as long in `next` as in `from`,
// leaving out the wall at `except`.
export function holdsLocks(from: Point[], next: Point[], locked: number[] | undefined, except?: number) {
  if (!locked?.length || from.length !== next.length) return true
  return locked.every(
    i => i === except || i >= from.length || Math.abs(wallLength(next, i) - wallLength(from, i)) <= HOLD_M,
  )
}

// Sets wall `index` to `length`. The chosen end moves along the wall, and
// the wall that meets it there moves along with it, kept parallel, so the
// corners at both its ends keep their angles.
export function setWallLength(
  room: RoomConfig,
  index: number,
  length: number,
  end: WallEnd,
  others: Point[][],
): WallLengthResult {
  if (!(length >= WALL_LEAST_M)) return { ok: false, reason: 'short' }
  const points = room.points
  const n = points.length
  const current = wallLength(points, index)
  if (current < 1e-9) return { ok: false, reason: 'invalid' }
  const a = points[index]
  const b = points[(index + 1) % n]
  const ux = (b[0] - a[0]) / current
  const uy = (b[1] - a[1]) / current
  const delta = length - current
  // The corner that moves and the one past it, on the neighbouring wall.
  const moved = end === 'end' ? [(index + 1) % n, (index + 2) % n] : [index, (index - 1 + n) % n]
  const sign = end === 'end' ? 1 : -1
  const next = points.map((p, i) =>
    moved.includes(i) ? ([round(p[0] + sign * delta * ux), round(p[1] + sign * delta * uy)] as Point) : p,
  )
  if (!holdsLocks(points, next, room.locked_walls, index)) return { ok: false, reason: 'locked' }
  if (!isValidRoom(next, others)) return { ok: false, reason: 'invalid' }
  return { ok: true, points: next }
}

// The end to move by default: the end, unless the wall there is locked and
// the one at the start is not.
export function defaultEnd(room: RoomConfig, index: number): WallEnd {
  const n = room.points.length
  const atEnd = isLocked(room, (index + 1) % n)
  const atStart = isLocked(room, (index - 1 + n) % n)
  return atEnd && !atStart ? 'start' : 'end'
}

// The room with wall `index` locked or not, leaving out the list when no
// wall is locked, so a room without locks is saved as it always was.
export function withLock(room: RoomConfig, index: number, locked: boolean): RoomConfig {
  const rest = (room.locked_walls ?? []).filter(i => i !== index)
  const next = locked ? [...rest, index].sort((x, y) => x - y) : rest
  const { locked_walls: _dropped, ...plain } = room
  return next.length ? { ...plain, locked_walls: next } : plain
}

// The locks after the corners of a room changed. `map` gives, for each
// corner before, where it is now, or null when it was taken out. A wall
// stays locked only when both its corners are still there and still next
// to each other, so a wall split in two or joined with the next loses it.
export function remapLocks(room: RoomConfig, points: Point[], map: (number | null)[]): RoomConfig {
  const before = room.points.length
  const kept: number[] = []
  for (const i of room.locked_walls ?? []) {
    const from = map[i]
    const to = map[(i + 1) % before]
    if (from === null || to === null || from === undefined || to === undefined) continue
    if ((from + 1) % points.length === to) kept.push(from)
  }
  const { locked_walls: _dropped, ...plain } = room
  return kept.length ? { ...plain, points, locked_walls: kept.sort((x, y) => x - y) } : { ...plain, points }
}

// The room with a corner put in after corner `index`.
export const insertCorner = (room: RoomConfig, index: number, point: Point) =>
  remapLocks(
    room,
    [...room.points.slice(0, index + 1), point, ...room.points.slice(index + 1)],
    room.points.map((_, i) => (i <= index ? i : i + 1)),
  )

// The room with corner `index` taken out.
export const removeCorner = (room: RoomConfig, index: number) =>
  remapLocks(
    room,
    room.points.filter((_, i) => i !== index),
    room.points.map((_, i) => (i === index ? null : i < index ? i : i - 1)),
  )
