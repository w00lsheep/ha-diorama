// Performance mode, on a phone or tablet, spends its frames where they are
// seen. While the camera moves the picture is drawn plainly: no shading
// where things meet and no smoothing of edges, which on a large tablet are
// most of a frame's work and which nobody can make out on a picture in
// motion. Once the camera has come to rest one more frame is drawn with
// both, the shading easing in, and that frame is what stays on the wall.
//
// The density the picture is drawn at is also judged against the pace
// performance mode keeps, rather than against the fastest frame seen,
// which on a device that never reaches that pace never asked for a step
// down.

import { PERFORMANCE_MAX_FPS } from '#/constants.ts'
import type { Camera } from 'three'

// How long the camera has to stand still before the finished frame is drawn.
export const REST_MS = 250

// How long the shading where things meet takes to come back once the
// camera rests.
export const SHADE_IN_S = 0.3

// The densities performance mode tries, finest last, and the one it starts
// at. A large tablet at its full density draws four times the pixels of one
// at a density of one, for a chip that cannot keep up.
export const LEAN_STEPS = [0.75, 1, 1.25, 1.5]
export const LEAN_START = 1.25

// The time a frame has at performance mode's pace. Frames are late when
// they take this much longer on average, and comfortable when they take at
// most this much longer.
export const LEAN_BUDGET_MS = 1000 / PERFORMANCE_MAX_FPS
export const LEAN_LATE = 1.2
export const LEAN_EASY = 1.05
// A gap longer than this is the camera taking off, not a slow frame.
export const LEAN_IDLE_MS = 250
// How many frames drawn in motion are averaged before a step is taken.
export const LEAN_WINDOW = 16

type Watch = { seen: Float64Array; at: number; timer: ReturnType<typeof setTimeout> | undefined }

// Each card watches its own camera.
const watches = new WeakMap<Camera, Watch>()

// Whether the camera has moved within the last REST_MS. Asked on every
// frame drawn: when it moves, the frame after it comes to rest is asked
// for, since nothing else would draw it.
export function inMotion(camera: Camera, invalidate: () => void): boolean {
  camera.updateMatrixWorld()
  const m = camera.matrixWorld.elements
  const p = camera.projectionMatrix.elements
  let w = watches.get(camera)
  if (!w) {
    w = { seen: new Float64Array(32), at: -Infinity, timer: undefined }
    w.seen.set(m, 0)
    w.seen.set(p, 16)
    watches.set(camera, w)
    return false
  }
  let changed = false
  for (let i = 0; i < 16; i++)
    if (w.seen[i] !== m[i] || w.seen[16 + i] !== p[i]) {
      changed = true
      break
    }
  const now = performance.now()
  if (changed) {
    w.seen.set(m, 0)
    w.seen.set(p, 16)
    w.at = now
    clearTimeout(w.timer)
    w.timer = setTimeout(invalidate, REST_MS + 20)
  }
  return now - w.at < REST_MS
}

// Whether the camera was in motion on the last frame drawn, without asking
// anything of it.
export function moving(camera: Camera): boolean {
  const w = watches.get(camera)
  return !!w && performance.now() - w.at < REST_MS
}
