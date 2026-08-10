import { z } from "zod";

import { requestStatuses } from "@/lib/domain/requests";

const uuid = z.uuid();
const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  uuid.optional(),
);
const optionalText = (maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(maximum).optional(),
  );

export const requestListQuerySchema = z.object({
  status: z.enum(requestStatuses).optional(),
  departmentId: optionalUuid,
  assignedMemberId: optionalUuid,
  serviceId: optionalUuid,
  search: optionalText(100).refine(
    (value) =>
      value === undefined || (value.length >= 2 && !/[(),:%_*]/.test(value)),
    "Search must contain at least 2 characters and no filter control characters.",
  ),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const requestIdSchema = uuid;

export const assignmentSchema = z
  .object({
    departmentId: uuid.nullable(),
    memberId: uuid.nullable(),
    reason: optionalText(500).nullable(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .refine((value) => value.departmentId !== null || value.memberId !== null, {
    message: "A department or employee is required.",
  });

export const statusTransitionSchema = z.object({
  newStatus: z.enum(requestStatuses),
  reason: optionalText(500).nullable(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const internalNoteSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const requestInformationSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export type RequestListQuery = z.infer<typeof requestListQuerySchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;
export type InternalNoteInput = z.infer<typeof internalNoteSchema>;
export type RequestInformationInput = z.infer<typeof requestInformationSchema>;
