import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { Section } from "../components/Section";
import { Pill } from "../components/Pill";
import { InformationCard } from "../components/InformationCard";
import { Button } from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { getPayslipsForUser } from "../services/payslipService";
import type { Payslip } from "../types/domain";
import { Body, Muted } from "../config/typography";

interface StaffDocumentEntry {
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

export const Dashboard = () => {
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  const { appUser } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [documents, setDocuments] = useState<StaffDocumentEntry[]>([]);

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
        const staffSnaps = await getDocs(
          query(
            collection(db, "staff"),
            where("email", "==", appUser.email?.toLowerCase()),
          ),
        );
        if (!staffSnaps.empty) {
          const data = staffSnaps.docs[0].data() as {
            metadata?: { documents?: StaffDocumentEntry[] };
          };
          setDocuments(data.metadata?.documents ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch staff documents", err);
      }
    };
    void run();
  }, [appUser]);

  const toDateStr = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
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
        {documents.length === 0 ? (
          <Muted>No documents available.</Muted>
        ) : (
          <div className="flex flex-col gap-3">
            {documents.map((doc, idx) => (
              <InformationCard
                key={idx}
                variant="payslip"
                name={doc.fileName}
                isNew={false}
                hasDownloaded={false}
                uploadedAt={doc.uploadedAt}
                admin={false}
                documentInfo={null}
                actions={
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        window.open(
                          doc.fileUrl,
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
