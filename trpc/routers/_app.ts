import { createTRPCRouter } from "../init";
import { imapRouter } from "./imap";

export const appRouter = createTRPCRouter({
  imap: imapRouter,
});

export type AppRouter = typeof appRouter;
