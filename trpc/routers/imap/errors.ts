export function isAuthError(err: any): boolean {
  const msg = (err?.message || "").toLowerCase();
  // Common IMAP auth failure patterns
  return (
    msg.includes("authentication") ||
    msg.includes("invalid credentials") ||
    msg.includes("login failed") ||
    msg.includes("auth") && msg.includes("fail")
  );
}
