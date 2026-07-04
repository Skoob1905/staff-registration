import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { FileSignature } from "lucide-react";
import { ImportHistory } from "../components/ImportHistory";
import {
  AccordionItem,
  Button,
  DeleteButton,
  DialogContent,
  DialogRoot,
  DialogTitle,
  DownloadButton,
} from "../components/ui";
import { Pill } from "../components/Pill";
import { AccordionTitle } from "../components/AccordionTitle";
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

export const Agencies = () => {
  useEffect(() => {
    document.title = "Agencies";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [deletingContract, setDeletingContract] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [clientFilters, setClientFilters] = useFilterParams();
  const { leftValue, rightValue, onLeftChange, onRightChange } =
    useDualAccordionParams();

  const {
    items: clients,
    loading,
    refresh,
    totalPages,
    totalResults,
  } = usePaginatedRecords({
    indexName: "clients_name_desc",
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

  const getDisplayFields = (
    client: Record<string, unknown>,
  ): Array<{ label: string; value: string }> => {
    const skipFields = new Set([
      "id",
      "objectID",
      "metadata",
      "uploadedInFile",
      "importedByUid",
      "importedByAgencyId",
      "importedAt",
      "business_name",
      "sortableName",
    ]);
    const result: Array<{ label: string; value: string }> = [];
    for (const [key, value] of Object.entries(client)) {
      if (skipFields.has(key)) continue;
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        result.push({ label: key, value: String(value) });
      }
    }
    return result;
  };

  const handleDeleteSuccess = async () => {
    setTimeout(() => refresh(), 2000);
  };

  const onPrevPage = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const onNextPage = useCallback(
    () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    [totalPages],
  );
  const onGoToPage = useCallback((p: number) => setPage(p), []);
  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

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
                <div className="flex min-w-0 w-full items-center gap-2">
                  <AccordionTitle className="leading-none">
                    {getPrimaryLabel(client)}
                  </AccordionTitle>
                  {scName && (
                    <Pill
                      status="signed"
                      icon={<FileSignature className="h-4 w-4" />}
                      label=""
                    />
                  )}
                </div>
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
              <div className="overflow-x-auto">
                <div className="w-max grid grid-rows-[repeat(6,auto)] grid-flow-col auto-cols-min gap-x-6 gap-y-1 text-xs sm:text-sm text-zinc-600">
                  {getDisplayFields(client).map((field, idx) => (
                    <p
                      key={field.label}
                      className="whitespace-nowrap px-1 animate-cascade"
                      style={
                        {
                          animationDelay: `${idx * 12}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        {field.label}
                      </span>
                      : {field.value}
                    </p>
                  ))}
                </div>
              </div>
              {scName && scUrl && (
                <DeleteButton
                  className="mt-2 animate-cascade"
                  style={{ animationDelay: "12ms" }}
                  disabled={deletingContract}
                  onClick={() => setConfirmDeleteClient(client)}
                />
              )}
            </AccordionItem>
          );
        }}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onGoToPage={onGoToPage}
        onPageSizeChange={onPageSizeChange}
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

      <DialogRoot
        open={confirmDeleteClient !== null}
        onOpenChange={(open) => {
          if (!open && !deletingContract) setConfirmDeleteClient(null);
        }}
      >
        <DialogContent
          closeDisabled={deletingContract}
          onClose={() => {
            if (!deletingContract) setConfirmDeleteClient(null);
          }}
        >
          <DialogTitle className="text-base sm:text-lg font-bold">
            Confirm Delete
          </DialogTitle>
          <p className="mt-2 text-xs sm:text-sm text-zinc-600">
            This will permanently delete the signed contract from storage. You
            will need to re-upload it.
          </p>
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deletingContract}
              onClick={() => void onDeleteContract()}
            >
              {deletingContract ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Deleting...
                </span>
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
};
