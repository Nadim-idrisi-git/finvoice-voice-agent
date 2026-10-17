import { z } from "zod";
const messageSchema = z.object({ message: z.string().trim().min(1).max(1200) });
const actionSchema = z.object({ type: z.enum(["reminder", "spending_alert", "report", "subscription_workflow"]), title: z.string().trim().min(3).max(100), details: z.string().trim().min(3).max(500) });
const confirmationSchema = z.object({ confirmation: z.literal(true) });
export {
  actionSchema,
  confirmationSchema,
  messageSchema
};
