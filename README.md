# OpenCode Logo Pulse

[English](README.en.md) | **简体中文**

复活早期 OpenCode 版本自带、后来被移除的主页 logo 交互彩蛋。按住一个实心的 logo 格子蓄力，松手把脉冲送进整个字标。

静止状态完整保留 OpenCode 原生的四行几何；动画与音效在交互之前保持休眠，且声音默认关闭。

## 背景

早期 OpenCode 在主页 logo 里藏了一个出乎意料地精致的交互：指针驱动蓄力、松手激起波浪、连击升级，还有同步音效。随着 TUI 演进，这个彩蛋消失了。

OpenCode Logo Pulse 把这个官方彩蛋以本地 TUI 插件的形式带了回来：静止时保留当前原生 logo，效果适配当前主题，并提供显式配置与生命周期清理，让它能安全地活在 OpenCode 核心之外。

## 体验

- **按住：** 经过短暂的防误触判定后，能量在指针下汇聚，描过选中的字形。
- **松手：** 蓄力化作一道主题色的波浪，字形留下短暂的余辉。
- **满蓄：** 按住满 `charge_ms` 自动触发爆发；之后再松手不会重复触发。
- **拖出：** 离开 logo 立即释放，并可靠地停止蓄力音效。
- **快速连发：** 1.5 秒内的连续交互会叠出三级连击，提升力度与传播速度。
- **主题原生：** 静态墨色、能量、高光与阴影都取自当前 OpenCode 主题。
- **闲时友好：** `idle: false` 时，logo 不被使用就不跑任何帧计时器。

只有左键点在可见的 logo 格子上才生效；空白格与其他按键保持惰性，也没有任何键盘命令或导航藏在这个效果后面。

## 环境要求

- 带 TUI 插件 API 的 OpenCode，已在 OpenCode 1.18.9 上测试。
- [Bun](https://bun.sh/)，用于安装、检查与部署。
- 可选的声音播放需要一个本地播放器：`ffplay`、`mpv`、`play`、`afplay` 或 `aplay` 之一。

## 安装

```bash
git clone https://github.com/WhiteGiverMa/opencode-logo-pulse.git
cd opencode-logo-pulse
bun install
bun run typecheck
bun run deploy
```

`bun run deploy` 会把插件和 WAV 资源复制到：

```text
~/.config/opencode/plugins/logo-pulse
```

然后把插件加入 `~/.config/opencode/tui.json`：

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

已有的 TUI 设置可以与 `plugin` 并存。部署或修改 `tui.json` 后重启 OpenCode。

## 配置

所有选项都是可选的。

| 选项 | 类型 | 默认 | 取值 | 效果 |
|---|---|---:|---|---|
| `sound` | boolean | `false` | `true`、`false` | 启用蓄力低鸣与交替的脉冲音效。 |
| `volume` | number | `0.3` | `0` 到 `1` | 各效果独立增益之前的总音量，越界会被钳制。 |
| `charge_ms` | number | `3000` | `91` 到 `30000` | 自动满蓄爆发所需的毫秒数，取整并钳制。 |
| `idle` | boolean | `false` | `true`、`false` | logo 闲置时启用缓慢、低幅度的微光。 |
| `enhanced` | boolean | `true` | `true`、`false` | 使用多段 primary/secondary/white 能量渐变；关闭则回到简单的旧版渐变。 |

最小配置（全部使用默认值）：

```json
{
  "plugin": ["./plugins/logo-pulse/index.tsx"]
}
```

显式开启声音：

```json
{
  "plugin": [
    ["./plugins/logo-pulse/index.tsx", { "sound": true, "volume": 0.2 }]
  ]
}
```

## 声音行为

插件从平台回退列表中选择第一个可用的播放器，并接管它启动的每个进程。蓄力时间超过 WAV 资源长度时低鸣会循环；松手、拖出、焦点丢失、插件停用和 OpenCode 退出都会终止这个低鸣进程。

如果开了声音却听不到：

1. 确认装了一个受支持的播放器，例如 `ffplay -version`。
2. 确认 `sound` 为 `true` 且 `volume` 大于 `0`。
3. 修改 `tui.json` 后重启 OpenCode。

没有可用播放器时，视觉交互不受影响。

## 开发

```bash
bun run test
bun run typecheck
bun run deploy
```

- `bun run test` 覆盖静态保真、主题重绘、蓄力/释放、指针逃逸、自动爆发、按键过滤、闲置动效、旧版渐变与连击行为。
- `bun run typecheck` 检查插件与测试脚手架的 TypeScript，不产出文件。
- `bun run deploy` 刷新全局 OpenCode 插件副本。

与原生主页对比时，用不带外部 TUI 插件的方式启动 OpenCode：

```bash
opencode --pure
```

## 更新

```bash
git pull --ff-only
bun install
bun run typecheck
bun run deploy
```

重启 OpenCode 加载新文件。

## 卸载

1. 从 `~/.config/opencode/tui.json` 的 `plugin` 数组中移除 `./plugins/logo-pulse/index.tsx`。
2. 可选：删除 `~/.config/opencode/plugins/logo-pulse`。
3. 重启 OpenCode。

OpenCode 会回到原生的静态主页 logo。

## 许可

[MIT](LICENSE) © 2026 WhiteGiverMa
