import { WebDavClient, parseMultiStatus, q1, textOf, absoluteUrl, DAV_NS as NS } from "../core/WebDavClient";
import { DavCollection, DavObjectRef, SyncChange, VCardInfo } from "../types";

export class CardDavClient {
  constructor(private dav: WebDavClient) { }

  async listAddressBooks(rootHref = "/"): Promise<DavCollection[]> {
    // current-user-principal
    const res1 = await this.dav.propfind(rootHref, "0", propfindXml([
      [NS.d, "current-user-principal"],
    ]));
    const doc1 = await parseMultiStatus(res1);
    const principal =
      textOf(q1(doc1, `${NS.d} current-user-principal`)?.querySelector("*")) ||
      textOf(q1(doc1, `${NS.d} href`)) || "/";

    // addressbook-home-set
    const res2 = await this.dav.propfind(principal!, "0", propfindXml([
      [NS.card, "addressbook-home-set"],
    ]));
    const doc2 = await parseMultiStatus(res2);
    const home =
      textOf(q1(doc2, `${NS.card} addressbook-home-set`)?.querySelector("*")) ||
      "/";

    // list under home
    const res3 = await this.dav.propfind(home, "1", propfindXml([
      [NS.d, "displayname"],
      [NS.d, "resourcetype"],
      [NS.d, "sync-token"],
      [NS.cs, "getctag"],
    ]));
    const doc3 = await parseMultiStatus(res3);
    const out: DavCollection[] = [];
    for (const resp of Array.from(doc3.getElementsByTagNameNS(NS.d, "response"))) {
      const href = textOf(q1(resp, `${NS.d} href`));
      const resType = q1(resp, `${NS.d} resourcetype`);
      const isBook = !!resType?.querySelector(`*[local-name()='addressbook']`);
      if (!href || !isBook) continue;
      out.push({
        href,
        displayName: textOf(q1(resp, `${NS.d} displayname`)),
        syncToken: textOf(q1(resp, `${NS.d} sync-token`)),
        ctag: textOf(q1(resp, `${NS.cs} getctag`)),
      });
    }
    return out;
  }

  async syncCollection(
    bookHref: string,
    syncToken?: string
  ): Promise<{ changes: SyncChange[]; nextSyncToken?: string }> {
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<d:sync-collection xmlns:d="${NS.d}">
  <d:sync-token>${escapeXml(syncToken || "")}</d:sync-token>
  <d:sync-level>1</d:sync-level>
  <d:prop>
    <d:getetag/>
  </d:prop>
</d:sync-collection>`;
    const res = await this.dav.report(bookHref, "1", body);
    const doc = await parseMultiStatus(res);

    const changes: SyncChange[] = [];
    for (const r of Array.from(doc.getElementsByTagNameNS(NS.d, "response"))) {
      const href = textOf(q1(r, `${NS.d} href`));
      const status = textOf(q1(r, `${NS.d} status`));
      const etag = textOf(q1(r, `${NS.d} getetag`));
      if (!href) continue;
      if (status && /404|410/.test(status)) {
        changes.push({ href, status: "deleted" });
      } else {
        changes.push({ href, status: etag ? "modified" : "added", etag: etag?.replace(/^W\//, "") });
      }
    }
    const next = textOf(q1(doc, `${NS.d} sync-token`));
    return { changes, nextSyncToken: next };
  }

  async listObjects(bookHref: string): Promise<DavObjectRef[]> {
    const xml = propfindXml([[NS.d, "getetag"]]);
    const res = await this.dav.propfind(bookHref, "1", xml);
    const doc = await parseMultiStatus(res);
    const out: DavObjectRef[] = [];
    for (const r of Array.from(doc.getElementsByTagNameNS(NS.d, "response"))) {
      const href = textOf(q1(r, `${NS.d} href`));
      const etag = textOf(q1(r, `${NS.d} getetag`));
      if (!href) continue;
      if (href.endsWith("/") && href === bookHref) continue;
      out.push({ href, etag: etag?.replace(/^W\//, "") });
    }
    return out;
  }

  async getVCardRaw(href: string): Promise<{ vcf: string; etag?: string }> {
    const res = await this.dav.request("GET", href);
    if (!res.ok) throw new Error(`GET ${href} failed: ${res.status}`);
    const etag = res.headers.get("ETag") || undefined;
    const vcf = await res.text();
    return { vcf, etag: etag?.replace(/^W\//, "") };
  }

  // Addressbook-multiget: fetch selected cards efficiently
  async multiGet(
    bookHref: string,
    hrefs: string[]
  ): Promise<Array<{ href: string; vcf: string; etag?: string }>> {
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<c:addressbook-multiget xmlns:d="${NS.d}" xmlns:c="${NS.card}">
  <d:prop>
    <d:getetag/>
    <c:address-data/>
  </d:prop>
  ${hrefs.map((h) => `<d:href>${escapeXml(h)}</d:href>`).join("\n")}
</c:addressbook-multiget>`;
    const res = await this.dav.report(bookHref, "1", body);
    const doc = await parseMultiStatus(res);
    const out: Array<{ href: string; vcf: string; etag?: string }> = [];
    for (const r of Array.from(doc.getElementsByTagNameNS(NS.d, "response"))) {
      const href = textOf(q1(r, `${NS.d} href`));
      const vcf = (q1(r, `${NS.card} address-data`)?.textContent || "").trim();
      const etag = textOf(q1(r, `${NS.d} getetag`))?.replace(/^W\//, "");
      if (!href) continue;
      out.push({ href, vcf, etag });
    }
    return out;
  }

  async putVCard(
    bookHref: string,
    filenameVcf: string, // e.g. "uid123.vcf"
    vcf: string,
    opts?: { etag?: string }
  ): Promise<{ etag?: string }> {
    const href = absoluteUrl(bookHref, filenameVcf);
    const headers: Record<string, string> = {
      "Content-Type": "text/vcard; charset=utf-8",
    };
    if (opts?.etag) headers["If-Match"] = opts.etag;
    else headers["If-None-Match"] = "*";
    const res = await this.dav.put(href, vcf, headers);
    if (!(res.status === 201 || res.status === 204)) {
      throw new Error(`PUT vCard failed: ${res.status}`);
    }
    return { etag: res.headers.get("ETag") || undefined };
  }

  async deleteVCard(href: string, opts?: { etag?: string }): Promise<void> {
    const headers: Record<string, string> = {};
    if (opts?.etag) headers["If-Match"] = opts.etag;
    const res = await this.dav.delete(href, headers);
    if (!(res.status === 200 || res.status === 204)) {
      throw new Error(`DELETE ${href} failed: ${res.status}`);
    }
  }
}

// ---- helpers ----
const propfindXml = (props: Array<[string, string]>) => {
  const nsDecl: Record<string, string> = {};
  for (const [ns] of props) nsDecl[nsAlias(ns)] = ns;
  const decl = Object.entries(nsDecl)
    .map(([k, v]) => `xmlns:${k}="${v}"`)
    .join(" ");
  const items = props.map(([ns, local]) => `<${nsAlias(ns)}:${local}/>`).join("");
  return `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="${NS.d}" ${decl}>
  <d:prop>${items}</d:prop>
</d:propfind>`;
};

function nsAlias(ns: string): string {
  if (ns === NS.d) return "d";
  if (ns === NS.card) return "c";
  if (ns === NS.cs) return "cs";
  return "x";
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
