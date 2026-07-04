/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import { getAllInvoices, getInvoicesForAgency, markItemsDownloaded, markItemsSeen, type InvoiceEntry } from "../services/invoiceService";
import { getAllTimesheets, getTimesheetsForAgency, type AgencyTimesheets } from "../utils/timesheets";

interface AgencyInvoices {
  agencyId: string;
  agencyName: string;
  invoices: InvoiceEntry[];
}

interface DataCounts {
  staff: number;
  invoices: number;
  timesheets: number;
}

interface DataContextValue {
  counts: DataCounts;
  invoices: AgencyInvoices[];
  timesheets: AgencyTimesheets[];
  invoicesByAgency: Record<string, number>;
  timesheetsByAgency: Record<string, number>;
  invoicesLoading: boolean;
  timesheetsLoading: boolean;
  refreshInvoices: () => void;
  refreshTimesheets: () => void;
  markSeen: (type: "invoices" | "timesheets", agencyId: string, ids: string[]) => Promise<void>;
  markDownloaded: (type: "invoices" | "timesheets", agencyId: string, ids: string[]) => Promise<void>;
}

const DataContext = createContext<DataContextValue>({
  counts: { staff: 0, invoices: 0, timesheets: 0 },
  invoices: [],
  timesheets: [],
  invoicesByAgency: {},
  timesheetsByAgency: {},
  invoicesLoading: true,
  timesheetsLoading: true,
  refreshInvoices: () => {},
  refreshTimesheets: () => {},
  markSeen: async () => {},
  markDownloaded: async () => {},
});

function countUnseen<T extends { hasSeen?: boolean }>(
  agencies: { agencyId: string }[],
  key: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const a of agencies) {
    const items = (a as Record<string, unknown>)[key] as T[] | undefined;
    if (!items) continue;
    const unseen = items.filter((item) => item.hasSeen === false).length;
    if (unseen > 0) result[a.agencyId] = unseen;
  }
  return result;
}

function sumValues(map: Record<string, number>): number {
  return Object.values(map).reduce((sum, n) => sum + n, 0);
}

function computeCounts(
  invoices: AgencyInvoices[],
  timesheets: AgencyTimesheets[],
) {
  const invoicesByAgency = countUnseen<InvoiceEntry>(invoices, "invoices");
  const timesheetsByAgency = countUnseen(timesheets, "timesheets");

  return {
    counts: {
      staff: 0,
      invoices: sumValues(invoicesByAgency),
      timesheets: sumValues(timesheetsByAgency),
    },
    invoicesByAgency,
    timesheetsByAgency,
  };
}

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { appUser } = useAuth();
  const [invoices, setInvoices] = useState<AgencyInvoices[]>([]);
  const [timesheets, setTimesheets] = useState<AgencyTimesheets[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [timesheetsLoading, setTimesheetsLoading] = useState(true);

  const isAdmin = appUser?.role === "admin";
  const isSuper = appUser?.role === "super";

  const fetchInvoices = useCallback(() => {
    if (!appUser) return;
    setInvoicesLoading(true);

    const request = isAdmin || isSuper
      ? getAllInvoices()
      : getInvoicesForAgency(appUser.agencyId).then((items) => [{
          agencyId: appUser.agencyId,
          agencyName: "",
          invoices: items,
        }]);

    request
      .then((data) => {
        console.log("[DataProvider] invoices:", data.length, data);
        setInvoices(data);
      })
      .catch((err) => {
        console.error("[DataProvider] invoices failed:", err);
        setInvoices([]);
      })
      .finally(() => setInvoicesLoading(false));
  }, [appUser, isAdmin, isSuper]);

  const fetchTimesheets = useCallback(() => {
    if (!appUser) return;
    setTimesheetsLoading(true);

    const request = isAdmin || isSuper
      ? getAllTimesheets()
      : getTimesheetsForAgency(appUser.agencyId).then((items) => [{
          agencyId: appUser.agencyId,
          agencyName: "",
          timesheets: items,
        }]);

    request
      .then((data) => {
        console.log("[DataProvider] timesheets:", data.length, data);
        setTimesheets(data);
      })
      .catch((err) => {
        console.error("[DataProvider] timesheets failed:", err);
        setTimesheets([]);
      })
      .finally(() => setTimesheetsLoading(false));
  }, [appUser, isAdmin, isSuper]);

  /* eslint-disable react-hooks/set-state-in-effect -- Data fetching on mount requires setState in effect */
  useEffect(() => {
    if (appUser) {
      fetchInvoices();
      fetchTimesheets();
    }
  }, [appUser, fetchInvoices, fetchTimesheets]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { counts, invoicesByAgency, timesheetsByAgency } = useMemo(() => {
    const result = computeCounts(invoices, timesheets);
    console.log("[DataProvider] counts:", result.counts, "byAgency:", { invoices: result.invoicesByAgency, timesheets: result.timesheetsByAgency });
    return result;
  }, [invoices, timesheets]);

  const markSeen = useCallback(
    async (type: "invoices" | "timesheets", agencyId: string, ids: string[]) => {
      await markItemsSeen(type, agencyId, ids);
      if (type === "invoices") fetchInvoices();
      else fetchTimesheets();
    },
    [fetchInvoices, fetchTimesheets],
  );

  const markDownloaded = useCallback(
    async (type: "invoices" | "timesheets", agencyId: string, ids: string[]) => {
      await markItemsDownloaded(type, agencyId, ids);
      if (type === "invoices") fetchInvoices();
      else fetchTimesheets();
    },
    [fetchInvoices, fetchTimesheets],
  );

  return (
    <DataContext.Provider
      value={{
        counts,
        invoices,
        timesheets,
        invoicesByAgency,
        timesheetsByAgency,
        invoicesLoading,
        timesheetsLoading,
        refreshInvoices: fetchInvoices,
        refreshTimesheets: fetchTimesheets,
        markSeen,
        markDownloaded,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextValue => {
  return useContext(DataContext);
};
