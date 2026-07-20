import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Plus } from "lucide-react";
import {
  AccordionAction,
  AccordionItem,
  Button,
  DeleteButton,
  DialogContent,
  DialogRoot,
  DialogTitle,
  Input,
  Label,
} from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { useToast } from "../context/ToastProvider";
import { ClientsDropdown } from "../components/ClientsDropdown";
import { Metadata } from "../components/Metadata";
import { useAppStore } from "../stores/appStore";
import { functions } from "../services/firebase";
import { formatInvitedAt } from "../utils/date";
import { getCompanyName } from "../utils/company";
import { Muted } from "../config/typography";
import { config } from "../config";
import { AccordionTitle } from "../components/AccordionTitle";
import { PaginatedFilterSection } from "../components/PaginatedFilterSection";
import { useDualAccordionParams } from "../hooks/useDualAccordionParams";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { useFilterParams } from "../hooks/useFilterParams";
import { usePaginationParams } from "../hooks/usePaginationParams";
import {
  buildFacetFilters,
  buildFacetRequestFields,
} from "../utils/loginsFilter";
import {
  type Agency,
  type FilterKeyMap,
} from "../types/domain";

const STATUS_COLOR: Record<string, string> = {
  awaiting_login: "bg-amber-400",
  password_set: "bg-blue-400",
  logged_in: "bg-emerald-400",
};

export const Users = () => {
  useEffect(() => {
    document.title = "Users";
  }, []);

  const { appUser } = useAuth();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (deleteLoading) {
      deleteTimerRef.current = setTimeout(() => {
        toast({
          title: "Still deleting...",
          variant: "info",
          replaceToast: true,
        });
      }, 8000);
    }
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = null;
      }
    };
  }, [deleteLoading, toast]);

  const companyCache = useAppStore((s) => s.companyCache);
  const admins = useAppStore((s) => s.admins);
  const loadAdmins = useAppStore((s) => s.loadAdmins);
  const fetchCompanyById = useAppStore((s) => s.fetchCompanyById);

  const { items: companies } = usePaginatedRecords({
    indexName: "clients_name_desc",
    agencyId: appUser?.agencyId ?? "",
    hitsPerPage: 1000,
  });

  const [loginsFilters, setLoginsFilters] = useFilterParams();
  const { page: loginsPage, pageSize: loginsPageSize, setPage: setLoginsPage, setPageSize: setLoginsPageSize } = usePaginationParams(50);
  const { leftValue, rightValue, onLeftChange, onRightChange } = useDualAccordionParams();

  const loginsKeyMap = useMemo<FilterKeyMap>(
    () => ({ tag: "tags", agency: "assignedTo" }),
    [],
  );

  const loginsFacetFilters = useMemo(
    () => buildFacetFilters(loginsFilters, loginsKeyMap),
    [loginsFilters, loginsKeyMap],
  );

  const loginsFacets = useMemo(
    () => buildFacetRequestFields(loginsKeyMap),
    [loginsKeyMap],
  );

  const {
    items: logins,
    loading: loginsLoading,
    totalPages: loginsTotalPages,
    totalResults: loginsTotalResults,
    facetCounts: loginsFacetCounts,
    refresh: refreshLogins,
  } = usePaginatedRecords({
    indexName: "logins_email_desc",
    agencyId: appUser?.agencyId ?? "",
    facetFilters: loginsFacetFilters,
    query: loginsFilters.name,
    page: loginsPage,
    hitsPerPage: loginsPageSize,
    facets: loginsFacets,
  });

  const loginsAgencyCounts = loginsFacetCounts?.assignedTo;
  const filteredLoginsAgencies = useMemo(() => {
    if (!loginsAgencyCounts) return companies;
    return companies.filter(
      (a) => (loginsAgencyCounts[a.id as string] ?? 0) > 0,
    );
  }, [loginsAgencyCounts, companies]);

  const fetchMissingCompanies = useCallback(async () => {
    if (!appUser?.agencyId) return;
    const cached = [...companies, ...Object.values(companyCache)];
    const missingIds = logins
      .map(
        (u) =>
          (u as { assignedTo?: string; agencyId?: string }).assignedTo ||
          (u as { assignedTo?: string; agencyId?: string }).agencyId,
      )
      .filter((id): id is string => !!id && !cached.some((c) => c.id === id));
    if (missingIds.length > 0) {
      await Promise.all(missingIds.map((id) => fetchCompanyById(id)));
    }
  }, [appUser?.agencyId, fetchCompanyById, companies, companyCache, logins]);

  useEffect(() => {
    if (appUser?.agencyId) loadAdmins(appUser.agencyId);
  }, [appUser?.agencyId, loadAdmins]);

  useEffect(() => {
    void fetchMissingCompanies();
  }, [logins, fetchMissingCompanies]);

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
      await assignFn({
        email: email.trim().toLowerCase(),
        agencyDocId: selectedCompanyId,
        continueUrl: window.location.origin + "/login",
        companyName: config.name,
      });

      setTimeout(() => refreshLogins(), 2000);

      toast({
        title: "Login created",
        description: `${email.trim().toLowerCase()} has been sent a request to login.`,
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
      setTimeout(() => refreshLogins(), 2000);
      setDeleteTarget(null);
      const revokedEmail = (deleteTarget as { email?: string })?.email || uid;
      toast({
        title: "Login removed",
        description: `${revokedEmail} has been revoked.`,
        replaceToast: true,
      });
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "Could not remove login.";
      toast({
        title: "Remove failed",
        description: message,
        variant: "error",
        replaceToast: true,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLoginsFiltersChange = useCallback(
    (filters: typeof loginsFilters) => {
      setLoginsPage(0);
      setLoginsFilters(filters);
    },
    [setLoginsFilters, setLoginsPage],
  );

  return (
    <div className="mx-auto space-y-4">
      <PaginatedFilterSection
        title="Users"
        items={logins}
        loading={loginsLoading}
        page={loginsPage}
        totalPages={loginsTotalPages}
        totalResults={loginsTotalResults}
        pageSize={loginsPageSize}
        onPrevPage={() => setLoginsPage(Math.max(0, loginsPage - 1))}
        onNextPage={() => setLoginsPage(loginsPage + 1)}
        onGoToPage={setLoginsPage}
        onPageSizeChange={setLoginsPageSize}
        filterKeys={loginsKeyMap}
        filters={loginsFilters}
        onFiltersChange={handleLoginsFiltersChange}
        enableAgencyFilter
        enableTagFilter={false}
        agencies={filteredLoginsAgencies as unknown as Agency[]}
        agencyCounts={loginsAgencyCounts}
        leftAccordionValue={leftValue}
        onLeftAccordionChange={onLeftChange}
        rightAccordionValue={rightValue}
        onRightAccordionChange={onRightChange}
        emptyMessage="No users created yet."
        action={
          <Button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            New Login
          </Button>
        }
        renderItem={(user, idx) => {
          const userRecord = user as {
            id: string;
            email?: string;
            assignedTo?: string;
            agencyId?: string;
            invitedByUid?: string;
            invitedAt?: unknown;
            loginStatus?: string;
          };
          const companyId = userRecord.assignedTo || userRecord.agencyId;
          const company = companyId
            ? companies.find((c) => c.id === companyId) ||
              companyCache[companyId]
            : undefined;
          const companyName = company ? getCompanyName(company) : "Unknown";
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
                <div className="flex min-w-0 items-center gap-2">
                  {userRecord.loginStatus && (
                    <span
                      className={`inline-block w-1 h-4 rounded-full shrink-0 ${STATUS_COLOR[userRecord.loginStatus] ?? "bg-gray-300"}`}
                      title={userRecord.loginStatus.replace(/_/g, " ")}
                    />
                  )}
                  <AccordionTitle className="pr-4">
                    {userRecord.email || userRecord.id}
                  </AccordionTitle>
                </div>
              }
              actions={
                <AccordionAction>{companyName}</AccordionAction>
              }
            >
              <div>
                <Metadata
                  title="Invited by"
                  className="animate-cascade"
                  style={{ animationDelay: "0ms" }}
                  value={
                    <>
                      {invitedByEmail} at{" "}
                      {formatInvitedAt(userRecord.invitedAt)}
                    </>
                  }
                />
              </div>
              <DeleteButton
                className="mt-2 animate-cascade"
                style={{ animationDelay: "12ms" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(user);
                }}
              >
                Revoke
              </DeleteButton>
            </AccordionItem>
          );
        }}
      />

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
          <Muted className="mt-2">
            Remove login for{" "}
            <strong>
              {(deleteTarget as { email?: string })?.email ||
                (deleteTarget?.id as string) ||
                ""}
            </strong>
            ?
          </Muted>
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
          <Muted className="mt-1">
            Request a login for your client's email address
          </Muted>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="company">Client</Label>
              <ClientsDropdown
                id="company"
                value={selectedCompanyId}
                onChange={(id) => setSelectedCompanyId(id)}
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
