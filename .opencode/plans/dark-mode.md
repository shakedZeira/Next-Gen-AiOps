# Plan: Dark Mode

**Impact: MEDIUM | Effort: LOW (1-2 days)**
**Status: COMPLETED**
**Dependencies: None**

---

## Goal
Add a dark mode toggle suitable for NOC environments (24/7 operations rooms with low ambient light).

## Current State
- White/light theme only
- Tailwind CSS with gray-900 sidebar but white content areas
- No theme toggle exists

## Design

### Theme Strategy
- CSS custom properties (CSS variables) for all colors
- Two theme classes: `:root` (light) and `.dark` (dark)
- Toggle persisted in localStorage
- Respects `prefers-color-scheme` on first visit

### Color Mapping
| Element | Light | Dark |
|---------|-------|------|
| Background | `bg-gray-50` | `bg-gray-950` |
| Card/Surface | `bg-white` | `bg-gray-900` |
| Border | `border-gray-200` | `border-gray-800` |
| Text primary | `text-gray-900` | `text-gray-100` |
| Text secondary | `text-gray-500` | `text-gray-400` |
| Sidebar | `bg-gray-900` | `bg-gray-950` |

## Implementation

### 1. Tailwind dark mode config
- File: `ui/tailwind.config.js`
- Add `darkMode: 'class'`

### 2. Theme context + toggle
- File: `ui/src/hooks/useTheme.ts` (NEW)
- `useTheme()` hook: returns `{ theme, toggle }`
- Reads/writes `localStorage('theme')`
- Applies `dark` class to `<html>`

### 3. Update global styles
- File: `ui/src/index.css`
- Add dark mode variants to base layers

### 4. Update all pages/components
- Replace hardcoded `bg-white`, `text-gray-900`, etc. with dark-aware classes
- Pages: Dashboard, NOCAlerts, CMDBExplorer, ChatBot, SLODashboard, AgentMonitor, SystemHealth, Docs, AuditLog, DCExplorer
- Components: Sidebar, Header, Layout, ServiceHealthCard, AlertTable, AlertDetail, IncidentDetail, NodeDetailPanel, TopologyGraph, GeoMap

### 5. Toggle button
- File: `ui/src/components/Header.tsx`
- Sun/moon icon toggle in the header bar

### 6. Navigation
- Toggle persists across page navigation (localStorage)

## Files to Create/Modify
- `ui/tailwind.config.js` — darkMode: 'class'
- `ui/src/hooks/useTheme.ts` — NEW: theme hook
- `ui/src/index.css` — dark mode base styles
- `ui/src/components/Header.tsx` — theme toggle button
- `ui/src/components/Sidebar.tsx` — dark classes
- `ui/src/components/Layout.tsx` — dark classes
- `ui/src/pages/*.tsx` — dark classes on all pages
- `ui/src/components/*.tsx` — dark classes on all components
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Click sun/moon toggle → entire UI switches theme
2. Refresh page → theme persists
3. Open new tab → theme matches
4. System preference (prefers-color-scheme: dark) → dark on first visit
5. All text readable, all borders visible, no contrast issues
