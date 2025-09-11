export type DavAuth =
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string }; // use XOAUTH2 access_token here

export type ClientConfig = {
  baseUrl: string; // principal or server root, e.g., https://dav.example.com/
  auth: DavAuth;
  userAgent?: string;
  // Timeouts in ms
  timeoutMs?: number;
};

export type DavCollection = {
  href: string; // absolute or server-relative path
  displayName?: string;
  description?: string;
  ctag?: string; // getctag (non-standard) or sync-token
  syncToken?: string; // CalDAV/CardDAV sync-token
  color?: string;
  supportsSharing?: boolean;
};

export type DavObjectRef = {
  href: string;
  etag?: string;
};

export type SyncChange = {
  href: string;
  status: "added" | "modified" | "deleted";
  etag?: string;
};

export type CalEventInfo = DavObjectRef & {
  uid?: string;
  summary?: string;
  dtstart?: string;
  dtend?: string;
};

export type VCardInfo = DavObjectRef & {
  uid?: string;
  fn?: string;
  email?: string;
  tel?: string;
};
