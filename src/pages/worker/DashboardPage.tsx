import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { Section } from "../../components/Section";
import { Pill } from "../../components/Pill";
import { ActionButton } from "../../components/ui";
import {
  AccordionRoot,
  AccordionItem,
} from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { getPayslipsForUser } from "../../services/payslipService";
import type { Payslip, StaffUpload } from "../../types/domain";
import { Body, Muted } from "../../config/typography";

export const DashboardPage = () => {
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  const { appUser } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [documents, setDocuments] = useState<StaffUpload[]>([]);

  useEffect(() => {
    if (!appUser) return;
    const run = async () => {
      const [slips, docsSnaps] = await Promise.all([
        getPayslipsForUser(appUser.uid, appUser.agencyId),
        getDocs(
          query(
            collection(db, "staff_uploads"),
            where("userId", "==", appUser.uid),
            orderBy("uploadedAt", "desc"),
          ),
        ),
      ]);
      setPayslips(slips);
      setDocuments(
        docsSnaps.docs.map(
          (d) => ({ id: d.id, ...d.data() } as StaffUpload),
        ),
      );
    };
    void run();
  }, [appUser]);

  const toDateStr = (ts: unknown) => {
    const d = (ts as { toDate: () => Date } | null)?.toDate?.();
    return d
      ? d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Section title="Dashboard">
        <div className="flex items-center gap-3">
          <Pill status="registered" />
        </div>
        <Body className="mt-2">Nothing to do</Body>
      </Section>

      <Section title="Documents" count={documents.length}>
        {documents.length ? (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <AccordionRoot type="single" collapsible>
              {documents.map((doc) => (
                <AccordionItem
                  key={doc.id}
                  value={doc.id}
                  title={
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{doc.fileName}</span>
                      <ActionButton
                        variant="download"
                        ariaLabel="Download document"
                        href={doc.fileUrl}
                      />
                    </div>
                  }
                >
                  <div className="space-y-1">
                    <p>
                      <b>Category:</b> {doc.category || "General"}
                    </p>
                    <p>
                      <b>Uploaded:</b> {toDateStr(doc.uploadedAt)}
                    </p>
                  </div>
                </AccordionItem>
              ))}
            </AccordionRoot>
          </div>
        ) : (
          <Muted>No documents available.</Muted>
        )}
      </Section>

      <Section title="Payslips" count={payslips.length}>
        {payslips.length ? (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <AccordionRoot type="single" collapsible>
              {payslips.map((payslip) => (
                <AccordionItem
                  key={payslip.id}
                  value={payslip.id}
                  title={
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{payslip.fileName}</span>
                      {!payslip.hasDownloaded && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          New
                        </span>
                      )}
                      <ActionButton
                        variant="download"
                        ariaLabel="Download payslip"
                        href={payslip.fileUrl}
                      />
                    </div>
                  }
                >
                  <div className="space-y-1">
                    <p>
                      <b>Sent By:</b> {payslip.sentBy ?? "Unknown"}
                    </p>
                    <p>
                      <b>Sent At:</b> {toDateStr(payslip.timestamp)}
                    </p>
                  </div>
                </AccordionItem>
              ))}
            </AccordionRoot>
          </div>
        ) : (
          <Muted>No payslips available.</Muted>
        )}
      </Section>
    </div>
  );
};
