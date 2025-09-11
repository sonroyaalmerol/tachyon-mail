import { parseProps, getProp } from "./vobject";

export type ICalSummary = {
  uid?: string;
  summary?: string;
  dtstart?: string;
  dtend?: string;
};

export function summarizeIcs(ics: string): ICalSummary {
  const props = parseProps(ics);
  return {
    uid: getProp(props, "UID"),
    summary: getProp(props, "SUMMARY"),
    dtstart: getProp(props, "DTSTART"),
    dtend: getProp(props, "DTEND"),
  };
}
