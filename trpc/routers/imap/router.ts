import { z } from "zod";
import { ImapFlow } from "imapflow";
import { authedProcedure, baseProcedure, createTRPCRouter } from "../../init";
import {
  appendInputSchema,
  connectionInput,
  deleteSchema,
  fetchOptionsSchema,
  fetchRangeSchema,
  flagUpdateSchema,
  mailboxCreateSchema,
  mailboxDeleteSchema,
  mailboxOpenSchema,
  mailboxPathSchema,
  mailboxRenameSchema,
  moveCopySchema,
  searchQuerySchema,
} from "./schemas";
import { withClient } from "./client";
import { mergeObjects } from "./zod-utils";
import { getImapConfigForUser } from "@/lib/mail/imapAccounts";

function parseHeaders(buf?: Buffer): Record<string, string> | undefined {
  if (!buf) return undefined;
  const text = buf.toString("utf8");
  const lines = text.replace(/\r\n[ \t]+/g, " ").split(/\r?\n/);
  const out: Record<string, string> = {};
  for (const line of lines) {
    const i = line.indexOf(":");
    if (i > 0) {
      const k = line.slice(0, i).toLowerCase();
      const v = line.slice(i + 1).trim();
      if (out[k]) out[k] = `${out[k]}, ${v}`;
      else out[k] = v;
    }
  }
  return out;
}

const withResolved = async (userId: string, accountId?: string) => {
  const cfg = await getImapConfigForUser(userId, accountId);
  // normalize to ResolvedConnection format expected by withClient
  const auth =
    (cfg.auth as any).type === "xoauth2"
      ? { user: (cfg.auth as any).user, accessToken: (cfg.auth as any).accessToken }
      : { user: (cfg.auth as any).user, pass: (cfg.auth as any).pass };
  return { ...cfg, auth };
};

export const imapRouter = createTRPCRouter({
  connect: authedProcedure
    .input(connectionInput)
    .mutation(async ({ ctx, input }) => {
      // const conn = await withResolved(ctx.session!.user?.name, input.auth.user);
      return withClient(input, async (client) => {
        return {
          connected: true,
          host: input.host,
          capabilities: client.capabilities
            ? Array.from(Object.keys(client.capabilities))
            : [],
          mailbox: client.mailbox || null,
          authenticatedUser: input.auth.user,
        };
      })
    }
    ),

  status: baseProcedure
    .input(connectionInput)
    .query(async ({ input }) =>
      withClient(input, async (client) => {
        try {
          await client.noop();
          return { ok: true, user: input.auth.user };
        } catch {
          return { ok: false, user: input.auth.user };
        }
      })
    ),

  listMailboxes: baseProcedure
    .input(connectionInput)
    .query(async ({ input }) =>
      withClient(input, async (client) => {
        const listed = await client.list(); // -> ListResponse[]
        const boxes = listed.map((box) => ({
          path: box.path,
          name: box.name,
          subscribed: box.subscribed ?? false,
          flags: box.flags ? Array.from(box.flags) : [],
          delim: box.delimiter ?? "/",
          specialUse: box.specialUse || null,
        }));
        return boxes;
      })
    ),

  createMailbox: baseProcedure
    .input(mergeObjects(connectionInput, mailboxCreateSchema))
    .mutation(async ({ input }) =>
      withClient(input, async (client) => {
        const created = await client.mailboxCreate(input.mailbox);
        if (input.subscribe) {
          try {
            await client.mailboxSubscribe(input.mailbox);
          } catch {
            // ignore subscribe failures (not all servers support it)
          }
        }
        return { created: !!created, mailbox: input.mailbox };
      })
    ),

  renameMailbox: baseProcedure
    .input(mergeObjects(connectionInput, mailboxRenameSchema))
    .mutation(async ({ input }) =>
      withClient(input, async (client) => {
        await client.mailboxRename(input.from, input.to);
        return { renamed: true, from: input.from, to: input.to };
      })
    ),

  deleteMailbox: baseProcedure
    .input(mergeObjects(connectionInput, mailboxDeleteSchema))
    .mutation(async ({ input }) =>
      withClient(input, async (client) => {
        await client.mailboxDelete(input.mailbox);
        return { deleted: true, mailbox: input.mailbox };
      })
    ),

  openMailbox: baseProcedure
    .input(mergeObjects(connectionInput, mailboxOpenSchema))
    .mutation(async ({ input }) =>
      withClient(input, async (client) => {
        const lock = await client.getMailboxLock(input.mailbox);
        try {
          const mb = client.mailbox ? client.mailbox : null;
          return {
            mailbox: input.mailbox,
            readOnly: input.readOnly,
            exists: mb?.exists ?? 0,
            flags: mb?.flags ? Array.from(mb.flags) : [],
            permanentFlags: mb?.permanentFlags ? Array.from(mb.permanentFlags) : [],
            uidValidity: mb?.uidValidity ?? null,
            uidNext: mb?.uidNext ?? null,
          };
        } finally {
          lock.release();
        }
      })
    ),

  search: baseProcedure
    .input(
      mergeObjects(connectionInput,
        z.object({
          mailbox: mailboxPathSchema,
          query: searchQuerySchema,
          bySeq: z.boolean().default(false),
          limit: z.number().int().positive().max(10000).default(500),
        })
      )
    )
    .query(async ({ input }) =>
      withClient(input, async (client) => {
        const lock = await client.getMailboxLock(input.mailbox);
        try {
          const criteria =
            input.query.raw ??
            ((): any[] => {
              const c: any[] = [];
              if (input.query.seen !== undefined)
                c.push(input.query.seen ? "SEEN" : "UNSEEN");
              if (input.query.answered !== undefined)
                c.push(input.query.answered ? "ANSWERED" : "UNANSWERED");
              if (input.query.flagged !== undefined)
                c.push(input.query.flagged ? "FLAGGED" : "UNFLAGGED");
              if (input.query.draft !== undefined)
                c.push(input.query.draft ? "DRAFT" : "UNDRAFT");
              if (input.query.deleted !== undefined)
                c.push(input.query.deleted ? "DELETED" : "UNDELETED");
              if (input.query.subject) c.push(["SUBJECT", input.query.subject]);
              if (input.query.from) c.push(["FROM", input.query.from]);
              if (input.query.to) c.push(["TO", input.query.to]);
              if (input.query.since)
                c.push(["SINCE", input.query.since.toUTCString()]);
              if (input.query.before)
                c.push(["BEFORE", input.query.before.toUTCString()]);
              if (c.length === 0) c.push("ALL");
              return c;
            })();

          const result = await client.search(
            { seen: undefined },
            {
              uid: !input.bySeq,
              source: criteria,
              limit: input.limit,
            } as any
          );

          return {
            mailbox: input.mailbox,
            count: result ? result.length : 0,
            ids: result,
            bySeq: input.bySeq,
          };
        } finally {
          lock.release();
        }
      })
    ),

  fetch: baseProcedure
    .input(
      mergeObjects(connectionInput,
        z.object({
          mailbox: mailboxPathSchema,
          range: fetchRangeSchema,
          options: fetchOptionsSchema.optional(),
        })
      )
    )
    .query(async ({ input }) =>
      withClient(input, async (client) => {
        const { range, options } = input;

        let source: any = "*";
        let byUid = true;
        if (range.uids && range.uids.length > 0) {
          source = range.uids;
          byUid = true;
        } else if (range.seq) {
          source = range.seq;
          byUid = false;
        }

        const fetchQuery: Parameters<ImapFlow["fetch"]>[1] = {
          uid: byUid,
          envelope: options?.envelope ?? true,
          bodyStructure: options?.bodyStructure ?? false,
          flags: options?.flags ?? true,
          internalDate: options?.internalDate ?? true,
          headers: options?.headers?.fields
            ? options.headers.fields
            : options?.headers
              ? true
              : false,
          bodyParts: undefined,
        };

        const items: any[] = [];
        let count = 0;

        for await (const msg of client.fetch(source, fetchQuery)) {
          const base = {
            uid: msg.uid,
            seq: msg.seq,
            envelope: msg.envelope,
            flags: Array.isArray(msg.flags) ? Array.from(msg.flags) : Array.from(msg.flags ?? []),
            internalDate: msg.internalDate,
            size: msg.size,
            bodyStructure: msg.bodyStructure,
          };

          const headers =
            options?.headers ? parseHeaders(msg.headers as unknown as Buffer | undefined) : undefined;

          let body: string | Buffer | undefined;
          if (options?.bodyPart) {
            const { content } = await client.download(msg.uid, options.bodyPart, { uid: true });
            const chunks: Buffer[] = [];
            for await (const chunk of content) chunks.push(Buffer.from(chunk));
            const buf = Buffer.concat(chunks);
            body = options.bodyAsText ?? true ? buf.toString("utf8") : buf;
          }

          items.push({ ...base, headers, body: options?.bodyPart ? body : undefined });
          if (++count >= (range.limit ?? 100)) break;
        }

        return { mailbox: input.mailbox, count: items.length, items };
      })
    ),

  append: baseProcedure
    .input(mergeObjects(connectionInput, appendInputSchema))
    .mutation(async ({ input }) =>
      withClient(input, async (client) => {
        const res = await client.append(input.mailbox, input.raw, input.flags, input.date);
        return {
          ok: true,
          mailbox: input.mailbox,
          uid: res ? res.uid : null,
          uidValidity: res ? res.uidValidity : null,
        };
      })
    ),

  updateFlags: baseProcedure
    .input(mergeObjects(connectionInput, flagUpdateSchema))
    .mutation(async ({ input }) =>
      withClient(input, async (client) => {
        const lock = await client.getMailboxLock(input.mailbox);
        try {
          const method =
            input.mode === "add"
              ? client.messageFlagsAdd
              : input.mode === "remove"
                ? client.messageFlagsRemove
                : client.messageFlagsSet;

          const res = await method.call(client, input.uids, input.flags, {
            uid: true,
          });

          return { ok: true, modified: res ? 1 : 0 };
        } finally {
          lock.release();
        }
      })
    ),

  moveOrCopy: baseProcedure
    .input(mergeObjects(connectionInput, moveCopySchema))
    .mutation(async ({ input }) =>
      withClient(input, async (client) => {
        const lock = await client.getMailboxLock(input.fromMailbox);
        try {
          if (input.copy) {
            const res = await client.messageCopy(
              input.uids,
              input.toMailbox,
              { uid: true }
            );
            return { ok: true, type: "copy", result: res };
          } else {
            const res = await client.messageMove(
              input.uids,
              input.toMailbox,
              { uid: true }
            );
            return { ok: true, type: "move", result: res };
          }
        } finally {
          lock.release();
        }
      })
    ),

  deleteMessages: baseProcedure
    .input(mergeObjects(connectionInput, deleteSchema))
    .mutation(async ({ input }) =>
      withClient(input, async (client) => {
        const lock = await client.getMailboxLock(input.mailbox);
        try {
          const res = await client.messageFlagsAdd(input.uids, ["\\Deleted"], {
            uid: true,
          });
          return { ok: true, expunged: res || 0 };
        } finally {
          lock.release();
        }
      })
    ),

  downloadRaw: baseProcedure
    .input(
      mergeObjects(connectionInput,
        z.object({
          mailbox: mailboxPathSchema,
          uid: z.number().int().positive(),
        })
      )
    )
    .query(async ({ input }) =>
      withClient(input, async (client) => {
        const lock = await client.getMailboxLock(input.mailbox);
        try {
          const { content } = await client.download(input.uid);
          const chunks: Buffer[] = [];
          for await (const chunk of content) {
            chunks.push(Buffer.from(chunk));
          }
          const raw = Buffer.concat(chunks).toString("utf8");
          return { uid: input.uid, raw };
        } finally {
          lock.release();
        }
      })
    ),
});
