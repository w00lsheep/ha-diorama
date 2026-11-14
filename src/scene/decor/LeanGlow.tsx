import { LAMP_KEY_SHARE, LAMP_THROUGH_SHARE } from '#/theme.ts'
import type { PointLight } from 'three'
import type { Ref } from 'react'

// A lamp in performance mode. In full a lamp is two point lights, the bulb
// and what comes through its shade, and a strip is a rect area light. Every
// pixel of every material loops over every light in the scene, and a rect
// area light is the dearest of them, so on a tablet a flat with its lamps
// on spent most of a frame on the lights. Here a lamp is one point light
// carrying both shares, and a strip is a point light in its middle. The
// room is lit about as brightly and in the same color, only the wash under
// a strip is rounder.

type Props = {
  ref: Ref<PointLight>
  at: [number, number, number]
  color: [number, number, number]
  // The lamp's whole output, before it is shared out.
  total: number
  // What the bulb is heading for, to rank the lamps that may cast.
  rank: number
  shown: boolean
  strip: boolean
}

// A strip's wash, against a lamp's, for the same output. The rect area
// light is four times the output, spread along the strip.
const STRIP_SHARE = 1

export default function LeanGlow({ ref, at, color, total, rank, shown, strip }: Props) {
  const share = strip ? STRIP_SHARE : LAMP_KEY_SHARE + LAMP_THROUGH_SHARE
  return (
    <pointLight
      ref={ref}
      position={strip ? [at[0], at[1] - 0.05, at[2]] : at}
      color={color}
      intensity={total * share}
      distance={7}
      decay={1.2}
      visible={shown}
      userData={{ rank }}
    />
  )
}
