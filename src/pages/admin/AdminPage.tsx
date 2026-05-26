import { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Plus } from "lucide-react";
import {
  AccordionItem,
  AccordionRoot,
  Button,
  Card,
  Input,
  Label,
} from "../../components/ui";
import {
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "../../components/ui/dialog";
import { useAuth } from "../../context/AuthProvider";
import { useToast } from "../../context/ToastProvider";
import { ClientsDropdown } from "../../components/ClientsDropdown";
import { useAppStore } from "../../stores/appStore";
import { functions } from "../../services/firebase";
import { formatInvitedAt } from "../../utils/date";
import { getCompanyName } from "../../utils/company";

export const AdminPage = () => {
  useEffect(() => {
    document.title = "Users";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openUserId, setOpenUserId] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const companies = useAppStore((s) => s.clients);
  const companyCache = useAppStore((s) => s.companyCache);
  const logins = useAppStore((s) => s.logins);
  const loginsLoaded = useAppStore((s) => s.loginsLoaded);
  const loginsLoading = useAppStore((s) => s.loginsLoading);
  const admins = useAppStore((s) => s.admins);
  const loadLogins = useAppStore((s) => s.loadLogins);
  const loadAdmins = useAppStore((s) => s.loadAdmins);
  const fetchCompanyById = useAppStore((s) => s.fetchCompanyById);
  const addLogin = useAppStore((s) => s.addLogin);
  const removeLogin = useAppStore((s) => s.removeLogin);

  const loadData = useCallback(async () => {
    if (!appUser?.agencyId) return;
    await loadLogins(appUser.agencyId);
    if (!useAppStore.getState().loginsLoaded) {
      return;
    }

    const store = useAppStore.getState();
    const cached = [...store.clients, ...Object.values(store.companyCache)];
    const missingIds = store.logins
      .map(
        (u) =>
          (u as { assignedTo?: string; agencyId?: string }).assignedTo ||
          (u as { assignedTo?: string; agencyId?: string }).agencyId,
      )
      .filter((id): id is string => !!id && !cached.some((c) => c.id === id));
    if (missingIds.length > 0) {
      await Promise.all(missingIds.map((id) => fetchCompanyById(id)));
    }
  }, [appUser?.agencyId, loadLogins, fetchCompanyById]);

  useEffect(() => {
    if (appUser?.agencyId) loadAdmins(appUser.agencyId);
  }, [appUser?.agencyId, loadAdmins]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const adminEmailByUid = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of admins as Array<{
      id: string;
      email?: string;
      uid?: string;
    }>) {
      const email = (a as { email?: string }).email;
      if (!email) continue;
      map[a.id] = email;
      const uid = (a as { uid?: string }).uid;
      if (uid) map[uid] = email;
    }
    return map;
  }, [admins]);

  const resetModal = () => {
    setSelectedCompanyId("");
    setEmail("");
  };

  const handleCreateLogin = async () => {
    if (!appUser?.agencyId || !selectedCompanyId || !email.trim()) return;

    const company =
      companies.find((c) => c.id === selectedCompanyId) ||
      companyCache[selectedCompanyId];
    if (!company) return;

    setSubmitting(true);
    try {
      const assignFn = httpsCallable(functions, "assignClientLogin");
      const result = await assignFn({
        email: email.trim().toLowerCase(),
        agencyDocId: selectedCompanyId,
      });
      const createdId = (result.data as { ok: boolean; userId: string }).userId;

      addLogin({
        id: createdId,
        email: email.trim().toLowerCase(),
        role: "client",
        agencyId: selectedCompanyId,
        invitedByUid: appUser.uid,
        invitedAt: new Date(),
      });

      toast({
        title: "Login created",
        description: `${email.trim().toLowerCase()} has been sent a password reset link to be login.`,
      });

      setShowModal(false);
      resetModal();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Could not create login right now.";
      toast({
        title: "Create failed",
        description: message,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveLogin = async () => {
    const target = deleteTarget;
    if (!target) return;
    const uid = (target.id as string) || (target.uid as string) || "";
    if (!uid) {
      toast({
        title: "Cannot delete",
        description: "Missing user identifier.",
        variant: "error",
      });
      return;
    }
    setDeleteLoading(true);
    try {
      const removeFn = httpsCallable(functions, "removeClientLogin");
      await removeFn({ uid });
      removeLogin(uid);
      setDeleteTarget(null);
      const revokedEmail = (deleteTarget as { email?: string })?.email || uid;
      toast({
        title: "Login removed",
        description: `${revokedEmail} has been revoked.`,
      });
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Could not remove login.";
      toast({ title: "Remove failed", description: message, variant: "error" });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold">
            Users ({logins.length})
          </h2>
          <Button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            New Login
          </Button>
        </div>
        <div className="mt-1.5 sm:mt-3">
          {loginsLoading && !loginsLoaded ? (
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
              Loading...
            </p>
          ) : logins.length === 0 ? (
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
              No users created yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <AccordionRoot
                type="single"
                collapsible
                value={openUserId}
                onValueChange={setOpenUserId}
              >
                {logins.map((user, idx) => {
                  const userRecord = user as {
                    id: string;
                    email?: string;
                    assignedTo?: string;
                    agencyId?: string;
                    invitedByUid?: string;
                  };
                  const companyId =
                    userRecord.assignedTo || userRecord.agencyId;
                  const company = companyId
                    ? companies.find((c) => c.id === companyId) ||
                      companyCache[companyId]
                    : undefined;
                  const companyName = company
                    ? getCompanyName(company)
                    : "Unknown";
                  const invitedByEmail =
                    adminEmailByUid[userRecord.invitedByUid ?? ""] ||
                    userRecord.invitedByUid ||
                    "";
                  return (
                      <AccordionItem
                        key={userRecord.id}
                        value={userRecord.id}
                        className="animate-cascade"
                        style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
                        title={
                          <span className="truncate font-medium pr-4">
                            {userRecord.email || userRecord.id}
                          </span>
                        }
                        actions={
                          <span className="text-xs sm:text-sm font-medium text-[var(--muted-foreground)] whitespace-nowrap">
                            {companyName}
                          </span>
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs sm:text-sm text-zinc-600 truncate">
                            <span className="font-medium text-[var(--foreground)]">
                              Invited by:{" "}
                            </span>
                            {invitedByEmail} at{" "}
                            {formatInvitedAt(
                              (user as { invitedAt?: unknown }).invitedAt,
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(user);
                            }}
                            className="shrink-0 rounded-xl bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-[0_3px_10px_rgba(0,95,87,0.12)] transition hover:bg-red-700"
                          >
                            Revoke
                          </button>
                        </div>
                      </AccordionItem>
                  );
                })}
              </AccordionRoot>
            </div>
          )}
        </div>
      </Card>

      <DialogRoot
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent onClose={() => setDeleteTarget(null)}>
          <DialogTitle className="text-base sm:text-lg font-bold">
            Remove Login
          </DialogTitle>
          <p className="mt-2 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Remove login for{" "}
            <strong>
              {(deleteTarget as { email?: string })?.email ||
                (deleteTarget?.id as string) ||
                ""}
            </strong>
            ?
          </p>
          <p className="mt-1 text-xs font-medium text-amber-600">
            This will revoke their access. All assigned staff to this agency
            will not be removed. They will need a new login created to sign in
            again.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteLoading}
              onClick={() => void handleRemoveLogin()}
            >
              {deleteLoading ? "Removing..." : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      <DialogRoot
        open={showModal}
        onOpenChange={(open) => {
          if (!open) resetModal();
          setShowModal(open);
        }}
      >
        <DialogContent
          onClose={() => {
            resetModal();
            setShowModal(false);
          }}
        >
          <DialogTitle className="text-base sm:text-lg font-bold">
            Generate Login
          </DialogTitle>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Request a login for your client's email address
          </p>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="company">Client</Label>
              <ClientsDropdown
                id="company"
                value={selectedCompanyId}
                onChange={setSelectedCompanyId}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-xs sm:text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:bg-[var(--input-focus-bg)]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              disabled={!selectedCompanyId || !email.trim() || submitting}
              onClick={() => void handleCreateLogin()}
            >
              {submitting ? "Creating..." : "Create Login"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
};
