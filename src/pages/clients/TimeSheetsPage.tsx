import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Section } from "../../components/Section";
import { TimesheetCard } from "../../components/TimesheetCard";
import { useAuth } from "../../context/AuthProvider";
import { db } from "../../services/firebase";
import type { TimesheetEntry } from "../../utils/timesheets";

export const TimeSheetsPage = () => {
  useEffect(() => {
    document.title = "Time Sheets";
  }, []);

  const { appUser } = useAuth();
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.agencyId) return;

    let cancelled = false;

    const fetchTimesheets = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "agencies", appUser.agencyId));
        if (cancelled) return;
        const data = snap.data();
        const meta = data?.metadata as Record<string, unknown> | undefined;
        setTimesheets((meta?.timesheets as TimesheetEntry[] | undefined) ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchTimesheets();

    return () => {
      cancelled = true;
    };
  }, [appUser?.agencyId]);

  return (
    <div className="mx-auto space-y-4">
      <Section title="Timesheets">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : timesheets.length === 0 ? (
          <p className="text-sm text-zinc-500">No timesheets uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {timesheets.map((entry, idx) => (
              <TimesheetCard key={idx} entry={entry} clientName="" />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};
