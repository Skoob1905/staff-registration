/**
 * Determines whether a payslip belongs to the caller.
 *
 * A payslip's `userId` is stored as the uppercased staff document id (see
 * `uploadPayslip`), while the caller's Firebase Auth uid is unrelated to that
 * id. Ownership is therefore resolved by matching the staff documents looked
 * up for the caller (by email) against the payslip's `userId`.
 */
export const isPayslipOwner = (
  staffDocIds: string[],
  payslipUserId: string,
): boolean => {
  const target = payslipUserId.trim().toUpperCase();
  if (!target) return false;
  return staffDocIds.some((id) => id.trim().toUpperCase() === target);
};
