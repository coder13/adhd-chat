type ChatPreferenceDebugValue = string | number | boolean | null | undefined;

export type ChatPreferenceDebugContext = Record<
  string,
  ChatPreferenceDebugValue
>;

export type ChatPreferenceDebugEvent = {
  name: string;
  at: number;
  context?: ChatPreferenceDebugContext;
};

export type ChatPreferenceDebugInspector = {
  enabled: boolean;
  events: ChatPreferenceDebugEvent[];
  reset: () => void;
  print: () => void;
};

const CHAT_PREFERENCE_DEBUG_LOCAL_STORAGE_KEY =
  'adhd-chat.debug.chat-preferences';
const CHAT_PREFERENCE_DEBUG_GLOBAL_KEY = '__ADHD_CHAT_CHAT_PREF_DEBUG__';
const MAX_DEBUG_EVENTS = 200;

let announcedDebugInspector = false;

type GlobalWithChatPreferenceDebug = typeof globalThis & {
  [CHAT_PREFERENCE_DEBUG_GLOBAL_KEY]?: ChatPreferenceDebugInspector;
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
  return globalThis as GlobalWithChatPreferenceDebug;
}

function getNodeEnv() {
  return getGlobalObject().process?.env?.NODE_ENV ?? null;
}

function hasLocalStorageOverride() {
  try {
    const value = getGlobalObject().localStorage?.getItem(
      CHAT_PREFERENCE_DEBUG_LOCAL_STORAGE_KEY
    );
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}

export function isChatPreferenceDebugEnabled() {
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

function ensureChatPreferenceDebugInspector() {
  if (!isChatPreferenceDebugEnabled()) {
    return null;
  }

  const globalObject = getGlobalObject();
  if (!globalObject[CHAT_PREFERENCE_DEBUG_GLOBAL_KEY]) {
    const inspector: ChatPreferenceDebugInspector = {
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

    globalObject[CHAT_PREFERENCE_DEBUG_GLOBAL_KEY] = inspector;
  }

  if (!announcedDebugInspector) {
    announcedDebugInspector = true;
    console.info(
      `[chat-pref-debug] enabled. Inspect window.${CHAT_PREFERENCE_DEBUG_GLOBAL_KEY}, call .print(), or set localStorage["${CHAT_PREFERENCE_DEBUG_LOCAL_STORAGE_KEY}"]="1" to force-enable it.`
    );
  }

  return globalObject[CHAT_PREFERENCE_DEBUG_GLOBAL_KEY] ?? null;
}

export function recordChatPreferenceDebugEvent(
  name: string,
  context?: ChatPreferenceDebugContext
) {
  const inspector = ensureChatPreferenceDebugInspector();
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

  console.info(`[chat-pref-debug] ${name}`, context ?? {});
}
