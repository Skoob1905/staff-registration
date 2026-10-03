import { useMemo } from "react";
import { PaginatedFilterSection } from "../views/Table";
import { usePaginationParams } from "../hooks/usePaginationParams";
import { emptyFilters } from "../types/domain";

interface Contract {
  title: string;
  parties: string;
  start: string;
  end: string;
  status: "Active" | "Expired";
  value: string;
}

const contracts: Contract[] = [
  { title: "Site Labour Agreement", parties: "You & Acme Corp", start: "01 Jan 2026", end: "31 Dec 2026", status: "Active", value: "£45,000" },
  { title: "Scaffold Inspection Contract", parties: "You & Beta Ltd", start: "15 Mar 2026", end: "14 Mar 2027", status: "Active", value: "£18,500" },
  { title: "General Labour Hire", parties: "You & Gamma Construction", start: "01 Feb 2026", end: "31 Jul 2026", status: "Active", value: "£22,000" },
  { title: "Site Cleanup — Phase 1", parties: "You & Delta Facilities", start: "01 Nov 2025", end: "31 Jan 2026", status: "Expired", value: "£8,400" },
  { title: "Holiday Cover Agreement", parties: "You & Epsilon Staffing", start: "01 Jun 2025", end: "31 Aug 2025", status: "Expired", value: "£6,200" },
];

export const Contracts = () => {
  const { page, pageSize, setPage, setPageSize } = usePaginationParams();
  const totalPages = Math.max(1, Math.ceil(contracts.length / pageSize));
  const paged = useMemo(
    () => contracts.slice(page * pageSize, (page + 1) * pageSize),
    [page, pageSize],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-4">
      <PaginatedFilterSection<Contract>
        title="Contracts"
        items={paged}
        loading={false}
        page={page}
        totalPages={totalPages}
        totalResults={contracts.length}
        pageSize={pageSize}
        onPrevPage={() => setPage(Math.max(0, page - 1))}
        onNextPage={() => setPage(page + 1)}
        onGoToPage={setPage}
        onPageSizeChange={setPageSize}
        filters={emptyFilters}
        onFiltersChange={() => {}}
        enableNameFilter={false}
        enableTagFilter={false}
        expandable={false}
        columnHeaders={["Title", "Parties", "Start", "End", "Status", "Value"]}
        emptyMessage="No contracts found."
        renderItem={(c) => (
          <>
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
              {c.title}
            </span>
            <span className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
              {c.parties}
            </span>
            <span className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
              {c.start}
            </span>
            <span className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
              {c.end}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  c.status === "Active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {c.status}
              </span>
            </span>
            <span className="min-w-0 flex-1 text-xs font-semibold text-green-700 sm:text-sm">
              {c.value}
            </span>
          </>
        )}
      />
    </div>
  );
};
