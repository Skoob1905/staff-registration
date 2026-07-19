import type { Payslip } from "../types/domain";

export interface StaffPayslips {
  staffId: string;
  staffName: string;
  payslips: Payslip[];
}
