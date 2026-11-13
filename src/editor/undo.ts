import type { CardConfig } from '#/types.ts'
import { useEffect, useRef } from 'react'

// How many steps back the editor remembers.
const LIMIT = 200
// Changes closer together than this are one step, so a held arrow key or a
// name typed letter by letter is taken back at once.
const MERGE_MS = 600

// What a config holds, to tell a real change from the same config handed
// back again, as Home Assistant does once it has heard of a change. A
// model's mesh is long, so only its length is looked at.
function fingerprint(config: CardConfig): string {
  return JSON.stringify(config, (key, value) =>
    (key === 'vertices' || key === 'triangles') && typeof value === 'string' ? value.length : value,
  )
}

type Step = { config: CardConfig; key: string; at: number }

// Undo and redo for the editor. Every config the editor is given is a step,
// whatever made it, and undo hands the one before back through `onChange`,
// so the editor picks it up as it does an edit made in the YAML.
export function useUndo(config: CardConfig, onChange: (config: CardConfig) => void) {
  const past = useRef<CardConfig[]>([])
  const future = useRef<CardConfig[]>([])
  const current = useRef<Step>({ config, key: fingerprint(config), at: 0 })

  useEffect(() => {
    const key = fingerprint(config)
    const now = Date.now()
    const step = current.current
    if (key === step.key) {
      step.config = config
      return
    }
    if (now - step.at > MERGE_MS) {
      past.current.push(step.config)
      if (past.current.length > LIMIT) past.current.shift()
    }
    future.current = []
    current.current = { config, key, at: now }
  }, [config])

  const go = (from: { current: CardConfig[] }, to: { current: CardConfig[] }) => {
    const target = from.current.pop()
    if (!target) return false
    to.current.push(current.current.config)
    // At zero, the next change after this one is a step of its own.
    current.current = { config: target, key: fingerprint(target), at: 0 }
    onChange(target)
    return true
  }

  return {
    undo: () => go(past, future),
    redo: () => go(future, past),
  }
}
