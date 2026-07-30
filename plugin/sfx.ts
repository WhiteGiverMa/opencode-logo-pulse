import { join } from "node:path"

const PLAYERS = [
  "ffplay",
  "mpv",
  "mpg123",
  "mpg321",
  "mplayer",
  "afplay",
  "play",
  "omxplayer",
  "aplay",
  "cmdmp3",
  "cvlc",
  "powershell.exe",
] as const

type Player = (typeof PLAYERS)[number]

export type SoundOptions = {
  enabled: boolean
  volume: number
  assetsDir?: string
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function command(player: Player, file: string, volume: number) {
  if (player === "ffplay") return [player, "-loglevel", "quiet", "-autoexit", "-nodisp", "-af", `volume=${volume}`, file]
  if (player === "mpv") return [player, "--really-quiet", "--no-video", "--audio-display=no", "--volume", String(Math.round(volume * 100)), file]
  if (player === "mpg123" || player === "mpg321") return [player, "-q", "-g", String(Math.round(volume * 100)), file]
  if (player === "mplayer") return [player, "-really-quiet", "-vo", "null", "-volume", String(Math.round(volume * 100)), file]
  if (player === "play") return [player, "-q", "-v", String(volume), file]
  if (player === "cvlc") return [player, "--quiet", `--gain=${volume}`, "--play-and-exit", file]
  if (player === "powershell.exe") {
    const escaped = file.replaceAll("'", "''")
    return [player, "-NoProfile", "-NonInteractive", "-Command", `(New-Object Media.SoundPlayer '${escaped}').PlaySync()`]
  }
  return [player, file]
}

export function createSound(options: SoundOptions) {
  const assets = options.assetsDir ?? join(import.meta.dir, "assets")
  const pulses = ["pulse-a.wav", "pulse-b.wav", "pulse-c.wav"].map((file) => join(assets, file))
  const charge = join(assets, "charge.wav")
  const volume = clamp(options.volume)
  const children = new Set<ReturnType<typeof Bun.spawn>>()
  let player: Player | null | undefined
  let hum: ReturnType<typeof Bun.spawn> | undefined
  let restart: ReturnType<typeof setTimeout> | undefined
  let sequence = 0
  let shot = 0
  let disposed = false

  const pick = () => {
    if (player !== undefined) return player
    player = PLAYERS.find((candidate) => Bun.which(candidate)) ?? null
    return player
  }

  const terminate = (child: ReturnType<typeof Bun.spawn>) => {
    children.delete(child)
    if (child.exitCode !== null) return
    try {
      child.kill("SIGTERM")
    } catch {
      return
    }
    const force = setTimeout(() => {
      if (child.exitCode !== null) return
      try {
        child.kill("SIGKILL")
      } catch {
      }
    }, 150)
    void child.exited.finally(() => clearTimeout(force))
  }

  const run = (file: string, level: number) => {
    if (!options.enabled || disposed || volume <= 0) return
    const selected = pick()
    if (!selected) return
    try {
      const child = Bun.spawn(command(selected, file, clamp(level)), {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      })
      children.add(child)
      void child.exited.finally(() => children.delete(child))
      return child
    } catch {
      return
    }
  }

  const stop = () => {
    sequence++
    if (restart) {
      clearTimeout(restart)
      restart = undefined
    }
    if (!hum) return
    const current = hum
    hum = undefined
    terminate(current)
  }

  const loopHum = (id: number) => {
    if (id !== sequence || disposed) return
    const child = run(charge, volume * 0.8)
    if (!child || id !== sequence || disposed) {
      if (child) terminate(child)
      return
    }
    hum = child
    void child.exited.finally(() => {
      if (id !== sequence || disposed || hum !== child) return
      hum = undefined
      restart = setTimeout(() => {
        restart = undefined
        loopHum(id)
      }, 250)
    })
  }

  return {
    start() {
      stop()
      if (!options.enabled || disposed) return
      const id = sequence
      loopHum(id)
    },
    stop,
    pulse(scale = 1) {
      stop()
      const file = pulses[shot++ % pulses.length]
      run(file, volume * (0.75 + 0.25 * clamp(scale)))
    },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      for (const child of [...children]) terminate(child)
    },
  }
}
