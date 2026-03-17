# Frontend Reflow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full frontend reflow using Design System First approach — Cursor/Bolt dark clean style with consistent tokens, zero hardcoded colors, zero inline hover handlers, and polished layouts across all screens.

**Architecture:** Add missing design tokens to variables.scss (shadows, radius-xl, semantic bg vars). Then sweep all components to replace hardcoded values with CSS variables and inline JS hover handlers with CSS classes. Finally polish rough screens (Admin, CloudPanel, ChatBox, Projects).

**Tech Stack:** React, Remix, Tailwind CSS, CSS custom properties (variables.scss), Framer Motion

---

### Task 1: Design Tokens — Add missing vars to variables.scss

**Files:**
- Modify: `app/styles/variables.scss`

**Step 1: Add shadow, radius-xl, and semantic background tokens**

Add after line 39 (after `--radius-full`):

```scss
  --radius-xl:              16px;

  /* === Shadows === */
  --shadow-sm:              0 1px 2px rgba(0,0,0,0.3);
  --shadow-md:              0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg:              0 8px 24px rgba(0,0,0,0.5);
  --shadow-popover:         0 20px 60px -12px rgba(0,0,0,0.4);

  /* === Semantic backgrounds === */
  --error-muted:            rgba(239,68,68,0.08);
  --error-border:           rgba(239,68,68,0.2);
  --success-muted:          rgba(34,197,94,0.1);
  --success-border:         rgba(34,197,94,0.2);
  --warning-muted:          rgba(245,158,11,0.1);
  --warning-border:         rgba(245,158,11,0.2);
```

**Step 2: Commit**
```bash
git add app/styles/variables.scss
git commit -m "style: add shadow, radius-xl, semantic bg tokens"
```

---

### Task 2: Header — Replace inline hover handlers with CSS

**Files:**
- Modify: `app/components/header/Header.tsx`

**Step 1: Replace all 4 inline hover handler pairs with CSS classes**

The file has 4 buttons/links with `onMouseEnter`/`onMouseLeave` setting style properties. Replace each with a CSS utility class pattern.

For example, the sidebar toggle button (line 69-84):
```tsx
// BEFORE
<button
  style={{ color: 'var(--text-tertiary)' }}
  onMouseEnter={e => { ... }}
  onMouseLeave={e => { ... }}
>

// AFTER — use a reusable class pattern
<button
  className="... text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
>
```

Apply same pattern to: sidebar toggle, Projects link, Settings gear, Convert to Project button.

Remove all `onMouseEnter`/`onMouseLeave` handlers and their inline `style` color props (move to className).

**Step 2: Apply same fix to other files with inline hover handlers**

Files to fix (from grep):
- `app/components/header/UserMenu.tsx` (4 occurrences)
- `app/components/header/HeaderActionButtons.client.tsx` (2 occurrences)
- `app/components/sidebar/HistoryItem.tsx` (4 occurrences)
- `app/components/@settings/core/ControlPanel.tsx` (2 occurrences)
- `app/components/projects/ProjectSettingsModal.tsx` (2 occurrences)
- `app/components/projects/tabs/SecretsTab.tsx` (2 occurrences)
- `app/routes/profile.tsx` (2 occurrences)
- `app/components/workbench/ScreenshotSelector.tsx` (1 occurrence)

Pattern: Replace `onMouseEnter`/`onMouseLeave` + inline `style={{ color }}` with Tailwind arbitrary value classes: `text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]`

**Step 3: Commit**
```bash
git add -A
git commit -m "style: replace all inline hover handlers with CSS classes"
```

---

### Task 3: Hardcoded Colors — Replace with CSS variables

**Files:**
- Modify: `app/components/workbench/PublishButton.tsx`
- Modify: `app/routes/admin.tsx`
- Modify: Any other files with hardcoded rgba/hex for semantic colors

**Step 1: Replace hardcoded colors with new semantic tokens**

In PublishButton.tsx:
```tsx
// BEFORE
style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
boxShadow: '0 20px 60px -12px rgba(0,0,0,0.4)'

// AFTER
style={{ background: 'var(--error-muted)', border: '1px solid var(--error-border)' }}
boxShadow: 'var(--shadow-popover)'
```

In admin.tsx:
```tsx
// BEFORE
background: 'rgba(239,68,68,0.08)'
border: '1px solid rgba(239,68,68,0.2)'
background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'

// AFTER
background: 'var(--error-muted)'
border: '1px solid var(--error-border)'
background: ok ? 'var(--success-muted)' : 'var(--error-muted)'
```

**Step 2: Grep for any remaining hardcoded `#10B981`, `#EF4444`, `#F59E0B`, `rgba(239`, `rgba(34,197` in .tsx files and replace**

**Step 3: Commit**
```bash
git add -A
git commit -m "style: replace hardcoded colors with CSS variable tokens"
```

---

### Task 4: CloudPanel — Extract sub-components and improve layout

**Files:**
- Modify: `app/components/workbench/CloudPanel.tsx` (1006 lines)
- Create: `app/components/workbench/cloud/OverviewSection.tsx`
- Create: `app/components/workbench/cloud/DatabaseSection.tsx`
- Create: `app/components/workbench/cloud/UsersSection.tsx`
- Create: `app/components/workbench/cloud/SecretsSection.tsx`
- Create: `app/components/workbench/cloud/SqlEditorSection.tsx`
- Create: `app/components/workbench/cloud/LogsSection.tsx`
- Create: `app/components/workbench/cloud/DeploySection.tsx`

**Step 1: Extract each renderContent case into its own component file**

Each case in the `renderContent` switch becomes a standalone component. Props: `schema`, `chatId`, and any needed state/handlers.

**Step 2: Update CloudPanel.tsx to import and render extracted components**

CloudPanel becomes ~200 lines: provider toggle, nav sidebar, and section rendering.

**Step 3: Improve nav styling**

- Add `var(--shadow-sm)` to active nav item
- Increase padding in content area from `p-4` to `p-6`
- Add subtle separator between nav groups
- Overview cards: add `hover:scale-[1.01] transition-transform` and `box-shadow: var(--shadow-sm)`

**Step 4: Commit**
```bash
git add -A
git commit -m "refactor: extract CloudPanel into sub-components, improve layout"
```

---

### Task 5: Admin Page — Full redesign

**Files:**
- Modify: `app/routes/admin.tsx` (351 lines)

**Step 1: Redesign with sections**

- Infrastructure checklist: card grid (2 cols) with icon + status dot + glow
- SQL Editor: formatted table output for query results (not raw JSON)
- Apps list: proper table with columns (schema, tables, size)
- Env vars: key-value table with masked values
- Domain section: cleaner card layout

**Step 2: Add collapsible sections**

Each major section wraps in a disclosure component:
```tsx
<details open className="group">
  <summary className="flex items-center gap-2 cursor-pointer ...">
    <div className="i-ph:caret-right group-open:rotate-90 transition-transform" />
    Section Title
  </summary>
  <div className="mt-3">...content...</div>
</details>
```

**Step 3: Replace raw JSON output with formatted table**

```tsx
// SQL results
{results.length > 0 && (
  <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
    <table className="w-full text-xs">
      <thead>
        <tr style={{ background: 'var(--surface-2)' }}>
          {Object.keys(results[0]).map(k => <th key={k} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>{k}</th>)}
        </tr>
      </thead>
      <tbody>
        {results.map((row, i) => (
          <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {Object.values(row).map((v, j) => <td key={j} className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{String(v)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

**Step 4: Commit**
```bash
git add app/routes/admin.tsx
git commit -m "style: redesign admin page with cards, tables, collapsible sections"
```

---

### Task 6: PublishButton — Migrate inline styles to CSS variables

**Files:**
- Modify: `app/components/workbench/PublishButton.tsx`

**Step 1: Replace all inline style objects with Tailwind + CSS variable classes**

Key changes:
- Popover container: `boxShadow` → `shadow-[var(--shadow-popover)]` or keep as style with token
- Error state: `rgba(239,68,68,...)` → `var(--error-muted)`, `var(--error-border)`
- All `style={{ color: 'var(--text-*)' }}` → `text-[var(--text-*)]` Tailwind classes where possible
- All `style={{ background: 'var(--surface-*)' }}` → `bg-[var(--surface-*)]` Tailwind classes

**Step 2: Commit**
```bash
git add app/components/workbench/PublishButton.tsx
git commit -m "style: migrate PublishButton inline styles to CSS variable classes"
```

---

### Task 7: Projects Page — Add search bar + polish

**Files:**
- Modify: `app/routes/projects.tsx` (235 lines)

**Step 1: Add search/filter input**

Add a search input above the grid that filters projects by name:
```tsx
<input
  value={search}
  onChange={e => setSearch(e.target.value)}
  placeholder="Search projects..."
  className="w-full max-w-sm px-3 py-2 rounded-lg text-sm bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
/>
```

Filter: `projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))`

**Step 2: Commit**
```bash
git add app/routes/projects.tsx
git commit -m "feat: add search filter to projects page"
```

---

### Task 8: Final sweep — consistency check

**Step 1: Grep for remaining issues**

```bash
# Any remaining hardcoded colors in .tsx
grep -rn "#10B981\|#EF4444\|#F59E0B\|#059669\|rgba(239\|rgba(34,197\|rgba(245,158" --include="*.tsx" app/

# Any remaining inline hover handlers
grep -rn "onMouseEnter\|onMouseLeave" --include="*.tsx" app/
```

Fix any remaining issues found.

**Step 2: Commit and push**
```bash
git add -A
git commit -m "style: final consistency sweep — clean all hardcoded colors and hover handlers"
git push origin main
```
