import type { Payslip } from "../types/domain";

export interface StaffPayslips {
  staffId: string;
  staffName: string;
  payslips: Payslip[];
}

export const getAllStaffPayslips = async (
  assignedAgencyIds?: string[],
): Promise<StaffPayslips[]> => {
  const { getAllStaff } = await import("../services/firestore");
  const { getPayslip } = await import("../services/firestore");
  const snaps = await getAllStaff();
  const results: StaffPayslips[] = [];

  for (const data of snaps as Record<string, unknown>[]) {
    if (assignedAgencyIds) {
      if (assignedAgencyIds.length === 0) continue;
      const staffAgencyId = (
        data.metadata as Record<string, unknown> | undefined
      )?.assignedToId as string | undefined;
      if (!staffAgencyId || !assignedAgencyIds.includes(staffAgencyId)) continue;
    }

    const payslipIds =
      ((data.metadata as Record<string, unknown>)?.payslipsSent as
        | string[]
        | undefined) ?? [];
    if (payslipIds.length === 0) continue;

    const payslipDocs = (
      await Promise.all(payslipIds.map((id) => getPayslip(id)))
    ).filter((d): d is Record<string, unknown> => d !== null);

    if (payslipDocs.length === 0) continue;

    const staffName =
      [(data.Forename as string) ?? "", (data.Surname as string) ?? ""]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      (data.email as string) ||
      (data.id as string);

    results.push({
      staffId: data.id as string,
      staffName,
      payslips: payslipDocs
        .map((d) => ({ id: d.id as string, ...d }) as Payslip)
        .sort((a, b) => {
          const toMs = (ts: unknown) =>
            (ts as { toDate: () => Date } | null)?.toDate?.()?.getTime() ?? 0;
          return toMs(b.timestamp) - toMs(a.timestamp);
        }),
    });
  }

  return results.sort((a, b) => a.staffName.localeCompare(b.staffName));
};

export const getStaffPayslipsByAgency = async (
  agencyId: string,
): Promise<StaffPayslips[]> => {
  const { getStaffByAgency } = await import("../services/firestore");
  const { getPayslip } = await import("../services/firestore");
  const snaps = await getStaffByAgency(agencyId);
  const results: StaffPayslips[] = [];

  for (const data of snaps as Record<string, unknown>[]) {
    const payslipIds =
      ((data.metadata as Record<string, unknown>)?.payslipsSent as
        | string[]
        | undefined) ?? [];
    if (payslipIds.length === 0) continue;

    const payslipDocs = (
      await Promise.all(payslipIds.map((id) => getPayslip(id)))
    ).filter((d): d is Record<string, unknown> => d !== null);

    if (payslipDocs.length === 0) continue;

    const staffName =
      [(data.Forename as string) ?? "", (data.Surname as string) ?? ""]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      (data.email as string) ||
      (data.id as string);

    results.push({
      staffId: data.id as string,
      staffName,
      payslips: payslipDocs
        .map((d) => ({ id: d.id as string, ...d }) as Payslip)
        .sort((a, b) => {
          const toMs = (ts: unknown) =>
            (ts as { toDate: () => Date } | null)?.toDate?.()?.getTime() ?? 0;
          return toMs(b.timestamp) - toMs(a.timestamp);
        }),
    });
  }

  return results.sort((a, b) => a.staffName.localeCompare(b.staffName));
};
