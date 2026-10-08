/** @jsxImportSource @opentui/solid */
import { BoxRenderable, MouseButton, MouseEvent, RGBA, TextAttributes } from "@opentui/core"
import { onBlur, useRenderer, type JSX } from "@opentui/solid"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { For, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { logo } from "./art"
import { createSound } from "./sfx"

type Theme = {
  primary: RGBA
  secondary: RGBA
  text: RGBA
  textMuted: RGBA
  background: RGBA
}

type Config = {
  sound: boolean
  volume: number
  chargeMs: number
  idle: boolean
  enhanced: boolean
}

type Ring = {
  x: number
  y: number
  at: number
  force: number
  kick: number
  speed: number
}

type Hold = {
  x: number
  y: number
  at: number
  glyph: number | undefined
}

type Release = Hold & {
  level: number
  rise: number
  speed: number
}

type Glow = {
  glyph: number
  at: number
  force: number
}

type Frame = {
  t: number
  list: Ring[]
  hold: Hold | undefined
  release: Release | undefined
  glow: Glow | undefined
  spark: number
}

type Trace = {
  glyph: number
  i: number
  l: number
}

type IdleState = {
  reach: number
  rings: number
  active: Array<{ head: number; eased: number; ambient: number }>
}

const SHIMMER = {
  period: 4600,
  rings: 2,
  sweepFraction: 1,
  coreWidth: 1.2,
  coreAmp: 1.9,
  softWidth: 10,
  softAmp: 1.6,
  tail: 5,
  tailAmp: 0.64,
  haloWidth: 4.3,
  haloOffset: 0.6,
  haloAmp: 0.16,
  breathBase: 0.04,
  noise: 0.1,
  ambientAmp: 0.36,
  ambientCenter: 0.5,
  ambientWidth: 0.34,
  shadowMix: 0.1,
  primaryMix: 0.3,
  originX: 4.5,
  originY: 13.5,
}

const GAP = 1
const WIDTH = 0.76
const GAIN = 2.3
const FLASH = 2.15
const TRAIL = 0.28
const SWELL = 0.24
const WIDE = 1.85
const DRIFT = 1.45
const EXPAND = 1.62
const LIFE = 1020
const HOLD = 90
const SINK = 40
const ARC = 2.2
const FORK = 1.2
const DIM = 1.04
const KICK = 0.86
const LAG = 60
const SUCK = 0.34
const SHIMMER_IN = 60
const SHIMMER_OUT = 2.8
const TRACE = 0.033
const TAIL = 1.8
const TRACE_IN = 200
const GLOW_OUT = 1600
const COMBO_WINDOW = 1500
const PEAK = RGBA.fromInts(255, 255, 255)
const NEAR = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const

function clamp(n: number) {
  return Math.max(0, Math.min(1, n))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t)
}

function ease(t: number) {
  const p = clamp(t)
  return p * p * (3 - 2 * p)
}

function push(t: number) {
  const p = clamp(t)
  return ease(p * p)
}

function ramp(t: number, start: number, end: number) {
  if (end <= start) return ease(t >= end ? 1 : 0)
  return ease((t - start) / (end - start))
}

function tint(base: RGBA, overlay: RGBA, alpha: number) {
  return RGBA.fromInts(
    Math.round((base.r + (overlay.r - base.r) * clamp(alpha)) * 255),
    Math.round((base.g + (overlay.g - base.g) * clamp(alpha)) * 255),
    Math.round((base.b + (overlay.b - base.b) * clamp(alpha)) * 255),
  )
}

function glow(base: RGBA, theme: Theme, n: number, enhanced: boolean, phase: number) {
  if (!enhanced) {
    const mid = tint(base, theme.primary, 0.84)
    const top = tint(theme.primary, PEAK, 0.96)
    if (n <= 1) return tint(base, mid, Math.min(1, Math.sqrt(Math.max(0, n)) * 1.14))
    return tint(mid, top, Math.min(1, 1 - Math.exp(-2.4 * (n - 1))))
  }
  const fringe = tint(theme.primary, theme.secondary, 0.22 + 0.1 * Math.sin(phase))
  if (n <= 0.72) return tint(base, theme.primary, Math.sqrt(Math.max(0, n / 0.72)))
  if (n <= 1.3) return tint(theme.primary, fringe, (n - 0.72) / 0.58)
  return tint(fringe, PEAK, Math.min(1, 1 - Math.exp(-2.2 * (n - 1.3))))
}

function shade(base: RGBA, theme: Theme, n: number, enhanced: boolean, phase: number) {
  if (n >= 0) return glow(base, theme, n, enhanced, phase)
  return tint(base, theme.background, Math.min(0.82, -n * 0.64))
}

function ghost(n: number, scale: number) {
  return n < 0 ? n : n * scale
}

function noise(x: number, y: number, t: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + t * 0.043) * 43758.5453
  return n - Math.floor(n)
}

function lit(char: string) {
  return char !== " " && char !== "_" && char !== "~" && char !== ","
}

function key(x: number, y: number) {
  return `${x},${y}`
}

function route(list: Array<{ x: number; y: number }>) {
  const left = new Map(list.map((item) => [key(item.x, item.y), item]))
  const path: Array<{ x: number; y: number }> = []
  let cur = [...left.values()].sort((a, b) => a.y - b.y || a.x - b.x)[0]
  let dir = { x: 1, y: 0 }
  while (cur) {
    path.push(cur)
    left.delete(key(cur.x, cur.y))
    if (!left.size) return path
    const next = NEAR.map(([dx, dy]) => left.get(key(cur.x + dx, cur.y + dy)))
      .filter((item): item is { x: number; y: number } => !!item)
      .sort((a, b) => {
        const adot = (a.x - cur.x) * dir.x + (a.y - cur.y) * dir.y
        const bdot = (b.x - cur.x) * dir.x + (b.y - cur.y) * dir.y
        if (adot !== bdot) return bdot - adot
        return Math.abs(a.x - cur.x) + Math.abs(a.y - cur.y) - Math.abs(b.x - cur.x) - Math.abs(b.y - cur.y)
      })[0]
    if (!next) {
      cur = [...left.values()].sort(
        (a, b) => (a.x - cur.x) ** 2 + (a.y - cur.y) ** 2 - (b.x - cur.x) ** 2 - (b.y - cur.y) ** 2,
      )[0]
      dir = { x: 1, y: 0 }
      continue
    }
    dir = { x: next.x - cur.x, y: next.y - cur.y }
    cur = next
  }
  return path
}

function mapGlyphs(full: string[]) {
  const cells: Array<{ x: number; y: number }> = []
  for (let y = 0; y < full.length; y++) {
    for (let x = 0; x < (full[y]?.length ?? 0); x++) {
      if (lit(full[y]?.[x] ?? " ")) cells.push({ x, y })
    }
  }
  const all = new Map(cells.map((item) => [key(item.x, item.y), item]))
  const seen = new Set<string>()
  const glyph = new Map<string, number>()
  const trace = new Map<string, Trace>()
  const center = new Map<number, { x: number; y: number }>()
  let id = 0
  for (const item of cells) {
    if (seen.has(key(item.x, item.y))) continue
    const stack = [item]
    const part: Array<{ x: number; y: number }> = []
    seen.add(key(item.x, item.y))
    while (stack.length) {
      const cur = stack.pop()!
      part.push(cur)
      glyph.set(key(cur.x, cur.y), id)
      for (const [dx, dy] of NEAR) {
        const next = all.get(key(cur.x + dx, cur.y + dy))
        if (!next || seen.has(key(next.x, next.y))) continue
        seen.add(key(next.x, next.y))
        stack.push(next)
      }
    }
    const path = route(part)
    path.forEach((cell, i) => trace.set(key(cell.x, cell.y), { glyph: id, i, l: path.length }))
    center.set(id, {
      x: part.reduce((sum, cell) => sum + cell.x, 0) / part.length + 0.5,
      y: (part.reduce((sum, cell) => sum + cell.y, 0) / part.length) * 2 + 1,
    })
    id++
  }
  return { glyph, trace, center }
}

const LEFT = logo.left[0]?.length ?? 0
const FULL = logo.left.map((line, index) => line + " ".repeat(GAP) + logo.right[index])
const SPAN = Math.hypot(FULL[0]?.length ?? 0, FULL.length * 2) * 0.94
const MAP = mapGlyphs(FULL)

function shimmer(x: number, y: number, frame: Frame) {
  return frame.list.reduce((best, item) => {
    const age = (frame.t - item.at) * item.speed
    if (age < SHIMMER_IN || age > LIFE) return best
    const dist = Math.hypot(x + 0.5 - item.x, y * 2 + 1 - item.y)
    const p = age / LIFE
    const lag = SPAN * (1 - (1 - p) ** EXPAND) - dist
    if (lag < 0.18 || lag > SHIMMER_OUT) return best
    const band = Math.exp(-(((lag - 1.05) / 0.68) ** 2))
    const wobble = 0.5 + 0.5 * Math.sin(frame.t * 0.035 + x * 0.9 + y * 1.7)
    return Math.max(best, band * wobble * (1 - p) ** 1.45)
  }, 0)
}

function remain(x: number, y: number, item: Release, t: number) {
  const age = (t - item.at) * item.speed
  if (age < 0 || age > LIFE) return 0
  const p = age / LIFE
  const dist = Math.hypot(x - item.x, y * 2 - item.y * 2)
  const r = SPAN * (1 - (1 - p) ** EXPAND)
  if (dist > r) return 1
  return clamp((r - dist) / 1.35 < 1 ? 1 - (r - dist) / 1.35 : 0)
}

function wave(x: number, y: number, frame: Frame, live: boolean) {
  return frame.list.reduce((sum, item) => {
    const age = (frame.t - item.at) * item.speed
    if (age < 0 || age > LIFE) return sum
    const p = age / LIFE
    const dist = Math.hypot(x + 0.5 - item.x, y * 2 + 1 - item.y)
    const r = SPAN * (1 - (1 - p) ** EXPAND)
    const fade = (1 - p) ** 1.32
    const j = 1.02 + noise(x + item.x * 0.7, y + item.y * 0.7, item.at * 0.002 + age * 0.06) * 0.52
    const edge = Math.exp(-(((dist - r) / WIDTH) ** 2)) * GAIN * fade * item.force * j
    const swell = Math.exp(-(((dist - Math.max(0, r - DRIFT)) / WIDE) ** 2)) * SWELL * fade * item.force
    const trail = dist < r ? Math.exp(-(r - dist) / 2.4) * TRAIL * fade * item.force * lerp(0.92, 1.22, j) : 0
    const flash = Math.exp(-(dist * dist) / 3.2) * FLASH * item.force * Math.max(0, 1 - age / 140) * lerp(0.95, 1.18, j)
    const kick = Math.exp(-(dist * dist) / 2) * item.kick * Math.max(0, 1 - age / 100)
    const suck = Math.exp(-(((dist - 1.25) / 0.75) ** 2)) * item.kick * SUCK * Math.max(0, 1 - age / 110)
    const wake = live && dist < r ? Math.exp(-(r - dist) / 1.25) * 0.32 * fade : 0
    return sum + edge + swell + trail + flash + wake - kick - suck
  }, 0)
}

function field(x: number, y: number, frame: Frame, chargeMs: number) {
  const held = frame.hold
  const rest = frame.release
  const item = held ?? rest
  if (!item) return 0
  const rise = held ? ramp(frame.t - held.at, HOLD, chargeMs) : rest!.rise
  const level = held ? push(rise) : rest!.level
  const body = rise
  const storm = level * level
  const sink = held ? ramp(frame.t - held.at, SINK, chargeMs) : rest!.rise
  const dx = x - item.x
  const dy = y * 2 - item.y * 2
  const dist = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)
  const spin = frame.t * lerp(0.008, 0.018, storm)
  const dim = lerp(0, DIM, sink) * lerp(0.99, 1.01, 0.5 + 0.5 * Math.sin(frame.t * 0.014))
  const core = Math.exp(-(dist * dist) / Math.max(0.22, lerp(0.22, 3.2, body))) * lerp(0.42, 2.45, body)
  const shell = Math.exp(-(((dist - lerp(0.16, 2.05, body)) / Math.max(0.18, lerp(0.18, 0.82, body))) ** 2)) * lerp(0.1, 0.95, body)
  const ember = Math.exp(-(((dist - lerp(0.45, 2.65, body)) / Math.max(0.14, lerp(0.14, 0.62, body))) ** 2)) * lerp(0.02, 0.78, body)
  const arc = Math.max(0, Math.cos(angle * 3 - spin + frame.spark * 2.2)) ** 8
  const seam = Math.max(0, Math.cos(angle * 5 + spin * 1.55)) ** 12
  const ring = Math.exp(-(((dist - lerp(1.05, 3, level)) / 0.48) ** 2)) * arc * lerp(0.03, 0.5 + ARC, storm)
  const fork = Math.exp(-(((dist - (1.55 + storm * 2.1)) / 0.36) ** 2)) * seam * storm * FORK
  const spark = Math.max(0, noise(x, y, frame.t) - lerp(0.94, 0.66, storm)) * lerp(0, 5.4, storm)
  const glitch = spark * Math.exp(-dist / Math.max(1.2, 3.1 - storm))
  const crack = Math.max(0, Math.cos((dx - dy) * 1.6 + spin * 2.1)) ** 18
  const lash = crack * Math.exp(-(((dist - (1.95 + storm * 2)) / 0.28) ** 2)) * storm * 1.1
  const flicker = Math.max(0, noise(item.x * 3.1, item.y * 2.7, frame.t * 1.7) - 0.72) * Math.exp(-(dist * dist) / 0.15) * lerp(0.08, 0.42, body)
  const fade = rest && !held ? remain(x, y, rest, frame.t) : 1
  return (core + shell + ember + ring + fork + glitch + lash + flicker - dim) * fade
}

function pick(x: number, y: number, frame: Frame, chargeMs: number) {
  const held = frame.hold
  const rest = frame.release
  const item = held ?? rest
  if (!item) return 0
  const rise = held ? ramp(frame.t - held.at, HOLD, chargeMs) : rest!.rise
  const dist = Math.hypot(x - item.x, y * 2 - item.y * 2)
  const fade = rest && !held ? remain(x, y, rest, frame.t) : 1
  return Math.exp(-(dist * dist) / 1.7) * lerp(0.2, 0.96, rise) * fade
}

function select(x: number, y: number) {
  const direct = MAP.glyph.get(key(x, y))
  if (direct !== undefined) return direct
  return NEAR.map(([dx, dy]) => MAP.glyph.get(key(x + dx, y + dy))).find(
    (item): item is number => item !== undefined,
  )
}

function trace(x: number, y: number, frame: Frame, chargeMs: number) {
  const held = frame.hold
  const rest = frame.release
  const item = held ?? rest
  if (!item || item.glyph === undefined) return 0
  const step = MAP.trace.get(key(x, y))
  if (!step || step.glyph !== item.glyph || step.l < 2) return 0
  const age = frame.t - item.at
  const rise = held ? ramp(age, HOLD, chargeMs) : rest!.rise
  const appear = held ? ramp(age, 0, TRACE_IN) : 1
  const speed = lerp(TRACE * 0.48, TRACE * 0.88, rise)
  const head = (age * speed) % step.l
  const dist = Math.min(Math.abs(step.i - head), step.l - Math.abs(step.i - head))
  const tail = (head - TAIL + step.l) % step.l
  const lag = Math.min(Math.abs(step.i - tail), step.l - Math.abs(step.i - tail))
  const fade = rest && !held ? remain(x, y, rest, frame.t) : 1
  const core = Math.exp(-((dist / 1.05) ** 2)) * lerp(0.8, 2.35, rise)
  const aura = Math.exp(-((dist / 1.85) ** 2)) * lerp(0.08, 0.34, rise)
  const trail = Math.exp(-((lag / 1.45) ** 2)) * lerp(0.04, 0.42, rise)
  return (core + aura + trail) * appear * fade
}

function bloom(x: number, y: number, frame: Frame) {
  const item = frame.glow
  if (!item || MAP.glyph.get(key(x, y)) !== item.glyph) return 0
  const age = frame.t - item.at
  if (age < 0 || age > GLOW_OUT) return 0
  const p = age / GLOW_OUT
  const center = MAP.center.get(item.glyph)!
  const bias = Math.exp(-((Math.hypot(x + 0.5 - center.x, y * 2 + 1 - center.y) / 2.8) ** 2))
  return lerp(item.force, item.force * 0.18, p) * lerp(0.72, 1.1, bias) * (1 - p) ** 2
}

function buildIdleState(t: number): IdleState {
  const width = FULL[0]?.length ?? 1
  const height = FULL.length * 2
  const reach =
    Math.max(
      Math.hypot(SHIMMER.originX, SHIMMER.originY),
      Math.hypot(width - SHIMMER.originX, SHIMMER.originY),
      Math.hypot(SHIMMER.originX, height - SHIMMER.originY),
      Math.hypot(width - SHIMMER.originX, height - SHIMMER.originY),
    ) +
    SHIMMER.tail * 2
  const rings = Math.max(1, Math.floor(SHIMMER.rings))
  const active: IdleState["active"] = []
  for (let i = 0; i < rings; i++) {
    const cycle = (t / SHIMMER.period + i / rings) % 1
    if (cycle >= SHIMMER.sweepFraction) continue
    const phase = cycle / SHIMMER.sweepFraction
    const envelope = Math.sin(phase * Math.PI)
    const eased = envelope * envelope * (3 - 2 * envelope)
    const distance = (phase - SHIMMER.ambientCenter) / SHIMMER.ambientWidth
    active.push({
      head: phase * reach,
      eased,
      ambient: Math.abs(distance) < 1 ? (1 - distance * distance) ** 2 * SHIMMER.ambientAmp : 0,
    })
  }
  return { reach, rings, active }
}

function idle(x: number, pixelY: number, frame: Frame, state: IdleState) {
  const dx = x + 0.5 - SHIMMER.originX
  const dy = pixelY - SHIMMER.originY
  const dist = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)
  const wobble =
    ((noise(x * 0.32, pixelY * 0.25, frame.t * 0.0005) - 0.5) * 0.55 +
      (noise(x * 0.12, pixelY * 0.08, frame.t * 0.00022) - 0.5) * 0.32 +
      Math.sin(angle * 3 + frame.t * 0.0012) * 0.054) *
    SHIMMER.noise
  const traveled = dist + wobble
  let value = 0
  let peak = 0
  let primary = 0
  let ambient = 0
  for (const ring of state.active) {
    const delta = traveled - ring.head
    const core = Math.exp(-(Math.abs(delta / SHIMMER.coreWidth) ** 1.8))
    const soft = Math.exp(-(Math.abs(delta / SHIMMER.softWidth) ** 1.6))
    const tailRange = SHIMMER.tail * 2.6
    const tail = delta < 0 && delta > -tailRange ? (1 + delta / tailRange) ** 2.6 : 0
    const halo = Math.exp(-(Math.abs((delta + SHIMMER.haloOffset) / SHIMMER.haloWidth) ** 1.6))
    value += (soft * SHIMMER.softAmp + tail * SHIMMER.tailAmp) * ring.eased
    peak += (core * SHIMMER.coreAmp + halo * SHIMMER.haloAmp) * ring.eased
    primary += (halo + tail * 0.6) * ring.eased
    ambient += ring.ambient
  }
  return {
    glow: value / state.rings,
    peak: SHIMMER.breathBase + ambient / state.rings + peak / state.rings,
    primary: (primary / state.rings) * SHIMMER.primaryMix,
  }
}

function parseConfig(options: Record<string, unknown> | undefined): Config {
  const number = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback)
  return {
    sound: typeof options?.sound === "boolean" ? options.sound : false,
    volume: clamp(number(options?.volume, 0.3)),
    chargeMs: Math.max(HOLD + 1, Math.min(30_000, Math.round(number(options?.charge_ms, 3000)))),
    idle: typeof options?.idle === "boolean" ? options.idle : false,
    enhanced: typeof options?.enhanced === "boolean" ? options.enhanced : true,
  }
}

type LogoProps = {
  theme: () => Theme
  config: Config
  sound: ReturnType<typeof createSound>
}

export function Logo(props: LogoProps) {
  const renderer = useRenderer()
  const [rings, setRings] = createSignal<Ring[]>([])
  const [hold, setHold] = createSignal<Hold>()
  const [release, setRelease] = createSignal<Release>()
  const [selectedGlow, setSelectedGlow] = createSignal<Glow>()
  const [now, setNow] = createSignal(0)
  let box: BoxRenderable | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let humming = false
  let combo = 0
  let lastBurst = -Infinity
  let mouseInput = ""

  const stop = () => {
    if (!timer) return
    clearInterval(timer)
    timer = undefined
  }

  const start = () => {
    if (timer) return
    timer = setInterval(tick, 16)
  }

  const burst = (x: number, y: number) => {
    const item = hold()
    if (!item) return
    humming = false
    props.sound.stop()
    const t = performance.now()
    combo = t - lastBurst <= COMBO_WINDOW ? Math.min(3, combo + 1) : 1
    lastBurst = t
    const rise = ramp(t - item.at, HOLD, props.config.chargeMs)
    const level = push(rise)
    const boost = 1 + (combo - 1) * 0.18
    const speed = 1 + (combo - 1) * 0.12
    setHold(undefined)
    setRelease({ ...item, at: t, level, rise, speed })
    if (item.glyph !== undefined) {
      setSelectedGlow({ glyph: item.glyph, at: t, force: lerp(0.18, 1.5, rise * level) * boost })
    }
    setRings((list) => [
      ...list,
      {
        x: x + 0.5,
        y: y * 2 + 1,
        at: t,
        force: lerp(0.82, 2.55, level) * boost,
        kick: lerp(0.32, 0.32 + KICK, level) * boost,
        speed,
      },
    ])
    setNow(t)
    start()
    props.sound.pulse(lerp(0.8, 1, level) * boost)
  }

  const tick = () => {
    const t = performance.now()
    setNow(t)
    const item = hold()
    if (item && !humming && t - item.at >= HOLD) {
      humming = true
      props.sound.start()
    }
    if (item && t - item.at >= props.config.chargeMs) burst(item.x, item.y)
    let live = false
    setRings((list) => {
      const next = list.filter((ring) => (t - ring.at) * ring.speed < LIFE)
      live = next.length > 0
      return next
    })
    const flash = selectedGlow()
    if (flash && t - flash.at >= GLOW_OUT) setSelectedGlow(undefined)
    if (!live) setRelease(undefined)
    if (live || hold() || release() || selectedGlow() || props.config.idle) return
    stop()
  }

  const press = (x: number, y: number, t: number) => {
    const current = hold()
    if (current) burst(current.x, current.y)
    setNow(t)
    if (!current) setRelease(undefined)
    setHold({ x, y, at: t, glyph: select(x, y) })
    mouseInput = ""
    humming = false
    start()
  }

  const releaseAnywhere = (chunk: string | Buffer) => {
    mouseInput = (mouseInput + chunk.toString()).slice(-128)
    const sequence = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g
    let match: RegExpExecArray | null
    let consumed = 0
    while ((match = sequence.exec(mouseInput))) {
      consumed = sequence.lastIndex
      const button = Number(match[1])
      if ((button & 64) !== 0 || (button & 3) !== MouseButton.LEFT) continue
      const item = hold()
      if (!item) continue
      if ((button & 32) !== 0) {
        if (!box) continue
        const x = Number(match[2]) - 1
        const y = Number(match[3]) - 1
        if (x < box.x || x >= box.x + box.width || y < box.y || y >= box.y + box.height) burst(item.x, item.y)
        continue
      }
      if (match[4] === "m") burst(item.x, item.y)
    }
    if (consumed) mouseInput = mouseInput.slice(consumed)
  }

  onMount(() => {
    renderer.stdin.on("data", releaseAnywhere)
    if (props.config.idle) {
      setNow(performance.now())
      start()
    }
  })

  onCleanup(() => {
    renderer.stdin.removeListener("data", releaseAnywhere)
    stop()
    humming = false
    props.sound.stop()
  })

  const frame = createMemo<Frame>(() => {
    const t = now()
    const item = hold()
    return {
      t,
      list: rings(),
      hold: item,
      release: release(),
      glow: selectedGlow(),
      spark: item ? noise(item.x, item.y, t) : 0,
    }
  })

  const dusk = createMemo<Frame>(() => {
    const base = frame()
    const t = base.t - LAG
    return {
      ...base,
      t,
      spark: base.hold ? noise(base.hold.x, base.hold.y, t) : 0,
    }
  })

  const idleState = createMemo(() => (props.config.idle ? buildIdleState(frame().t) : undefined))
  const useSubpixelBlocks = () => renderer.capabilities?.rgb === true

  onBlur(() => {
    const item = hold()
    if (item) burst(item.x, item.y)
  })

  const renderLine = (
    line: string,
    y: number,
    ink: RGBA,
    bold: boolean,
    offset: number,
    current: Frame,
    delayed: Frame,
    idleValue: IdleState | undefined,
  ): JSX.Element[] => {
    const theme = props.theme()
    const shadow = tint(theme.background, ink, 0.25)
    const attributes = bold ? TextAttributes.BOLD : undefined
    return Array.from(line).map((char, index) => {
      if (char === " ") {
        return (
          <text fg={ink} attributes={attributes} selectable={false}>
            {char}
          </text>
        )
      }
      const x = offset + index
      const energy = field(x, y, current, props.config.chargeMs)
      const empty = { glow: 0, peak: 0, primary: 0 }
      const pulseTop = idleValue ? idle(x, y * 2, current, idleValue) : empty
      const pulseBottom = idleValue ? idle(x, y * 2 + 1, current, idleValue) : empty
      const isLit = lit(char)
      const topPrimary = isLit ? Math.min(1, pulseTop.primary) : 0
      const bottomPrimary = isLit ? Math.min(1, pulseBottom.primary) : 0
      const topPeak = isLit ? Math.min(1, pulseTop.peak) : 0
      const bottomPeak = isLit ? Math.min(1, pulseBottom.peak) : 0
      const inkTop = tint(tint(ink, theme.primary, topPrimary), PEAK, topPeak)
      const inkBottom = tint(tint(ink, theme.primary, bottomPrimary), PEAK, bottomPeak)
      const pulsePeak = (pulseTop.peak + pulseBottom.peak) / 2
      const pulsePrimary = (pulseTop.primary + pulseBottom.primary) / 2
      const inkTinted = tint(tint(ink, theme.primary, isLit ? Math.min(1, pulsePrimary) : 0), PEAK, isLit ? Math.min(1, pulsePeak) : 0)
      const shadowTop = tint(shadow, PEAK, Math.min(1, pulseTop.peak * SHIMMER.shadowMix))
      const shadowBottom = tint(shadow, PEAK, Math.min(1, pulseBottom.peak * SHIMMER.shadowMix))
      const shadowTinted = tint(shadow, PEAK, Math.min(1, pulsePeak * SHIMMER.shadowMix))
      const live = wave(x, y, current, isLit) + energy
      const duskValue = wave(x, y, delayed, false) + energy
      const picked = isLit ? pick(x, y, current, props.config.chargeMs) : 0
      const traced = isLit ? trace(x, y, current, props.config.chargeMs) : 0
      const bloomed = isLit ? bloom(x, y, current) : 0
      const shimmerValue = shimmer(x, y, current)
      const strength = live + picked + traced + bloomed
      const phase = current.t * 0.003 + x * 0.23 + y * 0.51
      const paint = (base: RGBA, value: number) => shade(base, theme, value, props.config.enhanced, phase)

      if (char === "_") {
        return (
          <text
            fg={paint(inkTinted, duskValue * 0.08)}
            bg={paint(shadowTinted, ghost(duskValue, 0.24) + ghost(shimmerValue, 0.06))}
            attributes={attributes}
            selectable={false}
          >
            {" "}
          </text>
        )
      }
      if (char === "^") {
        return (
          <text
            fg={paint(inkTop, strength)}
            bg={paint(shadowBottom, ghost(duskValue, 0.18) + ghost(shimmerValue, 0.05) + ghost(bloomed, 0.08))}
            attributes={attributes}
            selectable={false}
          >
            ▀
          </text>
        )
      }
      if (char === "~") {
        return (
          <text fg={paint(shadowTop, ghost(duskValue, 0.22) + ghost(shimmerValue, 0.05))} attributes={attributes} selectable={false}>
            ▀
          </text>
        )
      }
      if (char === ",") {
        return (
          <text fg={paint(shadowBottom, ghost(duskValue, 0.22) + ghost(shimmerValue, 0.05))} attributes={attributes} selectable={false}>
            ▄
          </text>
        )
      }
      if (char === "█" && useSubpixelBlocks()) {
        return (
          <text fg={paint(inkTop, strength)} bg={paint(inkBottom, strength)} attributes={attributes} selectable={false}>
            ▀
          </text>
        )
      }
      if (char === "▀") {
        return (
          <text fg={paint(inkTop, strength)} attributes={attributes} selectable={false}>
            ▀
          </text>
        )
      }
      if (char === "▄") {
        return (
          <text fg={paint(inkBottom, strength)} attributes={attributes} selectable={false}>
            ▄
          </text>
        )
      }
      return (
        <text fg={paint(inkTinted, strength)} attributes={attributes} selectable={false}>
          {char}
        </text>
      )
    })
  }

  const hit = (x: number, y: number) => {
    const char = FULL[y]?.[x]
    return char !== undefined && char !== " "
  }

  const mouse = (event: MouseEvent) => {
    if (!box) return
    if ((event.type === "down" || event.type === "drag") && event.button === MouseButton.LEFT) {
      const x = event.x - box.x
      const y = event.y - box.y
      if (!hit(x, y)) return
      if (event.type === "drag" && hold()) return
      event.preventDefault()
      event.stopPropagation()
      press(x, y, performance.now())
      return
    }
    const item = hold()
    if (!item) return
    if (event.type === "out" || ((event.type === "up" || event.type === "drag-end") && event.button === MouseButton.LEFT)) {
      burst(item.x, item.y)
    }
  }

  return (
    <box ref={(item: BoxRenderable) => (box = item)}>
      <box
        position="absolute"
        top={0}
        left={0}
        width={FULL[0]?.length ?? 0}
        height={FULL.length}
        zIndex={1}
        onMouse={mouse}
      />
      <For each={logo.left}>
        {(line, index) => (
          <box flexDirection="row" gap={1}>
            <box flexDirection="row">
              {renderLine(line, index(), props.theme().textMuted, false, 0, frame(), dusk(), idleState())}
            </box>
            <box flexDirection="row">
              {renderLine(logo.right[index()], index(), props.theme().text, true, LEFT + GAP, frame(), dusk(), idleState())}
            </box>
          </box>
        )}
      </For>
    </box>
  )
}

const tui: TuiPlugin = async (api, options) => {
  const config = parseConfig(options)
  const sound = createSound({ enabled: config.sound, volume: config.volume })
  api.lifecycle.onDispose(() => sound.dispose())
  try {
    api.slots.register({
      slots: {
        home_logo(context) {
          return <Logo theme={() => context.theme.current} config={config} sound={sound} />
        },
      },
    })
  } catch {
    api.ui.toast({
      variant: "warning",
      title: "Logo pulse unavailable",
      message: "OpenCode kept the native home logo because the home_logo slot could not be registered.",
      duration: 5000,
    })
  }
}

const plugin: TuiPluginModule & { id: string } = {
  id: "o3p.terminal.logo-pulse",
  tui,
}

export default plugin
