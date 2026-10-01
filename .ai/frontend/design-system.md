# Design System

---

## UI-Bibliothek

**Entscheidung: kein UI-Framework** (weder Angular Material noch PrimeNG).
- Eigenes, schlankes Design-System in `frontend/src/styles.scss`: CSS-Custom-Properties (Tokens)
  plus Utility- und Komponentenklassen (`.card`, `.btn`, `.badge`, `.table`, `.dialog` …).
- Eigene Standalone-Komponenten für die Bausteine, die Material/PrimeNG sonst liefern würden,
  z. B. `app-date-range-picker`, Charts, Dialog- und Toast-Host.
- Icons: Lucide (`@lucide/angular`), siehe Abschnitt „Icons (Lucide)“.
- Neue Styles nutzen immer die Tokens (`--sp-*`, `--radius*`, `--fs-*`, Farben), keine Hardcode-Werte.
- Produktübergreifendes Corporate Design (Logo, Farben, Typografie, App-Shell) der Arrow-Produkte:
  [docs/arrow-corporate-design.md](../../docs/arrow-corporate-design.md). Bei Widersprüchen gilt der Leitfaden.

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

Palette nach dem Arrow-Leitfaden: Indigo als Primary, Slate als Neutralfarben
(Werte siehe [docs/arrow-corporate-design.md](../../docs/arrow-corporate-design.md) Abschnitt 3).

| Token | Verwendung |
|---|---|
| `--brand`, `--brand-hover`, `--brand-soft` | Primary (hell Indigo 600, dunkel Indigo 500), Auswahl/aktive Navigation |
| `--bg`, `--surface`, `--surface-2`, `--border`, `--hover` | Seitenhintergrund, Karten/Sidebar, Tabellenkopf/Inputs, Linien, Hover |
| `--text`, `--text-muted`, `--text-faint` | Text, Sekundärtext, Hinweise/Gruppenlabels |
| `--ok`/`--ok-bg`, `--warn`/`--warn-bg`, `--danger`/`--danger-bg`, `--info`/`--info-bg` | Semantik: Text-/Linienfarbe und passender Hintergrund (Badges) |

### Status-Farben (Projektbudget)

| Status | Token | Hex (Light / Dark) |
|---|---|---|
| `ON_TRACK` | `--ok` | `#059669` / `#34d399` |
| `WARNING` (>80%) | `--warn` | `#d97706` / `#fcd34d` |
| `EXCEEDED` (>100%) | `--danger` | `#dc2626` / `#f87171` |
| Archiviert/Inaktiv | `--text-faint` | Slate, 38 % Deckkraft |

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

- Font: **Inter**, selbst gehostet über `@fontsource-variable/inter` (Import in `styles.scss`, kein CDN),
  Fallback System-Font-Stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
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

  &--active    { background: var(--ok-bg);     color: var(--ok); }
  &--paused    { background: var(--warn-bg);   color: var(--warn); }
  &--completed { background: var(--info-bg);   color: var(--info); }
  &--archived  { background: var(--surface-2); color: var(--text-faint); }
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

### Zeitraum-Auswahl (`app-date-range-picker`)

`shared/components/date-range-picker.component.ts`, Logik in `shared/utils/date-range.ts` (getestet).
Eingesetzt in Dashboard, Reports, Timesheet und Kalender.

```html
<app-date-range-picker [(range)]="range" />                         <!-- freier Zeitraum -->
<app-date-range-picker mode="week" [range]="week()" (rangeChange)="setWeek($event)" />
<app-date-range-picker size="md" ... />                               <!-- 38px, in Filterleisten -->
```

- Trigger: `‹` · Kalender-Icon + Preset-Name bzw. Zeitraum (+ `KW n` im Wochenmodus) · `›`.
  Die Pfeile springen um die Länge des Zeitraums; ganze Monate, Quartale und Jahre bleiben dabei kalendertreu.
- Popover: Preset-Liste (Heute … Letztes Jahr bzw. Diese/Letzte/Nächste Woche) + Monatskalender mit KW-Spalte,
  Wochenbeginn Montag. Im Zeitraummodus wählen zwei Klicks den Zeitraum (mit Hover-Vorschau),
  im Wochenmodus wählt ein Klick die ganze Woche.
- Tastatur: Pfeile ±1/±7 Tage, Home/End Wochenanfang/-ende, PageUp/PageDown ±1 Monat (+Shift ±1 Jahr),
  Enter/Space wählt, Escape schließt und gibt den Fokus an den Trigger zurück.
- Platzierung: unter dem Trigger, bei zu wenig Platz darüber, Höhe auf den Viewport begrenzt.
  ≤ 640px wird das Popover zum Bottom Sheet mit Preset-Chips und 44px-Touch-Targets.
- Zustand liegt in der URL: `?from=&to=` (Dashboard, Reports) bzw. `?week=` (Timesheet, Kalender).

### Icons (Lucide)

- Bibliothek: `@lucide/angular`. Keine Unicode-Glyphen (▶ ✕ ✎ …) und keine handgeschriebenen Inline-SVGs als Icons.
- Pro Icon die Komponente importieren und als Attribut auf `<svg>` nutzen: `<svg lucidePlay></svg>`
  (Import `LucidePlay` in `imports` der Komponente). Dynamisch (z. B. Navigation): `<svg [lucideIcon]="item.icon"></svg>`
  mit `LucideDynamicIcon` und Typ `LucideIcon`.
- Defaults global in `app.config.ts`: `provideLucideConfig({ size: 16, strokeWidth: 1.75 })`.
  Sidebar-Navigation nutzt `[size]="20"`, Topbar-Aktionen `[size]="18"`.
- Farbe kommt über `currentColor` aus dem Text des Elternelements, also keine Farben am Icon selbst setzen.
- Icons ohne `title` sind automatisch `aria-hidden`. Reine Icon-Buttons brauchen deshalb immer ein `aria-label`
  (zusätzlich `title` für den Tooltip).
- Zuordnung: Play = Start/Fortsetzen, Square = Stop, X = Schließen/Verwerfen, Pencil = Bearbeiten, Copy = Duplizieren,
  Split = Aufteilen, Plus = Neu anlegen, Chevron* = Blättern/Aufklappen, Arrow* = Navigation zu anderer Seite.

---

## Dark / Light Mode

Umsetzung über CSS-Custom-Properties in `styles.scss`:

```scss
:root,
:root[data-theme='light'] { --bg: #f8fafc; --surface: #ffffff; --text: #0f172a; /* … */ }
:root[data-theme='dark']  { --bg: #1e293b; --surface: #0f172a; /* … */ }
```

- `ThemeService` setzt `data-theme` auf `<html>`. Startwert: gespeicherter Wert (`localStorage`-Key `dash-theme`),
  sonst `prefers-color-scheme`.
- Umschalten über den Sun/Moon-Button in der Topbar.
- Komponenten verwenden ausschließlich Tokens, damit beide Themes ohne eigene Overrides funktionieren.

---

## Layout

### App Shell

Die Shell folgt dem gemeinsamen Arrow-Layout (Referenz: velo), siehe
[docs/arrow-corporate-design.md](../../docs/arrow-corporate-design.md) Abschnitt 7.

```
┌──────────────┬───────────────────────────────────────────────┐
│ [dash-Logo] ‹│  TOPBAR: Timer-Bar | Suche | Theme-Toggle     │
│ ÜBERSICHT    ├───────────────────────────────────────────────┤
│  Dashboard   │  CONTENT                                      │
│  Reports     │                                               │
│ ERFASSUNG    │                                               │
│  Timer       │                                               │
│  Timesheet   │                                               │
│  Kalender    │                                               │
│ STAMMDATEN   │                                               │
│  Kunden      │                                               │
│  Projekte    │                                               │
│  Tags        │                                               │
├──────────────┤                                               │
│  Einstell.   │                                               │
│  v0.0.1      │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

- Sidebar (`app.ts`): 240px, einklappbar auf 72px (Zustand in `localStorage` `dash-nav-collapsed`).
  Logo aus `public/logo-sidebar(-dark).svg` bzw. `sidebar-min(-dark).svg`, Nav-Items 48px mit 20px-Icons,
  aktiv mit `--brand-soft`/`--brand`. Einstellungen im Footer, darunter die Version aus `GET /health`.
- Topbar: 64px Höhe, fix am oberen Rand.
- Content: scrollbar, `overflow: auto`.

### Responsive

- Desktop (> 640px): Sidebar sichtbar, ein-/ausklappbar.
- Mobil (≤ 640px): Sidebar als Off-Canvas-Drawer mit Backdrop, geöffnet über den Menü-Button in der Topbar;
  schließt bei Navigation, Backdrop-Klick und `Escape`. Die Timer-Bar bricht in eine eigene Zeile um,
  Touch-Targets sind 44px groß.

---

## Visualisierungen

Keine Chart-Library: Die Charts sind leichtgewichtige Standalone-Komponenten aus HTML/SVG
in `shared/components/`. Sie haben Signal-Inputs und nutzen die Theme-Tokens.

| Komponente | Zweck |
|---|---|
| `app-bar-chart` | Horizontale Balken (Stunden/Umsatz pro Projekt, Kunde, …) |
| `app-line-chart` | Trendlinie als SVG-Polyline |
| `app-donut-gauge` | Billable-Quote als Ring |

Eine Heatmap wird direkt im Reports-Template als CSS-Grid gerendert.

### Chart-Typen

| Chart | Seite | Daten |
|---|---|---|
| Bar | Reports | Stunden pro Projekt/Kunde |
| Donut | Dashboard | Billable vs Non-Billable |
| Line | Reports | Trend täglich/wöchentlich/monatlich |
| Heatmap | Reports | Aktivität pro Tag |
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
