import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { Section } from "../components/Section";
import { Pill } from "../components/Pill";
import { InformationCard } from "../components/InformationCard";
import { ActionButton } from "../components/ui";
import { AccordionRoot, AccordionItem } from "../components/ui";
import { Button } from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { getPayslipsForUser } from "../services/payslipService";
import type { Payslip, StaffUpload } from "../types/domain";
import { Body, Muted } from "../config/typography";

export const Dashboard = () => {
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  const { appUser } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [documents, setDocuments] = useState<StaffUpload[]>([]);

  useEffect(() => {
    if (!appUser) return;
    const run = async () => {
      try {
        const slips = await getPayslipsForUser(appUser.email);
        setPayslips(slips);
      } catch (err) {
        console.error("Failed to fetch payslips", err);
      }

      try {
        const docsSnaps = await getDocs(
          query(
            collection(db, "staff_uploads"),
            where("userId", "==", appUser.uid),
            orderBy("uploadedAt", "desc"),
          ),
        );
        setDocuments(
          docsSnaps.docs.map((d) => ({ id: d.id, ...d.data() }) as StaffUpload),
        );
      } catch {
        // staff_uploads won't match for workers without agency
      }
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
        {payslips.length === 0 ? (
          <Muted>No payslips available.</Muted>
        ) : (
          <div className="flex flex-col gap-3">
            {payslips.map((payslip, idx) => (
              <InformationCard
                key={idx}
                variant="payslip"
                name={payslip.fileName}
                isNew={!payslip.hasDownloaded}
                hasDownloaded={!!payslip.hasDownloaded}
                uploadedAt={payslip.timestamp as unknown as string}
                admin={false}
                documentInfo={null}
                actions={
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        window.open(
                          payslip.fileUrl,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }}
                    >
                      Download
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};
