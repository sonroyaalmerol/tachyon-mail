type HeadersInitLike = Record<string, string>;

const NS = {
  d: "DAV:",
  cal: "urn:ietf:params:xml:ns:caldav",
  card: "urn:ietf:params:xml:ns:carddav",
  cs: "http://calendarserver.org/ns/",
};

export const DAV_NS = NS;

export class WebDavClient {
  constructor(private cfg: {
    baseUrl: string;
    auth: { type: "basic"; username: string; password: string } | { type: "bearer"; token: string };
    userAgent?: string;
    timeoutMs?: number;
  }) { }

  get baseUrl(): string {
    return this.cfg.baseUrl.replace(/\/+$/, "") + "/";
  }

  async propfind(
    href: string,
    depth: "0" | "1" | "infinity",
    bodyXml: string,
    headers?: HeadersInitLike
  ): Promise<Response> {
    return this.request("PROPFIND", href, bodyXml, {
      Depth: depth,
      "Content-Type": 'application/xml; charset="utf-8"',
      ...headers,
    });
  }

  async report(
    href: string,
    depth: "0" | "1" | "infinity",
    bodyXml: string,
    headers?: HeadersInitLike
  ): Promise<Response> {
    return this.request("REPORT", href, bodyXml, {
      Depth: depth,
      "Content-Type": 'application/xml; charset="utf-8"',
      ...headers,
    });
  }

  async mkcol(href: string, headers?: HeadersInitLike): Promise<Response> {
    return this.request("MKCOL", href, undefined, headers);
  }

  async mkcalendar(href: string, bodyXml?: string): Promise<Response> {
    return this.request(
      "MKCALENDAR",
      href,
      bodyXml,
      bodyXml
        ? { "Content-Type": 'application/xml; charset="utf-8"' }
        : undefined
    );
  }

  async put(
    href: string,
    data: string | Uint8Array,
    headers?: HeadersInitLike
  ): Promise<Response> {
    return this.request("PUT", href, data, headers);
  }

  async patch(
    href: string,
    data: string | Uint8Array,
    headers?: HeadersInitLike
  ): Promise<Response> {
    return this.request("PATCH", href, data, headers);
  }

  async delete(href: string, headers?: HeadersInitLike): Promise<Response> {
    return this.request("DELETE", href, undefined, headers);
  }

  async options(href: string): Promise<Response> {
    return this.request("OPTIONS", href);
  }

  async request(
    method: string,
    href: string,
    body?: string | Uint8Array,
    headers?: HeadersInitLike
  ): Promise<Response> {
    const url = absoluteUrl(this.baseUrl, href);
    const h: HeadersInitLike = {
      ...(this.cfg.userAgent ? { "User-Agent": this.cfg.userAgent } : {}),
      ...authHeader(this.cfg.auth),
      ...(headers || {}),
    };
    const controller = new AbortController();
    const to = setTimeout(
      () => controller.abort(),
      this.cfg.timeoutMs ?? 30000
    );
    try {
      const res = await fetch(url, {
        method,
        headers: h as any,
        body:
          typeof body === "string"
            ? body
            : body
              ? new Blob([body])
              : undefined,
        signal: controller.signal,
      } as RequestInit);
      return res;
    } finally {
      clearTimeout(to);
    }
  }
}

function authHeader(auth: { type: "basic"; username: string; password: string } | { type: "bearer"; token: string }) {
  if (auth.type === "basic") {
    const token =
      typeof btoa !== "undefined"
        ? btoa(`${auth.username}:${auth.password}`)
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer?.from(`${auth.username}:${auth.password}`, "utf8").toString("base64");
    return { Authorization: `Basic ${token}` };
  } else {
    return { Authorization: `Bearer ${auth.token}` };
  }
}

export function absoluteUrl(base: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/")) {
    const u = new URL(base);
    return u.origin + href;
  }
  return base + href.replace(/^\.?\//, "");
}

// Very small XML helper: extracts elements and props from multistatus
export async function parseMultiStatus(res: Response): Promise<Document> {
  const text = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");
  return doc;
}

export function q(doc: Document, name: string): Element[] {
  const [ns, local] = splitQName(name);
  const sel = ns
    ? `*[local-name()='${local}'][namespace-uri()='${ns}']`
    : `*[local-name()='${local}']`;
  return Array.from(doc.querySelectorAll(sel)) as any;
}

export function q1(
  el: Element | Document,
  localName: string,
  nsUri?: string
): Element | null {
  if (nsUri) {
    // direct child with namespace
    return el.querySelector(
      `:scope > *[local-name()='${localName}'][namespace-uri()='${nsUri}']`
    );
  } else {
    // direct child, any namespace
    return el.querySelector(`:scope > *[local-name()='${localName}']`);
  }
}

export function textOf(el: Element | null | undefined): string | undefined {
  if (!el) return undefined;
  return (el.textContent || "").trim() || undefined;
}

function splitQName(n: string): [string | null, string] {
  const i = n.indexOf(" ");
  if (i < 0) return [null, n];
  return [n.slice(0, i), n.slice(i + 1)];
}
