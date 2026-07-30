#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins/logo-pulse"

install -d "$target/assets"
install -m 0644 "$root/plugin/index.tsx" "$root/plugin/art.ts" "$root/plugin/sfx.ts" "$target/"
install -m 0644 "$root/plugin/assets/"*.wav "$target/assets/"

printf 'Deployed logo-pulse to %s\n' "$target"
