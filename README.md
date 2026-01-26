# Personal Website

## Theme system
- Light, Dark, and System modes are supported globally. System mode follows the OS preference in real time through `matchMedia('(prefers-color-scheme: dark)')`.
- The current preference is stored in `localStorage` under `theme-preference`. When the preference is `system`, the resolved light/dark value is stored on `<html data-theme="..." data-theme-source="...">` and updates live.
- `src/theme.js` exposes `themeManager.init()`, `getPreference()`, `getEffectiveTheme()`, `setPreference(mode)`, and `subscribe(callback)` so components can read and react to theme changes.
- A no-FOUC inline script in `public/index.html` resolves the preference before any CSS is parsed to prevent a flash of incorrect colors.

## Design tokens
All global colors, borders, and shadows live in `src/styles/style.css` as CSS custom properties. Key tokens:

```
--color-bg, --color-surface, --color-surface-2
--color-text, --color-muted, --color-border, --color-border-strong
--color-primary, --color-primary-strong, --color-primary-contrast
--color-link, --color-link-hover, --color-accent, --color-danger
--color-wordle-absent, --color-wordle-present, --color-wordle-correct
--color-primary-soft, --color-primary-softer, --color-overlay-soft
--shadow-1, --shadow-2
```

Add new components by referencing variables instead of hard-coding colors (e.g., `background: var(--color-surface)` and `color: var(--color-text)`). When you need a new semantic color, add it once at the top of `style.css` with both light and dark values.

## UI toggle and assets
- The header always renders the segmented theme toggle (`src/components/theme-toggle.js`) which uses a radiogroup for keyboard and screen reader access. “System” shows the currently resolved theme label, and arrow keys move between modes.
- The site logo stays legible in both themes via a neutral header background and the `--logo-filter` token. Replace `public/icons/logo.png` with light/dark variants as needed by updating that filter or swapping the image source in `Nav`.

## Adding themed components
1. Import `../styles/style.css` (already done in existing components).
2. Structure markup so containers can inherit `background-color: var(--color-bg)` and default text colors.
3. Use the semantic tokens for borders, cards, and shadows (`var(--shadow-1)` or `var(--shadow-2)`).
4. Prefer `currentColor` for SVG/icon fills; otherwise, add both light & dark asset variants or tint via CSS filters similar to the logo approach.
5. When adding animations or transitions, wrap them in `@media (prefers-reduced-motion: reduce)` guards like the existing pattern.
