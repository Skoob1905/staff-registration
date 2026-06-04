import { type ReactNode } from "react";
import { AccordionRoot } from "./ui";
import { PaginationBar } from "./PaginationBar";
import { Section } from "./Section";
import { Muted } from "../config/typography";

interface PaginatedSectionProps<T> {
  title: string;
  items: T[];
  loading: boolean;
  renderItem: (item: T, index: number) => ReactNode;
  action?: ReactNode;

  page: number;
  totalPages: number;
  totalResults: number;
  pageSize: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const PaginatedSection = <T,>({
  title,
  items,
  loading,
  renderItem,
  action,

  page,
  totalPages,
  totalResults,
  pageSize,
  onPrevPage,
  onNextPage,
  onGoToPage,
  onPageSizeChange,
}: PaginatedSectionProps<T>) => (
  <Section title={title} count={totalResults} action={action}>
    {loading && items.length === 0 ? (
      <Muted>Loading...</Muted>
    ) : items.length === 0 ? (
      <Muted>Add some {title.toLowerCase()} now!</Muted>
    ) : (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <AccordionRoot type="single" collapsible>
            {items.map((item, idx) => renderItem(item, idx))}
          </AccordionRoot>
        </div>
          <PaginationBar
            currentPage={page + 1}
            totalPages={totalPages}
            totalCount={totalResults}
            pageSize={pageSize}
            loading={loading}
            onPrev={onPrevPage}
            onNext={onNextPage}
            onGoToPage={(p) => onGoToPage(p - 1)}
            onPageSizeChange={onPageSizeChange}
          />
      </div>
    )}
  </Section>
);
