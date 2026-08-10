import type { AgentToolName } from "@/lib/agent/tool-schemas";

const tools: Record<AgentToolName, Record<string, unknown>> = {
  search_company_information: {
    type: "function",
    name: "search_company_information",
    description: "Search active approved company services and knowledge.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", minLength: 1, maxLength: 2000 },
        serviceCode: { type: ["string", "null"], maxLength: 100 },
      },
      required: ["question", "serviceCode"],
      additionalProperties: false,
    },
  },
  save_conversation_fields: {
    type: "function",
    name: "save_conversation_fields",
    description: "Propose validated fields from the current customer message.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        expectedDraftVersion: { type: "integer", minimum: 1 },
        fields: {
          type: "object",
          properties: {
            intent: {
              type: ["string", "null"],
              enum: [
                "request_quotation",
                "request_site_visit",
                "ask_about_services",
                "check_request_status",
                "report_problem",
                "speak_to_employee",
              ],
            },
            serviceId: { type: ["string", "null"], format: "uuid" },
            customerName: { type: ["string", "null"], maxLength: 160 },
            phone: { type: ["string", "null"], maxLength: 20 },
            email: { type: ["string", "null"], format: "email" },
            description: { type: ["string", "null"], maxLength: 2000 },
            location: { type: ["string", "null"], maxLength: 500 },
            preferredStartDate: {
              type: ["string", "null"],
              format: "date",
            },
            budgetMin: { type: ["number", "null"], minimum: 0 },
            budgetMax: { type: ["number", "null"], minimum: 0 },
          },
          required: [
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
          ],
          additionalProperties: false,
        },
        fieldSources: {
          type: "object",
          properties: Object.fromEntries(
            [
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
            ].map((field) => [
              field,
              {
                type: ["string", "null"],
                enum: ["customer_message", "explicit_correction", null],
              },
            ]),
          ),
          required: [
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
          ],
          additionalProperties: false,
        },
      },
      required: ["expectedDraftVersion", "fields", "fieldSources"],
      additionalProperties: false,
    },
  },
  create_customer_request: {
    type: "function",
    name: "create_customer_request",
    strict: true,
    description:
      "Create a request only after explicit server-confirmed summary confirmation.",
    parameters: {
      type: "object",
      properties: {
        confirmation: { const: true },
        idempotencyKey: { type: "string", format: "uuid" },
      },
      required: ["confirmation", "idempotencyKey"],
      additionalProperties: false,
    },
  },
  get_request_status: {
    type: "function",
    name: "get_request_status",
    strict: true,
    description: "Get customer-safe status after server verification.",
    parameters: {
      type: "object",
      properties: {
        referenceNumber: { type: "string" },
        verificationToken: { type: "string" },
      },
      required: ["referenceNumber", "verificationToken"],
      additionalProperties: false,
    },
  },
  request_human_support: {
    type: "function",
    name: "request_human_support",
    strict: true,
    description:
      "Request human support when the server capability is available.",
    parameters: {
      type: "object",
      properties: {
        requestId: { type: ["string", "null"], format: "uuid" },
        reason: { type: "string", maxLength: 500 },
        priority: { type: "string", enum: ["normal", "high", "urgent"] },
      },
      required: ["requestId", "reason", "priority"],
      additionalProperties: false,
    },
  },
  attach_file_to_conversation: {
    type: "function",
    name: "attach_file_to_conversation",
    strict: true,
    description:
      "Associate an already validated private upload when available.",
    parameters: {
      type: "object",
      properties: { attachmentId: { type: "string", format: "uuid" } },
      required: ["attachmentId"],
      additionalProperties: false,
    },
  },
};

export const agentToolNames = Object.freeze(
  Object.keys(tools) as AgentToolName[],
);
export const agentTools = agentToolNames.map((name) => tools[name]);
export const executableAgentTools = [
  tools.search_company_information,
  tools.save_conversation_fields,
];
