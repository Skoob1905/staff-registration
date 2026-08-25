import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { FileSignature } from "lucide-react";
import { AddModal } from "../components/AddModal";
import { ImportHistory } from "../components/ImportHistory";
import { AccordionItem, DownloadButton } from "../components/ui";
import { PreviewModal } from "../components/modals";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { Pill } from "../components/Pill";
import { AssignedStaff } from "../components/Pills/AssignedStaff";
import { StaffAccordionHeader } from "../views/Accordion";
import { ActionButtonContainer } from "../components/ActionButtonContainer";
import { RecordData } from "../components/RecordData";
import { cleanRecordData } from "../utils/cleanRecordData";
import { Metadata } from "../components/Metadata";
import { TableView } from "../views/Table";
import { useToast } from "../context/ToastProvider";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";
import { functions } from "../services/firebase";
import { toDate } from "../utils/date";

export const Agencies = () => {
  useEffect(() => {
    document.title = "Agencies";
  }, []);

  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "records";
  const [confirmDeleteAgency, setConfirmDeleteAgency] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [deletingAgency, setDeletingAgency] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalFile, setAddModalFile] = useState<File | null>(null);

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const handleRefresh = useCallback(
    () => setRefreshTrigger((n) => n + 1),
    [],
  );

  const getPrimaryLabel = (client: Record<string, unknown>): string => {
    return (
      (client.business_name as string) ||
      (client["Business Name"] as string) ||
      (client["Company Name"] as string) ||
      (client.company_name as string) ||
      (client.name as string) ||
      (client.agencyName as string) ||
      findValueByNormalizedKey(
        client as Record<string, unknown>,
        "businessname",
        "companyname",
        "name",
        "agencyname",
        "organisation",
        "company",
      ) ||
      "Unknown"
    );
  };

  const onDeleteAgency = async () => {
    if (!confirmDeleteAgency) return;
    setDeletingAgency(true);
    const name = getPrimaryLabel(confirmDeleteAgency);
    try {
      const callable = httpsCallable(functions, "deleteAgency");
      await callable({ agencyId: confirmDeleteAgency.id as string });
      toast({
        title: "Agency deleted",
        description: `${name} has been permanently deleted.`,
        variant: "success",
      });
      setConfirmDeleteAgency(null);
      setTimeout(handleRefresh, 2000);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Failed to delete agency.";
      toast({
        title: "Delete failed",
        description: `Could not delete ${name}. ${message}`,
        variant: "error",
      });
    } finally {
      setDeletingAgency(false);
    }
  };

  return (
    <div className="mx-auto space-y-4">
      {tab === "records" ? (
        <TableView<Record<string, unknown>>
          title="Agencies"
          indexName="agencies_name_desc"
          filterKeys={{ tag: "tags", agency: "metadata.uploadedBy" }}
          enableTagFilter={false}
          enableLoginStatusFilter={false}
          columnHeaders={["Agency Name", "Assigned Staff"]}
          refreshTrigger={refreshTrigger}
          renderItem={(agency, idx) => {
            const meta = agency.metadata as Record<string, unknown> | undefined;
            const scName = meta?.signedContractName as string | undefined;
            const scUrl = meta?.signedContract as string | undefined;
            const scDate = meta?.signedContractAt as string | number | undefined;
            return (
              <AccordionItem
                key={agency.id as string}
                value={agency.id as string}
                className="animate-cascade"
                style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
                columns={[
                  <span className="tabular-nums">{idx + 1}</span>,
                  <StaffAccordionHeader name={getPrimaryLabel(agency)}>
                    {scName && (
                      <Pill
                        status="signed"
                        icon={<FileSignature className="h-4 w-4" />}
                        label=""
                      />
                    )}
                  </StaffAccordionHeader>,
                  <AssignedStaff
                    record={agency}
                    onClick={() =>
                      navigate(
                        `/staff?agencies=${encodeURIComponent(agency.id as string)}&page=1`,
                      )
                    }
                  />,
                ]}
              >
                {scName && scUrl && (
                  <div className="mb-2 flex items-center gap-2">
                    <Metadata
                      title="Signed Contract"
                      className="animate-cascade"
                      style={{ animationDelay: "0ms" }}
                      value={
                        <span className="inline-flex items-center gap-2">
                          {scName}
                          {scDate && toDate(scDate) && (
                            <span className="text-zinc-400">
                              ({toDate(scDate)!.toLocaleDateString()})
                            </span>
                          )}
                        </span>
                      }
                    />
                    <DownloadButton
                      size="md"
                      href={scUrl}
                      ariaLabel="Download contract"
                    />
                  </div>
                )}
                <RecordData data={cleanRecordData(agency)} />
                <ActionButtonContainer
                  handleDelete={() => setConfirmDeleteAgency(agency)}
                />
              </AccordionItem>
            );
          }}
        />
      ) : (
        <ImportHistory
          type="agency"
          cloudFunction="removeAgencies"
          getPreviewNames={(rows) =>
            rows.map(
              (r) =>
                r.business_name ||
                r["Business Name"] ||
                r["Company Name"] ||
                r.Company_Name ||
                r.company_name ||
                findValueByNormalizedKey(
                  r,
                  "businessname",
                  "companyname",
                  "name",
                  "agencyname",
                  "organisation",
                  "company",
                ) ||
                "Unknown",
            )
          }
          onDeleteSuccess={() => setTimeout(handleRefresh, 2000)}
        />
      )}

      <AddModal
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) setAddModalFile(null);
        }}
        cloudFunction="importAgencyCsv"
        storagePath="agencies"
        itemLabel="agency"
        itemLabelPlural="agencies"
        csvType="agency"
        duplicateKey="companyName"
        initialFile={addModalFile}
        onSuccess={() => setTimeout(handleRefresh, 2000)}
      />

      <PreviewModal
        open={showPreviewModal}
        file={previewFile}
        mode="invoice"
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewFile(null);
        }}
      />

      <DeleteConfirmModal
        open={confirmDeleteAgency !== null}
        deleting={deletingAgency}
        label="agency"
        itemName={confirmDeleteAgency ? getPrimaryLabel(confirmDeleteAgency) : ""}
        clientName=""
        description="This will unassign all staff, remove the agency's user and login, and unassign this agency from any clients."
        onDelete={() => void onDeleteAgency()}
        onClose={() => setConfirmDeleteAgency(null)}
      />
    </div>
  );
};
