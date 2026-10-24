import { z } from "zod";
import { zClockTime, zIsoDate, zOptionalId, zOptionalText } from "@/lib/validation";

export const EVENT_TYPES = ["MEETING", "PERSONAL", "DEADLINE"] as const;
export const CALENDAR_VIEWS = ["month", "week", "day"] as const;

export const eventInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, "Give the event a title.").max(200, "Use 200 characters or fewer."),
    type: z.enum(EVENT_TYPES),
    allDay: z.boolean(),
    date: zIsoDate,
    clientId: zOptionalId,
    startTime: zClockTime,
    endTime: zClockTime,
    location: zOptionalText(200),
    notes: zOptionalText(2000),
  })
  .refine((v) => v.allDay || v.startTime !== null, { path: ["startTime"], message: "Set a start time, or mark it all day." })
  .refine((v) => v.allDay || !v.startTime || !v.endTime || v.endTime > v.startTime, {
    path: ["endTime"],
    message: "The end time must be after the start time.",
  });

export type EventInput = z.output<typeof eventInputSchema>;
export type EventFormValues = z.input<typeof eventInputSchema>;

export const calendarQuerySchema = z.object({
  view: z.enum(CALENDAR_VIEWS).catch("month"),
  date: zIsoDate.optional().catch(undefined),
  event: z.string().max(60).optional().catch(undefined),
});
