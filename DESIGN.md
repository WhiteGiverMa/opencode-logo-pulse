# OpenCode Logo Pulse Design System

## 0. Research Log

- Concrete reference: the legacy OpenCode interactive logo is the visual and interaction contract; no external style reference was used because this plugin restores an existing OpenCode surface.
- Product brief: preserve native static fidelity while restoring the legacy animation layers, configuration, and cleanup guarantees.
- Skipped lanes: Lazyweb and generated concepts would invent a new direction and conflict with the restoration brief.

## 1. Atmosphere & Identity

The logo remains the quiet, native OpenCode home mark until touched. Its signature moment is a tactile press-and-release response: energy gathers exactly under the pointer, traces the selected glyph, then breaks into a theme-colored wave across the full wordmark. The effect should feel discovered rather than advertised.

## 2. Color

All colors derive at render time from the active OpenCode theme.

| Role | Token | Source | Usage |
|---|---|---|---|
| Surface | `theme.background` | Host theme | Shadow attenuation and negative energy |
| Muted ink | `theme.textMuted` | Host theme | Left half of the native logo |
| Primary ink | `theme.text` | Host theme | Right half of the native logo |
| Energy | `theme.primary` | Host theme | Pulse, trace, halo, and enhanced gradient |
| Peak | `RGBA(255,255,255)` | Perceptual highlight | Short-lived pulse and bloom core only |
| Shadow | `tint(background, ink, 0.25)` | Derived | Legacy `_ ^ ~ ,` shadow cells |

Rules:

- No fixed brand color may replace a host theme token.
- Energy interpolates from the current ink through `theme.primary` to peak white.
- `enhanced: false` retains the legacy two-stage ramp; `enhanced: true` adds a restrained, time-varying primary fringe without changing the static state.

## 3. Typography

The terminal and OpenTUI renderer own the font. The component emits only the legacy block characters and spacing.

| Role | Weight | Source |
|---|---|---|
| Left wordmark | Regular | Host terminal |
| Right wordmark | Bold | `TextAttributes.BOLD` |
| Custom `ink` variant | Bold | Legacy component contract |

Character substitutions are semantic rendering primitives: `█` may become `▀` on RGB terminals for independent top and bottom samples; `_`, `^`, `~`, and `,` encode shadow geometry and are never displayed literally.

## 4. Spacing & Layout

- Canvas: the exact four-row geometry from `art.ts`.
- Inter-word gap: one terminal cell.
- Hit area: exactly the combined art bounds; spaces are inert.
- Sampling: one terminal cell equals two vertical light samples on RGB-capable renderers.
- The overlay is absolute within the logo box and may not affect home-page layout.

## 5. Components

### Logo Pulse

- **Structure**: one relative box, one absolute mouse-capture box, four row boxes, and per-cell text renderables.
- **Variants**: native logo; optional custom shape/ink for internal reuse.
- **States**: static, hold delay, charging, auto-burst, release wave, glyph bloom, optional idle shimmer.
- **Interaction**: left-button down or initial drag on a non-space cell starts charge; up releases at the original press point; a full charge bursts automatically.
- **Accessibility**: the logo remains decorative and selectable text is disabled; no command or navigation is hidden behind the pointer interaction; `sound: false` provides a silent mode.
- **Motion**: a 16 ms frame loop runs only while an effect is active, except when explicitly enabled by `idle`.
- **Layout**: fixed four-row terminal cluster; the host remains the scroll owner.

### Sound Controller

- **Structure**: platform player selection, one owned hum process, fire-and-forget pulse processes, and a disposal boundary.
- **Variants**: enabled or silent; normalized volume `0..1`.
- **States**: idle, pending asset resolution, humming, stopping, disposed.
- **Reliability**: sequence tokens invalidate delayed starts; every burst, release, cleanup, and plugin disposal path terminates the owned hum.

## 6. Motion & Interaction

| Phase | Timing | Meaning |
|---|---:|---|
| Hold threshold | 90 ms | Filters accidental clicks before hum begins |
| Charge | Configurable, default 3000 ms | Builds field, arcs, sparks, and glyph trace |
| Pulse life | 1020 ms, combo-adjusted speed | Carries the release wave across the wordmark |
| Glyph bloom | 1600 ms | Lets the selected glyph settle after release |
| Combo window | 1500 ms | Escalates up to three consecutive bursts |
| Idle shimmer | 4600 ms period | Optional low-amplitude breathing sweep |

The frame loop must stop once rings, release, bloom, and hold are absent. Combo changes pulse force and travel speed but not the static logo. All movement conveys charge, release, or the explicitly configured idle state.

## 7. Depth & Surface

Depth is light-field based, not geometric. A press layers core, shell, ember, rotating arcs, forks, sparse sparks, and a localized sink. A release layers a sharp ring, broad swell, wake, shimmer, and glyph bloom. Shadow markers carry a delayed low-gain sample so the wordmark feels lit rather than recolored.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Static contrast and appearance remain exactly host-controlled.
- Sound is disabled by default; when enabled, it starts at a conservative volume.
- Animation never blocks keyboard input or changes layout.
- Idle CPU returns to baseline when `idle` is disabled.
- Theme changes are read from the host at render time.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| No reduced-motion host preference is exposed by the documented TUI plugin API | `index.tsx` | The effect is pointer-triggered and optional idle motion defaults off | Revisit if OpenCode exposes an accessibility preference |
| Windows audio is not a P0 validation target | `sfx.ts` | WSL is the primary environment in the PRD | Validate when the plugin is copied to Windows |
