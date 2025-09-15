import { z } from "zod";

export function mergeObjects<
  A extends z.ZodRawShape,
  B extends z.ZodRawShape
>(a: z.ZodObject<A>, b: z.ZodObject<B>) {
  return z.object({ ...a.shape, ...b.shape }) as z.ZodObject<A & B>;
}
