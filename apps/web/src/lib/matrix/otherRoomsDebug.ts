type OtherRoomsDebugValue = string | number | boolean | null | undefined;

export type OtherRoomsDebugContext = Record<string, OtherRoomsDebugValue>;

export type OtherRoomsDebugEvent = {
  name: string;
  at: number;
  context?: OtherRoomsDebugContext;
};

export type OtherRoomsDebugInspector = {
  enabled: boolean;
  events: OtherRoomsDebugEvent[];
  reset: () => void;
  print: () => void;
};

const OTHER_ROOMS_DEBUG_LOCAL_STORAGE_KEY = 'adhd-chat.debug.other-rooms';
const OTHER_ROOMS_DEBUG_GLOBAL_KEY = '__ADHD_CHAT_OTHER_ROOMS_DEBUG__';
const MAX_DEBUG_EVENTS = 300;

let announcedOtherRoomsDebug = false;

type GlobalWithOtherRoomsDebug = typeof globalThis & {
  [OTHER_ROOMS_DEBUG_GLOBAL_KEY]?: OtherRoomsDebugInspector;
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
  return globalThis as GlobalWithOtherRoomsDebug;
}

function getNodeEnv() {
  return getGlobalObject().process?.env?.NODE_ENV ?? null;
}

function hasLocalStorageOverride() {
  try {
    const value = getGlobalObject().localStorage?.getItem(
      OTHER_ROOMS_DEBUG_LOCAL_STORAGE_KEY
    );
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}

function isOtherRoomsDebugEnabled() {
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

function ensureOtherRoomsDebugInspector() {
  if (!isOtherRoomsDebugEnabled()) {
    return null;
  }

  const globalObject = getGlobalObject();
  if (!globalObject[OTHER_ROOMS_DEBUG_GLOBAL_KEY]) {
    const inspector: OtherRoomsDebugInspector = {
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

    globalObject[OTHER_ROOMS_DEBUG_GLOBAL_KEY] = inspector;
  }

  if (!announcedOtherRoomsDebug) {
    announcedOtherRoomsDebug = true;
    console.info(
      `[other-rooms-debug] enabled. Inspect window.${OTHER_ROOMS_DEBUG_GLOBAL_KEY}, call .print(), or set localStorage["${OTHER_ROOMS_DEBUG_LOCAL_STORAGE_KEY}"]="1" to force-enable it.`
    );
  }

  return globalObject[OTHER_ROOMS_DEBUG_GLOBAL_KEY] ?? null;
}

export function recordOtherRoomsDebugEvent(
  name: string,
  context?: OtherRoomsDebugContext
) {
  const inspector = ensureOtherRoomsDebugInspector();
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

  console.info(`[other-rooms-debug] ${name}`, context ?? {});
}
