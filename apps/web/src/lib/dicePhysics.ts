import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import { Quaternion, Vector3 } from 'three'

/**
 * Small deterministic rigid-body-ish simulation for six dice: gravity, floor and wall bounces,
 * tumbling, then a guided settle so each die ends on the face the server rolled. Pure maths, no
 * rendering, so the same seed gives the same throw on every client.
 */

export const DIE_SIZE = 1
const HALF = DIE_SIZE / 2
const GRAVITY = -34
const RESTITUTION = 0.42
const FRICTION = 0.78
export const FREE_FLIGHT_S = 1.25 // pure physics
export const SETTLE_S = 1.1 // guided into the final face
export const THROW_TOTAL_S = FREE_FLIGHT_S + SETTLE_S

// BoxGeometry material order: +x, -x, +y, -y, +z, -z — one symbol per face, SYMBOLS order.
export const FACE_NORMALS: Vector3[] = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
]
const UP = new Vector3(0, 1, 0)

export const faceIndexOf = (symbol: GameSymbol): number => SYMBOLS.indexOf(symbol)

// Orientation that puts `symbol` on top, turned by `yaw` radians about the vertical.
export const faceUpQuaternion = (symbol: GameSymbol, yaw: number): Quaternion => {
  const normal = FACE_NORMALS[faceIndexOf(symbol)] ?? UP
  const toUp = new Quaternion().setFromUnitVectors(normal, UP)
  const spin = new Quaternion().setFromAxisAngle(UP, yaw)
  return spin.multiply(toUp)
}

export interface DieState {
  position: Vector3
  velocity: Vector3
  orientation: Quaternion
  // Axis-angle spin per second.
  spinAxis: Vector3
  spinSpeed: number
  target: Vector3
  targetOrientation: Quaternion
  // Where the guided phase started from, for smooth blending.
  settleFrom?: { position: Vector3; orientation: Quaternion }
  // Seconds this die waits in the cup before it flies.
  delay: number
}

// The part of the floor the camera can see: x is symmetric, z runs from the far edge (top of
// the screen, negative) to the near edge (bottom, positive).
export interface Bounds {
  halfW: number
  zMin: number
  zMax: number
  // Tall phone screen: lay the six dice out 2 across × 3 deep instead of 3 × 2.
  portrait?: boolean
}

const mulberry = (seed: string) => {
  let h = 1779033703
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353)
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

// Six landing spots spread over the floor, deterministic per round.
export const createThrow = (seed: string, dice: GameSymbol[], bounds: Bounds): DieState[] => {
  const rand = mulberry(seed)
  const slots = [0, 1, 2, 3, 4, 5].sort(() => rand() - 0.5)
  const cols = bounds.portrait ? 2 : 3
  const rows = 6 / cols
  return dice.map((symbol, i) => {
    const slot = slots[i] ?? i
    const col = slot % cols
    const row = Math.floor(slot / cols)
    const zSpan = bounds.zMax - bounds.zMin
    // Grid cell centres with a little jitter, inside the visible floor.
    const cx = ((col + 0.5) / cols) * 2 - 1
    const cz = (row + 0.5) / rows
    const target = new Vector3(
      (cx * 0.62 + (rand() - 0.5) * 0.25) * bounds.halfW,
      HALF,
      bounds.zMin + zSpan * (cz + (rand() - 0.5) * (0.5 / rows)),
    )
    // Launch from the cup at the centre, fast and high, roughly toward the target.
    const dir = target.clone().setY(0).normalize()
    const speed = 7 + rand() * 4
    const velocity = new Vector3(dir.x * speed, 9 + rand() * 4, dir.z * speed)
    const spinAxis = new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize()
    return {
      position: new Vector3(0, 1.6, 0),
      velocity,
      orientation: new Quaternion().setFromAxisAngle(spinAxis, rand() * Math.PI * 2),
      spinAxis,
      spinSpeed: 14 + rand() * 10,
      target,
      targetOrientation: faceUpQuaternion(symbol, (rand() - 0.5) * 1.2),
      delay: rand() * 0.25,
    }
  })
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Advances one die to time `t` (seconds since the throw started) by `dt`. Returns true when
 * the die hit the floor this step (for sound). Free physics first, then a guided blend that
 * keeps the bounces but steers position and spin into the final resting pose.
 */
export const stepDie = (die: DieState, t: number, dt: number, bounds: Bounds): boolean => {
  const local = t - die.delay
  if (local <= 0) return false
  let hit = false

  if (local < FREE_FLIGHT_S) {
    die.velocity.y += GRAVITY * dt
    die.position.addScaledVector(die.velocity, dt)
    const spin = new Quaternion().setFromAxisAngle(die.spinAxis, die.spinSpeed * dt)
    die.orientation.premultiply(spin)
    if (die.position.y < HALF) {
      die.position.y = HALF
      if (die.velocity.y < -1) hit = true
      die.velocity.y = -die.velocity.y * RESTITUTION
      die.velocity.x *= FRICTION
      die.velocity.z *= FRICTION
      die.spinSpeed *= 0.7
    }
    const limitX = bounds.halfW - HALF
    if (Math.abs(die.position.x) > limitX) {
      die.position.x = Math.sign(die.position.x) * limitX
      die.velocity.x *= -RESTITUTION
      hit = true
    }
    if (die.position.z < bounds.zMin + HALF) {
      die.position.z = bounds.zMin + HALF
      die.velocity.z *= -RESTITUTION
      hit = true
    } else if (die.position.z > bounds.zMax - HALF) {
      die.position.z = bounds.zMax - HALF
      die.velocity.z *= -RESTITUTION
      hit = true
    }
    return hit
  }

  // Guided settle: ease from wherever physics left the die into the exact final pose, with two
  // fading hops so it still reads as a die coming to rest.
  die.settleFrom ??= { position: die.position.clone(), orientation: die.orientation.clone() }
  const u = Math.min(1, (local - FREE_FLIGHT_S) / SETTLE_S)
  const e = easeOut(u)
  die.position.lerpVectors(die.settleFrom.position, die.target, e)
  const hop = Math.abs(Math.sin(u * Math.PI * 2)) * (1 - u) * 0.9
  die.position.y = HALF + hop
  die.orientation.slerpQuaternions(die.settleFrom.orientation, die.targetOrientation, e)
  return false
}
