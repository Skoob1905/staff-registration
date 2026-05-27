import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AddModal } from "../../components/AddModal";
import { ImportHistory } from "../../components/ImportHistory";
import {
  AccordionItem,
  AccordionRoot,
  Button,
  Card,
} from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { useAppStore, type AgencyDoc } from "../../stores/appStore";
import { findValueByNormalizedKey } from "../../utils/staff";

export const AdminClientsPage = () => {
  useEffect(() => {
    document.title = "Clients";
  }, []);

  const { appUser } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [openClientId, setOpenClientId] = useState<string | undefined>();
  const [importHistoryVersion, setImportHistoryVersion] = useState(0);

  const clients = useAppStore((s) => s.clients);
  const clientsLoading = useAppStore((s) => s.clientsLoading);
  const loadClients = useAppStore((s) => s.loadClients);
  const loadLogins = useAppStore((s) => s.loadLogins);

  useEffect(() => {
    if (!appUser?.agencyId) return;
    loadClients(appUser.agencyId);
  }, [appUser?.agencyId, loadClients]);

  const existingClientKeys = useMemo(
    () =>
      new Set(
        clients
          .map((c) => {
            const name = findValueByNormalizedKey(c as Record<string, unknown>, "businessname", "name", "agencyname", "organisation", "company") || "";
            return name.toLowerCase().trim();
          })
          .filter(Boolean),
      ),
    [clients],
  );

  const getPrimaryLabel = (client: AgencyDoc): string => {
    return (
      (client.business_name as string) ||
      (client.company_name as string) ||
      (client.name as string) ||
      (client.agencyName as string) ||
      findValueByNormalizedKey(client as Record<string, unknown>, "businessname", "name", "agencyname", "organisation", "company") ||
      "Unknown"
    );
  };

  const getDisplayFields = (
    client: AgencyDoc,
  ): Array<{ label: string; value: string }> => {
    const skipFields = new Set([
      "id",
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
    if (appUser?.agencyId) {
      await Promise.all([
        loadClients(appUser.agencyId, true),
        loadLogins(appUser.agencyId, true),
      ]);
    }
  };

  const handleAddSuccess = async () => {
    if (appUser?.agencyId) {
      await loadClients(appUser.agencyId, true);
    }
    setImportHistoryVersion((v) => v + 1);
  };

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        getPrimaryLabel(a).localeCompare(getPrimaryLabel(b)),
      ),
    [clients],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold">Clients ({clients.length})</h2>
          <Button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="mt-1.5 sm:mt-3">
          {clientsLoading ? (
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">Loading...</p>
          ) : clients.length === 0 ? (
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
              Add some clients now!
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <AccordionRoot
                type="single"
                collapsible
                value={openClientId}
                onValueChange={setOpenClientId}
              >
                {sortedClients.map((client, idx) => (
                  <AccordionItem
                    key={client.id}
                    value={client.id}
                    className="animate-cascade"
                    style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
                    title={
                      <div className="flex min-w-0 w-full items-center gap-2">
                        <span className="truncate pr-4">
                          {getPrimaryLabel(client)}
                        </span>
                      </div>
                    }
                  >
                    <div className="max-h-[100px] overflow-y-auto columns-2 gap-x-4 text-xs sm:text-sm text-zinc-600">
                      {getDisplayFields(client).map((field) => (
                        <p
                          key={field.label}
                          className="truncate break-inside-avoid"
                        >
                          <span className="font-medium text-[var(--foreground)]">
                            {field.label}
                          </span>
                          : {field.value}
                        </p>
                      ))}
                    </div>
                  </AccordionItem>
                ))}
              </AccordionRoot>
            </div>
          )}
        </div>
      </Card>

      <ImportHistory
        type="agency"
        cloudFunction="removeAgencies"
        getPreviewNames={(rows) =>
          rows.map(
            (r) =>
              r.business_name ||
              r.Company_Name ||
              r.company_name ||
              findValueByNormalizedKey(r, "businessname", "name", "agencyname", "organisation", "company") ||
              "Unknown",
          )
        }
        onDeleteSuccess={handleDeleteSuccess}
        version={importHistoryVersion}
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
        existingKeys={existingClientKeys}
        onSuccess={handleAddSuccess}
        confirmText={(count) =>
          `Import ${count} client${count !== 1 ? "s" : ""}`
        }
      />
    </div>
  );
};
