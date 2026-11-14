import { lean } from '#/lib/devSettings.ts'
import { REST_MS } from '#/scene/rest.ts'

// Home Assistant hands every card the whole state on every change anywhere
// in the home, a power meter ticking, a phone's battery, and each time the
// card's whole tree is drawn again. On a tablet that takes about as long as
// a frame, so a turn of the home stuttered whenever something reported in.
// In performance mode a change that comes while the camera moves is held
// back until it rests, and the card is then drawn once with the latest
// state. Nothing is lost, only drawn a moment later, and never later than
// HOLD_MAX_MS after it came.

const HOLD_MAX_MS = 1500

// When a camera of any card on the page last moved.
let movedAt = -Infinity

export function moved() {
  movedAt = performance.now()
}

type Held = { since: number; timer: ReturnType<typeof setTimeout> | undefined }

const held = new Map<object, Held>()

// Whether a change for `key` is to wait. If so `apply` is called once the
// cameras rest, with whatever came last by then. A change that does not
// wait takes the place of one that was waiting.
export function hold(key: object, apply: () => void): boolean {
  const now = performance.now()
  const waiting = held.get(key)
  const due = !lean() || now - movedAt >= REST_MS || (!!waiting && now - waiting.since >= HOLD_MAX_MS)
  if (due) {
    if (waiting) {
      clearTimeout(waiting.timer)
      held.delete(key)
    }
    return false
  }
  if (waiting) return true
  const entry: Held = { since: now, timer: undefined }
  const check = () => {
    const t = performance.now()
    const rest = REST_MS - (t - movedAt)
    const left = HOLD_MAX_MS - (t - entry.since)
    if (rest > 0 && left > 0) {
      entry.timer = setTimeout(check, Math.min(rest, left) + 5)
      return
    }
    held.delete(key)
    apply()
  }
  entry.timer = setTimeout(check, Math.min(REST_MS - (now - movedAt), HOLD_MAX_MS) + 5)
  held.set(key, entry)
  return true
}
