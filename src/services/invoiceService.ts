import { httpsCallable } from "firebase/functions";
import { getClient, getAllClients } from "./firestore";
import { functions } from "./firebase";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";

export interface InvoiceEntry {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedByUid: string;
  uploadedAt: string;
  dueDate: string;
  amountPayable: string;
  agencyName: string;
  agencyId: string;
  status: "unpaid" | "paid" | "review";
  paidAt?: string;
  paidBy?: string;
  hasSeen?: boolean;
  hasDownloaded?: boolean;
}

export const uploadInvoice = async (
  file: File,
  agencyId: string,
  dueDate: string,
  amountPayable: string,
  agencyName: string,
  onProgress?: (pct: number) => void,
): Promise<void> => {
  onProgress?.(10);

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  onProgress?.(30);

  const fn = httpsCallable<
    {
      fileBase64: string;
      fileName: string;
      agencyId: string;
      contentType: string;
      dueDate: string;
      amountPayable: string;
      agencyName: string;
    },
    { ok: boolean; url: string }
  >(functions, "uploadInvoice");

  await fn({
    fileBase64: base64,
    fileName: file.name,
    agencyId,
    contentType: file.type,
    dueDate,
    amountPayable,
    agencyName,
  });

  onProgress?.(100);
};

export const markInvoicePaid = async (
  agencyId: string,
  invoiceId: string,
): Promise<void> => {
  const fn = httpsCallable<
    { agencyId: string; invoiceId: string },
    { ok: boolean }
  >(functions, "markInvoicePaid");
  await fn({ agencyId, invoiceId });
};

export const deleteInvoice = async (
  agencyId: string,
  invoiceId: string,
): Promise<void> => {
  const fn = httpsCallable<
    { agencyId: string; invoiceId: string },
    { ok: boolean }
  >(functions, "deleteInvoice");
  await fn({ agencyId, invoiceId });
};

export const getInvoicesForClient = async (
  clientId: string,
): Promise<InvoiceEntry[]> => {
  const data = await getClient(clientId);
  if (!data) return [];
  const metadata = data.metadata as { invoices?: InvoiceEntry[] } | undefined;
  const invoices = metadata?.invoices ?? [];
  return invoices.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
};

export const getAllInvoices = async (): Promise<
  Array<{ agencyId: string; agencyName: string; invoices: InvoiceEntry[] }>
> => {
  const snaps = await getAllClients();
  const results: Array<{
    agencyId: string;
    agencyName: string;
    invoices: InvoiceEntry[];
  }> = [];

  for (const data of snaps as Record<string, unknown>[]) {
    const invoices = ((data.metadata as Record<string, unknown>)?.invoices ?? []) as InvoiceEntry[];
    if (invoices.length > 0) {
      const name: string =
        (data.business_name as string) ||
        (data.Company_Name as string) ||
        (data.company_name as string) ||
        (data.name as string) ||
        (data.agencyName as string) ||
        findValueByNormalizedKey(
          data as Record<string, unknown>,
          "businessname",
          "name",
          "agencyname",
          "organisation",
          "company",
        ) ||
        "Unknown Agency";
      results.push({
        agencyId: (data.id as string),
        agencyName: name,
        invoices: invoices.sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
        ),
      });
    }
  }

  return results.sort((a, b) => a.agencyName.localeCompare(b.agencyName));
};

export const getLatestFileUpload = async (): Promise<{
  fileName: string;
  clientName: string;
  uploadedAt: string;
  status: string;
  unpaidCount: number;
} | null> => {
  const all = await getAllInvoices();
  let latest: {
    fileName: string;
    clientName: string;
    uploadedAt: string;
    status: string;
  } | null = null;
  let unpaidCount = 0;
  for (const agency of all) {
    for (const inv of agency.invoices) {
      if (inv.status === "unpaid" || inv.status === "review") {
        unpaidCount++;
      }
      if (!latest || new Date(inv.uploadedAt).getTime() > new Date(latest.uploadedAt).getTime()) {
        latest = {
          fileName: inv.fileName,
          clientName: agency.agencyName,
          uploadedAt: inv.uploadedAt,
          status: inv.status,
        };
      }
    }
  }
  if (!latest) return null;
  return { ...latest, unpaidCount };
};

export const markItemsSeen = async (
  type: "invoices" | "timesheets",
  agencyId: string,
  ids: string[],
): Promise<void> => {
  const fn = httpsCallable<
    { type: string; agencyId: string; ids: string[] },
    { ok: boolean }
  >(functions, "seenItems");
  await fn({ type, agencyId, ids });
};

export const markItemsDownloaded = async (
  type: "invoices" | "timesheets",
  agencyId: string,
  ids: string[],
): Promise<void> => {
  const fn = httpsCallable<
    { type: string; agencyId: string; ids: string[] },
    { ok: boolean }
  >(functions, "setDownloaded");
  await fn({ type, agencyId, ids });
};
