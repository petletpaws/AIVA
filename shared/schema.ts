import { z } from "zod";

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
    Expiry: z.number().optional(),
  }),
  Refresh_Token: z.object({
    token: z.string(),
    Created: z.string().optional(),
    Expiry: z.number().optional(),
  }).optional(),
});

export type OpertoAuthResponse = z.infer<typeof opertoAuthResponseSchema>;
