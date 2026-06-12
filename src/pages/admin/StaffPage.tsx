import { useCallback, useEffect, useMemo, useState } from "react";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { FileText, Loader2, Pen, Plus } from "lucide-react";
import { AddModal } from "../../components/AddModal";
import { ClientsDropdown } from "../../components/ClientsDropdown";
import { FileInteractionButtons } from "../../components/FileInteractionButtons";
import { ImportHistory } from "../../components/ImportHistory";
import { Metadata } from "../../components/Metadata";
import { StaffListSection } from "../../components/StaffListSection";
import {
  AccordionItem,
  ActionButton,
  Button,
  DialogContent,
  DialogRoot,
  DialogTitle,
  Input,
} from "../../components/ui";
import { useAuth } from "../../context/AuthProvider";
import { useToast } from "../../context/ToastProvider";
import { useAppStore } from "../../stores/appStore";
import { db, functions } from "../../services/firebase";
import { getCompanyName } from "../../utils/company";
import {
  getStaffName,
  getStaffNameFromRawRecord,
} from "../../utils/keyHeaderNormalisation";
import { usePaginatedRecords } from "../../hooks/usePaginatedRecords";
import { Muted } from "../../config/typography";
import type { Agency, BulkStaff } from "../../types/domain";

export const AdminStaffPage = () => {
  useEffect(() => {
    document.title = "Staff";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);

  const tags = useAppStore((s) => s.tags);
  const addTag = useAppStore((s) => s.addTag);

  const { items: companies } = usePaginatedRecords({
    indexName: "clients_name_desc",
    agencyId: appUser?.agencyId ?? "",
    facetFilters: undefined,
    hitsPerPage: 1000,
  });

  const [staffRefreshTrigger, setStaffRefreshTrigger] = useState(0);

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.value;
    }
    return map;
  }, [tags]);

  const [assigningStaffId, setAssigningStaffId] = useState<string | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<BulkStaff | null>(null);
  const [activeAssignMenu, setActiveAssignMenu] = useState<string | null>(null);
  const [unassignLoading, setUnassignLoading] = useState(false);
  const [tagTarget, setTagTarget] = useState<BulkStaff | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagLoading, setTagLoading] = useState(false);
  const [selectedAssignTagIds, setSelectedAssignTagIds] = useState<Set<string>>(
    new Set(),
  );
  const [deletingCvKey, setDeletingCvKey] = useState<string | null>(null);

  useEffect(() => {
    if (tagTarget) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAssignTagIds(new Set(tagTarget.tags || []));
      setTagInput("");
    }
  }, [tagTarget]);

  const handleDeleteCv = useCallback(
    async (staffId: string, fileName: string) => {
      const key = `${staffId}::${fileName}`;
      if (deletingCvKey) return;
      setDeletingCvKey(key);
      try {
        const callable = httpsCallable(functions, "deleteStaffCv");
        await callable({ staffId, fileName });
        setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);
        toast({ title: "CV deleted" });
      } catch {
        toast({ title: "Failed to delete CV", variant: "error" as const });
      } finally {
        setDeletingCvKey(null);
      }
    },
    [deletingCvKey, toast],
  );

  const handleAssignTags = useCallback(async () => {
    if (!tagTarget) return;
    setTagLoading(true);
    try {
      const staffId = tagTarget.id;
      const currentTags = new Set(tagTarget.tags || []);
      const selected = selectedAssignTagIds;
      const tagsToAdd = [...selected].filter((id) => !currentTags.has(id));
      const tagsToRemove = [...currentTags].filter((id) => !selected.has(id));

      const ops: Promise<unknown>[] = [];
      if (tagsToAdd.length > 0) {
        ops.push(
          updateDoc(doc(db, "staff", staffId), {
            tags: arrayUnion(...tagsToAdd),
          }),
        );
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
            addTag({ id: data.tagId, value: data.tagValue });
          }),
        );
      }
      if (ops.length === 0) return;

      await Promise.all(ops);
      setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);
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
  }, [tagTarget, selectedAssignTagIds, tagInput, addTag, toast]);

  const handleUnassign = useCallback(async () => {
    if (!unassignTarget || !appUser?.agencyId) return;
    setUnassignLoading(true);
    try {
      const callable = httpsCallable(functions, "unassignStaffFromAgency");
      await callable({ staffId: unassignTarget.id });
      setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);
      setUnassignTarget(null);
      toast({
        title: "Unassigned",
        description: `${getStaffName(unassignTarget)} has been unassigned`,
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
  }, [unassignTarget, appUser?.agencyId, toast]);

  const handleAssign = useCallback(
    async (staffId: string, assignedToId: string) => {
      if (!appUser?.agencyId) return;
      setAssigningStaffId(staffId);
      try {
        const agency = companies.find((a) => a.id === assignedToId);
        const assignedToName = agency ? getCompanyName(agency) : assignedToId;
        const callable = httpsCallable(functions, "assignStaffToAgency");
        await callable({ staffId, assignedToId, assignedToName });
        setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);
        toast({
          title: "Assigned",
          description: `Staff member has been assigned to ${assignedToName}`,
          variant: "success",
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to assign staff member.",
          variant: "error",
        });
      } finally {
        setAssigningStaffId(null);
      }
    },
    [appUser?.agencyId, companies, toast],
  );

  const handleDeleteSuccess = async () => {
    setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);
  };

  const handleAddSuccess = async () => {
    setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);
  };

  return (
    <div className="mx-auto space-y-4">
      <StaffListSection
        view="admin"
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
        refreshTrigger={staffRefreshTrigger}
        agencies={companies as unknown as Agency[]}
        renderItem={(member, idx) => (
          <AccordionItem
            key={member.id}
            value={member.id}
            className="animate-cascade"
            style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
            title={
              <div className="flex flex-col min-w-0">
                <span className="font-medium flex items-center gap-2">
                  {getStaffName(member)}
                  {member.metadata?.cv && member.metadata.cv.length > 0 && (
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 shrink-0">
                      <FileText className="h-3 w-3 text-blue-600" />
                    </span>
                  )}
                </span>
              </div>
            }
            actions={
              <>
                {member.metadata?.assignedToName ? (
                  <span className="group inline-flex shrink-0 items-center text-xs sm:text-sm text-[var(--muted-foreground)]">
                    <span className="truncate max-w-[200px] transition-all duration-200 group-hover:mr-1">
                      {member.metadata.assignedToName}
                    </span>
                    <span className="hidden overflow-hidden w-0 transition-all duration-200 group-hover:w-4 sm:inline-flex">
                      <ActionButton
                        variant="delete"
                        size="sm"
                        ariaLabel="Unassign staff"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUnassignTarget(member);
                        }}
                        className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      />
                    </span>
                  </span>
                ) : (
                  <span
                    className="hidden sm:inline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {activeAssignMenu === member.id ? (
                      <ClientsDropdown
                        disabled={assigningStaffId === member.id}
                        value=""
                        onChange={(value) => {
                          if (value) handleAssign(member.id, value);
                          setActiveAssignMenu(null);
                        }}
                        className="h-7 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-1.5 text-xs sm:text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
                        placeholder="Select client..."
                        autoFocus
                        onBlur={() => setActiveAssignMenu(null)}
                      />
                    ) : assigningStaffId === member.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--muted-foreground)]" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveAssignMenu(member.id)}
                        className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
                      >
                        <Pen className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                )}
              </>
            }
          >
            {(appUser?.role === "admin" || (member.tags?.length ?? 0) > 0) && (
              <div className="flex flex-col gap-0.5 mb-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="sm:hidden">
                  <Metadata
                    title="Assigned to"
                    value={
                      member.metadata?.assignedToName ? (
                        <>
                          {member.metadata.assignedToName}
                          <ActionButton
                            variant="delete"
                            size="xs"
                            ariaLabel="Unassign staff"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnassignTarget(member);
                            }}
                            className="ml-1.5 align-middle"
                          />
                        </>
                      ) : appUser?.role === "admin" ? (
                        <ClientsDropdown
                          disabled={assigningStaffId === member.id}
                          value=""
                          onChange={(value) => {
                            if (value) handleAssign(member.id, value);
                          }}
                          className="h-7 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-1.5 text-xs sm:text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
                          placeholder="Select client..."
                        />
                      ) : null
                    }
                  />
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Metadata
                    title="Tags"
                    value={
                      member.tags && member.tags.length > 0
                        ? member.tags.map((id) => tagsMap[id] || id).join(", ")
                        : ""
                    }
                  />
                  {appUser?.role === "admin" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTagTarget(member);
                      }}
                      className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
                    >
                      <Pen className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            {member.metadata?.cv && member.metadata.cv.length > 0 && (
              <div className="mb-2 flex flex-col gap-1 text-xs sm:text-sm">
                {member.metadata.cv.map((entry) => {
                  const cvKey = `${member.id}::${entry.fileName}`;
                  const isDeleting = deletingCvKey === cvKey;
                  return (
                    <Metadata
                      key={cvKey}
                      title="CV"
                      className="flex items-center"
                      value={
                        <span className="inline-flex flex-wrap items-center gap-2 align-middle">
                          <span className="text-[var(--muted-foreground)]">
                            {entry.fileName}
                          </span>
                          <FileInteractionButtons
                            fileUrl={entry.fileUrl}
                            fileName={entry.fileName}
                            interactionKey="cv"
                            size="sm"
                            onDelete={
                              isDeleting
                                ? undefined
                                : () =>
                                    handleDeleteCv(member.id, entry.fileName)
                            }
                          />
                          {entry.uploadedAt && (
                            <span className="text-zinc-400">
                              ({new Date(entry.uploadedAt).toLocaleDateString()}
                              )
                            </span>
                          )}
                          {isDeleting && (
                            <Loader2 className="h-3 w-3 animate-spin text-[var(--muted-foreground)]" />
                          )}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )}
            <div className="max-h-[100px] overflow-y-auto overflow-x-auto grid grid-rows-[repeat(6,auto)] grid-flow-col auto-cols-fr gap-x-6 gap-y-1 text-xs sm:text-sm text-zinc-600">
              {Object.entries(member)
                .filter(
                  ([key, value]) =>
                    key !== "id" &&
                    key !== "uid" &&
                    key !== "metadata" &&
                    key !== "agencyId" &&
                    key !== "importedByAgencyId" &&
                    key !== "tags" &&
                    key !== "typeIds" &&
                    key !== "sortableName" &&
                    value !== "" &&
                    value !== null &&
                    value !== undefined,
                )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => (
                  <p key={key} className="truncate px-1">
                    <span className="font-medium text-[var(--foreground)]">
                      {key}
                    </span>
                    <span className="font-medium">: {String(value ?? "")}</span>
                  </p>
                ))}
            </div>
          </AccordionItem>
        )}
      />

      <DialogRoot
        open={unassignTarget !== null}
        onOpenChange={(open) => {
          if (!open && !unassignLoading) setUnassignTarget(null);
        }}
      >
        <DialogContent
          closeDisabled={unassignLoading}
          onClose={() => {
            if (!unassignLoading) setUnassignTarget(null);
          }}
        >
          <DialogTitle className="text-base sm:text-lg font-bold">
            Unassign Staff
          </DialogTitle>
          <Muted className="mt-2">
            Remove{" "}
            <strong>
              {unassignTarget ? getStaffName(unassignTarget) : ""}
            </strong>{" "}
            from <strong>{unassignTarget?.metadata?.assignedToName}</strong>?
          </Muted>
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
              {unassignLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Removing...
                </span>
              ) : (
                "Remove"
              )}
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
          <Muted className="mt-1">
            Assigned tags will be visible to the client.
          </Muted>
          {Object.keys(tagsMap).length > 0 && (
            <div className="mt-4">
              <label className="text-sm sm:text-base font-semibold text-[var(--foreground)]">
                Existing tags
              </label>
              <div className="mt-1 max-h-40 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 overflow-y-auto">
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
                      className="rounded shrink-0"
                    />
                    <span className="truncate">{value}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4">
            <label className="text-sm sm:text-base font-semibold text-[var(--foreground)]">
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
        getPreviewNames={(rows) => rows.map(getStaffNameFromRawRecord)}
        onDeleteSuccess={handleDeleteSuccess}
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
        onSuccess={handleAddSuccess}
        confirmText={(count) => `Import ${count} staff`}
      />
    </div>
  );
};
