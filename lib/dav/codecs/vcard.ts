import { parseProps, getProp, getProps } from "./vobject";

export type VCardSummary = {
  uid?: string;
  fn?: string;
  email?: string;
  tel?: string;
};

export function summarizeVcf(vcf: string): VCardSummary {
  const props = parseProps(vcf);
  const emails = getProps(props, "EMAIL");
  const tels = getProps(props, "TEL");
  return {
    uid: getProp(props, "UID"),
    fn: getProp(props, "FN"),
    email: emails[0],
    tel: tels[0],
  };
}
