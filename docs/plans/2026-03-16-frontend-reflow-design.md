# Frontend Reflow Design — Cursor/Bolt Style

**Date:** 2026-03-16
**Style:** Cursor/Bolt — dark, clean, generous spacing, emerald accent
**Scope:** Full reflow — Design System First approach

---

## 1. Design Tokens

### Colors (standardize usage — eliminate all hardcoded values)
All components must use CSS variables. Zero inline hex/rgba values.

### New shadow tokens
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md: 0 4px 12px rgba(0,0,0,0.4);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
```

### Border radius (standardize)
```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
```

### Interactive states
- Zero `onMouseEnter/Leave` inline handlers — all via CSS `:hover`
- Standard transition: `transition-colors duration-150`
- All buttons use `<Button>` component, no raw `<button>` with Tailwind

---

## 2. Component Changes

### Header.tsx
- Replace inline JS hover handlers with CSS hover classes
- Keep current layout (clean)

### CloudPanel.tsx
- Extract each section into standalone component
- Nav: accent bar active, subtle hover
- Overview cards: soft shadow, micro hover scale (1.01)
- More breathing room (padding)

### admin.tsx
- Full redesign: icon cards, grid layout, status glow dots
- SQL results in formatted table (not raw JSON)
- Collapsible sections

### ChatBox.tsx
- Extract toolbar items into smaller components
- Reduce clutter below textarea

### PublishButton.tsx
- Migrate inline styles to CSS variables

### Preview.tsx
- Keep logic (1500 lines), only standardize CSS to variables

### projects.tsx
- Add search bar
- Keep existing card design

---

## 3. Implementation Tasks (parallel-safe)

1. **Tokens:** Add shadow/radius vars to variables.scss, eliminate hardcoded colors across all files
2. **Header:** Replace inline hover handlers with CSS classes
3. **CloudPanel:** Extract sub-components, improve spacing/layout
4. **Admin:** Redesign with cards, tables, collapsible sections
5. **ChatBox:** Extract toolbar components, clean layout
6. **PublishButton:** Migrate to CSS variables
7. **Preview + Projects:** CSS standardization + search bar
