import { z } from "zod";

const cleanName = (value: string): string => value.trim().replace(/\s+/g, " ");
const cleanAddress = (value: string): string => value.trim().replace(/\s+/g, " ");

const nameRegex = /^[A-Za-z' -]+$/;

export const registrationSchema = z.object({
  firstName: z
    .string()
    .transform(cleanName)
    .refine((v) => v.length >= 2, "First name must be at least 2 characters.")
    .refine((v) => nameRegex.test(v), "First name cannot contain numbers or symbols."),
  lastName: z
    .string()
    .transform(cleanName)
    .refine((v) => v.length >= 2, "Last name must be at least 2 characters.")
    .refine((v) => nameRegex.test(v), "Last name cannot contain numbers or symbols."),
  birthday: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Please select a valid date.")
    .refine((v) => {
      const date = new Date(v);
      return !Number.isNaN(date.getTime()) && date <= new Date();
    }, "Birthday must be a valid past date."),
  address: z
    .string()
    .transform(cleanAddress)
    .refine((v) => v.length >= 8, "Address must be at least 8 characters."),
  honestyConfirmed: z
    .boolean()
    .refine((v) => v === true, "You must confirm that your answers are honest."),
});

export type RegistrationFormInput = z.input<typeof registrationSchema>;
export type RegistrationPayload = z.output<typeof registrationSchema>;

export const parseRegistrationForm = (
  formData: RegistrationFormInput,
): { success: true; data: RegistrationPayload } | { success: false; errors: Record<string, string> } => {
  const result = registrationSchema.safeParse(formData);
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
