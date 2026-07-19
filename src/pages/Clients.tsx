import { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { FileSignature } from "lucide-react";
import { AssignAgenciesModal, DeleteClientModal } from "../components/modals";
import { ImportHistory } from "../components/ImportHistory";
import { AccordionItem, DownloadButton } from "../components/ui";
import { Pill } from "../components/Pill";
import { AgencyPill } from "../components/Pills/AgencyPill";
import { StaffAccordionHeader } from "../components/StaffAccordionHeader";
import { ActionButtonContainer } from "../components/ActionButtonContainer";
import { RecordData } from "../components/RecordData";
import { cleanRecordData } from "../utils/cleanRecordData";
import { Metadata } from "../components/Metadata";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";
import { getCompanyName } from "../utils/company";
import { functions } from "../services/firebase";
import { toDate } from "../utils/date";
import { PaginatedFilterSection } from "../components/PaginatedFilterSection";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { useFilterParams } from "../hooks/useFilterParams";
import { useDualAccordionParams } from "../hooks/useDualAccordionParams";
import { usePaginationParams } from "../hooks/usePaginationParams";

export const Clients = () => {
  useEffect(() => {
    document.title = "Clients";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [deletingContract, setDeletingContract] = useState(false);
  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const [clientFilters, setClientFilters] = useFilterParams();
  const { leftValue, rightValue, onLeftChange, onRightChange } =
    useDualAccordionParams();
  const [assignAgenciesTarget, setAssignAgenciesTarget] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<Set<string>>(
    new Set(),
  );
  const [assignAgenciesLoading, setAssignAgenciesLoading] = useState(false);

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

  const { items: agencies } = usePaginatedRecords({
    indexName: "agencies_name_desc",
    agencyId: appUser?.agencyId ?? "",
    hitsPerPage: 1000,
  });

  const agenciesMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of agencies) {
      map[a.id as string] = getCompanyName(a as Record<string, unknown>);
    }
    return map;
  }, [agencies]);

  const agencyItems = useMemo(
    () =>
      agencies.map((a) => ({
        id: a.id as string,
        name: getCompanyName(a as Record<string, unknown>),
      })),
    [agencies],
  );

  const openAssignAgencies = (client: Record<string, unknown>) => {
    const meta = client.metadata as Record<string, unknown> | undefined;
    const ids = (meta?.assignedAgencies as string[] | undefined) ?? [];
    setSelectedAgencyIds(new Set(ids));
    setAssignAgenciesTarget(client);
  };

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

  const handleAssignAgencies = useCallback(async () => {
    if (!assignAgenciesTarget) return;
    setAssignAgenciesLoading(true);
    try {
      const callable = httpsCallable(functions, "assignAgencyToClient");
      await callable({
        clientId: assignAgenciesTarget.id as string,
        assignedAgencyIds: [...selectedAgencyIds],
      });
      setTimeout(() => refresh(), 2000);
      setAssignAgenciesTarget(null);
      toast({
        title: "Agencies updated",
        description: "Assigned agencies have been saved.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to assign agencies.",
        variant: "error",
      });
    } finally {
      setAssignAgenciesLoading(false);
    }
  }, [assignAgenciesTarget, selectedAgencyIds, toast]);

  const handleClientFiltersChange = useCallback(
    (filters: typeof clientFilters) => {
      setPage(0);
      setClientFilters(filters);
    },
    [setClientFilters, setPage],
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
        title="Clients"
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
                  <AgencyPill record={client} />
                  {scName && (
                    <Pill
                      status="signed"
                      icon={<FileSignature className="h-4 w-4" />}
                      label=""
                    />
                  )}
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
              {(appUser?.role === "super" || Boolean(meta?.assignedAgencies)) && (
                <div className="flex items-center gap-2 mb-2">
                  <Metadata
                    title="Agencies"
                    className="animate-cascade"
                    style={{ animationDelay: "0ms" }}
                    value={
                      meta?.assignedAgencies
                        ? (meta.assignedAgencies as string[])
                            .map((id: string) => agenciesMap[id] || id)
                            .join(", ")
                        : "None"
                    }
                  />
                </div>
              )}
              <RecordData data={cleanRecordData(client)} />
              <ActionButtonContainer
                handleAgencies={() => openAssignAgencies(client)}
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
        type="client"
        cloudFunction="removeClients"
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

      <DeleteClientModal
        open={confirmDeleteClient !== null}
        onClose={() => setConfirmDeleteClient(null)}
        onDelete={onDeleteContract}
        deleting={deletingContract}
        clientName={
          confirmDeleteClient ? getPrimaryLabel(confirmDeleteClient) : ""
        }
      />

      <AssignAgenciesModal
        open={assignAgenciesTarget !== null}
        onClose={() => setAssignAgenciesTarget(null)}
        items={agencyItems}
        selectedIds={selectedAgencyIds}
        onSelectionChange={setSelectedAgencyIds}
        onSave={() => void handleAssignAgencies()}
        saving={assignAgenciesLoading}
      />
    </div>
  );
};
