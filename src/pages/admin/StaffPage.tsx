import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Plus, X } from "lucide-react";
import {
  DialogRoot,
  DialogContent,
  DialogTitle,
} from "../../components/ui/dialog";
import { AddModal } from "../../components/AddModal";
import { ClientsDropdown } from "../../components/ClientsDropdown";
import { ImportHistory } from "../../components/ImportHistory";
import { FilterView } from "../../components/FilterView";
import {
  AccordionItem,
  AccordionRoot,
  Button,
  Input,
} from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { useToast } from "../../context/ToastProvider";
import { useAppStore } from "../../stores/appStore";
import { db, functions } from "../../services/firebase";
import { getCompanyName } from "../../utils/company";
import type { Agency, BulkStaff, StaffFilters } from "../../types/domain";
import { emptyFilters } from "../../types/domain";

export const AdminStaffPage = () => {
  useEffect(() => {
    document.title = "Staff";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filters, setFilters] = useState<StaffFilters>(emptyFilters);

  const staff = useAppStore((s) => s.staff);
  const agencies = useAppStore((s) => s.agencies);
  const companies = useAppStore((s) => s.clients);
  const tags = useAppStore((s) => s.tags);
  const loadStaff = useAppStore((s) => s.loadStaff);
  const loadAgencies = useAppStore((s) => s.loadAgencies);
  const loadClients = useAppStore((s) => s.loadClients);
  const loadTags = useAppStore((s) => s.loadTags);
  const addTag = useAppStore((s) => s.addTag);
  const updateStaffInStore = useAppStore((s) => s.updateStaffInStore);

  useEffect(() => {
    if (!appUser?.agencyId) return;
    loadStaff(appUser.agencyId).catch((err) => {
      console.error("Failed to load staff:", err);
      toast({
        title: "Error",
        description: "Failed to load staff. Check permissions.",
        variant: "error",
      });
    });
  }, [appUser?.agencyId, loadStaff, toast]);

  useEffect(() => {
    if (!appUser?.agencyId) return;
    loadAgencies(appUser.agencyId).catch((err) => {
      console.error("Failed to load agencies:", err);
    });
  }, [appUser?.agencyId, loadAgencies]);

  useEffect(() => {
    if (!appUser?.agencyId) return;
    loadClients(appUser.agencyId).catch((err) => {
      console.error("Failed to load clients:", err);
    });
  }, [appUser?.agencyId, loadClients]);

  useEffect(() => {
    loadTags().catch(() => {});
  }, [loadTags]);

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.value;
    }
    return map;
  }, [tags]);

  const staffWithFullName = useMemo(
    () =>
      staff
        .map((s) => ({
          ...s,
          fullName: [s.Title, s.Forename, s.Surname].filter(Boolean).join(" "),
        }))
        .sort((a, b) => (a.Forename || "").localeCompare(b.Forename || "")),
    [staff],
  );

  const existingNiKeys = useMemo(
    () =>
      new Set(
        staff
          .map((s) => {
            const r = s as unknown as Record<string, string>;
            const ni = (
              r["NI Number"] ||
              r.ni_number ||
              r.NI_Number ||
              r.NINO ||
              ""
            )
              .toLowerCase()
              .trim();
            return ni || "";
          })
          .filter(Boolean),
      ),
    [staff],
  );

  const [importHistoryVersion, setImportHistoryVersion] = useState(0);
  const [assigningStaffLoading, setAssigningStaffLoading] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<BulkStaff | null>(null);
  const [unassignLoading, setUnassignLoading] = useState(false);
  const [tagTarget, setTagTarget] = useState<BulkStaff | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagLoading, setTagLoading] = useState(false);
  const [selectedAssignTagIds, setSelectedAssignTagIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (tagTarget) {
      setSelectedAssignTagIds(new Set(tagTarget.tags || []));
      setTagInput("");
    }
  }, [tagTarget]);

  const handleAssignTags = useCallback(async () => {
    if (!tagTarget) return;
    setTagLoading(true);
    try {
      const staffId = tagTarget.id;
      const currentTags = new Set(tagTarget.tags || []);
      const selected = selectedAssignTagIds;
      const tagsToAdd = [...selected].filter((id) => !currentTags.has(id));
      const tagsToRemove = [...currentTags].filter((id) => !selected.has(id));

      const finalTagIds = new Set(tagTarget.tags || []);
      for (const id of tagsToRemove) finalTagIds.delete(id);

      const ops: Promise<unknown>[] = [];
      if (tagsToAdd.length > 0) {
        ops.push(
          updateDoc(doc(db, "staff", staffId), {
            tags: arrayUnion(...tagsToAdd),
          }),
        );
        for (const id of tagsToAdd) finalTagIds.add(id);
      }
      if (tagsToRemove.length > 0) {
        ops.push(
          updateDoc(doc(db, "staff", staffId), {
            tags: arrayRemove(...tagsToRemove),
          }),
        );
      }
      if (tagInput.trim()) {
        const callable = httpsCallable(functions, "addStaffTag");
        ops.push(
          callable({ staffId, tag: tagInput.trim() }).then((res) => {
            const data = res.data as { tagId: string; tagValue: string };
            finalTagIds.add(data.tagId);
            addTag({ id: data.tagId, value: data.tagValue });
          }),
        );
      }
      if (ops.length === 0) return;

      await Promise.all(ops);
      updateStaffInStore(staffId, { tags: Array.from(finalTagIds) });
      setTagInput("");
      setTagTarget(null);
      toast({
        title: "Tags updated",
        variant: "success",
      });
    } catch (err) {
      console.error("[StaffPage] failed to update tags:", err);
      toast({
        title: "Error",
        description: "Failed to update tags.",
        variant: "error",
      });
    } finally {
      setTagLoading(false);
    }
  }, [
    tagTarget,
    selectedAssignTagIds,
    tagInput,
    addTag,
    updateStaffInStore,
    toast,
  ]);

  const handleUnassign = useCallback(async () => {
    if (!unassignTarget || !appUser?.agencyId) return;
    setUnassignLoading(true);
    try {
      const callable = httpsCallable(functions, "unassignStaffFromAgency");
      await callable({ staffId: unassignTarget.id });
      updateStaffInStore(unassignTarget.id, {
        metadata: {
          assignedTo: undefined,
          assignedToId: undefined,
          assignedToName: undefined,
          assignedBy: undefined,
          assignedAt: undefined,
        },
      });
      setUnassignTarget(null);
      toast({
        title: "Unassigned",
        description: `${[unassignTarget.Title, unassignTarget.Forename, unassignTarget.Surname].filter(Boolean).join(" ")} has been unassigned`,
        variant: "success",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to unassign staff member.",
        variant: "error",
      });
    } finally {
      setUnassignLoading(false);
    }
  }, [unassignTarget, appUser?.agencyId, updateStaffInStore, toast]);

  const handleAssign = useCallback(
    async (staffId: string, assignedToId: string) => {
      if (!appUser?.agencyId) return;
      setAssigningStaffLoading(true);
      try {
        const staffMember = staff.find((s) => s.id === staffId);
        const agency = companies.find((a) => a.id === assignedToId);
        const assignedToName = agency ? getCompanyName(agency) : assignedToId;
        const callable = httpsCallable(functions, "assignStaffToAgency");
        await callable({ staffId, assignedToId, assignedToName });
        updateStaffInStore(staffId, {
          metadata: {
            assignedToId,
            assignedToName,
            assignedBy: appUser.email || appUser.uid,
            assignedAt: new Date(),
          },
        });
        toast({
          title: "Assigned",
          description: `${[staffMember?.Title, staffMember?.Forename, staffMember?.Surname].filter(Boolean).join(" ")} has now been assigned to ${assignedToName}`,
          variant: "success",
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to assign staff member.",
          variant: "error",
        });
      } finally {
        setAssigningStaffLoading(false);
      }
    },
    [appUser?.agencyId, staff, companies, updateStaffInStore, toast],
  );

  const handleDeleteSuccess = async () => {
    if (appUser?.agencyId) {
      await loadStaff(appUser.agencyId, true);
    }
  };

  const handleAddSuccess = async () => {
    if (appUser?.agencyId) {
      await Promise.all([
        loadClients(appUser.agencyId, true),
        loadStaff(appUser.agencyId, true),
      ]);
    }
    setImportHistoryVersion((v) => v + 1);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <FilterView
        title="Staff"
        items={staffWithFullName}
        filters={filters}
        onFiltersChange={setFilters}
        searchFields={["fullName", "Forename", "Surname", "email"]}
        tags={tagsMap}
        agencies={companies as unknown as Agency[]}
        enableNameFilter
        enableTagFilter
        enableAgencyFilter
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
      >
        {(filteredStaff): ReactNode => (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <AccordionRoot type="single" collapsible>
              {filteredStaff.map((member, idx) => (
                <AccordionItem
                  key={member.id}
                  value={member.id}
                  className="animate-cascade"
                  style={{ animationDelay: `${idx * 50}ms` } as React.CSSProperties}
                  title={
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium pr-4">
                        {[member.Title, member.Forename, member.Surname]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                    </div>
                  }
                  actions={
                    member.metadata?.assignedToName ? (
                      <span className="group hidden sm:inline-flex items-center text-xs sm:text-sm text-[var(--muted-foreground)] whitespace-nowrap">
                        <span className="transition-all duration-200 group-hover:mr-1">{member.metadata.assignedToName}</span>
                        <span className="overflow-hidden w-0 transition-all duration-200 group-hover:w-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnassignTarget(member);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-4 w-4 rounded-full bg-red-500 text-white inline-flex items-center justify-center hover:bg-red-600 shrink-0"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      </span>
                    ) : (
                      <span className="hidden sm:inline" onClick={(e) => e.stopPropagation()}>
                        <ClientsDropdown
                          disabled={assigningStaffLoading}
                          value=""
                          onChange={(value) => {
                            if (value) handleAssign(member.id, value);
                          }}
                          className="h-7 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-1.5 text-xs sm:text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
                          placeholder="Select client..."
                        />
                      </span>
                    )
                  }
                >
                  {(appUser?.role === "admin" || (member.tags?.length ?? 0) > 0) && (
                    <div className="flex gap-4 mb-2">
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="sm:hidden text-xs sm:text-sm text-[var(--muted-foreground)]">
                          <span className="font-semibold">Assigned To:</span>{" "}
                          {member.metadata?.assignedToName ? (
                            <>
                              {member.metadata.assignedToName}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUnassignTarget(member);
                                }}
                                className="ml-1.5 h-3.5 w-3.5 rounded-full bg-red-500 text-white inline-flex items-center justify-center hover:bg-red-600 transition shrink-0 align-middle"
                              >
                                <X className="h-2 w-2" />
                              </button>
                            </>
                          ) : appUser?.role === "admin" ? (
                            <ClientsDropdown
                              disabled={assigningStaffLoading}
                              value=""
                              onChange={(value) => {
                                if (value) handleAssign(member.id, value);
                              }}
                              className="h-7 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-1.5 text-xs sm:text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
                              placeholder="Select client..."
                            />
                          ) : null}
                        </div>
                        {member.tags && member.tags.length > 0 && (
                          <span className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                            <span className="font-semibold">Tags:</span>{" "}
                            {member.tags
                              .map((id) => tagsMap[id] || id)
                              .join(", ")}
                          </span>
                        )}
                      </div>
                      {appUser?.role === "admin" && (
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTagTarget(member);
                          }}
                          className="self-center h-6 rounded-lg px-2 text-[10px] shadow-none shrink-0"
                        >
                          Tags
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="max-h-[100px] overflow-y-auto columns-2 gap-x-4 text-xs sm:text-sm text-zinc-600">
                    {Object.entries(member)
                      .filter(
                        ([key, value]) =>
                          key !== "id" &&
                          key !== "metadata" &&
                          key !== "agencyId" &&
                          key !== "importedByAgencyId" &&
                          key !== "tags" &&
                          key !== "typeIds" &&
                          value !== "" &&
                          value !== null &&
                          value !== undefined,
                      )
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, value]) => (
                        <p key={key} className="truncate break-inside-avoid">
                          <span className="font-medium text-[var(--foreground)]">
                            {key}
                          </span>
                          <span className="font-medium">
                            : {String(value ?? "")}
                          </span>
                        </p>
                      ))}
                  </div>
                </AccordionItem>
              ))}
            </AccordionRoot>
          </div>
        )}
      </FilterView>

      <DialogRoot
        open={unassignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUnassignTarget(null);
        }}
      >
        <DialogContent onClose={() => setUnassignTarget(null)}>
          <DialogTitle className="text-base sm:text-lg font-bold">
            Unassign Staff
          </DialogTitle>
          <p className="mt-2 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Remove{" "}
            <strong>
              {[
                unassignTarget?.Title,
                unassignTarget?.Forename,
                unassignTarget?.Surname,
              ]
                .filter(Boolean)
                .join(" ")}
            </strong>{" "}
            from <strong>{unassignTarget?.metadata?.assignedToName}</strong>?
          </p>
          <p className="mt-1 text-xs font-medium text-amber-600">
            They will need to be reassigned and will disappear from the client's
            assigned staff page.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={unassignLoading}
              onClick={() => void handleUnassign()}
            >
              {unassignLoading ? "Removing..." : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={tagTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTagTarget(null);
            setTagInput("");
          }
        }}
      >
        <DialogContent
          onClose={() => {
            setTagTarget(null);
            setTagInput("");
          }}
        >
          <DialogTitle className="text-base sm:text-lg font-bold">
            Assign Tags
          </DialogTitle>
          <p className="mt-2 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Assigned tags will be visible to the client.
          </p>
          {Object.keys(tagsMap).length > 0 && (
            <div className="mt-4">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                Existing tags
              </label>
              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                {Object.entries(tagsMap).map(([id, value]) => (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssignTagIds.has(id)}
                      onChange={() => {
                        const next = new Set(selectedAssignTagIds);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        setSelectedAssignTagIds(next);
                      }}
                      className="rounded"
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              {Object.keys(tagsMap).length > 0
                ? "Or create a new tag"
                : "New tag"}
            </label>
            <Input
              placeholder="Enter tag name..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              disabled={tagLoading}
              onClick={() => void handleAssignTags()}
            >
              {tagLoading ? "Saving..." : "Assign Tags"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      <ImportHistory
        type="staff"
        cloudFunction="removeStaffImport"
        getPreviewNames={(rows) =>
          rows.map((r) => {
            const keys = Object.keys(r);
            const findKey = (...names: string[]) => {
              for (const name of names) {
                const match = keys.find(
                  (k) => k.toLowerCase() === name.toLowerCase(),
                );
                if (match) return r[match];
              }
              return "";
            };
            return (
              [
                findKey("title"),
                findKey("forename", "first_name", "firstname", "first name"),
                findKey("surname", "last_name", "lastname", "last name"),
              ]
                .filter(Boolean)
                .join(" ") ||
              findKey("email") ||
              "Unknown"
            );
          })
        }
        onDeleteSuccess={handleDeleteSuccess}
        version={importHistoryVersion}
      />

      <AddModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        cloudFunction="importStaffCsv"
        storagePath="staff_imports"
        itemLabel="staff"
        itemLabelPlural="staff"
        csvType="staff"
        duplicateKey="NI Number"
        existingKeys={existingNiKeys}
        clients={agencies}
        onSuccess={handleAddSuccess}
        confirmText={(count) => `Import ${count} staff`}
      />
    </div>
  );
};
