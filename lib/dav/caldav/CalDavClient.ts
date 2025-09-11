import { WebDavClient, parseMultiStatus, q, q1, textOf, absoluteUrl, DAV_NS as NS } from "../core/WebDavClient";
import { CalEventInfo, DavCollection, DavObjectRef, SyncChange } from "../types";

export class CalDavClient {
  constructor(private dav: WebDavClient) { }

  // Discover principal, calendars home, and list calendars
  async listCalendars(rootHref = "/"): Promise<DavCollection[]> {
    // Step 1: find current-user-principal
    const res1 = await this.dav.propfind(rootHref, "0", propfindXml([
      [NS.d, "current-user-principal"],
    ]));
    const doc1 = await parseMultiStatus(res1);
    const principal = textOf(q1(doc1, `${NS.d} current-user-principal`) || q1(doc1, `${NS.d} href`)) ||
      textOf(q(doc1, `${NS.d} href`)[0]);
    const principalHref = principal || "/";

    // Step 2: calendars home set
    const res2 = await this.dav.propfind(principalHref, "0", propfindXml([
      [NS.cal, "calendar-home-set"],
    ]));
    const doc2 = await parseMultiStatus(res2);
    const home = textOf(q1(doc2, `${NS.cal} calendar-home-set`)?.querySelector("*")) || "/";

    // Step 3: list collections under home with calendar properties
    const res3 = await this.dav.propfind(home, "1", propfindXml([
      [NS.d, "displayname"],
      [NS.cal, "calendar-description"],
      [NS.cal, "supported-calendar-component-set"],
      [NS.d, "resourcetype"],
      [NS.d, "sync-token"],
      [NS.cs, "getctag"],
      [NS.cs, "calendar-color"],
    ]));
    const doc3 = await parseMultiStatus(res3);

    const responses = Array.from(doc3.getElementsByTagNameNS(NS.d, "response"));
    const out: DavCollection[] = [];
    for (const r of responses) {
      const href = textOf(q1(r, `${NS.d} href`));
      if (!href) continue;
      const resourcetype = q1(r, `${NS.d} propstat`)?.querySelector("*[local-name()='resourcetype']");
      const isCalendar = !!resourcetype?.querySelector(`*[local-name()='calendar']`);
      if (!isCalendar) continue;
      out.push({
        href,
        displayName: textOf(q1(r, `${NS.d} displayname`)),
        description: textOf(q1(r, `${NS.cal} calendar-description`)),
        syncToken: textOf(q1(r, `${NS.d} sync-token`)),
        ctag: textOf(q1(r, `${NS.cs} getctag`)),
        color: textOf(q1(r, `${NS.cs} calendar-color`)),
      });
    }
    return out;
  }

  // Sync calendar collection using sync-token (preferred)
  async syncCollection(
    calendarHref: string,
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

    const res = await this.dav.report(calendarHref, "1", body);
    const doc = await parseMultiStatus(res);

    const changes: SyncChange[] = [];
    for (const resp of Array.from(doc.getElementsByTagNameNS(NS.d, "response"))) {
      const href = textOf(q1(resp, `${NS.d} href`));
      const status = textOf(q1(resp, `${NS.d} status`));
      const etag = textOf(q1(resp, `${NS.d} getetag`));
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

  // List objects quickly with ETags (no payloads)
  async listObjects(calendarHref: string): Promise<DavObjectRef[]> {
    const xml = propfindXml([[NS.d, "getetag"]]);
    const res = await this.dav.propfind(calendarHref, "1", xml);
    const doc = await parseMultiStatus(res);

    const out: DavObjectRef[] = [];
    for (const resp of Array.from(doc.getElementsByTagNameNS(NS.d, "response"))) {
      const href = textOf(q1(resp, `${NS.d} href`));
      const etag = textOf(q1(resp, `${NS.d} getetag`));
      if (!href) continue;
      // Skip the collection itself
      if (href.endsWith("/") && href === calendarHref) continue;
      out.push({ href, etag: etag?.replace(/^W\//, "") });
    }
    return out;
  }

  // Fetch specific VCALENDAR by href (text) with ETag
  async getEventRaw(href: string): Promise<{ ics: string; etag?: string }> {
    const res = await this.dav.request("GET", href);
    if (!res.ok) throw new Error(`GET ${href} failed: ${res.status}`);
    const etag = res.headers.get("ETag") || undefined;
    const ics = await res.text();
    return { ics, etag: etag?.replace(/^W\//, "") };
  }

  // Time-range query using calendar-query REPORT (summary info)
  async timeRangeQuery(
    calendarHref: string,
    startISO: string,
    endISO: string
  ): Promise<CalEventInfo[]> {
    const body = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="${NS.d}" xmlns:c="${NS.cal}">
  <d:prop>
    <d:getetag/>
    <c:calendar-data>
      <c:comp name="VCALENDAR">
        <c:comp name="VEVENT">
          <c:prop name="UID"/>
          <c:prop name="SUMMARY"/>
          <c:prop name="DTSTART"/>
          <c:prop name="DTEND"/>
        </c:comp>
      </c:comp>
    </c:calendar-data>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${startISO.replace(/[-:]/g, "")}Z" end="${endISO.replace(/[-:]/g, "")}Z"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
    const res = await this.dav.report(calendarHref, "1", body);
    const doc = await parseMultiStatus(res);

    const out: CalEventInfo[] = [];
    for (const resp of Array.from(doc.getElementsByTagNameNS(NS.d, "response"))) {
      const href = textOf(q1(resp, `${NS.d} href`));
      const etag = textOf(q1(resp, `${NS.d} getetag`))?.replace(/^W\//, "");
      const calData = q1(resp, `${NS.cal} calendar-data`);
      const ics = calData?.textContent || "";
      if (!href) continue;
      const info = extractSummaryFromICS(ics);
      out.push({
        href,
        etag,
        uid: info.uid,
        summary: info.summary,
        dtstart: info.dtstart,
        dtend: info.dtend,
      });
    }
    return out;
  }

  // Create or update event (If-Match for safe updates)
  async putEvent(
    calendarHref: string,
    filenameIcs: string, // e.g. "12345.ics"
    ics: string,
    opts?: { etag?: string } // If updating, pass current ETag
  ): Promise<{ etag?: string }> {
    const href = absoluteUrl(calendarHref, filenameIcs);
    const headers: Record<string, string> = {
      "Content-Type": "text/calendar; charset=utf-8",
    };
    if (opts?.etag) headers["If-Match"] = opts.etag;
    else headers["If-None-Match"] = "*"; // prevent overwrite if create
    const res = await this.dav.put(href, ics, headers);
    if (!(res.status === 201 || res.status === 204)) {
      throw new Error(`PUT event failed: ${res.status}`);
    }
    return { etag: res.headers.get("ETag") || undefined };
  }

  async deleteEvent(href: string, opts?: { etag?: string }): Promise<void> {
    const headers: Record<string, string> = {};
    if (opts?.etag) headers["If-Match"] = opts.etag;
    const res = await this.dav.delete(href, headers);
    if (!(res.status === 200 || res.status === 204)) {
      throw new Error(`DELETE ${href} failed: ${res.status}`);
    }
  }
}

// ---- helpers ----

function propfindXml(props: Array<[string, string]>): string {
  // props as [ns, local]
  const nsDecl: Record<string, string> = {};
  for (const [ns] of props) {
    const key = nsAlias(ns);
    nsDecl[key] = ns;
  }
  const decl = Object.entries(nsDecl)
    .map(([k, v]) => `xmlns:${k}="${v}"`)
    .join(" ");
  const items = props
    .map(([ns, local]) => `<${nsAlias(ns)}:${local}/>`)
    .join("");
  return `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="${NS.d}" ${decl}>
  <d:prop>${items}</d:prop>
</d:propfind>`;
}

function nsAlias(ns: string): string {
  if (ns === NS.d) return "d";
  if (ns === NS.cal) return "c";
  if (ns === NS.cs) return "cs";
  return "x";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function extractSummaryFromICS(ics: string): {
  uid?: string; summary?: string; dtstart?: string; dtend?: string;
} {
  const lines = ics.split(/\r?\n/);
  const out: any = {};
  for (const line of lines) {
    if (line.startsWith("UID:")) out.uid = line.slice(4).trim();
    else if (line.startsWith("SUMMARY:")) out.summary = line.slice(8).trim();
    else if (line.startsWith("DTSTART")) out.dtstart = line.split(":")[1]?.trim();
    else if (line.startsWith("DTEND")) out.dtend = line.split(":")[1]?.trim();
  }
  return out;
}
