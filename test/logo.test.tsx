/** @jsxImportSource @opentui/solid */
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { describe, expect, test } from "bun:test"
import { createSignal } from "solid-js"
import { Logo } from "../plugin/index"

const theme = {
  primary: RGBA.fromHex("#7c6cf2"),
  secondary: RGBA.fromHex("#4fc3f7"),
  text: RGBA.fromHex("#f5f5f5"),
  textMuted: RGBA.fromHex("#999999"),
  background: RGBA.fromHex("#111111"),
}

function harness(
  chargeMs = 3000,
  currentTheme = () => theme,
  overrides: Partial<{ idle: boolean; enhanced: boolean }> = {},
) {
  const calls = { start: 0, stop: 0, pulse: 0, levels: [] as number[] }
  const sound = {
    start() {
      calls.start++
    },
    stop() {
      calls.stop++
    },
    pulse(level = 1) {
      calls.pulse++
      calls.levels.push(level)
    },
    dispose() {},
  }
  const node = () => (
    <Logo
      theme={currentTheme}
      config={{ sound: true, volume: 0.3, chargeMs, idle: false, enhanced: true, ...overrides }}
      sound={sound}
    />
  )
  return { calls, node }
}

describe("Logo", () => {
  test("renders the four-row native wordmark", async () => {
    const value = harness()
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      const frame = setup.captureCharFrame().split("\n")
      expect(frame.slice(0, 4)).toEqual([
        "                                 ▄                          ",
        "█▀▀█ █▀▀█ █▀▀█ █▀▀▄ █▀▀▀ █▀▀█ █▀▀█ █▀▀█                     ",
        "█  █ █  █ █▀▀▀ █  █ █    █  █ █  █ █▀▀▀                     ",
        "▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀                     ",
      ])
    } finally {
      setup.renderer.destroy()
    }
  })

  test("ignores blank cells", async () => {
    const value = harness()
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      await setup.mockMouse.click(0, 0)
      await Bun.sleep(120)
      expect(value.calls).toEqual({ start: 0, stop: 0, pulse: 0, levels: [] })
    } finally {
      setup.renderer.destroy()
    }
  })

  test("repaints static ink when the host theme changes", async () => {
    const [currentTheme, setCurrentTheme] = createSignal(theme)
    const value = harness(3000, currentTheme)
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      const before = JSON.stringify(setup.captureSpans())
      setCurrentTheme({ ...theme, text: RGBA.fromHex("#ff3344"), textMuted: RGBA.fromHex("#44ff88") })
      await setup.renderOnce()
      expect(JSON.stringify(setup.captureSpans())).not.toBe(before)
    } finally {
      setup.renderer.destroy()
    }
  })

  test("charges a solid cell and bursts on release", async () => {
    const value = harness()
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      const before = JSON.stringify(setup.captureSpans())
      await setup.mockMouse.pressDown(0, 1)
      await Bun.sleep(120)
      await setup.renderOnce()
      expect(value.calls.start).toBe(1)
      const charged = JSON.stringify(setup.captureSpans())
      expect(charged).not.toBe(before)
      await setup.mockMouse.release(0, 1)
      await Bun.sleep(80)
      await setup.renderOnce()
      expect(value.calls.pulse).toBe(1)
      expect(value.calls.stop).toBeGreaterThan(0)
      expect(JSON.stringify(setup.captureSpans())).not.toBe(charged)
    } finally {
      setup.renderer.destroy()
    }
  })

  test("bursts when a held pointer leaves the logo", async () => {
    const value = harness()
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      await setup.mockMouse.pressDown(0, 1)
      await Bun.sleep(120)
      await setup.mockMouse.moveTo(59, 7)
      expect(value.calls.start).toBe(1)
      expect(value.calls.pulse).toBe(1)
      await setup.mockMouse.release(59, 7)
      expect(value.calls.pulse).toBe(1)
      expect(value.calls.stop).toBeGreaterThan(0)
    } finally {
      setup.renderer.destroy()
    }
  })

  test("automatically bursts at full charge", async () => {
    const value = harness(120)
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      await setup.mockMouse.pressDown(0, 1)
      await Bun.sleep(170)
      expect(value.calls.start).toBe(1)
      expect(value.calls.pulse).toBe(1)
      await setup.mockMouse.release(0, 1)
      expect(value.calls.pulse).toBe(1)
    } finally {
      setup.renderer.destroy()
    }
  })

  test("ignores non-left release while charging", async () => {
    const value = harness()
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      await setup.mockMouse.pressDown(0, 1)
      await Bun.sleep(120)
      await setup.mockMouse.emitMouseEvent("up", 0, 1, 1)
      expect(value.calls.pulse).toBe(0)
      await setup.mockMouse.release(0, 1)
      expect(value.calls.pulse).toBe(1)
    } finally {
      setup.renderer.destroy()
    }
  })

  test("animates the optional idle shimmer", async () => {
    const value = harness(3000, () => theme, { idle: true })
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      const before = JSON.stringify(setup.captureSpans())
      await Bun.sleep(120)
      await setup.renderOnce()
      expect(JSON.stringify(setup.captureSpans())).not.toBe(before)
    } finally {
      setup.renderer.destroy()
    }
  })

  test("keeps charge motion in legacy gradient mode", async () => {
    const value = harness(3000, () => theme, { enhanced: false })
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      const before = JSON.stringify(setup.captureSpans())
      await setup.mockMouse.pressDown(0, 1)
      await Bun.sleep(120)
      await setup.renderOnce()
      expect(JSON.stringify(setup.captureSpans())).not.toBe(before)
      await setup.mockMouse.release(0, 1)
    } finally {
      setup.renderer.destroy()
    }
  })

  test("boosts rapid combo bursts and resets after the combo window", async () => {
    const value = harness()
    const setup = await testRender(value.node, { width: 60, height: 8 })
    try {
      await setup.renderOnce()
      await setup.mockMouse.click(0, 1)
      await setup.mockMouse.click(0, 1)
      expect(value.calls.levels[1]).toBeGreaterThan(value.calls.levels[0])
      await Bun.sleep(1600)
      await setup.mockMouse.click(0, 1)
      expect(value.calls.levels[2]).toBeCloseTo(value.calls.levels[0])
    } finally {
      setup.renderer.destroy()
    }
  })
})
