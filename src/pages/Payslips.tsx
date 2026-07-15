import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Loader2 } from "lucide-react";
import {
  AccordionAction,
  AccordionItem,
  AccordionRoot,
  Button,
  DeleteButton,
} from "../components/ui";
import { Section } from "../components/Section";
import { AccordionTitle } from "../components/AccordionTitle";
import { InformationCard } from "../components/InformationCard";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { useToast } from "../context/ToastProvider";
import { useAuth } from "../context/AuthProvider";
import { useAccordionParams } from "../hooks/useAccordionParams";
import { functions } from "../services/firebase";
import { formatSentDate } from "../utils/date";
import { getAllStaffPayslips, type StaffPayslips } from "../utils/payslips";
import { getAgency, getUser } from "../services/firestore";

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
  const { openValues, handleAccordionChange } = useAccordionParams();
  const role = appUser?.role;
  const [assignedAgencyIds, setAssignedAgencyIds] = useState<
    string[] | undefined
  >(undefined);
  const [assignedStaffIds, setAssignedStaffIds] = useState<
    string[] | undefined
  >(undefined);
  const [filterLoaded, setFilterLoaded] = useState(false);
  const [staffList, setStaffList] = useState<StaffPayslips[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (role === "super") {
      setFilterLoaded(true);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        if (role === "admin") {
          const userData = await getUser(appUser!.uid);
          if (!cancelled) {
            const ids =
              (userData as { assignedAgencyIds?: string[] })
                ?.assignedAgencyIds ?? [];
            setAssignedAgencyIds(ids);
          }
        } else if (role === "client") {
          const agencyData = await getAgency(appUser!.agencyId);
          if (!cancelled) {
            const staffIds = (
              agencyData?.metadata as Record<string, unknown> | undefined
            )?.assignedStaff as string[] | undefined;
            setAssignedStaffIds(staffIds ?? []);
          }
        }
      } catch {
        if (!cancelled) {
          if (role === "admin") setAssignedAgencyIds([]);
          else if (role === "client") setAssignedStaffIds([]);
        }
      } finally {
        if (!cancelled) setFilterLoaded(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [role, appUser]);

  const loadData = async (): Promise<StaffPayslips[]> => {
    if (role === "admin") return getAllStaffPayslips(assignedAgencyIds);
    if (role === "client")
      return getAllStaffPayslips(undefined, assignedStaffIds);
    return getAllStaffPayslips();
  };

  useEffect(() => {
    if (!appUser) return;
    if ((role === "admin" || role === "client") && !filterLoaded) return;
    loadData()
      .then(setStaffList)
      .catch(() => setStaffList([]))
      .finally(() => setLoading(false));
  }, [appUser, role, assignedAgencyIds, assignedStaffIds, filterLoaded]);

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

  const totalPayslips = staffList.reduce(
    (sum, s) => sum + s.payslips.length,
    0,
  );

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
          <AccordionRoot
            className="mt-1.5 sm:mt-3 space-y-3"
            type="multiple"
            value={openValues}
            onValueChange={handleAccordionChange}
          >
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
                  style={
                    { animationDelay: `${idx * 5}ms` } as React.CSSProperties
                  }
                  title={
                    <span className="flex items-center gap-2">
                      <AccordionTitle>{staff.staffName}</AccordionTitle>
                    </span>
                  }
                  actions={
                    <AccordionAction>
                      {"Latest: " + formatSentDate(latestPayslip.timestamp)}
                    </AccordionAction>
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
                                window.open(
                                  payslip.fileUrl,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                              }}
                            >
                              Download
                            </Button>
                            {(role === "admin" || role === "super") && (
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
                            )}
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
