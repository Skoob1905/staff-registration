# Component Glossary

## Section
A generic card container with an optional title, count badge, and CTA action. Wraps children in the base Card component.

- `title` — heading text
- `count` — optional number shown as `"Title (count)"`
- `action` — optional ReactNode rendered top-right (typically a Button)
- `children` — body content

## PaginatedSection
Extends Section with data fetching, accordion rendering, and pagination. Takes items from an external hook and renders them in an accordion with a pagination bar.

- `items` — data array
- `loading` — loading state
- `renderItem` — callback `(item, index) => ReactNode` for each accordion item
- `defaultPageSize` — optional (default 50)

## AccordionItem
An expandable/collapsible card built on `@radix-ui/react-accordion`. Each item has a header row and a body content area.

**Header layout (left to right):** `title` → `actions` → chevron
- `title` — main label, left-aligned, flex-1 (pushes everything right)
- `actions` — optional right-side content (company name, action buttons), rendered inside the trigger with `stopPropagation` so clicks don't toggle
- **chevron** — always at the far-right, rotates on open (`[[data-state=open]_&]:rotate-180`)
- **No `secondary` prop** — company/secondary labels belong inside `actions` (removed in May 2026 to simplify the header layout)

The header uses `group/header` on `Accordion.Header` so that parent-level hover effects can target children (e.g. `group-hover/header:opacity-100` to reveal action buttons on hover).

## PaginatedFilterSection
Extends PaginatedSection with a filter button and StaffFilterModal. The caller configures which filter dimensions are enabled.

- All PaginatedSection props, plus:
- `filters` / `onFiltersChange` — filter state
- `enableNameFilter`, `enableTypeFilter`, `enableTagFilter`, `enableAgencyFilter` — toggle filter UI sections
- `tags`, `agencies`, `staffTypes` — data sources for the filter modal
- `searchFields` — fields to client-side search by name
- `hideClear`, `emptyMessage`, `noMatchMessage` — display options
