# Typography System

## Files
- `src/config/typography.ts` — React component primitives
- `src/config/theme.ts` — `typeface` property (font-family stack)
- `src/config/types.ts` — `Theme.typeface` definition
- `src/index.css` — uses `var(--font-family)` on `body`

## Global Typeface
The font-family is set via the `typeface` property in the theme config (`src/config/theme.ts`). It maps to `--font-family` CSS variable and is applied to `body` in `index.css`.

**Current value:** `'Manrope', 'Avenir Next', 'Segoe UI', sans-serif`

To change the app-wide typeface, edit the `typeface` property in `darkTheme` (and `lightTheme`) inside `src/config/theme.ts`. No other file changes needed.`

## Overview
All text styling in the app is managed via reusable React components. Every component accepts `children`, optional `className` (appended to the base), and optional `as` to override the rendered HTML tag.

## Components

| Component | Default Tag | Classes | Use Case |
|---|---|---|---|
| `H1` | `h2` | `text-base sm:text-lg font-bold text-[var(--foreground)]` | Section/dialog headings — *the* primary heading |
| `H2` | `h3` | `text-sm sm:text-base font-bold text-[var(--foreground)]` | Sub-section headings, modal section labels |
| `H3` | `h4` | `text-sm font-semibold text-[var(--foreground)]` | Tier‑3 headings |
| `Body` | `p` | `text-xs sm:text-sm text-[var(--foreground)]` | Regular paragraph / readable text |
| `BodyBold` | `p` | `text-xs sm:text-sm font-semibold text-[var(--foreground)]` | Bold paragraph emphasis |
| `BodyMedium` | `p` | `text-xs sm:text-sm font-medium text-[var(--foreground)]` | Medium-weight body text |
| `Muted` | `p` | `text-xs sm:text-sm text-[var(--muted-foreground)]` | Secondary / helper / muted text |
| `Caption` | `p` | `text-xs text-[var(--muted-foreground)]` | Tiny labels, timestamps, footnote-style text |
| `Label` | `label` | `text-xs sm:text-sm font-medium text-[var(--foreground)]` | Form `<label>` elements |

## Usage Rules

1. **Prefer the component over raw classes.** Every new piece of text should use one of the components above.
2. **Add extras via `className`.** Don't recreate the base class string — pass margin/padding/width overrides as props.
   ```tsx
   <Muted className="mt-2">Some helper text</Muted>
   ```
3. **Override the tag with `as`.** If you need a different element (e.g. a `<span>` inside a flex row):
   ```tsx
   <Muted as="span">Small inline text</Muted>
   ```
4. **Do NOT use `H1` for page-level `<h1>`.** The name reflects its visual role (section heading), not its semantic level. Use `as="h1"` if you need an `<h1>`.
5. **`Label` already renders `<label>`.** Add `htmlFor` directly:
   ```tsx
   <Label htmlFor="email">Email</Label>
   ```

## Usage by File

### H1 (3 occurrences)
- `SignModal.tsx:105` — dialog title
- `StaffFilterModal.tsx:109` — dialog title
- `AssignModal.tsx:71` — dialog title

### H2 (5 occurrences)
- `StaffFilterModal.tsx:116,130,166` — section labels (Name, Tags, Clients)
- `AssignModal.tsx:77,105` — section labels (Tags, Clients)

### H3 (0 occurrences)
- Available but not yet in use.

### Body (2 occurrences)
- `AddModal.tsx:511` — auto-assign summary as `<div>`
- `AddModal.tsx:571` — duplicate confirmation description

### BodyBold (0 occurrences)
- Available but not yet in use.

### BodyMedium (2 occurrences)
- `ImportHistory.tsx:236` — import file name (truncated)
- `AddModal.tsx:433` — file-selection prompt

### Muted (21 occurrences — most-used component)
- `AddModal.tsx:453` — file info (span)
- `FilterView.tsx:175,179,185` — loading / empty / no-match text
- `StaffFilterModal.tsx:134,140,170` — tag/client empty states
- `AssignModal.tsx:81,109` — tag/client empty states
- `ImportHistory.tsx:201,205,266,298` — empty state + dialog descriptions
- `AdminPage.tsx:229,231,318,361` — loading, empty, confirm messages
- `StaffPage.tsx:480,527` — confirm messages
- `ClientsPage.tsx:123,125` — loading + empty state

### Caption (8 occurrences)
- `PaginationBar.tsx:84,141` — page info text (span)
- `ImportHistory.tsx:239` — import timestamp
- `ProfilePage.tsx:47,57,67` — field labels (Email, Role, Company)
- `AddModal.tsx:436` — caption below file picker
- `AddModal.tsx:502` — upload status caption

### Label (11 occurrences)
- `LoginPage.tsx:107,117,168` — Email, Password, Forgot Email
- `AdminPage.tsx:367,377` — Client, Email fields
- `UploadPage.tsx:71,89` — Category, File fields
- `AdminUploadPage.tsx:88,103,118,129` — Staff Member, Upload Type, Period, File
