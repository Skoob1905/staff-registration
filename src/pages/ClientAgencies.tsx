import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSignature, Loader2 } from "lucide-react";
import { getUser, getClientByEmail } from "../services/firestore";
import { AccordionItem, DownloadButton } from "../components/ui";
import { Pill } from "../components/Pill";
import { AssignedStaff } from "../components/Pills/AssignedStaff";
import { StaffAccordionHeader } from "../views/Accordion";
import { Metadata } from "../components/Metadata";
import { RecordData } from "../components/RecordData";
import { cleanRecordData } from "../utils/cleanRecordData";
import { Muted } from "../config/typography";
import { PageTitle } from "../components/PageTitle";
import { useAuth } from "../context/AuthProvider";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";
import { toDate } from "../utils/date";
import { PaginatedFilterSection } from "../views/Table";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { useFilterParams } from "../hooks/useFilterParams";
import { usePaginationParams } from "../hooks/usePaginationParams";

function getPrimaryLabel(agency: Record<string, unknown>): string {
  return (
    (agency.business_name as string) ||
    (agency["Business Name"] as string) ||
    (agency["Company Name"] as string) ||
    (agency.company_name as string) ||
    (agency.name as string) ||
    (agency.agencyName as string) ||
    findValueByNormalizedKey(
      agency as Record<string, unknown>,
      "businessname",
      "companyname",
      "name",
      "agencyname",
      "organisation",
      "company",
    ) ||
    "Unknown"
  );
}

export const ClientAgencies = () => {
  useEffect(() => {
    document.title = "Agencies";
  }, []);

  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [assignedAgencyIds, setAssignedAgencyIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const [filters, setFilters] = useFilterParams();

  const handleFiltersChange = useCallback(
    (newFilters: typeof filters) => {
      setPage(0);
      setFilters(newFilters);
    },
    [setFilters, setPage],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        let ids: string[] = [];

        if (!appUser) return;
        if (appUser.role === "admin") {
          const userData = await getUser(appUser.uid);
          if (cancelled) return;
          if (!userData) {
            setAssignedAgencyIds([]);
          } else {
            ids =
              (userData as { assignedAgencyIds?: string[] })
                .assignedAgencyIds ?? [];
            if (ids.length === 0 && appUser.agencyId) {
              ids = [appUser.agencyId];
            }
            console.log(
              "[ClientAgencies] admin user doc, assignedAgencies:",
              ids,
            );
            setAssignedAgencyIds(ids);
          }
        } else {
          const email = appUser.email?.toLowerCase();
          if (!email) {
            setAssignedAgencyIds([]);
            setReady(true);
            return;
          }
          const clientData = await getClientByEmail(email);
          if (cancelled) return;

          if (!clientData) {
            console.log(
              "[ClientAgencies] no client doc found for email:",
              email,
            );
            setAssignedAgencyIds([]);
          } else {
            ids =
              (clientData as { metadata?: { assignedAgencies?: string[] } })
                .metadata?.assignedAgencies ?? [];
            console.log(
              "[ClientAgencies] client doc found, assignedAgencies:",
              ids,
            );
            setAssignedAgencyIds(ids);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[ClientAgencies] fetch failed", err);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [appUser?.email, appUser?.role]);

  const agencyFilter = useMemo(() => {
    if (assignedAgencyIds.length === 0) {
      return "objectID:__none__";
    }
    const filter = assignedAgencyIds.map((id) => `objectID:${id}`).join(" OR ");
    console.log("[ClientAgencies] filters:", filter);
    return filter;
  }, [assignedAgencyIds]);

  const {
    items: agencies,
    loading,
    totalPages,
    totalResults,
  } = usePaginatedRecords({
    indexName: "agencies_name_desc",
    agencyId: "all",
    filters: agencyFilter,
    query: filters.name,
    page,
    hitsPerPage: pageSize,
    enabled: ready,
  });

  if (!ready || (agencies.length === 0 && loading)) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
      {agencies.length === 0 ? (
        <div>
          <PageTitle>Agencies</PageTitle>
          <Muted className="px-4">No agencies assigned yet.</Muted>
        </div>
      ) : (
        <PaginatedFilterSection
          title="Agencies"
          items={agencies}
          loading={loading}
          totalResults={totalResults}
          columnHeaders={["Agency Name", "Email", "Address", "Postcode"]}
          renderItem={(agency, idx) => {
            const record = agency as unknown as Record<string, unknown>;
            const meta = record.metadata as Record<string, unknown> | undefined;
            const scName = meta?.signedContractName as string | undefined;
            const scUrl = meta?.signedContract as string | undefined;
            const scDate = meta?.signedContractAt as
              | string
              | number
              | undefined;
            const email = findValueByNormalizedKey(
              record,
              "email",
              "emailaddress",
            );
            const address = findValueByNormalizedKey(
              record,
              "address",
              "addressline1",
              "address1",
              "firstlineofaddress",
            );
            const postcode = findValueByNormalizedKey(
              record,
              "postcode",
              "postalcode",
              "zip",
              "zipcode",
            );
            return (
              <AccordionItem
                key={agency.id as string}
                value={agency.id as string}
                className="animate-cascade"
                style={
                  { animationDelay: `${idx * 5}ms` } as React.CSSProperties
                }
                columns={[
                  <span className="tabular-nums">{idx + 1}</span>,
                  <StaffAccordionHeader name={getPrimaryLabel(record)}>
                    {scName && (
                      <Pill
                        status="signed"
                        icon={<FileSignature className="h-4 w-4" />}
                        label=""
                      />
                    )}
                    <AssignedStaff
                      record={record}
                      onClick={() =>
                        navigate(
                          `/staff?agencies=${encodeURIComponent(record.id as string)}&page=1`,
                        )
                      }
                    />
                  </StaffAccordionHeader>,
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {email || "—"}
                  </span>,
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {address || "—"}
                  </span>,
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {postcode || "—"}
                  </span>,
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
                <RecordData data={cleanRecordData(record)} />
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
          filters={filters}
          onFiltersChange={handleFiltersChange}
          enableNameFilter
          enableTagFilter={false}
          nameFilterLabel="Name"
        />
      )}
    </div>
  );
};
