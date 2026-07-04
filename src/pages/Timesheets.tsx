import { useEffect, useMemo, useRef } from "react";
import { Section } from "../components/Section";
import { InformationCard } from "../components/InformationCard";
import { Button } from "../components/ui";
import { useAuth } from "../context/AuthProvider";
import { useData } from "../context/DataProvider";

export const Timesheets = () => {
  const { appUser } = useAuth();
  const { timesheets, timesheetsLoading: loading, markSeen, markDownloaded } = useData();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myTimesheets = useMemo(() => {
    return timesheets.flatMap((a) => a.timesheets);
  }, [timesheets]);

  useEffect(() => {
    if (!loading && appUser?.agencyId && myTimesheets.length > 0) {
      const unseenIds = myTimesheets
        .filter((ts) => ts.hasSeen === false)
        .map((ts) => ts.fileName);

      if (unseenIds.length > 0) {
        timerRef.current = setTimeout(() => {
          markSeen("timesheets", appUser.agencyId!, unseenIds).catch(() => {});
        }, 3000);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loading, appUser?.agencyId, myTimesheets, markSeen]);

  return (
    <div className="mx-auto space-y-4">
      <Section title="Timesheets">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : myTimesheets.length === 0 ? (
          <p className="text-sm text-zinc-500">No timesheets uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {myTimesheets.map((entry, idx) => (
              <InformationCard
                key={idx}
                variant="timesheet"
                name={entry.fileName}
                isNew={entry.hasSeen === false}
                hasDownloaded={!!entry.hasDownloaded}
                uploadedAt={entry.uploadedAt}
                admin={false}
                documentInfo={null}
                actions={
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        window.open(entry.fileUrl, "_blank", "noopener,noreferrer");
                        markDownloaded("timesheets", appUser?.agencyId ?? "", [entry.fileName]).catch(() => {});
                      }}
                    >
                      Download
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};
