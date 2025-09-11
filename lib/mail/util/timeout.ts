export async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label = "timeout"
): Promise<T> {
  let to: any;
  const t = new Promise<T>((_, reject) => {
    to = setTimeout(() => reject(new Error(label)), ms);
  });
  try {
    return await Promise.race([p, t]);
  } finally {
    clearTimeout(to);
  }
}
