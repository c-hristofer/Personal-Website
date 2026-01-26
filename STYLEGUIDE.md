# Styling System

This project now uses a layered global stylesheet located in `src/styles/`:

1. `tokens.css` – design tokens (colors, typography, spacing, radii, shadows, layout measurements).
2. `base.css` – modern reset, typography defaults, form and button primitives, global focus/scrollbar styles.
3. `layout.css` – site-wide layout patterns such as `.container`, `.section`, `.stack`, `.grid`, `.cluster`, `.card`, `.hero`, and the page shell.
4. `components.css` – nav/menu, theme toggle, cards/panels, dashboard widgets, tables, TOC modal, modals, and page-specific modules built with the shared tokens.

`src/styles/style.css` simply imports the files above to keep ordering predictable.

## Design Tokens (`tokens.css`)

- **Typography:**
  - Families: `--font-sans`, `--font-mono`
  - Sizes: `--fs-xxs` … `--fs-xxl` (fluid clamp scale)
  - Line heights: `--lh-tight`, `--lh-normal`, `--lh-relaxed`
  - Weights: `--fw-regular`, `--fw-medium`, `--fw-semibold`, `--fw-bold`
- **Spacing:** `--space-1` (4px) … `--space-10` (fluid section spacing)
- **Radii:** `--radius-sm`, `--radius-md`, `--radius-lg`
- **Colors:** `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-text`, `--color-muted`, `--color-border`, `--color-border-strong`, `--color-primary`, `--color-primary-strong`, `--color-primary-contrast`, `--color-link`, `--color-link-hover`, `--color-accent`, `--color-danger`, `--color-success`, `--color-warning`, `--color-info`, plus semantic helpers for Wordle tiles.
- **Shadows:** `--shadow-1`, `--shadow-2`
- **Layout:** `--container-max`, `--container-pad`, `--cluster-gap`, `--grid-gap`

Dark mode overrides the palette while reusing the same semantic names so components don’t change.

## Base Layer (`base.css`)

- Applies `box-sizing: border-box` everywhere, sets body typography/background, and normalizes lists, media, and tables.
- Links inherit tokenized colors with hover/focus states.
- Forms inherit font settings and use the border + focus tokens.
- Buttons share a primary style by default; `.btn`, `.btn--secondary`, `.btn--ghost`, `.btn--danger` modifiers live in `components.css` when a variant is needed.
- Accessibility helpers: `.sr-only`, consistent `:focus-visible`, reduced-motion guard, custom scrollbar styling.

## Layout Patterns (`layout.css`)

- `.app-container` / `.content`: vertical flex shell to keep footer pinned while respecting background tokens.
- `.container`: centered wrapper using `--container-max` and responsive side padding.
- `main` gains consistent max-width, padding, border, and shadow so every page’s primary content matches.
- `.section`: vertical spacing helper; `.stack` & `.stack-tight` manage vertical rhythm.
- `.grid`, `.grid-2`, `.grid-3`: responsive grids that collapse on small screens without overflow.
- `.cluster`: horizontal flex row with wrapping for chip/button groups.
- `.hero`, `.page-title`, `.badge`: hero states and section headings.
- `.card` / `.panel` / `.table-scroll`: reusable card/panel surfaces, plus responsive table wrapper.

## Components (`components.css`)

- Header + nav overlay share consistent spacing, filters, and responsive behavior for the theme toggle and menu button.
- `.theme-toggle` implements the Light/Dark/System segmented control using the shared button primitives.
- `.toc-*`, `.main-card`, `.flightpath-section`, `.makemore-section`, `.basketball-section`, `.dashboard`, `.signin-page`, `.toc`, `.scrollable-*`, `.rps-buttons`, `.guess-grid`, etc. reuse the tokens for padding, borders, and typography.
- Button modifiers: `.btn`, `.btn--secondary`, `.btn--ghost`, `.btn--danger` give consistent alternative states; destructive buttons also use the shared `--color-danger` token.
- Tables, forms, and checkbox styles align with the base focus ring and accent color for accessibility.

## Building New UI

1. Wrap new pages/sections inside `<main>` or a `.section` + `.container` pair to inherit max-width and spacing.
2. Use `.stack` for vertical rhythm or `.grid-2` / `.grid-3` for responsive cards. Avoid manual margins except for exceptions noted above.
3. Apply the `.card`/`.panel` class (or extend via BEM selectors) for any boxed surface so borders/shadows stay consistent.
4. Buttons should rely on the default `<button>` style or the `.btn--*` modifiers; don’t inline colors.
5. Reference `tokens.css` whenever a new semantic value is required. If a new semantic color or spacing requirement emerges, add it in `tokens.css` first, then consume it.
6. For bespoke modules, colocate styles in `components.css` but keep them token-based and grouped under a clear comment block.

Following these steps keeps spacing, typography, and contrast predictable on iPhone/Android and desktop browsers.
