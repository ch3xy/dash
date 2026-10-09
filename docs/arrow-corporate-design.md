# Arrow Produkt-Design – Designleitfaden

> Gemeinsames Corporate Design der Arrow-Produkte **velo** (Cash Flow), **dash** (Time Tracking) und
> **mission control** (Cockpit). Referenzimplementierung ist **velo**; dash übernimmt die App-Shell 1:1.
>
> Stand: 2026-10-01 · Quellen: `velo/frontend/src/styles.scss` + `app.component.*`, `missioncontrol/src/styles.css` +
> `layout/sidebar.*`, `arrow-web/src/styles/_variables.scss`, `dash/frontend/src/styles.scss` + `app.ts`.

---

## 1. Markenarchitektur

| Ebene | Marke | Zweck | Leitfarbe |
|---|---|---|---|
| Unternehmen | **Arrow Solutions IT Consulting** (arrow-web) | Firmenauftritt, Landingpage, Angebote | Grün `#2fb07f` → Blau `#34a5c7` |
| Produktfamilie | **velo · dash · mission control** | Werkzeuge im täglichen Gebrauch | Indigo `#6366F1` |

- **Firmen-CI** (Grün/Blau-Verlauf, „A“-Logo) gehört auf Website, Angebote, Rechnungen und Präsentationen.
- **Produkt-CI** (Indigo, Kreis-und-Pfeil-Zeichen) gilt in allen Apps. Sie ist bewusst ruhiger, damit
  Status- und Datenfarben (Budget, Einnahmen/Ausgaben, Warnungen) klar hervortreten.
- Die Verbindung zwischen beiden ist der **Pfeil**: diagonales Pfeil-Symbol in der Firmenmarke,
  Pfeil im Kreis im Produktzeichen. Firmenfarben erscheinen in den Apps nicht als UI-Farbe.

---

## 2. Logo-System

### Produktzeichen

Ein Kreis mit diagonalem Pfeil in Primary-Indigo `#6366F1`. Identisch in allen Produkten – die Produkte
unterscheiden sich über die Wortmarke, nicht über das Zeichen.

### Wortmarke

- Produktname **klein geschrieben**: `velo`, `dash`, `mission control`.
- Darunter eine Beschreibung, ebenfalls klein: `cash flow`, `time tracking`, `cockpit`.
- Farbe: Text-Farbe des Themes (hell `#0F172A`, dunkel `#F1F5F9`); das Zeichen bleibt Indigo.
- Längere Namen (mission control) setzen die Wortmarke kleiner (~26px statt ~30px), damit das Logo
  in die 240px-Sidebar passt.

### Dateien (je Produkt in `public/`)

| Datei | Verwendung |
|---|---|
| `logo-sidebar.svg` / `logo-sidebar-dark.svg` | Sidebar ausgeklappt, hell/dunkel |
| `sidebar-min.svg` / `sidebar-min-dark.svg` | Sidebar eingeklappt (nur Zeichen) |
| `favicon.svg` (+ `favicon.ico` als Fallback) | Browser-Tab |

- Darstellungshöhe in der Sidebar: **48px**, Breite automatisch.
- Favicon: Zeichen auf Primary-Kachel. Die Unterscheidung der Tabs erfolgt über den `<title>` (`velo`, `dash`, …).
- Logos immer als `<img>` mit leerem `alt` einbinden, wenn der umgebende Link ein `aria-label` hat.
- Nicht erlaubt: Zeichen umfärben, verzerren, Firmen-Grün/Blau-Verlauf im Produktlogo.

---

## 3. Farben

Alle Farben sind CSS Custom Properties. Komponenten verwenden **ausschließlich Tokens**, nie Hex-Werte.

### 3.1 Primary

| Rolle | Hell | Dunkel | Hinweis |
|---|---|---|---|
| Primary (Marke, Charts, Logo) | `#6366F1` Indigo 500 | `#6366F1` | |
| Primary für Text/Buttons auf Hell | `#4F46E5` Indigo 600 | `#6366F1` | Kontrast AA auf Weiß |
| Primary Hover | `#4338CA` Indigo 700 | `#818CF8` Indigo 400 | |
| Primary Light (aktive Nav, Auswahl) | `#E0E7FF` Indigo 100 | `rgba(99,102,241,0.20)` | |
| Accent (sparsam, Hervorhebung) | `#7C3AED` Violet 600 | `#7C3AED` | |

### 3.2 Semantische Farben

| Rolle | Hell | Hell-Bg | Dunkel | Dunkel-Bg |
|---|---|---|---|---|
| Ok / Erfolg / Einnahme | `#059669` | `#D1FAE5` | `#34D399` | `rgba(5,150,105,0.15)` |
| Warnung | `#D97706` | `#FEF3C7` | `#FCD34D` | `rgba(217,119,6,0.15)` |
| Kritisch / Fehler / Ausgabe | `#DC2626` | `#FEE2E2` | `#F87171` | `rgba(220,38,38,0.15)` |
| Info | `#4338CA` | `#E0E7FF` | `#A5B4FC` | `rgba(99,102,241,0.15)` |
| Neutral / inaktiv / archiviert | `#6B7280` | `#F1F5F9` | `#94A3B8` | `#263548` |

Semantik ist produktübergreifend fix: **Grün = im Plan / positiv, Gelb = Achtung (z. B. > 80 % Budget),
Rot = überschritten / Fehler, Grau = inaktiv.** Farbe nie als einziges Signal – immer mit Text, Icon oder Wert.

### 3.3 Neutralfarben (Slate)

| Token-Rolle | Hell | Dunkel |
|---|---|---|
| Surface 0 (Karten, Sidebar, Topbar) | `#FFFFFF` | `#0F172A` |
| Surface 1 (Seitenhintergrund) | `#F8FAFC` | `#1E293B` |
| Surface 2 (Hover, Tabellenkopf, Inputs) | `#F1F5F9` | `#263548` |
| Border | `#E2E8F0` | `#334155` |
| Text | `#0F172A` | `#F1F5F9` |
| Text muted | `rgba(15,23,42,0.54)` | `rgba(241,245,249,0.60)` |
| Text hint (Gruppenlabels, Version) | `rgba(15,23,42,0.38)` | `rgba(241,245,249,0.38)` |

### 3.4 Chart-Farben

| Rolle | Hell | Dunkel |
|---|---|---|
| Hauptserie / Prognose | `#6366F1` (Fill `rgba(99,102,241,0.13)`) | `#818CF8` |
| Vergleich / historisch | `#94A3B8` | `#475569` |
| Markierung „heute“ | `#F59E0B` | `#FCD34D` |
| Positiv / negativ | `#059669` / `#DC2626` | `#34D399` / `#F87171` |
| Grid | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.06)` |
| Achsenbeschriftung | `rgba(0,0,0,0.45)` | `rgba(241,245,249,0.45)` |
| Tooltip | Bg `rgba(255,255,255,0.98)`, Border `rgba(0,0,0,0.10)` | Bg `rgba(15,23,42,0.98)`, Border `rgba(255,255,255,0.12)` |

Kategorische Daten (Projekte, Kategorien) nutzen eine Palette aus Tailwind-500-Tönen
(Blau, Violett, Cyan, Grün, Amber, Rot, Pink, Indigo, Lime, Orange, Teal, Purple).
Charts sind entscheidungsorientiert: keine 3D-Effekte, keine dekorativen Verläufe.

---

## 4. Typografie

- **Schrift: Inter**, selbst gehostet (DSGVO – kein Google-Fonts-CDN), Fallback
  `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- Zahlen in Tabellen, Beträgen und Zeiten: `font-variant-numeric: tabular-nums`; Zeitanzeigen (Timer) dürfen Monospace sein.

| Rolle | Größe / Gewicht | Details |
|---|---|---|
| Seitentitel (Page Header) | 22–28px / 700 | letter-spacing −0.02em; mobil 20px |
| Abschnittstitel / Karten-Label | 12–13px / 600 | uppercase, letter-spacing 0.05em, muted |
| Body | 14px / 400 | line-height 1.5 |
| Navigation | 14px / 500, aktiv 600 | |
| Nav-Gruppenlabel | 10px / 600 | uppercase, letter-spacing 0.08em, hint |
| Klein / Meta | 11–13px | muted |
| Kennzahl (KPI-Karte) | 28–32px / 700 | tabular-nums |
| Mobiler Topbar-Titel | 18px / 700 | letter-spacing −0.03em |

---

## 5. Raster, Radien, Schatten

### Spacing

4px-Basis, bevorzugt 8er-Schritte: **4 · 8 · 12 · 16 · 24 · 32 · 48**.
Content-Padding: 24px Desktop, 16px mobil.

### Radien

| Token | Wert | Verwendung |
|---|---|---|
| sm | 6px | Badges, kleine Buttons, Inputs-Innenelemente |
| md | 10px | Buttons, Inputs, Nav-Items, Karten |
| lg | 16px | Dialoge, große Karten |
| xl | 24px | Bottom Sheets, Hero-Elemente |
| pill | 999px | Chips, Toggles, Suchfeld |

### Schatten

| Stufe | Hell | Dunkel |
|---|---|---|
| sm (Karten) | `0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)` | `0 1px 3px rgba(0,0,0,.30)` |
| md (Popover, Menüs) | `0 4px 12px rgba(0,0,0,.10), 0 2px 4px rgba(0,0,0,.06)` | `0 4px 12px rgba(0,0,0,.40)` |
| lg (Drawer) | `0 10px 30px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.06)` | – |
| dialog | `0 20px 60px rgba(0,0,0,.15)` | `0 20px 60px rgba(0,0,0,.50)` |

Flaches Design: Hierarchie entsteht primär über Border und Surface-Stufen, Schatten sind dezent.

---

## 6. Icons

- Ziel-Bibliothek für alle Produkte: **Lucide** (Outline, `strokeWidth 1.75`), Farbe immer `currentColor`.
- Größen: 16px in Buttons/Tabellen, 18px in der Topbar, **20px in der Sidebar** (in 24px-Icon-Box).
- Reine Icon-Buttons brauchen `aria-label` (+ `title` als Tooltip). Keine Unicode-Glyphen (▶ ✕ ✎) als Icons.
- Feste Zuordnungen: Play = Start/Fortsetzen, Square = Stop, X = Schließen, Pencil = Bearbeiten, Plus = Neu,
  Settings = Einstellungen, Menu = Navigation öffnen, ChevronLeft/Right = Ein-/Ausklappen bzw. Blättern.

---

## 7. App-Shell & Sidebar

Alle Produkte teilen dieselbe Shell: **Sidebar links, Topbar oben (produktspezifisch), Content scrollt.**

```
┌──────────────┬───────────────────────────────────────────────┐
│ [Logo]     ‹ │  TOPBAR (produktspezifische Aktionen)         │
│              ├───────────────────────────────────────────────┤
│ ÜBERSICHT    │                                               │
│ ▣ Dashboard  │  CONTENT (padding 24px)                       │
│ ◔ Reports    │                                               │
│ ERFASSUNG    │                                               │
│ ⏱ Timer      │                                               │
│ …            │                                               │
├──────────────┤                                               │
│ ⚙ Einstell.  │                                               │
│              │                                               │
│ v1.2.3       │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

### Maße (verbindlich)

| Element | Spezifikation |
|---|---|
| Sidebar | 240px, eingeklappt 72px, Surface 0, rechte Border, Übergang `width .2s ease` |
| Header | Padding 16/16/12, Logo 48px hoch links, Einklapp-Button (40px rund, ChevronLeft/Right) rechts |
| Header eingeklappt | Zeichen-Logo und Button untereinander, zentriert |
| Gruppenlabel | 10px/600, uppercase, letter-spacing .08em, Hint-Farbe, Padding `12px 16px 4px` (inkl. Gruppen-Padding) |
| Nav-Item | min-height 48px, Radius 10px, margin 1px 0, Padding 0 16px, Gap 16px, Icon-Box 24px |
| Nav-Item Farben | Icon muted, Text normal; Hover Surface 2; **aktiv: Primary-Light-Bg, Text + Icon Primary, 600** |
| Liste | Gruppen mit 8px seitlichem Padding |
| Eingeklappt | Labels und Gruppenlabels ausgeblendet, Items zentriert, Tooltip (`title`) + `aria-label` mit dem Namen |
| Footer | **direkt unter der Navigation** (nicht am unteren Rand), border-top, Padding 8px. Eintrag **Einstellungen** in Nav-Item-Geometrie, aber gedämpft: Text + Icon muted, Schrift 400, Hover Surface 2 + Text-Farbe. Eingeklappt: runder 40px-Icon-Button, zentriert |
| Versionszeile | `v{version}`, per `margin-top: auto` **ganz unten** in der Sidebar, 11px, Hint-Farbe, opacity .55, nur ausgeklappt |
| Zustand | Einklappen wird pro Produkt in `localStorage` gespeichert (`<produkt>-nav-collapsed`) |

### Gruppierung der Navigation

Gruppen nach Aufgabe, nicht nach Technik; 2–4 Einträge je Gruppe. Einstellungen stehen immer im Footer,
nie in einer Gruppe. Beispiel dash: **Übersicht** (Dashboard, Reports) · **Erfassung** (Timer, Timesheet,
Kalender) · **Stammdaten** (Kunden, Projekte, Tags) · **Verwaltung** (Monatsabschluss, Daten).

### Mobil

- Sidebar wird zum **Off-Canvas-Drawer** (fixiert links, 240–280px, max. 85vw, Schatten lg) mit Backdrop
  `rgba(15,23,42,0.4)`; immer in ausgeklappter Darstellung.
- Topbar zeigt links den Menü-Button (`aria-label="Menü öffnen"`, `aria-expanded`) und den Produktnamen
  (18px/700/−0.03em).
- Drawer schließt bei Navigation, Klick auf den Backdrop und `Escape`.
- Keine Bottom-Navigation.

---

## 8. Komponenten-Grundlagen

| Komponente | Regeln |
|---|---|
| **Page Header** | Titel links, Primäraktion rechts (ein Primary-Button pro Seite), Filter/Zeitraum dazwischen oder darunter |
| **Buttons** | Höhe 36–40px (mobil ≥ 44px), Radius md. Varianten: Primary (gefüllt), Secondary/Outline, Ghost, Danger (Outline rot). Disabled = opacity .5, kein Hover |
| **Karten** | Surface 0, 1px Border, Radius md–lg, Schatten sm, Padding 16–24px. Karten-Label uppercase/muted |
| **KPI-Karten** | Label oben, Kennzahl groß, Vergleich/Untertitel klein darunter |
| **Tabellen** | Kopfzeile Surface 2, 12–13px/600; Zeilenhöhe ≥ 40px; Zahlen rechtsbündig + tabular-nums; Hover Surface 2 |
| **Formulare** | Label über dem Feld, Fehlertext unter dem Feld in Kritisch-Farbe; Inputs mobil 16px (kein iOS-Zoom) |
| **Badges/Status** | Semantik-Bg + Semantik-Text, Radius sm, 11–12px/600 |
| **Toasts** | Unten rechts (mobil unten zentriert, über Safe Area), Erfolg grün / Fehler rot, automatisch ausblenden |
| **Dialoge** | Radius lg, Schatten dialog, `Escape` schließt, Fokus wird gefangen und zurückgegeben |
| **Ladezustand** | Skeleton-Loader in Form des Inhalts statt Spinner für ganze Seiten |
| **Leerzustand** | Kurzer Satz, was fehlt, plus direkte Aktion („Noch keine Einträge heute.“ + „Eintrag anlegen“) |
| **Fehlerzustand** | Verständliche Meldung + „Erneut versuchen“; technische Details nur im Problem-Detail/Log |

---

## 9. Dark Mode

- Umschaltung über `data-theme="dark"` auf `<html>`; Startwert gespeicherte Wahl
  (`<produkt>-theme` in `localStorage`), sonst `prefers-color-scheme`.
- Jede Farbe hat ein Dark-Pendant (Abschnitt 3); Logos haben eigene Dark-Varianten.
- Schalter in der Topbar (Sun/Moon) oder in den Einstellungen.

---

## 10. Responsive

| Breakpoint | Verhalten |
|---|---|
| > 640px | Desktop: Sidebar sichtbar (ein-/ausklappbar), Content-Padding 24px |
| ≤ 640px | Mobil: Drawer statt Sidebar, Content-Padding 16px, Touch-Targets ≥ 44px, Popover werden Bottom Sheets |

Desktop-first, tabletfähig. Inhalte haben keine horizontale Seiten-Scrollbar; breite Tabellen scrollen in ihrem Container.

---

## 11. Barrierefreiheit

- Kontrast: Text ≥ 4.5:1 (deshalb Indigo 600 statt 500 für Text/Buttons auf Weiß).
- Sichtbarer Fokusring auf allen interaktiven Elementen (2px Primary bzw. `#93C5FD` auf dunklem Grund, Offset 2px).
- Alle Funktionen per Tastatur erreichbar; Shortcuts dokumentiert und per `?` einblendbar.
- Icon-Buttons mit `aria-label`, Navigation als `<nav>`/`<aside aria-label>`, aktiver Eintrag über `routerLinkActive`.
- `prefers-reduced-motion` respektieren: Transitions abschalten.

---

## 12. Sprache & Tonalität

- UI-Sprache Deutsch (velo zusätzlich Englisch über i18n). Du-Form, kurz und konkret.
- Verben auf Buttons („Speichern“, „Timer starten“), keine „OK“-Buttons.
- Zahlen- und Datumsformat `de-AT` (z. B. `01.10.2026`, `€ 1.234,50`), Woche beginnt Montag.
- Produktnamen immer klein: velo, dash, mission control.

---

## 13. Stand der Produkte & Migrationsbedarf

| Thema | velo | dash | mission control |
|---|---|---|---|
| Sidebar nach Abschnitt 7 | ✅ Referenz (Angular Material `mat-sidenav`) | ✅ seit 2026-10 (eigene Implementierung in `app.ts`) | ❌ schmale Rail mit „MC“-Kürzel → umstellen |
| Primary Indigo | ✅ | ✅ (`--brand` = Indigo 600/500) | ❌ Blau `#2563eb` → Indigo |
| Neutralfarben Slate | ✅ | ✅ | ⚠️ eigene Dark-Palette (`#0d1117`, `#121a28`) → Slate |
| Semantikfarben | ✅ | ✅ (`--ok/-warn/-danger/-info` + `-bg`) | ⚠️ Grün `#22c55e` → `#059669`/`#34D399` |
| Inter selbst gehostet | ✅ seit 2026-10 (`@fontsource-variable/inter`) | ✅ (`@fontsource-variable/inter`) | ❌ |
| Icons Lucide | ⚠️ Material Symbols Outlined (Strichstärke 300, Lucide-nah; optional migrieren) | ✅ | ❌ Unicode-Glyphen → Lucide |
| Logo-Set nach Abschnitt 2 | ✅ | ✅ | ❌ anlegen (Beschreibung „cockpit“) |
| Light + Dark Mode | ✅ | ✅ | ⚠️ nur Dark |
| Material-Komponenten im dash-Look | ✅ seit 2026-10 (`mat.theme` + `theme-overrides` auf Arrow-Tokens; 38px-Controls, 6px-Radius, Tabellen als Card) | – | – |
| Einstellungen als Seite (Darstellung: Hell/Dunkel/System) | ✅ `/settings` | ✅ `/settings` | ❌ |
| Mobil-Breakpoint | 600px | 640px | – |

Bei neuen Arrow-Produkten: Tokens aus Abschnitt 3–5 übernehmen, App-Shell nach Abschnitt 7 bauen,
Logo-Set nach Abschnitt 2 anlegen.
