# Trig Calculator

A TypeScript + React port of a Visual Basic 6 trig calculator originally written in 2002.
The VB6 project is not in this repository; this is the port that replaced it.

## Running

```
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a static `dist/` folder that can be
hosted anywhere - there's no backend. Pushing to `main` builds and publishes it to GitHub Pages
via `.github/workflows/deploy.yml`.

## What's here

- `src/trig/` - pure math, ported from the original's `modTrigFuncs.bas` and `modGraph.bas`.
- `src/state/` - app state (`useCalculatorState`) and localStorage persistence, replacing the
  VB6 registry-backed globals in `modSettings.bas`.
- `src/components/` - the circle (SVG), function graph (canvas), the function controls, and the
  settings dialogs.

## Differences from the original

- Runs in any browser instead of Windows-only; settings are stored in the browser's localStorage
  instead of the registry.
- Three bugs the original's own notes recorded but never fixed are fixed here: the angle is
  preserved when switching between the standard and inverse functions, the symbolic
  representation shows real exact values instead of always reporting "N/A", and printing uses the
  browser's native print instead of the old unreliable `PrintForm`.
- The angle is stored in degrees rather than radians, so repeated stepping can't accumulate
  floating point drift.
- Supports light/dark theme and works down to mobile widths.
