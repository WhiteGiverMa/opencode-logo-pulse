# OpenCode Logo Pulse

An interactive, theme-aware replacement for the OpenCode home logo. Hold a solid logo cell to gather energy, then release to send a pulse across the wordmark.

The static state preserves OpenCode's native four-row geometry. Animation and sound remain dormant until interaction, and sound is disabled by default.

## Experience

- **Press and hold:** after a short accidental-click guard, energy gathers beneath the pointer and traces the selected glyph.
- **Release:** the charge becomes a theme-colored wave with a short glyph afterglow.
- **Full charge:** holding for `charge_ms` triggers the burst automatically; releasing afterward does not trigger twice.
- **Drag away:** leaving the logo releases immediately and reliably stops the charge sound.
- **Rapid bursts:** interactions within 1.5 seconds build a three-level combo that increases force and propagation speed.
- **Theme native:** static ink, energy, highlights, and shadows derive from the active OpenCode theme.
- **Idle friendly:** with `idle: false`, no frame timer runs until the logo is used.

Only left-button interaction on a visible logo cell is active. Blank cells and other mouse buttons remain inert, and no keyboard command or navigation is hidden behind the effect.

## Requirements

- OpenCode with the TUI plugin API. Tested with OpenCode 1.18.9.
- [Bun](https://bun.sh/) for installation, checks, and deployment.
- Optional sound playback requires one supported local player, such as `ffplay`, `mpv`, `play`, `afplay`, or `aplay`.

## Install

```bash
git clone https://github.com/WhiteGiverMa/opencode-logo-pulse.git
cd opencode-logo-pulse
bun install
bun run typecheck
bun run deploy
```

`bun run deploy` copies the plugin and WAV assets to:

```text
~/.config/opencode/plugins/logo-pulse
```

Add the plugin to `~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "./plugins/logo-pulse/index.tsx",
      {
        "sound": false,
        "volume": 0.3,
        "charge_ms": 3000,
        "idle": false,
        "enhanced": true
      }
    ]
  ]
}
```

Existing TUI settings can remain alongside `plugin`. Restart OpenCode after deploying or changing `tui.json`.

## Configuration

All options are optional.

| Option | Type | Default | Accepted values | Effect |
|---|---|---:|---|---|
| `sound` | boolean | `false` | `true`, `false` | Enables the charge hum and alternating pulse sounds. |
| `volume` | number | `0.3` | `0` to `1` | Master level before the quieter per-effect gain is applied. Values are clamped. |
| `charge_ms` | number | `3000` | `91` to `30000` | Milliseconds required for an automatic full-charge burst. Values are rounded and clamped. |
| `idle` | boolean | `false` | `true`, `false` | Enables a slow, low-amplitude shimmer while the logo is otherwise idle. |
| `enhanced` | boolean | `true` | `true`, `false` | Uses the multi-stage primary/secondary/white energy ramp. Disable for the simpler legacy ramp. |

Minimal configuration, using every default:

```json
{
  "plugin": ["./plugins/logo-pulse/index.tsx"]
}
```

Enable sound explicitly:

```json
{
  "plugin": [
    ["./plugins/logo-pulse/index.tsx", { "sound": true, "volume": 0.2 }]
  ]
}
```

## Sound behavior

The plugin chooses the first available player from its platform fallback list and owns every process it starts. Charge audio loops for charges longer than the WAV asset, while release, drag-out, focus loss, plugin deactivation, and OpenCode shutdown terminate the owned hum.

If sound is enabled but inaudible:

1. Check that a supported player is installed, for example `ffplay -version`.
2. Confirm `sound` is `true` and `volume` is greater than `0`.
3. Restart OpenCode after changing `tui.json`.

The visual interaction works normally when no player is available.

## Development

```bash
bun run test
bun run typecheck
bun run deploy
```

- `bun run test` exercises static fidelity, theme repainting, charge/release, pointer escape, automatic burst, button filtering, idle motion, legacy gradients, and combo behavior.
- `bun run typecheck` checks plugin and harness TypeScript without emitting files.
- `bun run deploy` refreshes the global OpenCode plugin copy.

Run OpenCode without external TUI plugins when comparing against the native home screen:

```bash
opencode --pure
```

## Update

```bash
git pull --ff-only
bun install
bun run typecheck
bun run deploy
```

Restart OpenCode to load the updated files.

## Uninstall

1. Remove `./plugins/logo-pulse/index.tsx` from the `plugin` array in `~/.config/opencode/tui.json`.
2. Optionally delete `~/.config/opencode/plugins/logo-pulse`.
3. Restart OpenCode.

OpenCode will return to its native static home logo.

## License

[MIT](LICENSE) © 2026 WhiteGiverMa
