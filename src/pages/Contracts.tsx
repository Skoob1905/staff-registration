import { Section } from "../components/Section";

const contracts = [
  { title: "Site Labour Agreement", parties: "You & Acme Corp", start: "01 Jan 2026", end: "31 Dec 2026", status: "Active", value: "£45,000" },
  { title: "Scaffold Inspection Contract", parties: "You & Beta Ltd", start: "15 Mar 2026", end: "14 Mar 2027", status: "Active", value: "£18,500" },
  { title: "General Labour Hire", parties: "You & Gamma Construction", start: "01 Feb 2026", end: "31 Jul 2026", status: "Active", value: "£22,000" },
  { title: "Site Cleanup — Phase 1", parties: "You & Delta Facilities", start: "01 Nov 2025", end: "31 Jan 2026", status: "Expired", value: "£8,400" },
  { title: "Holiday Cover Agreement", parties: "You & Epsilon Staffing", start: "01 Jun 2025", end: "31 Aug 2025", status: "Expired", value: "£6,200" },
];

export const ContractsPage = () => (
  <div className="space-y-4">
    <Section title="Contracts">
      <div className="grid gap-3 sm:grid-cols-2">
        {contracts.map((c) => (
          <div key={c.title} className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{c.title}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  c.status === "Active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {c.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{c.parties}</p>
            <div className="mt-3 flex justify-between text-xs">
              <span>
                <span className="text-[var(--muted-foreground)]">Start:</span> {c.start}
              </span>
              <span>
                <span className="text-[var(--muted-foreground)]">End:</span> {c.end}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-green-700">{c.value}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  </div>
);
