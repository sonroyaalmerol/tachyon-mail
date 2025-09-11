import {
  WebDavClient,
  parseMultiStatus,
  q1,
  textOf,
  DAV_NS as NS,
} from "../core/WebDavClient";

export type DavAuth =
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string };

export type AutoDiscoverInput = {
  origin: string; // e.g., "https://dav.example.com" or "https://example.com"
  auth: DavAuth;
  timeoutMs?: number;
  userAgent?: string;
};

export type AutoDiscoverResult = {
  // Canonical host origin used
  origin: string;
  // Resolved service bases (fully qualified)
  caldavBase?: string;
  carddavBase?: string;
  // Principal and home-sets (server-relative hrefs)
  principalHref?: string;
  calendarHomeHref?: string;
  addressbookHomeHref?: string;
  // Raw server claims for inspection
  server?: {
    davHeader?: string | null;
    allowHeader?: string | null;
  };
};

const WELL_KNOWN = {
  caldav: "/.well-known/caldav",
  carddav: "/.well-known/carddav",
};

const COMMON_BASES = [
  "/", // server root
  "/dav/",
  "/caldav/",
  "/carddav/",
  "/remote.php/dav/", // Nextcloud/ownCloud
];

export async function autoDiscoverDav(
  input: AutoDiscoverInput
): Promise<AutoDiscoverResult> {
  const origin = normalizeOrigin(input.origin);
  const dav = new WebDavClient({
    baseUrl: origin + "/",
    auth: input.auth,
    userAgent: input.userAgent || "rn-dav-autodiscover/1.0",
    timeoutMs: input.timeoutMs ?? 15000,
  });

  // 1) Try well-known endpoints (they may redirect)
  const calBase = await resolveServiceBase(dav, origin, WELL_KNOWN.caldav);
  const cardBase = await resolveServiceBase(dav, origin, WELL_KNOWN.carddav);

  // 2) If missing, probe common bases
  const caldavBase =
    calBase?.base ||
    (await probeForCalDav(dav, origin, COMMON_BASES)) ||
    undefined;

  const carddavBase =
    cardBase?.base ||
    (await probeForCardDav(dav, origin, COMMON_BASES)) ||
    undefined;

  // 3) From any known base (prefer caldavBase), discover principal + homes
  const probeBase = caldavBase || carddavBase || origin + "/";
  const { principalHref, calendarHomeHref, addressbookHomeHref, server } =
    await discoverHomes(new WebDavClient({ ...dav["cfg"], baseUrl: probeBase }));

  return {
    origin,
    caldavBase,
    carddavBase,
    principalHref,
    calendarHomeHref,
    addressbookHomeHref,
    server,
  };
}

// ----- internals -----

async function resolveServiceBase(
  dav: WebDavClient,
  origin: string,
  path: string
): Promise<{ base: string } | null> {
  // RFC 6764 allows GET or PROPFIND on well-known that redirects to service root
  // Follow redirect and return final URL’s directory as base
  try {
    const url = origin + path;
    const res = await dav.request("GET", url);
    if (isRedirect(res.status)) {
      const loc = res.headers.get("Location");
      if (!loc) return null;
      const abs = toAbsolute(origin, loc);
      // caldav/carddav base is the final location (often a collection path)
      return { base: ensureTrailingSlash(abs) };
    }
    // Some servers respond 200 OK and expect PROPFIND; try PROPFIND depth 0
    if (res.ok) {
      const r2 = await dav.propfind(url, "0", propfindPrincipalXml());
      if (r2.ok) {
        // Use the well-known as base
        return { base: ensureTrailingSlash(origin + path) };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function probeForCalDav(
  dav: WebDavClient,
  origin: string,
  bases: string[]
): Promise<string | null> {
  for (const base of bases) {
    const baseUrl = ensureTrailingSlash(toAbsolute(origin, base));
    const ok = await looksLikeCalDav(dav, baseUrl);
    if (ok) return baseUrl;
  }
  return null;
}
async function probeForCardDav(
  dav: WebDavClient,
  origin: string,
  bases: string[]
): Promise<string | null> {
  for (const base of bases) {
    const baseUrl = ensureTrailingSlash(toAbsolute(origin, base));
    const ok = await looksLikeCardDav(dav, baseUrl);
    if (ok) return baseUrl;
  }
  return null;
}

async function looksLikeCalDav(dav: WebDavClient, baseUrl: string) {
  try {
    const client = new WebDavClient({ ...dav["cfg"], baseUrl });
    const opt = await client.options("");
    const davHdr = opt.headers.get("DAV") || "";
    if (/calendar-access/i.test(davHdr)) return true;
    // Fallback: PROPFIND for resourcetype calendar on depth 0 may fail at root
    const res = await client.propfind("", "0", propfindCalendarFeatureXml());
    if (res.ok) return true;
  } catch { }
  return false;
}

async function looksLikeCardDav(dav: WebDavClient, baseUrl: string) {
  try {
    const client = new WebDavClient({ ...dav["cfg"], baseUrl });
    const opt = await client.options("");
    const davHdr = opt.headers.get("DAV") || "";
    if (/addressbook/i.test(davHdr)) return true;
    const res = await client.propfind("", "0", propfindAddressbookFeatureXml());
    if (res.ok) return true;
  } catch { }
  return false;
}

async function discoverHomes(dav: WebDavClient): Promise<{
  principalHref?: string;
  calendarHomeHref?: string;
  addressbookHomeHref?: string;
  server: { davHeader?: string | null; allowHeader?: string | null };
}> {
  const server: { davHeader?: string | null; allowHeader?: string | null } = {
    davHeader: null,
    allowHeader: null,
  };
  try {
    const opt = await dav.options("");
    server.davHeader = opt.headers.get("DAV");
    server.allowHeader = opt.headers.get("Allow");
  } catch { }

  // Step 1: current-user-principal
  let principalHref: string | undefined;
  try {
    const res = await dav.propfind("", "0", propfindPrincipalXml());
    const doc = await parseMultiStatus(res);
    principalHref =
      textOf(q1(doc, "current-user-principal", NS.d)?.querySelector("*")) ||
      textOf(q1(doc, "href", NS.d)) ||
      undefined;
  } catch { }
  if (!principalHref) {
    // Some servers require probing a known collection path. Try common path.
    principalHref = "/";
  }

  // Step 2: homes
  let calendarHomeHref: string | undefined;
  let addressbookHomeHref: string | undefined;
  try {
    const res = await dav.propfind(principalHref!, "0", propfindHomesXml());
    const doc = await parseMultiStatus(res);
    calendarHomeHref =
      textOf(q1(doc, "calendar-home-set", NS.cal)?.querySelector("*")) ||
      undefined;
    addressbookHomeHref =
      textOf(q1(doc, "addressbook-home-set", NS.card)?.querySelector("*")) ||
      undefined;
  } catch { }

  return { principalHref, calendarHomeHref, addressbookHomeHref, server };
}

// ----- XML helpers -----

function propfindPrincipalXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="${NS.d}">
  <d:prop>
    <d:current-user-principal/>
    <d:href/>
  </d:prop>
</d:propfind>`;
}

function propfindHomesXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="${NS.d}" xmlns:c="${NS.card}" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <c:calendar-home-set/>
    <card:addressbook-home-set/>
  </d:prop>
</d:propfind>`;
}

function propfindCalendarFeatureXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="${NS.d}" xmlns:c="${NS.cal}">
  <d:prop>
    <d:resourcetype/>
    <c:supported-calendar-component-set/>
  </d:prop>
</d:propfind>`;
}

function propfindAddressbookFeatureXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="${NS.d}" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:resourcetype/>
    <card:addressbook/>
  </d:prop>
</d:propfind>`;
}

// ----- utils -----

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function ensureTrailingSlash(u: string): string {
  return u.endsWith("/") ? u : u + "/";
}

function toAbsolute(origin: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/")) return origin + href;
  return ensureTrailingSlash(origin) + href;
}

function normalizeOrigin(s: string): string {
  const u = new URL(s);
  return u.origin;
}
