import { z } from "zod";

const boundedText = z.string().trim().min(1).max(2000);
const nullableOptional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === null ? undefined : value),
    schema.optional(),
  );
const draftFieldNames = [
  "intent",
  "serviceId",
  "customerName",
  "phone",
  "email",
  "description",
  "location",
  "preferredStartDate",
  "budgetMin",
  "budgetMax",
] as const;
const fieldSourceSchema = z.enum(["customer_message", "explicit_correction"]);

export const searchCompanyInformationSchema = z
  .object({
    question: boundedText,
    serviceCode: nullableOptional(z.string().max(100)),
  })
  .strict();
export const saveConversationFieldsSchema = z
  .object({
    expectedDraftVersion: z.number().int().positive(),
    fields: z
      .object({
        intent: nullableOptional(
          z.enum([
            "request_quotation",
            "request_site_visit",
            "ask_about_services",
            "check_request_status",
            "report_problem",
            "speak_to_employee",
          ]),
        ),
        serviceId: nullableOptional(z.uuid()),
        customerName: nullableOptional(z.string().trim().min(2).max(160)),
        phone: nullableOptional(z.string().trim().min(9).max(20)),
        email: nullableOptional(z.email()),
        description: nullableOptional(z.string().trim().min(10).max(2000)),
        location: nullableOptional(z.string().trim().min(2).max(500)),
        preferredStartDate: nullableOptional(z.iso.date()),
        budgetMin: nullableOptional(
          z.number().nonnegative().max(1_000_000_000),
        ),
        budgetMax: nullableOptional(
          z.number().nonnegative().max(1_000_000_000),
        ),
      })
      .strict(),
    fieldSources: z
      .object(
        Object.fromEntries(
          draftFieldNames.map((field) => [
            field,
            nullableOptional(fieldSourceSchema),
          ]),
        ) as Record<
          (typeof draftFieldNames)[number],
          ReturnType<typeof nullableOptional<typeof fieldSourceSchema>>
        >,
      )
      .strict(),
  })
  .strict();
export const createCustomerRequestSchema = z
  .object({ confirmation: z.literal(true), idempotencyKey: z.uuid() })
  .strict();
export const getRequestStatusSchema = z
  .object({
    referenceNumber: z.string().regex(/^[A-Z0-9]{2,10}-\d{4}-\d{6}$/),
    verificationToken: z.string().min(20).max(500),
  })
  .strict();
export const requestHumanSupportSchema = z
  .object({
    requestId: nullableOptional(z.uuid()),
    reason: z.string().trim().min(3).max(500),
    priority: z.enum(["normal", "high", "urgent"]),
  })
  .strict();
export const attachFileToConversationSchema = z
  .object({ attachmentId: z.uuid() })
  .strict();

export const toolSchemas = {
  search_company_information: searchCompanyInformationSchema,
  save_conversation_fields: saveConversationFieldsSchema,
  create_customer_request: createCustomerRequestSchema,
  get_request_status: getRequestStatusSchema,
  request_human_support: requestHumanSupportSchema,
  attach_file_to_conversation: attachFileToConversationSchema,
} as const;

export type AgentToolName = keyof typeof toolSchemas;
