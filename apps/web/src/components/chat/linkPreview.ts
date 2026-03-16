export type SimpleLinkPreview = {
  url: string;
  host: string;
  title: string;
  subtitle: string | null;
};

const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)]?)/i;

function normalizeUrl(rawValue: string) {
  return rawValue.startsWith('www.') ? `https://${rawValue}` : rawValue;
}

export function extractFirstLinkPreview(message: string): SimpleLinkPreview | null {
  const match = message.match(URL_PATTERN)?.[1];
  if (!match) {
    return null;
  }

  try {
    const url = new URL(normalizeUrl(match));
    const path = `${url.pathname}${url.search}`.trim();
    return {
      url: url.toString(),
      host: url.hostname.replace(/^www\./, ''),
      title: url.hostname.replace(/^www\./, ''),
      subtitle: path && path !== '/' ? path : null,
    };
  } catch {
    return null;
  }
}
