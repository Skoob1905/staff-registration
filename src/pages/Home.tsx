import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { useAppStore } from "../stores/appStore";
import { getUser, getAgency, getAgencyByEmail } from "../services/firestore";
import { StaffListSection } from "../components/StaffListSection";
import { AccordionAction, AccordionItem } from "../components/ui";
import { StaffAccordionHeader } from "../components/StaffAccordionHeader";
import { Pill } from "../components/Pill";
import { Metadata } from "../components/Metadata";
import { FileInteractionButtons } from "../components/FileInteractionButtons";
import { useDualAccordionParams } from "../hooks/useDualAccordionParams";
import { getStaffName } from "../utils/keyHeaderNormalisation";
import { formatInvitedAt } from "../utils/date";
import { getTagName } from "../utils/getTagName";
import { getAgencyName } from "../utils/agency";
import type { Agency, BulkStaff } from "../types/domain";

export const Home = () => {
  useEffect(() => {
    document.title = "Home";
  }, []);

  const { appUser, agency } = useAuth();
  const navigate = useNavigate();
  const tags = useAppStore((s) => s.tags);
  const loadTags = useAppStore((s) => s.loadTags);
  const { leftValue, rightValue, onLeftChange, onRightChange } =
    useDualAccordionParams();

  const [agencyIds, setAgencyIds] = useState<string[]>([]);
  const [agencyList, setAgencyList] = useState<Agency[]>([]);
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
          const resolvedIds: string[] = [];
          const agenciesArr: Agency[] = [];
          for (const id of ids) {
            const data = await getAgency(id);
            if (data) {
              resolvedIds.push(id);
              agenciesArr.push({
                id,
                name: getAgencyName(data),
                slug: (data.slug as string) ?? "",
                assignedStaff:
                  ((data.metadata as Record<string, unknown> | undefined)
                    ?.assignedStaff as string[]) ?? [],
              });
            }
          }
          setAgencyIds(resolvedIds);
          setAgencyList(agenciesArr);
        } else {
          try {
            const agencies = await getAgencyByEmail(appUser.email ?? "");
            if (agencies.length > 0) {
              setAgencyIds([String(agencies[0].id)]);
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

  const targetAgencyIds = useMemo(() => {
    return agencyIds.length === 0 ? [] : agencyIds;
  }, [agencyIds]);

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
            <StaffAccordionHeader
              name={displayName}
              loginStatus={member.metadata?.loginStatus}
            >
              {member.metadata?.cv && member.metadata.cv.length > 0 && (
                <Pill
                  status="cv"
                  icon={<FileText className="h-4 w-4" />}
                  label=""
                />
              )}
              {member.metadata?.payslipsSent &&
                member.metadata.payslipsSent.length > 0 && (
                    <Pill
                      status="payslip"
                      icon={<Receipt className="h-4 w-4" />}
                      count={member.metadata.payslipsSent.length}
                      onClick={() =>
                        navigate(`/payslips?page=1&open=${member.id}&name=${encodeURIComponent(getStaffName(member))}`)
                      }
                    />
                )}
            </StaffAccordionHeader>
          }
          actions={
            member.metadata?.assignedToName ? (
              <AccordionAction>
                {member.metadata.assignedToName}
              </AccordionAction>
            ) : null
          }
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Metadata
              title="Tags"
              className="animate-cascade"
              style={{ animationDelay: "0ms" }}
              value={
                member.tags?.length
                  ? member.tags.map((id) => getTagName(tagsMap, id)).filter(Boolean).join(", ") || "None"
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
            ((member.metadata as Record<string, unknown>)?.documents as Record<string, unknown>[])?.length > 0 && (
              <div className="mb-2 flex flex-col gap-1 text-xs sm:text-sm">
                {((member.metadata as Record<string, unknown>)?.documents as Record<string, unknown>[])?.map((entry: Record<string, unknown>, i: number) => (
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
                          {entry.fileName as string}
                        </span>
                        <FileInteractionButtons
                          fileUrl={entry.fileUrl as string}
                          fileName={entry.fileName as string}
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
        targetAgencyIds={targetAgencyIds}
        agencies={agencyList}
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
