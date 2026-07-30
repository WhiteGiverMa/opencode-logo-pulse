/** @jsxImportSource @opentui/solid */
import { RGBA, TextAttributes, type CapturedFrame } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { Logo } from "../plugin/index"

const mode = process.argv[2] === "pulse" ? "pulse" : process.argv[2] === "rest" ? "rest" : "charge"
const theme = {
  primary: RGBA.fromHex("#ff5fa2"),
  secondary: RGBA.fromHex("#7c6cf2"),
  text: RGBA.fromHex("#f5f5f5"),
  textMuted: RGBA.fromHex("#8b8b8b"),
  background: RGBA.fromHex("#090909"),
}

const sound = {
  start() {},
  stop() {},
  pulse() {},
  dispose() {},
}

const color = (value: RGBA) => `${Math.round(value.r * 255)};${Math.round(value.g * 255)};${Math.round(value.b * 255)}`

function ansi(frame: CapturedFrame) {
  let output = `\x1b[48;2;${color(theme.background)}m\x1b[2J\x1b[H`
  frame.lines.forEach((line, index) => {
    output += `\x1b[${19 + index};41H`
    for (const span of line.spans) {
      const weight = (span.attributes & TextAttributes.BOLD) !== 0 ? "1" : "22"
      const background = span.bg.intent === "default" || span.bg.a === 0 ? theme.background : span.bg
      output += `\x1b[${weight};38;2;${color(span.fg)};48;2;${color(background)}m${span.text}`
    }
  })
  return `${output}\x1b[0m\x1b[?25l`
}

const setup = await testRender(
  () => (
    <Logo
      theme={() => theme}
      config={{ sound: false, volume: 0, chargeMs: 3000, idle: false, enhanced: true }}
      sound={sound}
    />
  ),
  { width: 39, height: 4, backgroundColor: theme.background },
)

await setup.renderOnce()
if (mode !== "rest") {
  await setup.mockMouse.pressDown(0, 1)
  if (mode === "charge") {
    await Bun.sleep(1000)
  } else {
    await Bun.sleep(600)
    await setup.mockMouse.release(0, 1)
    await Bun.sleep(250)
  }
}
await setup.renderOnce()
const frame = setup.captureSpans()
setup.renderer.destroy()
process.stdout.write(ansi(frame))
await new Promise<void>(() => {})
