import { z } from "zod";

export const signingSchema = z.object({
  termsAccepted: z
    .boolean()
    .refine(
      (v) => v === true,
      "You must confirm that you have read the terms and conditions.",
    ),
});

export type SigningFormInput = z.input<typeof signingSchema>;
export type SigningPayload = z.output<typeof signingSchema>;

export const parseSigningForm = (
  formData: SigningFormInput,
):
  | { success: true; data: SigningPayload }
  | { success: false; errors: Record<string, string> } => {
  const result = signingSchema.safeParse(formData);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return { success: false, errors };
};
