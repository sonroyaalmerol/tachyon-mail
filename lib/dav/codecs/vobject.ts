// Generic VObject helpers for vCard/vCalendar: folding/unfolding and props

export function unfoldLines(text: string): string[] {
  // Unfold per RFC: lines that begin with space or tab are continuations
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

export function parseProps(
  text: string
): Array<{ name: string; params: Record<string, string>; value: string }> {
  const lines = unfoldLines(text);
  const props: Array<{ name: string; params: Record<string, string>; value: string }> = [];
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...paramParts] = left.split(";");
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf("=");
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
      else params[p.toUpperCase()] = "";
    }
    props.push({ name: name.toUpperCase(), params, value });
  }
  return props;
}

export function getProp(
  props: Array<{ name: string; params: Record<string, string>; value: string }>,
  name: string
): string | undefined {
  const p = props.find((p) => p.name === name.toUpperCase());
  return p?.value;
}

export function getProps(
  props: Array<{ name: string; params: Record<string, string>; value: string }>,
  name: string
): string[] {
  return props.filter((p) => p.name === name.toUpperCase()).map((p) => p.value);
}
