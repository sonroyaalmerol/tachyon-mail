import { initTRPC, TRPCError } from '@trpc/server';
import { getServerSession } from 'next-auth';
import { cache } from 'react';
import superjson from 'superjson';
import { headers, cookies } from "next/headers";
import { authOptions } from '@/lib/auth/next-auth';
import { NextRequest } from 'next/server';
export const createTRPCContext = cache(async (opts?: { req?: NextRequest }) => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  const session = await getServerSession(authOptions)
  return {
    session,
    headers: opts?.req ? Object.fromEntries(opts.req.headers) : headers(),
    cookies: cookies(), // read-only in server components
  };
});

type Context = Awaited<ReturnType<typeof createTRPCContext>>;
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});
