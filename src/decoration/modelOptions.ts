import type { DecorationParam } from '#/decoration/catalog.ts'
import { modelOf } from '#/decoration/models.ts'
import type { ModelBox, ModelConfig, ModelOption } from '#/types.ts'

// The parts of an imported model a piece can have or leave out, tagged
// `[opt <name>]` in the file, like a monitor's stand or a speaker's cover.
// Each option is a switch in the item panel, saved in the piece's params
// like a sofa's chaise longue, so two pieces placed from one model can
// differ. A model without its stand would float where the stand held it,
// so it is moved to rest on what is left of it: on the floor, against the
// wall or up to the ceiling, by where it is mounted.

const PREFIX = 'opt:'
export const optionParamId = (name: string) => `${PREFIX}${name}`

export const isBox = (box: unknown): box is ModelBox =>
  Array.isArray(box) && box.length === 6 && box.every(n => typeof n === 'number' && Number.isFinite(n))

// The options as read back from the card config, leaving out any a hand
// edited config got wrong.
export function cleanOptions(options: unknown): ModelOption[] {
  if (!Array.isArray(options)) return []
  const seen = new Set<string>()
  return options.filter((o): o is ModelOption => {
    if (!o || typeof o !== 'object' || typeof o.name !== 'string' || !o.name || !isBox(o.box)) return false
    if (seen.has(o.name)) return false
    seen.add(o.name)
    return true
  })
}

// One switch for each option, after the sizes.
export const optionParams = (model: ModelConfig): DecorationParam[] =>
  cleanOptions(model.options).map(o => ({
    id: optionParamId(o.name),
    label: o.name,
    default: o.on ? 1 : 0,
    min: 0,
    max: 1,
    step: 1,
    unit: '',
    toggle: true,
  }))

// Whether a part or a top of an option is there on a piece with these params.
export function optionShown(model: ModelConfig, option: string | undefined, params?: Record<string, number>) {
  if (!option) return true
  const own = cleanOptions(model.options).find(o => o.name === option)
  if (!own) return true
  const saved = params?.[optionParamId(option)]
  return saved === undefined ? own.on : saved > 0.5
}

// How far the model moves, in its own frame at its own size, to rest on
// the parts it still has: down onto the floor or whatever it stands on,
// back to the wall with its lowest edge where its height off the floor
// says, or up to the ceiling. Nothing moves while every option is on, or
// when the options leave nothing.
export function optionShift(model: ModelConfig, params?: Record<string, number>): [number, number, number] {
  const options = cleanOptions(model.options)
  if (options.length === 0) return [0, 0, 0]
  const shown = options.filter(o => optionShown(model, o.name, params))
  if (shown.length === options.length) return [0, 0, 0]
  const boxes: ModelBox[] = shown.map(o => o.box)
  if (isBox(model.base)) boxes.push(model.base)
  if (boxes.length === 0) return [0, 0, 0]
  const [, d, h] = model.size
  const low = Math.min(...boxes.map(b => b[1]))
  const high = Math.max(...boxes.map(b => b[4]))
  const back = Math.min(...boxes.map(b => b[2]))
  if (model.mount === 'ceiling') return [0, h - high, 0]
  if (model.mount === 'wall') return [0, -low, -d / 2 - back]
  return [0, -low, 0]
}

// The options a piece leaves out, one name a line, which stays the same
// string while its switches do.
export function leftOut(kindId: string, params?: Record<string, number>) {
  const model = modelOf(kindId)
  if (!model) return ''
  return cleanOptions(model.options)
    .filter(o => !optionShown(model, o.name, params))
    .map(o => o.name)
    .join('\n')
}
