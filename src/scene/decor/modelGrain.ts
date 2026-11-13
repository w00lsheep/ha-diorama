import { BufferAttribute, type BufferGeometry } from 'three'

// Wood grain on an imported model. A part painted with the wood finish wears
// the card's own procedural oak, the one furniture floors use, so it gets
// coordinates for it here: each face is projected onto the side of the
// part's box it faces most, in meters, so the grain keeps one physical scale
// however large the part is. The grain runs along the part's longest side,
// as it does on a board, a slat or a table top.

// The axis of the part's box that its grain runs along: its longest.
function grainAxis(geometry: BufferGeometry) {
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  const size = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z]
  return size.indexOf(Math.max(...size))
}

// Adds a `uv` attribute to a non indexed geometry with normals, as a model's
// part comes out of `partGeometry`. The texture's grain runs along u.
export function addGrainUVs(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  if (!position || !normal || geometry.index) return geometry
  const along = grainAxis(geometry)
  const uv = new Float32Array(position.count * 2)
  const p = [0, 0, 0]
  for (let tri = 0; tri < position.count; tri += 3) {
    // One projection for the whole face, so a face never tears in two.
    let nx = 0
    let ny = 0
    let nz = 0
    for (let k = 0; k < 3; k++) {
      nx += normal.getX(tri + k)
      ny += normal.getY(tri + k)
      nz += normal.getZ(tri + k)
    }
    const n = [Math.abs(nx), Math.abs(ny), Math.abs(nz)]
    const facing = n.indexOf(Math.max(...n))
    const [a, b] = [0, 1, 2].filter(axis => axis !== facing)
    // The grain's axis goes on u when the face shows it. A face across the
    // grain, the end of a board, keeps the first of its two axes.
    const u = a === along || b !== along ? a : b
    const v = u === a ? b : a
    for (let k = 0; k < 3; k++) {
      const i = tri + k
      p[0] = position.getX(i)
      p[1] = position.getY(i)
      p[2] = position.getZ(i)
      uv[i * 2] = p[u]
      uv[i * 2 + 1] = p[v]
    }
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  return geometry
}
