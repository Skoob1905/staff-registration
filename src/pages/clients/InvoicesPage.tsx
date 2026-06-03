import { Card } from "../../components/ui";
import { H2 } from "../../config/typography";

const invoices = [
  { number: "INV-2026-0042", client: "Acme Corp", description: "Site labour — May 2026", amount: "£3,200.00", date: "31 May 2026", status: "Outstanding" },
  { number: "INV-2026-0041", client: "Beta Ltd", description: "Scaffold inspection — May 2026", amount: "£1,850.00", date: "28 May 2026", status: "Paid" },
  { number: "INV-2026-0040", client: "Gamma Construction", description: "Labour hire — May 2026", amount: "£2,750.00", date: "25 May 2026", status: "Paid" },
  { number: "INV-2026-0039", client: "Acme Corp", description: "Site labour — April 2026", amount: "£3,100.00", date: "30 Apr 2026", status: "Paid" },
  { number: "INV-2026-0038", client: "Delta Facilities", description: "Site cleanup — April 2026", amount: "£2,100.00", date: "28 Apr 2026", status: "Overdue" },
  { number: "INV-2026-0037", client: "Beta Ltd", description: "Scaffold inspection — April 2026", amount: "£1,750.00", date: "25 Apr 2026", status: "Paid" },
];

const statusStyles: Record<string, string> = {
  Paid: "bg-green-100 text-green-700",
  Outstanding: "bg-amber-100 text-amber-700",
  Overdue: "bg-red-100 text-red-700",
};

export const InvoicesPage = () => (
  <div className="space-y-4">
    <Card>
      <div className="flex items-center justify-between">
        <H2>Invoices</H2>
        <span className="text-xs text-[var(--muted-foreground)]">Outstanding: £3,200.00</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
              <th className="py-2 pr-4 font-medium">Invoice</th>
              <th className="py-2 pr-4 font-medium">Client</th>
              <th className="py-2 pr-4 font-medium">Description</th>
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Amount</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.number} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2.5 pr-4 font-medium">{inv.number}</td>
                <td className="py-2.5 pr-4">{inv.client}</td>
                <td className="py-2.5 pr-4 text-[var(--muted-foreground)]">{inv.description}</td>
                <td className="py-2.5 pr-4">{inv.date}</td>
                <td className="py-2.5 pr-4 font-medium">{inv.amount}</td>
                <td className="py-2.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      statusStyles[inv.status] || "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);
