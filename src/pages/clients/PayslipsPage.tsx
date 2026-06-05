import { Card } from "../../components/ui";
import { H2 } from "../../config/typography";

const payslips = [
  { period: "May 2026", gross: "£3,200.00", ni: "£180.40", tax: "£420.00", net: "£2,599.60", status: "Paid" },
  { period: "April 2026", gross: "£3,100.00", ni: "£172.80", tax: "£405.00", net: "£2,522.20", status: "Paid" },
  { period: "March 2026", gross: "£3,250.00", ni: "£184.60", tax: "£430.00", net: "£2,635.40", status: "Paid" },
  { period: "February 2026", gross: "£2,950.00", ni: "£162.00", tax: "£380.00", net: "£2,408.00", status: "Paid" },
  { period: "January 2026", gross: "£3,000.00", ni: "£165.60", tax: "£390.00", net: "£2,444.40", status: "Paid" },
];

export const PayslipsPage = () => (
  <div className="space-y-4">
    <Card>
      <H2>Payslips</H2>

      <div className="mt-3 space-y-2">
        {payslips.map((p) => (
          <div key={p.period} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-xs font-bold text-[var(--primary)]">
                {p.period.slice(0, 3)}
              </div>
              <div>
                <p className="text-sm font-semibold">{p.period}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Gross: {p.gross} &middot; NI: {p.ni} &middot; Tax: {p.tax}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-green-700">{p.net}</p>
              <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                {p.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  </div>
);
