import { z } from "zod";
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const opertoSettingsSchema = z.object({
  apiKey: z.string().min(1, "API Key is required"),
  apiValue: z.string().min(1, "API Value is required"),
  completed: z.string().optional(),
  taskStartDate: z.string().optional(),
  taskEndDate: z.string().optional(),
  perPage: z.number().int().positive().optional(),
});

export type OpertoSettings = z.infer<typeof opertoSettingsSchema>;

export const opertoStaffSchema = z.object({
  StaffID: z.number(),
  Name: z.string(),
  Email: z.string().optional(),
});

export type OpertoStaff = z.infer<typeof opertoStaffSchema>;

export const opertoPropertySchema = z.object({
  PropertyID: z.number().optional(),
  PropertyAbbreviation: z.string().optional(),
  PropertyName: z.string().optional(),
});

export type OpertoProperty = z.infer<typeof opertoPropertySchema>;

export const opertoTaskSchema = z.object({
  TaskID: z.number(),
  TaskName: z.string(),
  TaskDescription: z.string().nullable(),
  CompleteConfirmedDate: z.string().nullable(),
  Property: opertoPropertySchema.optional(),
  Staff: z.array(opertoStaffSchema).optional(),
  Amount: z.number().nullable().optional(),
});

export type OpertoTask = z.infer<typeof opertoTaskSchema>;

export const opertoTasksResponseSchema = z.object({
  data: z.array(opertoTaskSchema),
  has_more: z.boolean(),
  next_page: z.number().optional(),
});

export type OpertoTasksResponse = z.infer<typeof opertoTasksResponseSchema>;

export const opertoAuthResponseSchema = z.object({
  Access_Token: z.object({
    token: z.string(),
    Created: z.string().optional(),
    Expiry: z.coerce.number().optional(),
  }),
  Refresh_Token: z.object({
    token: z.string(),
    Created: z.string().optional(),
    Expiry: z.coerce.number().optional(),
  }).optional(),
});

export type OpertoAuthResponse = z.infer<typeof opertoAuthResponseSchema>;

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  apiKey: text("api_key").notNull(),
  apiValue: text("api_value").notNull(),
  completed: text("completed"),
  taskStartDate: text("task_start_date"),
  taskEndDate: text("task_end_date"),
  perPage: integer("per_page"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type SelectSettings = typeof settings.$inferSelect;

export const tokens = pgTable("tokens", {
  id: integer("id").primaryKey().default(1),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTokensSchema = createInsertSchema(tokens).omit({ id: true, updatedAt: true });
export type InsertTokens = z.infer<typeof insertTokensSchema>;
export type SelectTokens = typeof tokens.$inferSelect;

export const invoiceSchema = z.object({
  id: z.string(),
  staffName: z.string(),
  staffEmail: z.string().optional(),
  tasks: z.array(opertoTaskSchema),
  totalAmount: z.number(),
  createdAt: z.string(),
});

export type Invoice = z.infer<typeof invoiceSchema>;

export const sendInvoiceRequestSchema = z.object({
  recipientEmail: z.string().email("Valid email required"),
  staffName: z.string(),
  tasks: z.array(opertoTaskSchema),
  totalAmount: z.number(),
});

export type SendInvoiceRequest = z.infer<typeof sendInvoiceRequestSchema>;

export const extractedInvoiceDataSchema = z.object({
  staffName: z.string().nullable(),
  totalAmount: z.number().nullable(),
  date: z.string().nullable(),
  propertyName: z.string().nullable(),
  lineItems: z.array(z.object({
    description: z.string(),
    amount: z.number().nullable(),
  })).optional(),
  rawText: z.string().optional(),
  rawTextFull: z.string().optional(),
  allExtractedData: z.object({
    dates: z.array(z.object({
      dateStr: z.string(),
      isoDate: z.string(),
      confidence: z.number(),
    })).optional(),
    amounts: z.array(z.object({
      amount: z.number(),
      original: z.string(),
      confidence: z.number(),
    })).optional(),
    names: z.array(z.object({
      name: z.string(),
      type: z.enum(['staff', 'property', 'unknown']),
      confidence: z.number(),
    })).optional(),
    phoneNumbers: z.array(z.object({
      number: z.string(),
      confidence: z.number(),
    })).optional(),
    emails: z.array(z.object({
      email: z.string(),
      confidence: z.number(),
    })).optional(),
    addresses: z.array(z.object({
      address: z.string(),
      confidence: z.number(),
    })).optional(),
    fieldsSummary: z.record(z.unknown()).optional(),
  }).optional(),
});

export type ExtractedInvoiceData = z.infer<typeof extractedInvoiceDataSchema>;

export type MatchStatus = 'full_match' | 'partial_match' | 'no_match' | 'pending';

export const uploadedFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  uploadedAt: z.string(),
  extractedData: extractedInvoiceDataSchema.nullable(),
  matchStatus: z.enum(['full_match', 'partial_match', 'no_match', 'pending']),
  matchedStaffName: z.string().nullable(),
  matchDetails: z.string().nullable(),
});

export type UploadedFile = z.infer<typeof uploadedFileSchema>;
