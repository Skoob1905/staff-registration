import { useCallback, useEffect, useMemo, useState } from "react";
import { addStaffTags, removeStaffTags } from "../services/firestore";
import { httpsCallable } from "firebase/functions";
import { FileText, Loader2, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AgenciesDropdown } from "../components/AgenciesDropdown";
import { FileInteractionButtons } from "../components/FileInteractionButtons";
import { ImportHistory } from "../components/ImportHistory";
import { Metadata } from "../components/Metadata";
import { Pill } from "../components/Pill";
import { StaffAccordionHeader } from "../components/StaffAccordionHeader";
import { ActionButtonContainer } from "../components/ActionButtonContainer";
import { AssignTags, AssignStaff } from "../components/modals";
import { RecordData } from "../components/RecordData";
import { cleanRecordData } from "../utils/cleanRecordData";
import { getTagName } from "../utils/getTagName";
import { StaffListSection } from "../components/StaffListSection";
import { useDualAccordionParams } from "../hooks/useDualAccordionParams";
import {
  AccordionAction,
  AccordionItem,
  ActionButton,
  Button,
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { useAppStore } from "../stores/appStore";
import { functions } from "../services/firebase";
import {
  getStaffName,
  getStaffNameFromRawRecord,
} from "../utils/keyHeaderNormalisation";
import { shouldShowSendLink } from "../utils/loginStatus";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { toast_mapper, ToastType } from "../config/toast";
import { Muted } from "../config/typography";
import type { Agency, BulkStaff } from "../types/domain";

export const Staff = () => {
  useEffect(() => {
    document.title = "Staff";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const tags = useAppStore((s) => s.tags);
  const addTag = useAppStore((s) => s.addTag);

  const { items: companies } = usePaginatedRecords({
    indexName: "agencies_name_desc",
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
  const [assignStaffTarget, setAssignStaffTarget] = useState<BulkStaff | null>(
    null,
  );
  const [unassignTarget, setUnassignTarget] = useState<BulkStaff | null>(null);
  const [unassignLoading, setUnassignLoading] = useState(false);
  const [tagTarget, setTagTarget] = useState<BulkStaff | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagLoading, setTagLoading] = useState(false);
  const [selectedAssignTagIds, setSelectedAssignTagIds] = useState<Set<string>>(
    new Set(),
  );
  const [deletingCvKey, setDeletingCvKey] = useState<string | null>(null);
  const [deleteStaffTarget, setDeleteStaffTarget] = useState<BulkStaff | null>(
    null,
  );
  const [deleteStaffLoading, setDeleteStaffLoading] = useState(false);
  const [deletingDocumentKey, setDeletingDocumentKey] = useState<string | null>(
    null,
  );
  const { leftValue, rightValue, onLeftChange, onRightChange } =
    useDualAccordionParams();

  useEffect(() => {
    if (tagTarget) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAssignTagIds(new Set(tagTarget.tags || []));
      setTagInput("");
    }
  }, [tagTarget]);

  const handleDeleteDocument = useCallback(
    async (staffId: string, fileName: string) => {
      const key = `${staffId}::${fileName}`;
      if (deletingDocumentKey) return;
      setDeletingDocumentKey(key);
      try {
        const callable = httpsCallable(functions, "deleteStaffDocument");
        await callable({ staffId, fileName });
        setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);
        toast({ title: "Document deleted" });
      } catch {
        toast({
          title: "Failed to delete document",
          variant: "error" as const,
        });
      } finally {
        setDeletingDocumentKey(null);
      }
    },
    [deletingDocumentKey, toast],
  );

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
        ops.push(addStaffTags(staffId, tagsToAdd));
      }
      if (tagsToRemove.length > 0) {
        ops.push(removeStaffTags(staffId, tagsToRemove));
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
    if (!unassignTarget) return;
    console.log("[Staff] handleUnassign called with:", {
      staffId: unassignTarget.id,
      assignedToName: unassignTarget.metadata?.assignedToName,
    });
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
  }, [unassignTarget, toast]);

  const handleAssign = useCallback(
    async (
      staffId: string,
      agencyId: string,
      agencyName?: string,
      staffName?: string,
    ) => {
      if (!agencyId) return;
      console.log("[Staff] handleAssign called with:", {
        staffId,
        agencyId,
        agencyName,
        staffName,
      });
      setAssigningStaffId(staffId);
      try {
        const callable = httpsCallable(functions, "assignStaffToAgency");
        await callable({ staffId, agencyId });
        setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);

        toast({
          title: "Assigned",
          description: `${staffName || staffId} has been assigned to ${agencyName || agencyId}`,
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
    [appUser?.agencyId, toast],
  );

  const handleDeleteStaff = useCallback(async () => {
    if (!deleteStaffTarget) return;
    setDeleteStaffLoading(true);
    try {
      const callable = httpsCallable(functions, "removeStaffMember");
      await callable({ staffId: deleteStaffTarget.id });
      setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);
      setDeleteStaffTarget(null);
      toast({
        title: "Deleted",
        description: `${getStaffName(deleteStaffTarget)} has been permanently deleted`,
        variant: "success",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete staff member.",
        variant: "error",
      });
    } finally {
      setDeleteStaffLoading(false);
    }
  }, [deleteStaffTarget, toast]);

  const handleDeleteSuccess = async () => {
    setTimeout(() => setStaffRefreshTrigger((n) => n + 1), 2000);
  };

  return (
    <div className="mx-auto space-y-4">
      <StaffListSection
        refreshTrigger={staffRefreshTrigger}
        agencies={companies as unknown as Agency[]}
        leftAccordionValue={leftValue}
        onLeftAccordionChange={onLeftChange}
        rightAccordionValue={rightValue}
        onRightAccordionChange={onRightChange}
        renderItem={(member, idx) => (
          <AccordionItem
            key={member.id}
            value={member.id}
            className="animate-cascade"
            style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
            title={
              <StaffAccordionHeader
                name={getStaffName(member)}
                loginStatus={member.metadata?.loginStatus}
              >
                {member.metadata?.cv && member.metadata.cv.length > 0 && (
                  <Pill
                    status="cv"
                    icon={<FileText className="h-4 w-4" />}
                    label=""
                  />
                )}
                {member.metadata?.payslipsSent &&
                  member.metadata.payslipsSent.length > 0 && (
                    <Pill
                      status="payslip"
                      icon={<Receipt className="h-4 w-4" />}
                      count={member.metadata.payslipsSent.length}
                      onClick={() =>
                        navigate(`/payslips?page=1&open=${member.id}&name=${encodeURIComponent(getStaffName(member))}`)
                      }
                    />
                  )}
              </StaffAccordionHeader>
            }
            actions={
              member.metadata?.assignedToName ? (
                <AccordionAction>
                  {member.metadata.assignedToName}
                </AccordionAction>
              ) : null
            }
          >
            <div className="flex flex-col gap-0.5 mb-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="sm:hidden">
                <Metadata
                  title="Assigned to"
                  className="animate-cascade"
                  style={{ animationDelay: "0ms" }}
                  value={
                    member.metadata?.assignedToName ? (
                      <>
                        {member.metadata.assignedToName}
                        <ActionButton
                          variant="delete"
                          size="md"
                          ariaLabel="Unassign staff"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUnassignTarget(member);
                          }}
                          className="ml-1.5 align-middle"
                        />
                      </>
                    ) : appUser?.role === "super" ? (
                      <AgenciesDropdown
                        disabled={assigningStaffId === member.id}
                        value=""
                        onChange={(value, name) => {
                          if (value)
                            handleAssign(
                              member.id,
                              value,
                              name,
                              getStaffName(member),
                            );
                        }}
                        className="h-7 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-1.5 text-xs sm:text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
                        placeholder="Assign agency"
                      />
                    ) : null
                  }
                />
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Metadata
                  title="Tags"
                  className="animate-cascade"
                  style={{ animationDelay: "0ms" }}
                  value={
                    member.tags?.length
                      ? member.tags.map((id) => getTagName(tagsMap, id)).filter(Boolean).join(", ") || "None"
                      : "None"
                  }
                />
              </div>
            </div>
            {member.metadata?.cv && member.metadata.cv.length > 0 && (
              <div className="mb-2 flex flex-col gap-1 text-xs sm:text-sm">
                {member.metadata.cv.map((entry, idx) => {
                  const cvKey = `${member.id}::${entry.fileName}`;
                  const isDeleting = deletingCvKey === cvKey;
                  return (
                    <Metadata
                      key={cvKey}
                      title="CV"
                      className="flex items-center animate-cascade"
                      style={
                        {
                          animationDelay: `${(idx + 1) * 12}ms`,
                        } as React.CSSProperties
                      }
                      value={
                        <span className="inline-flex flex-wrap items-center gap-2 align-middle">
                          <span className="text-[var(--muted-foreground)]">
                            {entry.fileName}
                          </span>
                          <FileInteractionButtons
                            fileUrl={entry.fileUrl}
                            fileName={entry.fileName}
                            name={getStaffName(member)}
                            interactionKey="cv"
                            size="md"
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
            {Boolean((member.metadata as Record<string, unknown>)?.documents) &&
              (
                (member.metadata as Record<string, unknown>)
                  ?.documents as Record<string, unknown>[]
              )?.length > 0 && (
                <div className="mb-2 flex flex-col gap-1 text-xs sm:text-sm">
                  {(
                    (member.metadata as Record<string, unknown>)
                      ?.documents as Record<string, unknown>[]
                  )?.map((entry: Record<string, unknown>, idx: number) => {
                    const docKey = `${member.id}::${entry.fileName}`;
                    const isDeleting = deletingDocumentKey === docKey;
                    return (
                      <Metadata
                        key={docKey}
                        title="Document"
                        className="flex items-center animate-cascade"
                        style={
                          {
                            animationDelay: `${(idx + 1) * 12}ms`,
                          } as React.CSSProperties
                        }
                        value={
                          <span className="inline-flex flex-wrap items-center gap-2 align-middle">
                            <span className="text-[var(--muted-foreground)]">
                              {entry.fileName as string}
                            </span>
                            <FileInteractionButtons
                              fileUrl={entry.fileUrl as string}
                              fileName={entry.fileName as string}
                              name={getStaffName(member)}
                              interactionKey="document"
                              size="md"
                              onDelete={
                                isDeleting
                                  ? undefined
                                  : () =>
                                      handleDeleteDocument(
                                        member.id,
                                        entry.fileName as string,
                                      )
                              }
                            />
                            {Boolean(entry.uploadedAt) && (
                              <span className="text-zinc-400">
                                (
                                {new Date(
                                  entry.uploadedAt as string,
                                ).toLocaleDateString()}
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
            <RecordData
              data={cleanRecordData(
                member as unknown as Record<string, unknown>,
              )}
            />
            <ActionButtonContainer
              handleDelete={() => setDeleteStaffTarget(member)}
              handleUnassign={
                member.metadata?.assignedToName
                  ? () => {
                      setUnassignTarget(member);
                    }
                  : undefined
              }
              handleAssign={
                !member.metadata?.assignedToName
                  ? () => setAssignStaffTarget(member)
                  : undefined
              }
              handleTags={() => setTagTarget(member)}
              handleSendLink={
                member.email && shouldShowSendLink(member.metadata?.loginStatus)
                  ? async () => {
                      try {
                        const emailCallable = httpsCallable(functions, "sendImportEmails");
                        const result = await emailCallable({
                          emails: [member.email],
                          type: "worker",
                        });
                        const { queued } = result.data as { queued: number };
                        toast(toast_mapper[ToastType.EMAILS_QUEUED](queued));
                      } catch {
                        const sent = 0;
                        const failed = 1;
                        toast(toast_mapper[ToastType.EMAIL_FAILURE](sent, failed));
                      }
                    }
                  : undefined
              }
            />
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

      <AssignTags
        open={tagTarget !== null}
        onClose={() => {
          setTagTarget(null);
          setTagInput("");
        }}
        tagsMap={tagsMap}
        selectedIds={selectedAssignTagIds}
        onSelectionChange={setSelectedAssignTagIds}
        tagInput={tagInput}
        onTagInputChange={setTagInput}
        onSave={handleAssignTags}
        saving={tagLoading}
      />

      <DialogRoot
        open={deleteStaffTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteStaffLoading) setDeleteStaffTarget(null);
        }}
      >
        <DialogContent
          closeDisabled={deleteStaffLoading}
          onClose={() => {
            if (!deleteStaffLoading) setDeleteStaffTarget(null);
          }}
        >
          <DialogTitle className="text-base sm:text-lg font-bold">
            Delete Staff Member
          </DialogTitle>
          <Muted className="mt-2">
            Permanently delete{" "}
            <strong>
              {deleteStaffTarget ? getStaffName(deleteStaffTarget) : ""}
            </strong>
            ? This will also delete any associated user account.
          </Muted>
          <p className="mt-1 text-xs font-medium text-red-600">
            This action cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteStaffLoading}
              onClick={() => void handleDeleteStaff()}
            >
              {deleteStaffLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      <AssignStaff
        open={assignStaffTarget !== null}
        onClose={() => setAssignStaffTarget(null)}
        onAssign={(agencyId, agencyName) => {
          if (assignStaffTarget)
            handleAssign(
              assignStaffTarget.id,
              agencyId,
              agencyName,
              getStaffName(assignStaffTarget),
            );
          setAssignStaffTarget(null);
        }}
        saving={assigningStaffId !== null}
      />

      {appUser?.role === "super" && (
        <ImportHistory
          type="staff"
          cloudFunction="removeStaffImport"
          getPreviewNames={(rows) => rows.map(getStaffNameFromRawRecord)}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
};
