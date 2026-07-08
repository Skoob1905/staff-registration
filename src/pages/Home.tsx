import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { useAuth } from "../context/AuthProvider";
import { useAppStore } from "../stores/appStore";
import { getUser, getAgency, getAgencyByEmail } from "../services/firestore";
import { StaffListSection } from "../components/StaffListSection";
import { AccordionItem } from "../components/ui";
import { AccordionTitle } from "../components/AccordionTitle";
import { Pill } from "../components/Pill";
import { Metadata } from "../components/Metadata";
import { FileInteractionButtons } from "../components/FileInteractionButtons";
import { useDualAccordionParams } from "../hooks/useDualAccordionParams";
import {
  getStaffName,
  findValueByNormalizedKey,
} from "../utils/keyHeaderNormalisation";
import { formatInvitedAt } from "../utils/date";
import type { BulkStaff } from "../types/domain";

function getAgencyName(
  agencyDoc: Record<string, unknown>,
  fallbackId: string,
): string {
  return typeof agencyDoc.business_name === "string"
    ? agencyDoc.business_name
    : typeof agencyDoc["Business Name"] === "string"
      ? agencyDoc["Business Name"]
      : typeof agencyDoc.name === "string"
        ? agencyDoc.name
        : findValueByNormalizedKey(
            agencyDoc,
            "businessname",
            "companyname",
            "name",
            "agencyname",
            "company",
          ) || fallbackId;
}

export const Home = () => {
  useEffect(() => {
    document.title = "Home";
  }, []);

  const { appUser, agency } = useAuth();
  const tags = useAppStore((s) => s.tags);
  const loadTags = useAppStore((s) => s.loadTags);
  const { leftValue, rightValue, onLeftChange, onRightChange } =
    useDualAccordionParams();

  const [agencyNames, setAgencyNames] = useState<string[]>([]);
  const [agencyNamesLoaded, setAgencyNamesLoaded] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!appUser) return;

      try {
        if (appUser.role === "admin") {
          const userData = await getUser(appUser.uid);
          if (!userData) return;
          const ids =
            (userData as { assignedAgencyIds?: string[] }).assignedAgencyIds ??
            [];
          if (ids.length === 0 && appUser.agencyId) {
            ids.push(appUser.agencyId);
          }
          const names: string[] = [];
          for (const id of ids) {
            const data = await getAgency(id);
            if (data) {
              names.push(getAgencyName(data, id));
            }
          }
          setAgencyNames(names);
        } else {
          try {
            const agencies = await getAgencyByEmail(appUser.email ?? "");
            if (agencies.length > 0) {
              const name = getAgencyName(agencies[0], String(agencies[0].id));
              setAgencyNames(name ? [name] : []);
            }
          } catch (err) {
            console.error("[Home] failed to fetch agency by email:", err);
          }
        }
      } finally {
        setAgencyNamesLoaded(true);
      }
    };
    void run();
  }, [appUser, agency]);

  useEffect(() => {
    loadTags().catch(() => {});
  }, [loadTags]);

  const tagsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of tags) {
      map[tag.id] = tag.value;
    }
    return map;
  }, [tags]);

  const targetAgencyNames = useMemo(() => {
    if (agencyNames.length === 0) return undefined;
    return agencyNames;
  }, [agencyNames]);

  const renderItem = useCallback(
    (member: BulkStaff, idx: number) => {
      const displayName = getStaffName(member);
      return (
        <AccordionItem
          key={member.id}
          value={member.id}
          className="animate-cascade"
          style={{ animationDelay: `${idx * 5}ms` } as React.CSSProperties}
          title={
            <div className="flex min-w-0 items-center gap-2">
              <AccordionTitle>{displayName}</AccordionTitle>
              {member.metadata?.cv && member.metadata.cv.length > 0 && (
                <Pill
                  status="cv"
                  icon={<FileText className="h-4 w-4" />}
                  label=""
                />
              )}
            </div>
          }
          actions={
            member.metadata?.assignedToName ? (
              <span className="shrink-0 text-xs text-[var(--muted-foreground)] truncate max-w-[200px]">
                {member.metadata.assignedToName}
              </span>
            ) : null
          }
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Metadata
              title="Tags"
              className="animate-cascade"
              style={{ animationDelay: "0ms" }}
              value={
                member.tags && member.tags.length > 0
                  ? member.tags.map((id) => tagsMap[id] || id).join(", ")
                  : "None"
              }
            />
          </div>
          {member.metadata?.cv && member.metadata.cv.length > 0 && (
            <div className="mb-2 flex flex-col gap-1 text-xs sm:text-sm">
              {member.metadata.cv.map((entry, i) => (
                <Metadata
                  key={`${member.id}::cv::${entry.fileName}`}
                  title="CV"
                  className="flex items-center animate-cascade"
                  style={
                    {
                      animationDelay: `${(i + 1) * 12}ms`,
                    } as React.CSSProperties
                  }
                  value={
                    <span className="inline-flex flex-wrap items-center gap-2 align-middle">
                      <span className="text-[var(--muted-foreground)]">
                        {entry.fileName}
                      </span>
                      <FileInteractionButtons
                        fileUrl={entry.fileUrl}
                        fileName={entry.fileName}
                        interactionKey="cv"
                        size="md"
                      />
                    </span>
                  }
                />
              ))}
            </div>
          )}
          {Boolean((member.metadata as Record<string, unknown>)?.documents) &&
            ((member.metadata as Record<string, unknown>)?.documents as any[])?.length > 0 && (
              <div className="mb-2 flex flex-col gap-1 text-xs sm:text-sm">
                {((member.metadata as Record<string, unknown>)?.documents as any[])?.map((entry: any, i: number) => (
                  <Metadata
                    key={`${member.id}::doc::${entry.fileName}`}
                    title="Document"
                    className="flex items-center animate-cascade"
                    style={
                      {
                        animationDelay: `${(i + 1) * 12}ms`,
                      } as React.CSSProperties
                    }
                    value={
                      <span className="inline-flex flex-wrap items-center gap-2 align-middle">
                        <span className="text-[var(--muted-foreground)]">
                          {entry.fileName}
                        </span>
                        <FileInteractionButtons
                          fileUrl={entry.fileUrl}
                          fileName={entry.fileName}
                          interactionKey="document"
                          size="md"
                        />
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          <div className="overflow-x-auto mt-2">
            <div className="w-max grid grid-rows-[repeat(6,auto)] grid-flow-col auto-cols-min gap-x-6 gap-y-1 text-xs sm:text-sm text-zinc-600">
              {Object.entries(member)
                .filter(
                  ([key, value]) =>
                    key !== "id" &&
                    key !== "uid" &&
                    key !== "metadata" &&
                    key !== "agencyId" &&
                    key !== "importedByAgencyId" &&
                    key !== "tags" &&
                    key !== "typeIds" &&
                    key !== "sortableName" &&
                    value !== "" &&
                    value !== null &&
                    value !== undefined,
                )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value], i) => {
                  const display =
                    value instanceof Date
                      ? formatInvitedAt(value)
                      : String(value ?? "");
                  return (
                    <p
                      key={key}
                      className="whitespace-nowrap px-1 animate-cascade"
                      style={
                        {
                          animationDelay: `${i * 12}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        {key}
                      </span>
                      <span className="font-medium">: {display}</span>
                    </p>
                  );
                })}
            </div>
          </div>
        </AccordionItem>
      );
    },
    [tagsMap],
  );

  return (
    <div className="mx-auto space-y-4">
      <StaffListSection
        targetAgencyNames={targetAgencyNames}
        namesLoading={!agencyNamesLoaded}
        renderItem={renderItem}
        leftAccordionValue={leftValue}
        onLeftAccordionChange={onLeftChange}
        rightAccordionValue={rightValue}
        onRightAccordionChange={onRightChange}
      />
    </div>
  );
};
