import type { Payslip } from "../types/domain";

export interface StaffPayslips {
  staffId: string;
  staffName: string;
  payslips: Payslip[];
}

export const filterDownloadedPayslips = (payslips: Payslip[]): Payslip[] =>
  payslips.filter((payslip) => payslip.hasDownloaded === true);
