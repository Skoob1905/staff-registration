import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AddModal } from "../../components/AddModal";
import { ImportHistory } from "../../components/ImportHistory";
import { AccordionItem, Button } from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { findValueByNormalizedKey } from "../../utils/keyHeaderNormalisation";
import { PaginatedFilterSection } from "../../components/PaginatedFilterSection";
import { usePaginatedRecords } from "../../hooks/usePaginatedRecords";
import type { StaffFilters } from "../../types/domain";
import { emptyFilters } from "../../types/domain";

export const AdminClientsPage = () => {
  useEffect(() => {
    document.title = "Clients";
  }, []);

  const { appUser } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [clientFilters, setClientFilters] =
    useState<StaffFilters>(emptyFilters);

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

  const handleAddSuccess = async () => {
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

  return (
    <div className="mx-auto space-y-4">
      <PaginatedFilterSection
        title="Clients"
        items={clients}
        loading={loading}
        totalResults={totalResults}
        renderItem={(client, idx) => (
          <AccordionItem
            key={client.id as string}
            value={client.id as string}
            className="animate-cascade"
            style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
            title={
              <div className="flex min-w-0 w-full items-center gap-2">
                <span className="truncate pr-4">{getPrimaryLabel(client)}</span>
              </div>
            }
          >
            <div className="max-h-[100px] overflow-y-auto columns-2 gap-x-4 text-xs sm:text-sm text-zinc-600">
              {getDisplayFields(client).map((field) => (
                <p key={field.label} className="truncate break-inside-avoid">
                  <span className="font-medium text-[var(--foreground)]">
                    {field.label}
                  </span>
                  : {field.value}
                </p>
              ))}
            </div>
          </AccordionItem>
        )}
        action={
          <Button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        }
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onGoToPage={onGoToPage}
        onPageSizeChange={onPageSizeChange}
        filters={clientFilters}
        onFiltersChange={setClientFilters}
        enableNameFilter
        enableTagFilter={false}
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
        onOpenChange={setShowAddModal}
        cloudFunction="importAgencyCsv"
        storagePath="agency_imports"
        itemLabel="client"
        itemLabelPlural="clients"
        csvType="agency"
        duplicateKey="business_name"
        onSuccess={handleAddSuccess}
        confirmText={(count) =>
          `Import ${count} client${count !== 1 ? "s" : ""}`
        }
      />
    </div>
  );
};
