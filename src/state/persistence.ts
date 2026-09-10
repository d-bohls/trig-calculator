// Port of Modules/modSettings.bas persistence, using localStorage instead of
// the Windows registry (GetSetting/SaveSetting).

import { AngleMode, PI, TrigFunction } from '../trig/trigMath';

const STORAGE_KEY = 'trigCalculator.settings.v1';

interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** The graph is really three different pictures, and a window that suits one
 *  suits neither of the others: the standard functions put an angle spanning
 *  hundreds of degrees on the x-axis, arcsine and arccosine put a ratio confined
 *  to [-1, 1] there, and the remaining four arc functions take any ratio at all.
 *  Each keeps its own window, so moving between them doesn't disturb a view you
 *  set up, and coming back finds it as you left it. */
export const GraphKind = {
  Standard: 'standard',
  ArcBounded: 'arcBounded',
  ArcUnbounded: 'arcUnbounded',
} as const;
export type GraphKind = (typeof GraphKind)[keyof typeof GraphKind];

export function graphKindOf(inverseMode: boolean, fn: TrigFunction): GraphKind {
  if (!inverseMode) return GraphKind.Standard;
  return fn === TrigFunction.Sine || fn === TrigFunction.Cosine
    ? GraphKind.ArcBounded
    : GraphKind.ArcUnbounded;
}

/** Default bounds per kind, with the angle axis written in degrees to match the
 *  default angle mode - defaultGraphWindow converts it when radians are showing.
 *  The angle axis is x for the standard functions and y for the arc ones. The
 *  arc kinds share their angle bounds because they have to cover the principal
 *  ranges of every function in the group, which between them span -90 to 180. */
const DEFAULT_WINDOWS: Record<GraphKind, Bounds> = {
  [GraphKind.Standard]: { xMin: -540, xMax: 540, yMin: -10, yMax: 10 },
  [GraphKind.ArcBounded]: { xMin: -1.5, xMax: 1.5, yMin: -105, yMax: 195 },
  // wide enough to show these four flattening out towards their asymptotes,
  // which a ratio axis of a handful of units cuts off well before
  [GraphKind.ArcUnbounded]: { xMin: -20, xMax: 20, yMin: -105, yMax: 195 },
};

export interface PersistedSettings {
  radius: number;
  /** the angle, stored in degrees - see degreesFromRadians in
   *  useCalculatorState for why degrees rather than radians */
  degrees: number;
  functionMode: TrigFunction;
  angleMode: AngleMode;
  inverseMode: boolean;
  anglePlaces: number;
  resultPlaces: number;
  /** how many whole degrees the angle steppers move per click */
  angleStepDegrees: number;
  /** seconds one automated sweep takes, edge to edge of the graph window */
  sweepSeconds: number;
  /** one window per graph kind, each as laid out on screen - so for the arc
   *  kinds, xMin/xMax bound the ratio and yMin/yMax the angle */
  graphWindows: Record<GraphKind, Bounds>;
  showTangent: boolean;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  radius: 1,
  degrees: 30,
  functionMode: TrigFunction.Sine,
  angleMode: AngleMode.Degrees,
  inverseMode: false,
  anglePlaces: 2,
  resultPlaces: 4,
  // 15 walks the angle through the special angles, so the exact values stay
  // populated as you step
  angleStepDegrees: 15,
  // slow enough to follow the point round the circle as it goes, rather than
  // just watching it arrive
  sweepSeconds: 12,
  graphWindows: DEFAULT_WINDOWS,
  showTangent: false,
};

/** One kind's default bounds, with its angle axis converted to the unit in use. */
export function defaultGraphWindow(kind: GraphKind, angleMode: AngleMode): Bounds {
  const w = DEFAULT_WINDOWS[kind];
  const scale = angleMode === AngleMode.Degrees ? 1 : PI / 180;
  return kind === GraphKind.Standard
    ? { xMin: w.xMin * scale, xMax: w.xMax * scale, yMin: w.yMin, yMax: w.yMax }
    : { xMin: w.xMin, xMax: w.xMax, yMin: w.yMin * scale, yMax: w.yMax * scale };
}

function isBounds(v: unknown): v is Bounds {
  if (!v || typeof v !== 'object') return false;
  const b = v as Record<string, unknown>;
  return (['xMin', 'xMax', 'yMin', 'yMax'] as const).every((k) => typeof b[k] === 'number' && Number.isFinite(b[k]));
}

/** Saves from before the per-kind split held a single window in flat xMin/xMax/
 *  yMin/yMax fields. That window belonged to whichever kind was showing when it
 *  was written, so put it back there and default the other two. */
function migrateWindows(parsed: Record<string, unknown>): Record<GraphKind, Bounds> {
  const stored = parsed.graphWindows;
  if (stored && typeof stored === 'object') {
    const byKind = stored as Record<string, unknown>;
    const out = { ...DEFAULT_WINDOWS };
    for (const kind of Object.values(GraphKind)) {
      if (isBounds(byKind[kind])) out[kind] = byKind[kind];
    }
    return out;
  }

  const flat = { xMin: parsed.xMin, xMax: parsed.xMax, yMin: parsed.yMin, yMax: parsed.yMax };
  if (!isBounds(flat)) return { ...DEFAULT_WINDOWS };
  const angleMode = typeof parsed.angleMode === 'number' ? (parsed.angleMode as AngleMode) : DEFAULT_SETTINGS.angleMode;
  const fn = typeof parsed.functionMode === 'number' ? (parsed.functionMode as TrigFunction) : TrigFunction.Sine;
  const kind = graphKindOf(parsed.inverseMode === true, fn);
  const out = {} as Record<GraphKind, Bounds>;
  for (const k of Object.values(GraphKind)) out[k] = defaultGraphWindow(k, angleMode);
  out[kind] = flat;
  return out;
}

export function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    // older saves stored the angle in radians - carry it over rather than
    // silently resetting the angle to the default
    if (parsed.degrees === undefined && typeof parsed.radians === 'number') {
      parsed.degrees = (parsed.radians * 180) / PI;
    }
    return { ...DEFAULT_SETTINGS, ...parsed, graphWindows: migrateWindows(parsed) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage failures (e.g. private browsing quota)
  }
}
