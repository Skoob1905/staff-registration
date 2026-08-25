import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { FileSignature } from "lucide-react";
import { AssignAgenciesModal, DeleteClientModal } from "../components/modals";
import { ImportHistory } from "../components/ImportHistory";
import { AccordionItem, DownloadButton } from "../components/ui";
import { Pill } from "../components/Pill";
import { AgencyPill } from "../components/Pills/AgencyPill";
import { StaffAccordionHeader } from "../views/Accordion";
import { ActionButtonContainer } from "../components/ActionButtonContainer";
import { RecordData } from "../components/RecordData";
import { cleanRecordData } from "../utils/cleanRecordData";
import { Metadata } from "../components/Metadata";
import { TableView } from "../views/Table";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";
import { getAgencyName } from "../utils/agency";
import { functions } from "../services/firebase";
import { toDate } from "../utils/date";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";

export const Clients = () => {
  useEffect(() => {
    document.title = "Clients";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "records";

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [deletingContract, setDeletingContract] = useState(false);
  const [assignAgenciesTarget, setAssignAgenciesTarget] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<Set<string>>(
    new Set(),
  );
  const [assignAgenciesLoading, setAssignAgenciesLoading] = useState(false);

  const { items: agencies } = usePaginatedRecords({
    indexName: "agencies_name_desc",
    agencyId: appUser?.agencyId ?? "",
    hitsPerPage: 1000,
  });

  const agencyItems = useMemo(
    () =>
      agencies.map((a) => ({
        id: a.id as string,
        name: getAgencyName(a as Record<string, unknown>),
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

  const handleRefresh = useCallback(
    () => setRefreshTrigger((n) => n + 1),
    [],
  );

  const handleAssignAgencies = useCallback(async () => {
    if (!assignAgenciesTarget) return;
    setAssignAgenciesLoading(true);
    try {
      const callable = httpsCallable(functions, "assignAgencyToClient");
      await callable({
        clientId: assignAgenciesTarget.id as string,
        assignedAgencyIds: [...selectedAgencyIds],
      });
      setTimeout(handleRefresh, 2000);
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
  }, [assignAgenciesTarget, selectedAgencyIds, toast, handleRefresh]);

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
      handleRefresh();
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
      {tab === "records" ? (
        <TableView<Record<string, unknown>>
          title="Clients"
          indexName="clients_name_desc"
          filterKeys={{ tag: "tags", agency: "metadata.uploadedBy" }}
          enableTagFilter={false}
          enableLoginStatusFilter={false}
          columnHeaders={["Business Name", "Email", "Agencies"]}
          refreshTrigger={refreshTrigger}
          renderItem={(client, idx) => {
            const meta = client.metadata as Record<string, unknown> | undefined;
            const scName = meta?.signedContractName as string | undefined;
            const scUrl = meta?.signedContract as string | undefined;
            const scDate = meta?.signedContractAt as string | number | undefined;
            return (
              <AccordionItem
                key={client.id as string}
                value={client.id as string}
                className="animate-cascade"
                style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
                columns={[
                  <span className="tabular-nums">{idx + 1}</span>,
                  <StaffAccordionHeader name={getPrimaryLabel(client)}>
                    {scName && (
                      <Pill
                        status="signed"
                        icon={<FileSignature className="h-4 w-4" />}
                        label=""
                      />
                    )}
                  </StaffAccordionHeader>,
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {(client.email as string) || "—"}
                  </span>,
                  <AgencyPill record={client} />,
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
                <RecordData data={cleanRecordData(client)} />
                <ActionButtonContainer
                  handleAgencies={() => openAssignAgencies(client)}
                  handleDelete={() => setConfirmDeleteClient(client)}
                />
              </AccordionItem>
            );
          }}
        />
      ) : (
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
          onDeleteSuccess={() => setTimeout(handleRefresh, 2000)}
        />
      )}

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
