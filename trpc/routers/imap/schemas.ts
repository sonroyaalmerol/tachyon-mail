import { z } from "zod";

export const mailboxPathSchema = z.string().min(1);

export const connectionInput = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean().default(true),
  auth: z.object({
    user: z.string().min(1),
    pass: z.string().min(1),
  }),
  clientInfo: z
    .object({
      name: z.string().optional(),
      version: z.string().optional(),
    })
    .optional(),
  logger: z.boolean().optional(),
});

export const mailboxCreateSchema = z.object({
  mailbox: mailboxPathSchema,
  subscribe: z.boolean().optional(),
});

export const mailboxRenameSchema = z.object({
  from: mailboxPathSchema,
  to: mailboxPathSchema,
});

export const mailboxDeleteSchema = z.object({
  mailbox: mailboxPathSchema,
});

export const mailboxOpenSchema = z.object({
  mailbox: mailboxPathSchema,
  readOnly: z.boolean().default(true),
});

export const searchQuerySchema = z.object({
  seen: z.boolean().optional(),
  flagged: z.boolean().optional(),
  answered: z.boolean().optional(),
  draft: z.boolean().optional(),
  deleted: z.boolean().optional(),
  subject: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  since: z.date().optional(),
  before: z.date().optional(),
  raw: z.array(z.any()).optional(),
});

export const fetchRangeSchema = z.object({
  uids: z.array(z.number().int().positive()).optional(),
  seq: z.string().optional(),
  limit: z.number().int().positive().max(5000).default(100),
});

export const fetchOptionsSchema = z.object({
  envelope: z.boolean().default(true),
  bodyStructure: z.boolean().default(false),
  flags: z.boolean().default(true),
  internalDate: z.boolean().default(true),
  headers: z
    .object({
      fields: z.array(z.string()).optional(),
    })
    .optional(),
  bodyPart: z.string().optional(),
  bodyAsText: z.boolean().default(true),
});

export const appendInputSchema = z.object({
  mailbox: mailboxPathSchema,
  raw: z.string().min(1),
  flags: z.array(z.string()).optional(),
  date: z.date().optional(),
});

export const flagUpdateSchema = z.object({
  mailbox: mailboxPathSchema,
  uids: z.array(z.number().int().positive()).min(1),
  flags: z.array(z.string()).min(1),
  mode: z.enum(["add", "remove", "set"]).default("add"),
});

export const moveCopySchema = z.object({
  fromMailbox: mailboxPathSchema,
  toMailbox: mailboxPathSchema,
  uids: z.array(z.number().int().positive()).min(1),
  copy: z.boolean().default(false),
});

export const deleteSchema = z.object({
  mailbox: mailboxPathSchema,
  uids: z.array(z.number().int().positive()).min(1),
});
