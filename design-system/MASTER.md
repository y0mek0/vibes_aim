# vibes_aim — Design System MASTER

> Single source of truth for visual tokens, layout rules, and component primitives. Every CSS rule and every component must reference these tokens. Do not invent values outside this file.

## 1. Product frame

- **Product type:** browser aim-trading game. Desktop-first.
- **Brand idea:** "A trading terminal that respects your trigger finger." Aim and chart live on the same screen. No decorative chrome.
- **Style archetype (locked):** "Quiet Terminal." Dark background, near-black panels, sharp 1px hairlines, monospaced numbers, sans-serif UI. No glow-as-decoration, no pill buttons, no rounded oversized cards.
- **Density:** medium-high. Information must fit without scrolling in a 1440×900 viewport.

## 2. Color tokens

Backgrounds and surfaces

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0b0d12` | App background (canvas / page) |
| `--bg-2` | `#11141b` | Overlay panels, cards |
| `--bg-3` | `#171b24` | Inputs, deep surfaces |
| `--line` | `rgba(255,255,255,0.06)` | Hairline dividers (1px) |
| `--line-strong` | `rgba(255,255,255,0.12)` | Active borders |

Text

| Token | Hex | Use |
|---|---|---|
| `--fg` | `#e6e8ee` | Primary text |
| `--fg-dim` | `#8a91a0` | Secondary text, kickers |
| `--fg-mute` | `#5b6172` | Tertiary / placeholder |

Stock accent palette (the chart and the badge both read from this)

| Token | Hex | Use |
|---|---|---|
| `--aapl` | `#c9ccd1` | AAPL — silver/cool gray (matches user's "gray/silver" brief) |
| `--aapl-dim` | `#5d626a` | AAPL lowlight |
| `--nvda` | `#7df9c5` | NVDA — green neon (user brief) |
| `--nvda-dim` | `#2b6b54` | NVDA lowlight |
| `--spcx` | `#ffb347` | SPCX — warm amber (SpaceX association, distinct from green/red) |
| `--pre` | `#9aa3b2` | Pre-IPO placeholder (closed/awaiting) |
| `--loss` | `#ff5d6c` | Down tick, P/L negative |
| `--gain` | `#7df9c5` | Up tick, P/L positive (shares value with NVDA intentionally) |

System

| Token | Hex | Use |
|---|---|---|
| `--accent` | `--nvda` | Default action accent (primary CTA) |
| `--accent-dim` | `--nvda-dim` | Hover/active state |
| `--warn` | `#ffb347` | Same as SPCX; reserved for warnings |
| `--danger` | `#ff5d6c` | Same as loss; destructive actions |

## 3. Typography

| Token | Family | Weight | Use |
|---|---|---|---|
| `--font-ui` | `'Inter', system-ui, sans-serif` | 400/600/700 | Body, labels, buttons, headings |
| `--font-mono` | `'JetBrains Mono', ui-monospace, monospace` | 400/600 | Numbers, prices, tickers, stats, kickers |

Type scale (px, line-height)

| Token | Size / LH | Use |
|---|---|---|
| `--fs-kicker` | 11 / 1.4 | Kickers (`// vibes_aim`) |
| `--fs-small` | 12 / 1.4 | Notes, secondary |
| `--fs-body` | 14 / 1.45 | Default UI |
| `--fs-stat` | 13 / 1.3 | HUD readouts |
| `--fs-h2` | 18 / 1.3 | Section titles |
| `--fs-h1` | 28 / 1.2 | Hero titles |
| `--fs-price` | 22 / 1.1 | Hero price in trade row |

Rules

- Numbers (`stats`, prices, balances) must use `--font-mono`.
- Tabular figures are enforced by `font-variant-numeric: tabular-nums` on `.num`.
- All uppercase kickers use `letter-spacing: 0.18em` and `--font-mono`.

## 4. Spacing

A 4-px scale. Use tokens, do not write raw px gaps in components.

| Token | px |
|---|---|
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 24 |
| `--space-6` | 32 |
| `--space-7` | 48 |

## 5. Radius

Sharp-corner UI (per house rules).

| Token | px |
|---|---|
| `--radius-1` | 2 |
| `--radius-2` | 4 |
| `--radius-3` | 8 |
| `--radius-pill` | 999 (reserved for chip-style tags only; not buttons) |

Default surfaces use `--radius-2`. Cards use `--radius-3`. Inputs and buttons do not use pill radius.

## 6. Motion

- Allowed properties: `transform`, `opacity`. Never `width`, `height`, `top`, `left`, `margin` for animation.
- Default easing: `cubic-bezier(0.32, 0.72, 0, 1)` (custom, not `linear`/`ease-in-out`).
- Default duration: `160ms` for hovers, `220ms` for state changes, `320ms` for enter/exit.
- `prefers-reduced-motion: reduce` → durations collapse to `0.01ms`, no transforms.

## 7. Layout primitives

- `#app` is the page root. No horizontal scroll. `body { overflow-x: hidden }` is mandatory.
- The aim canvas is the only `position: fixed` layer (z-index 0).
- HUD chips (score, streak, mode label) are `position: fixed` overlays (z-index 5) and never `backdrop-filter` on scroll containers.
- Trading terminal uses a CSS grid: `grid-template-columns: 280px 1fr 320px;` on viewports ≥ 1180px; collapses to a single column below that.
- No `h-screen`; use `min-height: 100dvh` to survive mobile Safari URL bar (in case we ever enable it).

## 8. Component contracts

### Stock badge (`.stock`)

- 1px hairline border in `--line-strong`.
- Left: 6px wide vertical bar in the stock's accent (`--aapl` / `--nvda` / `--spcx` / `--pre`).
- Right: ticker in `--font-mono` uppercase + sub-label in `--fs-small`.
- Padding: `--space-2` `--space-3`. Radius: `--radius-2`.

### Primary button (`.btn`)

- Background: `--accent`. Text: `#04140c` (deep green, reads as ink on the neon green).
- Padding: `--space-3` `--space-5`. Radius: `--radius-2`. No drop-shadow.
- Hover: `transform: translateY(-1px); background: var(--accent-dim);` (only transform + background; no shadow).
- Active: `transform: translateY(0);` — feels like a physical press.
- Disabled: `background: var(--line); color: var(--fg-dim); cursor: not-allowed;`.

### Ghost button (`.btn-ghost`)

- Background: transparent. Border: `1px solid var(--line-strong)`. Color: `--fg`.
- Hover: `border-color: var(--accent); color: var(--accent);` (color change only).

### Panel (`.panel`)

- Background: `--bg-2`. Border: `1px solid var(--line)`. Radius: `--radius-3`.
- Padding: `--space-5`. No shadow, no gradient.
- Header row uses `.panel-head` with a kicker (`--fs-kicker`) and an optional right-aligned action.

### Number cell (`.num`)

- `font-family: var(--font-mono); font-variant-numeric: tabular-nums;`
- Negative variant `.num.neg` → `color: var(--loss);`
- Positive variant `.num.pos` → `color: var(--gain);`

### Hairline divider (`.hr`)

- `height: 1px; background: var(--line); border: 0;`

## 9. Anti-patterns (do not ship)

- No emoji as icons.
- No `box-shadow` larger than `0 1px 0 rgba(0,0,0,0.4)` — we are flat.
- No `backdrop-filter: blur(...)` on any scrollable container.
- No pill-shaped buttons.
- No `transition: all` — name the properties.
- No raw hex colors in components — always reference a token.
- No `<input type="number">` for prices. We render prices as `<span class="num">`; the inputs are order-size sliders, not free text.

## 10. Accessibility baseline

- Body text contrast vs `--bg`: ≥ 7:1 (`#e6e8ee` on `#0b0d12` = 16.4:1, passes AAA).
- Dim text vs `--bg`: ≥ 4.5:1 (`#8a91a0` on `#0b0d12` = 6.7:1, passes AA).
- All interactive elements are keyboard-reachable; the `Esc` key returns to the menu (already implemented in the engine).
- `prefers-reduced-motion: reduce` respected globally.

## 11. Stage 2 acceptance gates

- `client/css/style.css` is fully token-driven — no raw hex outside `:root`.
- `tests/css.test.mjs` passes (it already does).
- A smoke check: a one-liner `grep -RE "#[0-9a-fA-F]{6}" client/css/style.css | grep -v ":root"` returns zero matches. If it does not, fix the CSS, do not weaken the rule.
