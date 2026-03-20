type MatrixPerfContextValue = string | number | boolean | null | undefined;

export type MatrixPerfContext = Record<string, MatrixPerfContextValue>;

export type MatrixPerfTimingSummary = {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
};

export type MatrixPerfEvent = {
  kind: 'counter' | 'timing';
  name: string;
  at: number;
  value: number;
  context?: MatrixPerfContext;
};

export type MatrixPerfInspector = {
  enabled: boolean;
  counters: Record<string, number>;
  timings: Record<string, MatrixPerfTimingSummary>;
  recentEvents: MatrixPerfEvent[];
  reset: () => void;
  printSummary: () => void;
};

const MATRIX_PERF_LOCAL_STORAGE_KEY = 'adhd-chat.debug.matrix-perf';
const MATRIX_PERF_GLOBAL_KEY = '__ADHD_CHAT_MATRIX_PERF__';
const MAX_RECENT_EVENTS = 100;

let announcedMatrixPerf = false;

type GlobalWithMatrixPerf = typeof globalThis & {
  [MATRIX_PERF_GLOBAL_KEY]?: MatrixPerfInspector;
  process?: {
    env?: {
      NODE_ENV?: string;
    };
  };
  location?: {
    hostname?: string;
  };
  localStorage?: Storage;
};

function getGlobalObject() {
  return globalThis as GlobalWithMatrixPerf;
}

function getNodeEnv() {
  return getGlobalObject().process?.env?.NODE_ENV ?? null;
}

function hasLocalStorageOverride() {
  try {
    const value = getGlobalObject().localStorage?.getItem(
      MATRIX_PERF_LOCAL_STORAGE_KEY
    );
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}

export function isMatrixPerfEnabled() {
  const nodeEnv = getNodeEnv();
  if (nodeEnv === 'development') {
    return true;
  }

  if (hasLocalStorageOverride()) {
    return true;
  }

  const hostname = getGlobalObject().location?.hostname ?? '';
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0'
  );
}

function getNow() {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  }

  return Date.now();
}

function cloneTimingSummary(summary: MatrixPerfTimingSummary) {
  return {
    count: summary.count,
    totalMs: summary.totalMs,
    maxMs: summary.maxMs,
    lastMs: summary.lastMs,
  } satisfies MatrixPerfTimingSummary;
}

function ensureMatrixPerfInspector() {
  if (!isMatrixPerfEnabled()) {
    return null;
  }

  const globalObject = getGlobalObject();
  if (!globalObject[MATRIX_PERF_GLOBAL_KEY]) {
    const inspector: MatrixPerfInspector = {
      enabled: true,
      counters: {},
      timings: {},
      recentEvents: [],
      reset: () => {
        inspector.recentEvents.splice(0, inspector.recentEvents.length);
        Object.keys(inspector.counters).forEach((key) => {
          delete inspector.counters[key];
        });
        Object.keys(inspector.timings).forEach((key) => {
          delete inspector.timings[key];
        });
      },
      printSummary: () => {
        const timingSummary = Object.fromEntries(
          Object.entries(inspector.timings).map(([name, summary]) => [
            name,
            {
              ...cloneTimingSummary(summary),
              averageMs:
                summary.count > 0 ? summary.totalMs / summary.count : 0,
            },
          ])
        );

        console.table({
          counters: inspector.counters,
          timings: timingSummary,
        });
      },
    };

    globalObject[MATRIX_PERF_GLOBAL_KEY] = inspector;
  }

  if (!announcedMatrixPerf) {
    announcedMatrixPerf = true;
    console.info(
      `[matrix-perf] enabled. Inspect window.${MATRIX_PERF_GLOBAL_KEY} or set localStorage["${MATRIX_PERF_LOCAL_STORAGE_KEY}"]="1" to force-enable it.`
    );
  }

  return globalObject[MATRIX_PERF_GLOBAL_KEY] ?? null;
}

function pushRecentEvent(inspector: MatrixPerfInspector, event: MatrixPerfEvent) {
  inspector.recentEvents.push(event);
  if (inspector.recentEvents.length > MAX_RECENT_EVENTS) {
    inspector.recentEvents.splice(
      0,
      inspector.recentEvents.length - MAX_RECENT_EVENTS
    );
  }
}

export function incrementMatrixPerfCounter(
  name: string,
  context?: MatrixPerfContext,
  amount = 1
) {
  const inspector = ensureMatrixPerfInspector();
  if (!inspector) {
    return 0;
  }

  const nextValue = (inspector.counters[name] ?? 0) + amount;
  inspector.counters[name] = nextValue;
  pushRecentEvent(inspector, {
    kind: 'counter',
    name,
    at: Date.now(),
    value: amount,
    context,
  });

  return nextValue;
}

export function recordMatrixPerfDuration(
  name: string,
  durationMs: number,
  context?: MatrixPerfContext
) {
  const inspector = ensureMatrixPerfInspector();
  if (!inspector) {
    return durationMs;
  }

  const current = inspector.timings[name] ?? {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    lastMs: 0,
  };
  const nextSummary = {
    count: current.count + 1,
    totalMs: current.totalMs + durationMs,
    maxMs: Math.max(current.maxMs, durationMs),
    lastMs: durationMs,
  } satisfies MatrixPerfTimingSummary;
  inspector.timings[name] = nextSummary;
  pushRecentEvent(inspector, {
    kind: 'timing',
    name,
    at: Date.now(),
    value: durationMs,
    context,
  });

  return durationMs;
}

export function startMatrixPerfTimer(
  name: string,
  initialContext?: MatrixPerfContext
) {
  const startedAt = getNow();

  return {
    end(finalContext?: MatrixPerfContext) {
      return recordMatrixPerfDuration(name, getNow() - startedAt, {
        ...initialContext,
        ...finalContext,
      });
    },
  };
}

export async function timeMatrixPerf<T>(
  name: string,
  work: () => Promise<T>,
  context?: MatrixPerfContext
) {
  const timer = startMatrixPerfTimer(name, context);
  try {
    const result = await work();
    timer.end();
    return result;
  } catch (error) {
    timer.end({ status: 'error' });
    throw error;
  }
}
