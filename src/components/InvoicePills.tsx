import { Pill } from "./Pill";
import { renderInvoicePills } from "../utils/invoicePills";

interface InvoicePillsProps {
  invoices: Array<{ status: string }>;
}

export const InvoicePills = ({ invoices }: InvoicePillsProps) => {
  const { unpaid, paid } = renderInvoicePills(invoices);
  return (
    <>
      {unpaid > 0 && <Pill status="unpaid" count={unpaid} />}
      {paid > 0 && <Pill status="paid" count={paid} />}
    </>
  );
};
