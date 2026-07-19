import { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  AccordionAction,
  AccordionItem,
  Button,
  DeleteButton,
} from "../components/ui";
import { AccordionTitle } from "../components/AccordionTitle";
import { InformationCard } from "../components/InformationCard";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { StaffListSection } from "../components/StaffListSection";
import { useToast } from "../context/ToastProvider";
import { useAuth } from "../context/AuthProvider";
import { useAccordionParams } from "../hooks/useAccordionParams";
import {
  getPayslip,
  getUser,
  getAgency,
  getAgencyByEmail,
} from "../services/firestore";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";
import { functions } from "../services/firebase";
import { formatSentDate } from "../utils/date";
import type { Agency, BulkStaff, Payslip } from "../types/domain";
import type { StaffPayslips } from "../utils/payslips";

interface DeleteTarget {
  staffId: string;
  staffName: string;
  payslipId: string;
  payslipName: string;
}

function getAgencyName(
  agencyDoc: Record<string, unknown>,
  fallbackId: string,
): string {
  return typeof agencyDoc.business_name === "string"
    ? agencyDoc.business_name
    : typeof agencyDoc["Business Name"] === "string"
      ? agencyDoc["Business Name"]
      : typeof agencyDoc.name === "string"
        ? agencyDoc.name
        : findValueByNormalizedKey(
            agencyDoc,
            "businessname",
            "companyname",
            "name",
            "agencyname",
            "company",
          ) || fallbackId;
}

export const Payslips = () => {
  useEffect(() => {
    document.title = "Payslips";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const { openValues, handleAccordionChange } = useAccordionParams();
  const role = appUser?.role;
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [agencyNames, setAgencyNames] = useState<string[]>([]);
  const [agencyList, setAgencyList] = useState<Agency[]>([]);
  const [agencyNamesLoaded, setAgencyNamesLoaded] = useState(false);
  const [staffPayslips, setStaffPayslips] = useState<StaffPayslips[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!appUser) return;
      if (appUser.role === "super") {
        setAgencyNamesLoaded(true);
        return;
      }

      try {
        if (appUser.role === "admin") {
          const userData = await getUser(appUser.uid);
          if (!userData) return;
          const ids =
            (userData as { assignedAgencyIds?: string[] }).assignedAgencyIds ??
            [];
          if (ids.length === 0 && appUser.agencyId) {
            ids.push(appUser.agencyId);
          }
          console.log("[Payslips] admin assignedAgencyIds:", ids);
          const names: string[] = [];
          const agenciesArr: Agency[] = [];
          for (const id of ids) {
            const data = await getAgency(id);
            if (data) {
              const name = getAgencyName(data, id);
              names.push(name);
              agenciesArr.push({
                id,
                name,
                slug: (data.slug as string) ?? "",
                assignedStaff:
                  ((data.metadata as Record<string, unknown> | undefined)
                    ?.assignedStaff as string[]) ?? [],
              });
            }
          }
          console.log("[Payslips] resolved agency names:", names);
          setAgencyNames(names);
          setAgencyList(agenciesArr);
        } else {
          try {
            const agencies = await getAgencyByEmail(appUser.email ?? "");
            if (agencies.length > 0) {
              const name = getAgencyName(agencies[0], String(agencies[0].id));
              console.log("[Payslips] client agency name:", name);
              setAgencyNames(name ? [name] : []);
            } else {
              console.log("[Payslips] no agencies found for email");
            }
          } catch (err) {
            console.error("[Payslips] failed to fetch agency by email:", err);
          }
        }
      } finally {
        setAgencyNamesLoaded(true);
      }
    };
    void run();
  }, [appUser]);

  const targetAgencyNames = useMemo(() => {
    if (appUser?.role === "super") return undefined;
    const result = agencyNames.length === 0 ? [] : agencyNames;
    console.log("[Payslips] targetAgencyNames:", result);
    return result;
  }, [agencyNames, appUser?.role]);

  const handleDeleteSuccess = useCallback(() => {
    setTimeout(() => setRefreshTrigger((n) => n + 1), 2000);
  }, []);

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
      handleDeleteSuccess();
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

  const payslipsByStaffId = useMemo(() => {
    const map: Record<string, StaffPayslips> = {};
    for (const sp of staffPayslips) {
      map[sp.staffId] = sp;
    }
    return map;
  }, [staffPayslips]);

  const handleItemsChange = useCallback((staffItems: BulkStaff[]) => {
    console.log(
      "[Payslips] handleItemsChange called with",
      staffItems.length,
      "items",
    );
    if (staffItems.length === 0) {
      setStaffPayslips([]);
      return;
    }

    const fetchPayslips = async () => {
      const allPayslipIds = staffItems.flatMap(
        (s) => (s.metadata?.payslipsSent as string[] | undefined) ?? [],
      );
      const uniqueIds = [...new Set(allPayslipIds)];
      console.log("[Payslips] unique payslip IDs to fetch:", uniqueIds);

      const docs = (
        await Promise.all(uniqueIds.map((id) => getPayslip(id)))
      ).filter((d): d is Record<string, unknown> => d !== null);
      console.log("[Payslips] fetched payslip docs:", docs.length);

      const payslipsByUserId: Record<string, Payslip[]> = {};
      for (const doc of docs) {
        const userId = doc.userId as string;
        if (!payslipsByUserId[userId]) payslipsByUserId[userId] = [];
        payslipsByUserId[userId].push({
          id: doc.id as string,
          ...doc,
        } as Payslip);
      }

      for (const userId of Object.keys(payslipsByUserId)) {
        payslipsByUserId[userId].sort((a, b) => {
          const toMs = (ts: unknown) =>
            (ts as { toDate: () => Date } | null)?.toDate?.()?.getTime() ?? 0;
          return toMs(b.timestamp) - toMs(a.timestamp);
        });
      }

      const result: StaffPayslips[] = [];
      for (const staff of staffItems) {
        const payslips = payslipsByUserId[staff.id] ?? [];
        if (payslips.length === 0) continue;

        const staffName =
          [staff.Forename, staff.Surname].filter(Boolean).join(" ").trim() ||
          staff.email ||
          staff.id;

        result.push({ staffId: staff.id, staffName, payslips });
      }

      result.sort((a, b) => a.staffName.localeCompare(b.staffName));
      console.log(
        "[Payslips] staff payslips result:",
        result.length,
        "entries",
        result.map((r) => r.staffName),
      );

      setStaffPayslips(result);
    };

    fetchPayslips();
  }, []);

  const renderItem = useCallback(
    (member: BulkStaff, idx: number) => {
      const payslipEntry = payslipsByStaffId[member.id];
      if (!payslipEntry) {
        console.log(
          "[Payslips] renderItem: no payslip data for member",
          member.id,
          member.Forename,
          member.Surname,
        );
        return null;
      }

      const latestPayslip = payslipEntry.payslips.reduce((latest, p) => {
        const t =
          (p.timestamp as { toDate?: () => Date } | undefined)
            ?.toDate?.()
            ?.getTime() ?? 0;
        const lt =
          (latest.timestamp as { toDate?: () => Date } | undefined)
            ?.toDate?.()
            ?.getTime() ?? 0;
        return t > lt ? p : latest;
      }, payslipEntry.payslips[0]);

      return (
        <AccordionItem
          key={payslipEntry.staffId}
          value={payslipEntry.staffId}
          className="animate-cascade"
          style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
          title={
            <span className="flex items-center gap-2">
              <AccordionTitle>{payslipEntry.staffName}</AccordionTitle>
            </span>
          }
          actions={
            <AccordionAction>
              {"Latest: " + formatSentDate(latestPayslip.timestamp)}
            </AccordionAction>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {payslipEntry.payslips.map((payslip) => (
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
                            staffId: payslipEntry.staffId,
                            staffName: payslipEntry.staffName,
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
    },
    [role],
  );

  return (
    <div className="mx-auto space-y-4">
      <StaffListSection
        title="Payslips"
        accordionLayout="single"
        accordionType="multiple"
        algoliaFilters="metadata.payslipsCount > 0"
        renderItem={renderItem}
        multiAccordionValue={openValues}
        onMultiAccordionChange={handleAccordionChange}
        onItemsChange={handleItemsChange}
        refreshTrigger={refreshTrigger}
        targetAgencyNames={targetAgencyNames}
        agencies={agencyList}
        namesLoading={!agencyNamesLoaded}
      />

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
