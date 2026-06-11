export interface InvoicePillCounts {
  unpaid: number;
  paid: number;
}

export const renderInvoicePills = (
  statuses: Array<{ status: string }>,
): InvoicePillCounts => {
  let unpaid = 0;
  let paid = 0;
  for (const inv of statuses) {
    if (inv.status === "unpaid" || inv.status === "review") unpaid++;
    else if (inv.status === "paid") paid++;
  }
  return { unpaid, paid };
};
