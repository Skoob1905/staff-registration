import { Card } from "../../components/ui";

const entries = [
  { date: "02 Jun 2026", project: "Acme Corp — Site Survey", hours: 7.5, rate: "£35.00", total: "£262.50", status: "Approved" },
  { date: "01 Jun 2026", project: "Acme Corp — Site Survey", hours: 8.0, rate: "£35.00", total: "£280.00", status: "Approved" },
  { date: "29 May 2026", project: "Beta Ltd — Scaffold Inspection", hours: 6.0, rate: "£40.00", total: "£240.00", status: "Pending" },
  { date: "28 May 2026", project: "Beta Ltd — Scaffold Inspection", hours: 7.0, rate: "£40.00", total: "£280.00", status: "Approved" },
  { date: "27 May 2026", project: "Gamma Construction — Labour Hire", hours: 9.0, rate: "£30.00", total: "£270.00", status: "Pending" },
  { date: "26 May 2026", project: "Gamma Construction — Labour Hire", hours: 8.5, rate: "£30.00", total: "£255.00", status: "Pending" },
];

export const TimeSheetsPage = () => (
  <div className="space-y-4">
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold sm:text-lg">Time Sheets</h2>
        <span className="text-xs text-[var(--muted-foreground)]">This week: 21.5 hrs</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Project</th>
              <th className="py-2 pr-4 font-medium">Hours</th>
              <th className="py-2 pr-4 font-medium">Rate</th>
              <th className="py-2 pr-4 font-medium">Total</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.date + e.project} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2.5 pr-4">{e.date}</td>
                <td className="py-2.5 pr-4">{e.project}</td>
                <td className="py-2.5 pr-4">{e.hours}</td>
                <td className="py-2.5 pr-4">{e.rate}</td>
                <td className="py-2.5 pr-4 font-medium">{e.total}</td>
                <td className="py-2.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      e.status === "Approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {e.status}
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
