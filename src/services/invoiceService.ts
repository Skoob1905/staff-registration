import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db, functions } from "./firebase";

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

export const getInvoicesForAgency = async (
  agencyId: string,
): Promise<InvoiceEntry[]> => {
  const snap = await getDoc(doc(db, "agencies", agencyId));
  if (!snap.exists()) return [];
  const data = snap.data() as {
    metadata?: { invoices?: InvoiceEntry[] };
  };
  const invoices = data.metadata?.invoices ?? [];
  return invoices.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
};

export const getAllInvoices = async (): Promise<
  Array<{ agencyId: string; agencyName: string; invoices: InvoiceEntry[] }>
> => {
  const { collection, getDocs } = await import("firebase/firestore");
  const snaps = await getDocs(collection(db, "agencies"));
  const results: Array<{
    agencyId: string;
    agencyName: string;
    invoices: InvoiceEntry[];
  }> = [];

  for (const snap of snaps.docs) {
    const data = snap.data() as {
      metadata?: { invoices?: InvoiceEntry[] };
      name?: string;
    };
    const invoices = data.metadata?.invoices ?? [];
    if (invoices.length > 0) {
      const name: string =
        data.name ||
        data.business_name ||
        data.Company_Name ||
        data.company_name ||
        data.agencyName ||
        "Unknown Agency";
      results.push({
        agencyId: snap.id,
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
