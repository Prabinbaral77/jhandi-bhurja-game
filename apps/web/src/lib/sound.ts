import type { SoundReaction } from '@jhandi/protocol/room'
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
  // "Yaa-hoo!" — a rising shout, a falling whoop, then a little fanfare.
  win: (ac) => {
    voice(ac, {
      duration: 0.28,
      pitch: 300,
      pitchTo: 430,
      formant: 800,
      formantTo: 1_200,
      gain: 0.3,
    })
    voice(ac, {
      at: 0.3,
      duration: 0.6,
      pitch: 560,
      pitchTo: 380,
      formant: 520,
      formantTo: 360,
      gain: 0.32,
      vibrato: 10,
    })
    ;[523, 659, 784, 1_046].forEach((f, i) => {
      tone(ac, { freq: f, at: 0.95 + i * 0.09, duration: 0.25, type: 'triangle', gain: 0.14 })
    })
  },
  // Lost the round: the same wailing cry players can send as a reaction.
  lose: (ac) => {
    reactions.cry(ac)
  },
  tick: (ac) => {
    tone(ac, { freq: 1_200, duration: 0.04, gain: 0.05 })
  },
}

// ---------- Player reaction sounds (docs/progress.md: "fun sounds") ----------

// A "voice": two detuned oscillators through a resonant bandpass (a crude formant), with
// pitch and formant glides. Enough for wow / ooh / boo / cry / laugh caricatures.
const voice = (
  ac: AudioContext,
  {
    at = 0,
    duration,
    pitch,
    pitchTo = pitch,
    formant,
    formantTo = formant,
    gain = 0.25,
    type = 'sawtooth',
    vibrato = 0,
  }: {
    at?: number
    duration: number
    pitch: number
    pitchTo?: number
    formant: number
    formantTo?: number
    gain?: number
    type?: OscillatorType
    vibrato?: number
  },
) => {
  const t0 = ac.currentTime + at
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 4
  filter.frequency.setValueAtTime(formant, t0)
  filter.frequency.exponentialRampToValueAtTime(formantTo, t0 + duration)
  const vol = ac.createGain()
  vol.gain.setValueAtTime(0.0001, t0)
  vol.gain.exponentialRampToValueAtTime(gain, t0 + 0.05)
  vol.gain.setValueAtTime(gain, t0 + duration * 0.7)
  vol.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  filter.connect(vol).connect(ac.destination)
  for (const detune of [-6, 6]) {
    const osc = ac.createOscillator()
    osc.type = type
    osc.detune.value = detune
    osc.frequency.setValueAtTime(pitch, t0)
    osc.frequency.exponentialRampToValueAtTime(pitchTo, t0 + duration)
    if (vibrato > 0) {
      const lfo = ac.createOscillator()
      const depth = ac.createGain()
      lfo.frequency.value = 6
      depth.gain.value = vibrato
      lfo.connect(depth).connect(osc.frequency)
      lfo.start(t0)
      lfo.stop(t0 + duration + 0.05)
    }
    osc.connect(filter)
    osc.start(t0)
    osc.stop(t0 + duration + 0.05)
  }
}

const reactions: Record<SoundReaction, (ac: AudioContext) => void> = {
  // "Wooow!" rising then falling, bright formant.
  wow: (ac) => {
    voice(ac, { duration: 0.35, pitch: 180, pitchTo: 300, formant: 500, formantTo: 1_300 })
    voice(ac, {
      at: 0.33,
      duration: 0.5,
      pitch: 300,
      pitchTo: 160,
      formant: 1_300,
      formantTo: 450,
      vibrato: 8,
    })
  },
  // Disappointed "ooooh" sliding down.
  ooh: (ac) => {
    voice(ac, { duration: 0.8, pitch: 240, pitchTo: 120, formant: 450, formantTo: 320, vibrato: 5 })
  },
  // "Ha ha ha ha": short staccato puffs going down.
  laugh: (ac) => {
    ;[0, 0.17, 0.34, 0.5, 0.66].forEach((at, i) => {
      voice(ac, {
        at,
        duration: 0.14,
        pitch: 260 - i * 18,
        pitchTo: 220 - i * 18,
        formant: 900,
        formantTo: 700,
        gain: 0.22,
      })
    })
  },
  // Wailing cry: wobbling pitch, sliding down, twice.
  cry: (ac) => {
    voice(ac, {
      duration: 0.6,
      pitch: 420,
      pitchTo: 300,
      formant: 700,
      formantTo: 500,
      vibrato: 25,
      type: 'triangle',
      gain: 0.3,
    })
    voice(ac, {
      at: 0.65,
      duration: 0.7,
      pitch: 400,
      pitchTo: 240,
      formant: 650,
      formantTo: 420,
      vibrato: 30,
      type: 'triangle',
      gain: 0.3,
    })
  },
  // Duck: nasal buzz with a quick pitch drop, twice.
  quack: (ac) => {
    for (const at of [0, 0.22]) {
      voice(ac, {
        at,
        duration: 0.16,
        pitch: 330,
        pitchTo: 220,
        formant: 1_400,
        formantTo: 900,
        gain: 0.3,
      })
    }
  },
  // Low sputtering buzz falling in pitch, with a little rumble.
  fart: (ac) => {
    const t0 = ac.currentTime
    const osc = ac.createOscillator()
    const vol = ac.createGain()
    const filter = ac.createBiquadFilter()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(110, t0)
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.55)
    filter.type = 'lowpass'
    filter.frequency.value = 500
    // Amplitude flutter = the sputter.
    const lfo = ac.createOscillator()
    const depth = ac.createGain()
    lfo.type = 'square'
    lfo.frequency.setValueAtTime(28, t0)
    lfo.frequency.linearRampToValueAtTime(12, t0 + 0.55)
    depth.gain.value = 0.18
    vol.gain.setValueAtTime(0.0001, t0)
    vol.gain.exponentialRampToValueAtTime(0.3, t0 + 0.03)
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6)
    lfo.connect(depth).connect(vol.gain)
    osc.connect(filter).connect(vol).connect(ac.destination)
    osc.start(t0)
    lfo.start(t0)
    osc.stop(t0 + 0.65)
    lfo.stop(t0 + 0.65)
    noise(ac, { duration: 0.5, gain: 0.12, freq: 300 })
  },
  // Applause: a crowd of random claps over a second and a half.
  applause: (ac) => {
    for (let i = 0; i < 40; i++) {
      noise(ac, {
        at: Math.random() * 1.5,
        duration: 0.04,
        gain: 0.12 + Math.random() * 0.1,
        freq: 1_500 + Math.random() * 2_000,
      })
    }
  },
  // Crowd "booo": low, dark, long.
  boo: (ac) => {
    voice(ac, { duration: 0.9, pitch: 150, pitchTo: 110, formant: 380, formantTo: 300, gain: 0.3 })
    voice(ac, {
      at: 0.05,
      duration: 0.9,
      pitch: 165,
      pitchTo: 120,
      formant: 400,
      formantTo: 320,
      gain: 0.2,
    })
  },
  // Dhol beat: deep thump + bright tap, Dashain style "dhin ta dhin dhin ta".
  dhol: (ac) => {
    const beats: Array<[number, 'low' | 'high']> = [
      [0, 'low'],
      [0.18, 'high'],
      [0.36, 'low'],
      [0.5, 'low'],
      [0.68, 'high'],
    ]
    for (const [at, kind] of beats) {
      if (kind === 'low') {
        tone(ac, { freq: 160, at, duration: 0.25, type: 'sine', gain: 0.5, slideTo: 60 })
      } else {
        noise(ac, { at, duration: 0.05, gain: 0.35, freq: 2_500 })
        tone(ac, { freq: 900, at, duration: 0.06, type: 'triangle', gain: 0.15, slideTo: 600 })
      }
    }
  },
  // Wolf whistle: up, then up-and-down.
  whistle: (ac) => {
    tone(ac, { freq: 900, duration: 0.3, type: 'sine', gain: 0.2, slideTo: 1_800 })
    tone(ac, { freq: 1_800, at: 0.35, duration: 0.45, type: 'sine', gain: 0.2, slideTo: 700 })
  },
  // Kiss: a lip pop and a tiny chirp.
  kiss: (ac) => {
    noise(ac, { duration: 0.05, gain: 0.35, freq: 900 })
    tone(ac, { freq: 1_400, at: 0.04, duration: 0.12, type: 'sine', gain: 0.15, slideTo: 2_200 })
  },
  // A handful of coins poured out.
  coins: (ac) => {
    for (let i = 0; i < 9; i++) {
      tone(ac, {
        freq: 1_700 + Math.random() * 1_400,
        at: i * 0.07 + Math.random() * 0.03,
        duration: 0.12,
        gain: 0.1,
      })
    }
  },
}

export const reactionSfx = (name: SoundReaction): void => {
  if (useSoundStore.getState().muted) return
  const ac = context()
  if (!ac) return
  try {
    reactions[name](ac)
  } catch {
    // Autoplay policy or no output device: stay silent.
  }
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
