type LayoutDebugValue = string | number | boolean | null | undefined;

export type LayoutDebugContext = Record<string, LayoutDebugValue>;

export type LayoutDebugEvent = {
  name: string;
  at: number;
  context?: LayoutDebugContext;
};

export type LayoutDebugInspector = {
  enabled: boolean;
  events: LayoutDebugEvent[];
  reset: () => void;
  print: () => void;
};

const LAYOUT_DEBUG_LOCAL_STORAGE_KEY = 'adhd-chat.debug.layout';
const LAYOUT_DEBUG_GLOBAL_KEY = '__ADHD_CHAT_LAYOUT_DEBUG__';
const MAX_DEBUG_EVENTS = 200;

let announcedLayoutDebug = false;

type GlobalWithLayoutDebug = typeof globalThis & {
  [LAYOUT_DEBUG_GLOBAL_KEY]?: LayoutDebugInspector;
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
  return globalThis as GlobalWithLayoutDebug;
}

function getNodeEnv() {
  return getGlobalObject().process?.env?.NODE_ENV ?? null;
}

function hasLocalStorageOverride() {
  try {
    const value = getGlobalObject().localStorage?.getItem(
      LAYOUT_DEBUG_LOCAL_STORAGE_KEY
    );
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}

export function isLayoutDebugEnabled() {
  if (getNodeEnv() === 'development') {
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

function ensureLayoutDebugInspector() {
  if (!isLayoutDebugEnabled()) {
    return null;
  }

  const globalObject = getGlobalObject();
  if (!globalObject[LAYOUT_DEBUG_GLOBAL_KEY]) {
    const inspector: LayoutDebugInspector = {
      enabled: true,
      events: [],
      reset: () => {
        inspector.events.splice(0, inspector.events.length);
      },
      print: () => {
        console.table(
          inspector.events.map((event) => ({
            name: event.name,
            at: event.at,
            ...event.context,
          }))
        );
      },
    };

    globalObject[LAYOUT_DEBUG_GLOBAL_KEY] = inspector;
  }

  if (!announcedLayoutDebug) {
    announcedLayoutDebug = true;
    console.info(
      `[layout-debug] enabled. Inspect window.${LAYOUT_DEBUG_GLOBAL_KEY}, call .print(), or set localStorage["${LAYOUT_DEBUG_LOCAL_STORAGE_KEY}"]="1" to force-enable it.`
    );
  }

  return globalObject[LAYOUT_DEBUG_GLOBAL_KEY] ?? null;
}

export function recordLayoutDebugEvent(
  name: string,
  context?: LayoutDebugContext
) {
  const inspector = ensureLayoutDebugInspector();
  if (!inspector) {
    return;
  }

  inspector.events.push({
    name,
    at: Date.now(),
    context,
  });
  if (inspector.events.length > MAX_DEBUG_EVENTS) {
    inspector.events.splice(0, inspector.events.length - MAX_DEBUG_EVENTS);
  }

  console.info(`[layout-debug] ${name}`, context ?? {});
}
