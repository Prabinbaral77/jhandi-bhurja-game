import { create } from 'zustand'

/**
 * Sound effects synthesised with the Web Audio API — no audio files to download, and nothing
 * copyrighted. A licensed Malshree dhun recording can be added later (docs/progress.md tech debt).
 */

type Sfx = 'coin' | 'cancel' | 'shake' | 'clatter' | 'reveal' | 'win' | 'lose' | 'tick'

const readMuted = (): boolean => {
  try {
    return localStorage.getItem('muted') === '1'
  } catch {
    return false
  }
}

interface SoundStore {
  muted: boolean
  toggle: () => void
}

export const useSoundStore = create<SoundStore>((set) => ({
  muted: readMuted(),
  toggle: () => {
    set((s) => {
      const muted = !s.muted
      try {
        localStorage.setItem('muted', muted ? '1' : '0')
      } catch {
        // Private mode: not remembered.
      }
      return { muted }
    })
  },
}))

let ctx: AudioContext | null = null
const context = (): AudioContext | null => {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

const tone = (
  ac: AudioContext,
  {
    freq,
    at = 0,
    duration = 0.15,
    type = 'sine',
    gain = 0.2,
    slideTo,
  }: {
    freq: number
    at?: number
    duration?: number
    type?: OscillatorType
    gain?: number
    slideTo?: number
  },
) => {
  const osc = ac.createOscillator()
  const vol = ac.createGain()
  const t0 = ac.currentTime + at
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration)
  vol.gain.setValueAtTime(0.0001, t0)
  vol.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  vol.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(vol).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

// Short burst of filtered noise: dice rattling in a bowl / a wooden tap.
const noise = (ac: AudioContext, { at = 0, duration = 0.08, gain = 0.25, freq = 1_800 }) => {
  const length = Math.ceil(ac.sampleRate * duration)
  const buffer = ac.createBuffer(1, length, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 0.8
  const vol = ac.createGain()
  vol.gain.value = gain
  src.connect(filter).connect(vol).connect(ac.destination)
  src.start(ac.currentTime + at)
}

const play: Record<Sfx, (ac: AudioContext) => void> = {
  coin: (ac) => {
    tone(ac, { freq: 1_900, duration: 0.09, gain: 0.12 })
    tone(ac, { freq: 2_600, at: 0.03, duration: 0.12, gain: 0.08 })
  },
  cancel: (ac) => {
    tone(ac, { freq: 900, duration: 0.1, gain: 0.1, slideTo: 500 })
  },
  shake: (ac) => {
    for (let i = 0; i < 14; i++)
      noise(ac, { at: i * 0.11 + Math.random() * 0.03, freq: 1_200 + Math.random() * 1_600 })
  },
  // Dice hitting the cloth and each other after the throw.
  clatter: (ac) => {
    for (let i = 0; i < 10; i++) {
      noise(ac, {
        at: 0.05 + i * 0.09 + Math.random() * 0.05,
        duration: 0.05,
        gain: 0.3 - i * 0.02,
        freq: 500 + Math.random() * 500,
      })
    }
  },
  reveal: (ac) => {
    noise(ac, { duration: 0.06, gain: 0.3, freq: 700 })
    tone(ac, { freq: 220, duration: 0.12, type: 'triangle', gain: 0.15 })
  },
  win: (ac) => {
    ;[523, 659, 784, 1_046].forEach((f, i) => {
      tone(ac, { freq: f, at: i * 0.09, duration: 0.25, type: 'triangle', gain: 0.18 })
    })
  },
  lose: (ac) => {
    tone(ac, { freq: 180, duration: 0.3, type: 'sawtooth', gain: 0.08, slideTo: 90 })
  },
  tick: (ac) => {
    tone(ac, { freq: 1_200, duration: 0.04, gain: 0.05 })
  },
}

export const sfx = (name: Sfx): void => {
  if (useSoundStore.getState().muted) return
  const ac = context()
  if (!ac) return
  try {
    play[name](ac)
  } catch {
    // Autoplay policy or no output device: stay silent.
  }
}
