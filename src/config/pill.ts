export interface PillConfig {
  bg: string;
  border: string;
  text: string;
  label: string;
}

export type PillStatus = "paid" | "unpaid" | "review";

export const pillConfig: Record<PillStatus, PillConfig> = {
  paid: {
    bg: "bg-green-100",
    border: "border-green-300",
    text: "text-green-700",
    label: "Paid",
  },
  unpaid: {
    bg: "bg-red-100",
    border: "border-red-300",
    text: "text-red-700",
    label: "Unpaid",
  },
  review: {
    bg: "bg-orange-100",
    border: "border-orange-300",
    text: "text-orange-700",
    label: "Review",
  },
};
