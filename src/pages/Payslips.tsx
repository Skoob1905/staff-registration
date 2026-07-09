import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Loader2 } from "lucide-react";
import { AccordionItem, AccordionRoot, Button, DeleteButton } from "../components/ui";
import { Section } from "../components/Section";
import { AccordionTitle } from "../components/AccordionTitle";
import { InformationCard } from "../components/InformationCard";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { useToast } from "../context/ToastProvider";
import { useAuth } from "../context/AuthProvider";
import { functions } from "../services/firebase";
import { getUser } from "../services/firestore";
import { formatSentDate } from "../utils/date";
import { getAllStaffPayslips, type StaffPayslips } from "../utils/payslips";

interface DeleteTarget {
  staffId: string;
  staffName: string;
  payslipId: string;
  payslipName: string;
}

export const Payslips = () => {
  useEffect(() => {
    document.title = "Payslips";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<StaffPayslips[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async (): Promise<StaffPayslips[]> => {
    let agencyIds: string[] | undefined;

    if (appUser?.role === "admin") {
      const userData = await getUser(appUser.uid);
      if (userData) {
        const ids = (userData as { assignedAgencyIds?: string[] }).assignedAgencyIds ?? [];
        if (ids.length === 0 && appUser.agencyId) {
          ids.push(appUser.agencyId);
        }
        agencyIds = ids.length > 0 ? ids : undefined;
      }
    }

    return getAllStaffPayslips(agencyIds);
  };

  useEffect(() => {
    loadData()
      .then((data) => {
        setStaffList(data);
        setLoading(false);
      })
      .catch(() => {
        setStaffList([]);
        setLoading(false);
      });
  }, [appUser]);

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const fn = httpsCallable(functions, "deletePayslip");
      await fn({
        payslipId: deleteTarget.payslipId,
        staffId: deleteTarget.staffId,
      });
      toast({ title: "Payslip deleted", variant: "success" });
      setDeleteTarget(null);
      setStaffList(await loadData());
    } catch {
      toast({
        title: "Delete failed",
        description: "Please try again.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalPayslips = staffList.reduce((sum, s) => sum + s.payslips.length, 0);

  return (
    <div className="mx-auto space-y-4">
      <Section title="Payslips" count={totalPayslips}>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : staffList.length === 0 ? (
          <p className="text-sm text-zinc-500">No payslips uploaded yet.</p>
        ) : (
          <AccordionRoot className="mt-1.5 sm:mt-3 space-y-3" type="multiple">
            {staffList.map((staff, idx) => {
              const latestPayslip = staff.payslips.reduce((latest, p) => {
                const t =
                  (p.timestamp as { toDate?: () => Date } | undefined)
                    ?.toDate?.()
                    ?.getTime() ?? 0;
                const lt =
                  (latest.timestamp as { toDate?: () => Date } | undefined)
                    ?.toDate?.()
                    ?.getTime() ?? 0;
                return t > lt ? p : latest;
              }, staff.payslips[0]);

              return (
                <AccordionItem
                  key={staff.staffId}
                  value={staff.staffId}
                  className="animate-cascade"
                  style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
                  title={
                    <span className="flex items-center gap-2">
                      <AccordionTitle>{staff.staffName}</AccordionTitle>
                    </span>
                  }
                  actions={
                    <span className="text-xs text-zinc-400">
                      Latest: {formatSentDate(latestPayslip.timestamp)}
                    </span>
                  }
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {staff.payslips.map((payslip) => (
                      <InformationCard
                        key={payslip.id}
                        variant="payslip"
                        name={payslip.fileName}
                        isNew={!payslip.hasDownloaded}
                        hasDownloaded={!!payslip.hasDownloaded}
                        uploadedAt={payslip.timestamp}
                        admin
                        documentInfo={null}
                        actions={
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                window.open(payslip.fileUrl, "_blank", "noopener,noreferrer");
                              }}
                            >
                              Download
                            </Button>
                            <DeleteButton
                              onClick={() => {
                                setDeleteTarget({
                                  staffId: staff.staffId,
                                  staffName: staff.staffName,
                                  payslipId: payslip.id,
                                  payslipName: payslip.fileName,
                                });
                              }}
                            />
                          </div>
                        }
                      />
                    ))}
                  </div>
                </AccordionItem>
              );
            })}
          </AccordionRoot>
        )}
      </Section>

      <DeleteConfirmModal
        open={deleteTarget !== null}
        deleting={deleting}
        label="payslip"
        itemName={deleteTarget?.payslipName ?? ""}
        clientName={deleteTarget?.staffName ?? ""}
        onDelete={() => void onDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
