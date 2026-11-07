# PikolGo Design System — Retro-Futurism

## Direction

PikolGo looks like a courtside control terminal from a future that still trusts
CRT displays. The interface should feel precise, fast, and a little arcade-like
without becoming a novelty. Data stays quiet and legible; colour, geometry, and
thin scanlines create the atmosphere.

**Principles**

1. **Readable first.** Neon is an accent, never the only signal. Body copy uses
   `--pikol-text`, not a saturated brand colour.
2. **Asymmetry with structure.** Hero panels, stat rails, and session layouts use
   a deliberate 1.6/1 or 1.25/0.75 split instead of equal three-column grids.
3. **Terminal, not toy.** Monospace type, compact labels, tabular numbers, and
   thin grid lines. Avoid cartoon shadows and sticker-like decoration.
4. **Calm motion.** Motion confirms state or hints at depth. It never delays a
   tap, moves form controls, or loops in the reader's peripheral vision.
5. **One system.** Marketing, auth, organizer, and public boards share the same
   tokens and primitives. Public boards may be more expressive, never separate.

## Colour

The dark theme is the primary expression. Light mode is a warm, sunlit terminal
that keeps the same hierarchy and accents.

### Dark theme core tokens

| Token | Value | Use |
| --- | --- | --- |
| `--pikol-bg` | `#0B0B18` | App background |
| `--pikol-bg-deep` | `#060611` | Header, footer, deep wells |
| `--pikol-surface` | `#15152A` | Cards, inputs, panels |
| `--pikol-surface-raised` | `#1A1A32` | Menus, raised rows, modals |
| `--pikol-primary` | `#0080FF` | Primary actions, links, focus states |
| `--pikol-secondary` | `#D91A72` | Secondary accent, destructive emphasis |
| `--pikol-cyan` | `#00D8E6` | Live state, focus ring, data highlights |
| `--pikol-purple` | `#5D34D0` | Gradient depth, decorative panels |
| `--pikol-pink` | `#D92CC8` | Gradient depth, special emphasis |
| `--pikol-silver` | `#C0C0C0` | Second place, muted metallic detail |
| `--pikol-gold` | `#FFD700` | First place, qualifying highlight |
| `--pikol-success` | `#20C979` | Checked in, published, positive delta |
| `--pikol-warning` | `#F2B84B` | Waiting, needs attention |
| `--pikol-danger` | `#EF476F` | Errors, destructive actions |
| `--pikol-text` | `#E8E8F2` | Primary text |
| `--pikol-text-muted` | `#9B9BB2` | Secondary text, metadata |
| `--pikol-border` | `#343454` | Borders and dividers |
| `--pikol-focus` | `#00D8E6` | Keyboard focus ring |

Light mode reuses the token names with a warm-paper palette and darker accents
so text contrast remains AA or better. Tailwind semantic tokens
(`background`, `foreground`, `card`, `primary`, etc.) mirror these values for
existing components.

### Colour rules

- One primary action per panel. Link-style actions use `--pikol-cyan` or
  `--pikol-primary`, not a second filled button.
- Status never relies on colour alone: pair it with a label, icon, or border.
- Magenta and purple are atmospheric or secondary. Do not use them for body text.
- Gold, silver, and bronze are reserved for podium/qualification meaning.
- Error text uses `--pikol-danger` on a surface with a visible border.

## Typography

- **Family:** `Geist Mono` via `next/font`, with a system monospace fallback.
- **Scale:** `text-xs` labels, `text-sm` body compact, `text-base` standard body,
  `text-lg` panels, `text-2xl`/`text-3xl` page titles, `text-4xl`–`text-6xl` hero.
- **Headings:** semibold/bold, tight tracking, optional uppercase for short labels.
- **Body:** normal weight, `leading-relaxed` for prose, `text-pretty`.
- **Labels:** uppercase, `tracking-[0.12em]`, small and muted.
- **Numbers:** `tabular-nums` for scores, ranks, timers, and records.
- Avoid long uppercase sentences. Uppercase is for kickers, status, and buttons.

## Spacing and Layout

- Base rhythm: **8px**; common gaps are 8, 12, 16, 24, 32, 48, 64.
- Page container: `max-width: 1280px`, horizontal padding `1.5rem`.
- Cards: 12–16px radius, 20–28px padding, one-pixel border.
- Sections: 32px internal gap, 48–80px vertical rhythm on marketing pages.
- Mobile stacks before content gets cramped; use `sm:`, `md:`, and `lg:` changes.
- Use `min-h-[100dvh]`, never `h-screen`.
- Dense organizer panels keep 36–40px controls; primary mobile controls target
  44px.

### Z-index contract

| Layer | Value |
| --- | --- |
| Base content | `0` |
| Decorative background | `-10` |
| Scanline overlay | `90` |
| Sticky nav | `100` |
| Dropdowns / selects | `200` |
| Dialogs / drawers | `300` |
| Toasts | `500` |

## Shape and Effects

- Reverse-cut corners are the signature shape: use `.retro-corners` on feature
  panels and public-board headers, not every card.
- Cards get a hairline border and a subtle inner top highlight
  (`linear-gradient` from cyan at 8% opacity to transparent).
- Neon glow is limited to primary buttons, live badges, and meaningful focus.
  Keep glows under 24px blur and under 35% opacity.
- CRT scanlines: fixed, 2–3% opacity, pointer-events none, below dialogs.
- Perspective grid: background only, low contrast, masked toward the viewport
  edges. Never place it behind small text without a surface.
- Glitch decoration: one short hero/accent moment. No glitch on forms, scores,
  live timers, or text needed to complete a task.

## Motion

- Durations: 120ms for taps, 180ms for hover, 260ms for reveals.
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Animate only `transform` and `opacity` for non-essential movement.
- Respect `prefers-reduced-motion`: remove glitch/scanline movement, reveals,
  and smooth scrolling. Keep state changes immediate and visible.
- Loading states use skeletons with the same final dimensions. No layout shift.

## Components

### Buttons

- Default: blue fill, dark ink text for contrast, subtle lower edge, 1px border.
- Outline: transparent surface, cyan-tinted border, text brightens on hover.
- Secondary: raised surface with silver text.
- Ghost: no border until hover; used inside dense rows.
- Destructive: danger fill or danger outline, explicit label.
- Focus: 2px cyan outline, 2px offset, visible in both themes.

### Cards and panels

- Surface card: `--pikol-surface`, hairline `--pikol-border`, 12px radius.
- Interactive cards lift 2px and brighten the border; no large shadows.
- Header rows may use a subtle cyan/blue line or corner cut, but body content
  stays on a plain surface.
- Empty states include a short cause and the next action.

### Badges

Variants map to meaning: `live` (cyan), `success`, `warning`, `danger`,
`podium`, `draft`, `preparing`, `up-next`, `playing`, `completed`. Always include
text; never rely on a coloured dot alone.

### Forms

- Labels above controls, 8px gap, optional helper text below.
- Inputs: 44px minimum height, surface fill, border, 12px radius.
- Focus: cyan border + 2px ring; invalid: danger border and message.
- Errors appear near the field and at form level with `role="alert"`.
- Native selects are styled to match inputs; no invisible controls.
- Checkboxes are 20px with a visible checked state and full-row click target.

### Navigation

- Sticky, translucent deep background, 1px bottom border, 100 z-index.
- Logo is the supplied PNG wordmark, never a recreated icon.
- Desktop: logo, primary destination, theme control, auth actions.
- Mobile: logo + theme + auth/menu; no horizontal page overflow.
- Mobile menu closes on navigation, Escape, and outside interaction.
- Current route is indicated by text brightness and an underline/edge, not colour
  alone.

### Tables

- Sticky header only when a table scrolls independently.
- Row hover is a subtle surface change. Podium rows also carry a left border and
  a text label.
- Horizontal overflow is contained; the page itself never scrolls sideways.

### Dialogs

- 300 z-index, surface-raised panel, dim backdrop, 1px border.
- Title and description are always present for assistive tech.
- Content scrolls inside the dialog on short screens; close control is 44px.
- Focus trap and focus restoration come from Radix. Do not reimplement.

## Route Patterns

- **Landing:** asymmetric hero with product-console preview, data rail, varied
  feature mosaic, three-step rotation, live-board showcase, pricing, final CTA.
- **Auth:** centred console panel, logo above, one focused task, back link.
- **Dashboard:** greeting + primary action, club cards as command modules.
- **Club:** club identity bar, tabs, stat rail, then one primary work area.
- **Session:** control header, courts/live data, queue rail, lineup pipeline,
  history, standings. Dense but never compressed below touch size.
- **Public live board:** logo, club/session identity, LIVE state, courts first,
  then ready/up-next/preparation, queue, standings. No private data.
- **404/error/loading:** same surface language, plain explanation, one way back.

## Accessibility

- Target WCAG 2.2 AA: 4.5:1 body text, 3:1 large text and UI boundaries.
- Every interactive element is reachable by keyboard with a visible focus ring.
- Icon-only controls have an accessible name.
- Status changes exposed in text are also available to screen readers.
- Public boards must not expose emails, internal IDs, auth claims, or controls.
- Reduced motion is a hard requirement, not a progressive enhancement.
- Never place decorative overlays above form controls or dialog content.

## Performance

- CSS effects only; no animation library.
- Background noise/grid uses CSS gradients, not large images.
- Logo uses `next/image`; priority only in the header/hero.
- Avoid unnecessary client components. Navigation, dialogs, and timers are
  client boundaries; page data and public boards stay server-rendered.
- No layout shift from fonts, images, skeletons, or live data badges.

## Responsive QA

Check 375px, 768px, 1024px, and 1440px. At every width:

- No horizontal overflow.
- Logo remains legible and not stretched.
- Touch targets are at least 44px for primary mobile actions.
- Tables scroll inside their card.
- Sticky header does not cover anchored content.
- Dialog content is reachable above the mobile keyboard.
- Reduced-motion mode has no decorative movement.
