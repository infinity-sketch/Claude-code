// Link handling: normalize user input into safe, openable URLs and detect the platform.
// Never throws — invalid input comes back as { ok: false } with a human-readable reason.

export const PLATFORMS = {
  instagram: { label: 'Instagram', hosts: ['instagram.com', 'instagr.am'] },
  tiktok: { label: 'TikTok', hosts: ['tiktok.com'] },
  youtube: { label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  pinterest: { label: 'Pinterest', hosts: ['pinterest.com', 'pin.it'] },
  web: { label: 'Link', hosts: [] },
};

export function detectPlatform(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  for (const [key, p] of Object.entries(PLATFORMS)) {
    // Match the host itself or any subdomain (vm.tiktok.com, m.youtube.com, pinterest.co.uk handled below).
    if (p.hosts.some(h => host === h || host.endsWith('.' + h))) return key;
  }
  // Pinterest uses many country TLDs (pinterest.co.uk, pinterest.fr, ...).
  if (/(^|\.)pinterest\.[a-z.]{2,6}$/.test(host)) return 'pinterest';
  return 'web';
}

export function normalizeUrl(raw) {
  const input = String(raw ?? '').trim();
  if (!input) return { ok: false, raw: input, error: 'Empty link' };
  if (/\s/.test(input)) return { ok: false, raw: input, error: 'Link contains spaces' };

  let candidate = input;
  // Protocol-relative (//example.com) and bare domains get https://.
  if (candidate.startsWith('//')) candidate = 'https:' + candidate;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = 'https://' + candidate;
  // "instagram.com:foo" style typos parse as a scheme — only http(s) are allowed.
  if (!/^https?:\/\//i.test(candidate)) {
    return { ok: false, raw: input, error: 'Only web links (http/https) can be opened' };
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, raw: input, error: "This doesn't look like a valid link" };
  }
  const host = url.hostname;
  const validHost = host === 'localhost' || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (!validHost) return { ok: false, raw: input, error: "This doesn't look like a valid link" };

  const platform = detectPlatform(host);
  return {
    ok: true,
    raw: input,
    url: url.href,
    host: host.replace(/^www\./, ''),
    platform,
    platformLabel: PLATFORMS[platform].label,
  };
}

// Split pasted text into individual links, de-duplicated. Newlines and commas always separate;
// spaces only separate when every piece on the line looks like a link, so a typo such as
// "not a link" stays one entry (and shows one warning) instead of three.
export function splitLinks(text) {
  const out = [];
  for (const line of String(text ?? '').split(/[\n,]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1 && parts.every(p => /\.[a-z]{2,}/i.test(p))) out.push(...parts);
    else out.push(trimmed);
  }
  return [...new Set(out)];
}
