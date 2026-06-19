# Design System

---

## UI-Bibliothek

**Empfehlung: Angular Material 22**
- Gut in Angular integriert, Theme-System robust.
- Dark/Light Mode via `@angular/material` Theme.
- Alternativ: PrimeNG (mehr Komponenten, aber schwerer).

Entscheidung vor Phase 0 treffen. Standard: Angular Material.

---

## Spacing System

8px-Raster. Alle Abstände sind Vielfache von 8px.

| Token | Wert | Verwendung |
|---|---|---|
| `--space-1` | 8px | Minimaler Abstand |
| `--space-2` | 16px | Padding in Cards |
| `--space-3` | 24px | Abstand zwischen Sektionen |
| `--space-4` | 32px | Großer Abstand |
| `--space-6` | 48px | Seitenränder |

---

## Farben

### Status-Farben (Projektbudget)

| Status | Farbe | Hex (Light) |
|---|---|---|
| `ON_TRACK` | Grün | `#22c55e` |
| `WARNING` (>80%) | Gelb/Orange | `#f59e0b` |
| `EXCEEDED` (>100%) | Rot | `#ef4444` |
| Archiviert/Inaktiv | Grau | `#9ca3af` |

### Projekt-Farben (farbcodiert)

Palette von 12 vordefinierten Farben (Nutzer wählt eine aus):

```typescript
export const PROJECT_COLORS = [
  '#3b82f6', // Blau
  '#8b5cf6', // Violett
  '#06b6d4', // Cyan
  '#10b981', // Grün
  '#f59e0b', // Amber
  '#ef4444', // Rot
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#a855f7', // Purple
];
```

---

## Typografie

- Font: System-Font-Stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- Body: 14px / 1.5 line-height
- Labels: 12px, uppercase, letter-spacing 0.05em
- Headings: 20px (h1), 16px (h2), 14px (h3)
- Monospace für Zeitanzeige: `'JetBrains Mono', 'Fira Code', monospace`

---

## Komponenten-Richtlinien

### Cards

```scss
.card {
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--mat-divider-color);
  background: var(--mat-card-background-color);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
```

### Timer-Display

- Monospace-Font, groß (32px+)
- Subtiles Pulsieren wenn läuft (CSS animation)
- Klare Start/Stop-Buttons (FAB oder filled button)

### Budget-Progress-Bar

```html
<mat-progress-bar
  [value]="usedPercent"
  [color]="usedPercent >= 100 ? 'warn' : usedPercent >= 80 ? 'accent' : 'primary'"
/>
<span>{{ usedPercent | number:'1.0-1' }}% — {{ remainingMinutes | duration:'HH:MM' }} verbleibend</span>
```

### Status-Badge

```html
<span class="status-badge" [class]="'status-badge--' + status.toLowerCase()">
  {{ status }}
</span>
```

```scss
.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;

  &--active    { background: #dcfce7; color: #166534; }
  &--paused    { background: #fef3c7; color: #92400e; }
  &--completed { background: #dbeafe; color: #1e40af; }
  &--archived  { background: #f3f4f6; color: #6b7280; }
}
```

### Sticky Filterbar (Reports)

```scss
.filter-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--mat-background-color);
  padding: 12px 24px;
  border-bottom: 1px solid var(--mat-divider-color);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
```

---

## Dark / Light Mode

Angular Material Theming:

```scss
// styles.scss
@use '@angular/material' as mat;

$light-theme: mat.define-theme((
  color: (
    theme-type: light,
    primary: mat.$blue-palette,
  ),
));

$dark-theme: mat.define-theme((
  color: (
    theme-type: dark,
    primary: mat.$blue-palette,
  ),
));

:root { @include mat.all-component-themes($light-theme); }
.dark-theme { @include mat.all-component-themes($dark-theme); }
```

Toggle via `document.body.classList.toggle('dark-theme')`, gespeichert in `localStorage`.

---

## Layout

### App Shell

```
┌─────────────────────────────────────────────────────────┐
│  TOPBAR: Logo | Timer-Bar (persistent)      | Settings  │
├────────────┬────────────────────────────────────────────┤
│  SIDEBAR   │  CONTENT                                   │
│            │                                            │
│  Dashboard │                                            │
│  Timer     │                                            │
│  Timesheet │                                            │
│  Calendar  │                                            │
│  ───────   │                                            │
│  Clients   │                                            │
│  Projects  │                                            │
│  Tags      │                                            │
│  ───────   │                                            │
│  Reports   │                                            │
│  Settings  │                                            │
└────────────┴────────────────────────────────────────────┘
```

- Sidebar: 240px fix, collapsible auf Icon-Only (56px) via Toggle.
- Topbar: 56px Höhe, fix am oberen Rand.
- Content: scrollbar, `overflow-y: auto`.

### Responsive

- Desktop-first (>= 1024px): Vollständige Sidebar sichtbar.
- Tablet (768–1023px): Sidebar collapsed (Icon-Only).
- Mobile (<768px): Sidebar als Drawer (Overlay). Nicht Primärziel, aber nicht aktiv gebrochen.

---

## Visualisierungen (ECharts)

### Konfigurationsmuster

```typescript
import { NgxEchartsModule } from 'ngx-echarts';

// In Component
protected readonly chartOption = computed<EChartsOption>(() => ({
  xAxis: { type: 'category', data: this.labels() },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: this.values() }]
}));
```

### Chart-Typen

| Chart | Seite | Daten |
|---|---|---|
| Bar | Reports | Stunden pro Projekt/Kunde |
| Donut | Reports | Billable vs Non-Billable |
| Line | Dashboard/Reports | Trend täglich/wöchentlich |
| Heatmap | Dashboard | Aktivitäts-Heatmap (Calendar Chart) |
| Progress | Projektliste | Budgetverbrauch |

### Farbe in Charts

Projektfarben direkt aus `project.color` verwenden. Fallback auf `PROJECT_COLORS`-Palette per Index.

---

## Tastatur-Shortcuts (UI-Sichtbar)

Shortcut-Hilfe via `?`-Taste als Overlay/Dialog:

| Shortcut | Aktion |
|---|---|
| `n` | Neuer Zeiteintrag |
| `t` | Timer-Bar fokussieren |
| `s` | Timer Start/Stop |
| `/` | Globale Suche öffnen |
| `Esc` | Dialog schließen |
