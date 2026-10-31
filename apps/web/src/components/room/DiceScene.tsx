import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  createThrow,
  DIE_SIZE,
  stepDie,
  THROW_TOTAL_S,
  type Bounds,
  type DieState,
} from '@/lib/dicePhysics'
import { loadDiceTextures } from '@/lib/diceTextures'
import { sfx } from '@/lib/sound'

/**
 * Real 3D (WebGL via three.js): a courtyard floor seen from standing height, a brass cup in the
 * middle, six dice with lights and shadows. `stage` drives it: the cup rattles, then tips and
 * the dice fly, bounce off the floor and the edges, tumble and come to rest on the faces the
 * server rolled. Deterministic per round so every player sees the same throw.
 */

export type SceneStage = 'shaking' | 'thrown' | 'settled'

interface DiceSceneProps {
  stage: SceneStage
  dice: GameSymbol[]
  roundId: string
}

// Phones (portrait) look down more steeply from higher up so the narrow floor still fits six dice.
const placeCamera = (camera: THREE.PerspectiveCamera, aspect: number) => {
  camera.aspect = aspect
  if (aspect < 0.9) {
    camera.fov = 55
    camera.position.set(0, 16, 6.5)
  } else {
    camera.fov = 42
    camera.position.set(0, 12.5, 9.5)
  }
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
}

// Where the screen corners hit the floor (y = half a die), shrunk a little so dice stay in view.
const floorBounds = (camera: THREE.PerspectiveCamera): Bounds => {
  const hit = (nx: number, ny: number) => {
    const ray = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize()
    const k = (DIE_SIZE / 2 - camera.position.y) / ray.y
    return camera.position.clone().addScaledVector(ray, k)
  }
  const corners = [hit(-1, -1), hit(1, -1), hit(1, 1), hit(-1, 1)]
  const halfW = Math.min(...corners.map((c) => Math.abs(c.x))) * 0.9
  const zs = corners.map((c) => c.z)
  const zMin = Math.min(...zs)
  const zMax = Math.max(...zs)
  // keep clear of the very top (far) edge and the result caption at the bottom
  return { halfW, zMin: zMin + (zMax - zMin) * 0.12, zMax: zMax - (zMax - zMin) * 0.14 }
}

export default function DiceScene({ stage, dice, roundId }: DiceSceneProps) {
  const mount = useRef<HTMLDivElement>(null)
  const stageRef = useRef(stage)
  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  useEffect(() => {
    const host = mount.current
    if (!host) return
    let disposed = false

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    placeCamera(camera, host.clientWidth / Math.max(1, host.clientHeight))

    scene.add(new THREE.HemisphereLight(0xfff1d6, 0x3a1a10, 0.9))
    const sun = new THREE.DirectionalLight(0xffe9c0, 2.2)
    sun.position.set(-6, 14, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = sun.shadow.camera.bottom = -18
    sun.shadow.camera.right = sun.shadow.camera.top = 18
    sun.shadow.camera.far = 40
    scene.add(sun)

    // Floor: the dark cloth of the courtyard, receives the dice shadows.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x5a1f16, roughness: 0.95, metalness: 0 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Brass cup.
    const cup = new THREE.Group()
    const brass = new THREE.MeshStandardMaterial({
      color: 0xc9a23a,
      metalness: 0.8,
      roughness: 0.35,
    })
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.75, 1.9, 32, 1, true), brass)
    cupBody.material.side = THREE.DoubleSide
    const cupBottom = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), brass)
    cupBottom.rotation.x = Math.PI / 2
    cupBottom.position.y = -0.95
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 32), brass)
    lid.position.y = 1
    cup.add(cupBody, cupBottom, lid)
    cup.position.set(0, 0.95, 0)
    cup.castShadow = true
    cupBody.castShadow = true
    scene.add(cup)

    let bounds = floorBounds(camera)
    let dieMeshes: THREE.Mesh[] = []
    let states: DieState[] = []
    let throwStartedAt: number | null = null
    let rolledSound = false
    const geometry = new THREE.BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 2, 2, 2)

    void loadDiceTextures().then((textures) => {
      if (disposed) return
      const materials = SYMBOLS.map(
        (s) =>
          new THREE.MeshStandardMaterial({ map: textures[s], roughness: 0.45, metalness: 0.05 }),
      )
      dieMeshes = dice.map(() => {
        const mesh = new THREE.Mesh(geometry, materials)
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.visible = false
        scene.add(mesh)
        return mesh
      })
    })

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      renderer.setSize(w, h)
      placeCamera(camera, w / Math.max(1, h))
      // Only matters before the throw; a throw in progress keeps its bounds.
      if (throwStartedAt === null) bounds = floorBounds(camera)
    }
    resize()
    window.addEventListener('resize', resize)

    const startedAt = performance.now()
    let last = 0
    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      const now = (performance.now() - startedAt) / 1000
      const dt = Math.min(0.033, now - last)
      last = now
      const current = stageRef.current

      if (current === 'shaking') {
        // Rattle the cup with the lid on.
        cup.rotation.set(Math.sin(now * 40) * 0.12, 0, Math.cos(now * 37) * 0.12)
        cup.position.set(Math.sin(now * 33) * 0.15, 0.95 + Math.abs(Math.sin(now * 46)) * 0.12, 0)
        lid.visible = true
      } else {
        if (throwStartedAt === null) {
          throwStartedAt = now
          states = createThrow(roundId, dice, bounds)
          dieMeshes.forEach((m) => {
            m.visible = true
          })
        }
        // Cup tips over and rolls aside.
        const tip = Math.min(1, (now - throwStartedAt) / 0.45)
        cup.rotation.set(0, 0, -2.1 * tip)
        cup.position.set(-2.2 * tip, 0.95 - 0.35 * tip, 1.2 * tip)
        lid.visible = tip < 0.3

        const t = now - throwStartedAt
        const hitFloor = states
          .map((die, i) => {
            const hit = stepDie(die, t, dt, bounds)
            const mesh = dieMeshes[i]
            if (mesh) {
              mesh.position.copy(die.position)
              mesh.quaternion.copy(die.orientation)
            }
            return hit
          })
          .some(Boolean)
        if (hitFloor && t < THROW_TOTAL_S) sfx('tick')
        if (!rolledSound && t > 0.05) {
          rolledSound = true
          sfx('clatter')
        }
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      geometry.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
    // The scene is built once per round; stage changes flow through stageRef.
  }, [dice, roundId])

  return <div ref={mount} className="absolute inset-0" />
}
