import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { FileSignature } from "lucide-react";
import { AddModal } from "../components/AddModal";
import { ImportHistory } from "../components/ImportHistory";
import { AccordionItem, DownloadButton } from "../components/ui";
import { DeleteClientModal, PreviewModal } from "../components/modals";
import { Pill } from "../components/Pill";
import { AssignedStaff } from "../components/Pills/AssignedStaff";
import { StaffAccordionHeader } from "../components/StaffAccordionHeader";
import { ActionButtonContainer } from "../components/ActionButtonContainer";
import { RecordData } from "../components/RecordData";
import { cleanRecordData } from "../utils/cleanRecordData";
import { Metadata } from "../components/Metadata";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";
import { functions } from "../services/firebase";
import { toDate } from "../utils/date";
import { PaginatedFilterSection } from "../components/PaginatedFilterSection";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { useFilterParams } from "../hooks/useFilterParams";
import { useDualAccordionParams } from "../hooks/useDualAccordionParams";
import { usePaginationParams } from "../hooks/usePaginationParams";

export const Agencies = () => {
  useEffect(() => {
    document.title = "Agencies";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [deletingContract, setDeletingContract] = useState(false);
  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const [clientFilters, setClientFilters] = useFilterParams();
  const { leftValue, rightValue, onLeftChange, onRightChange } =
    useDualAccordionParams();

  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalFile, setAddModalFile] = useState<File | null>(null);

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const {
    items: clients,
    loading,
    refresh,
    totalPages,
    totalResults,
  } = usePaginatedRecords({
    indexName: "agencies_name_desc",
    agencyId: appUser?.agencyId ?? "",
    query: clientFilters.name,
    page,
    hitsPerPage: pageSize,
  });

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

  const handleDeleteSuccess = async () => {
    setTimeout(() => refresh(), 2000);
  };

  const handleClientFiltersChange = useCallback(
    (filters: typeof clientFilters) => {
      setPage(0);
      setClientFilters(filters);
    },
    [setClientFilters],
  );

  const onDeleteContract = async () => {
    if (!confirmDeleteClient) return;
    setDeletingContract(true);
    const name = getPrimaryLabel(confirmDeleteClient);
    try {
      const callable = httpsCallable(functions, "deleteContract");
      await callable({ clientId: confirmDeleteClient.id as string });
      toast({
        title: "Contract removed",
        description: `Signed contract for ${name} has been deleted.`,
        variant: "success",
      });
      setConfirmDeleteClient(null);
      refresh();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Failed to delete contract.";
      toast({
        title: "Delete failed",
        description: `Could not delete contract for ${name}. ${message}`,
        variant: "error",
      });
    } finally {
      setDeletingContract(false);
    }
  };

  return (
    <div className="mx-auto space-y-4">
      <PaginatedFilterSection
        title="Agencies"
        items={clients}
        loading={loading}
        totalResults={totalResults}
        renderItem={(client, idx) => {
          const meta = (client as Record<string, unknown>).metadata as
            | Record<string, unknown>
            | undefined;
          const scName = meta?.signedContractName as string | undefined;
          const scUrl = meta?.signedContract as string | undefined;
          const scDate = meta?.signedContractAt as string | number | undefined;
          return (
            <AccordionItem
              key={client.id as string}
              value={client.id as string}
              className="animate-cascade"
              style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
              title={
                <StaffAccordionHeader name={getPrimaryLabel(client)}>
                  {scName && (
                    <Pill
                      status="signed"
                      icon={<FileSignature className="h-4 w-4" />}
                      label=""
                    />
                  )}
                  <AssignedStaff
                    record={client}
                    onClick={() =>
                      navigate(
                        `/staff?agencies=${encodeURIComponent(getPrimaryLabel(client))}`,
                      )
                    }
                  />
                </StaffAccordionHeader>
              }
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
              <RecordData data={cleanRecordData(client)} />
              <ActionButtonContainer
                handleDelete={() => setConfirmDeleteClient(client)}
              />
            </AccordionItem>
          );
        }}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPrevPage={() => setPage(Math.max(0, page - 1))}
        onNextPage={() => setPage(page + 1)}
        onGoToPage={setPage}
        onPageSizeChange={setPageSize}
        filters={clientFilters}
        onFiltersChange={handleClientFiltersChange}
        enableNameFilter
        enableTagFilter={false}
        leftAccordionValue={leftValue}
        onLeftAccordionChange={onLeftChange}
        rightAccordionValue={rightValue}
        onRightAccordionChange={onRightChange}
      />

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
        onDeleteSuccess={handleDeleteSuccess}
      />

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
        onSuccess={async () => {
          setTimeout(() => refresh(), 2000);
        }}
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

      <DeleteClientModal
        open={confirmDeleteClient !== null}
        onClose={() => setConfirmDeleteClient(null)}
        onDelete={onDeleteContract}
        deleting={deletingContract}
        clientName={
          confirmDeleteClient ? getPrimaryLabel(confirmDeleteClient) : ""
        }
      />
    </div>
  );
};
