import { CheckCircle, AlertCircle } from "lucide-react";
import { Pill } from "./Pill";
import { renderInvoicePills } from "../utils/invoicePills";

interface InvoicePillsProps {
  invoices: Array<{ status: string }>;
}

export const InvoicePills = ({ invoices }: InvoicePillsProps) => {
  const { unpaid, paid } = renderInvoicePills(invoices);
  return (
    <>
      {unpaid > 0 && (
        <Pill
          status="unpaid"
          count={unpaid}
          icon={<AlertCircle className="h-4 w-4" />}
        />
      )}
      {paid > 0 && (
        <Pill
          status="paid"
          count={paid}
          icon={<CheckCircle className="h-4 w-4" />}
        />
      )}
    </>
  );
};
