import { useMemo } from "react";
import { useAuth } from "../context/AuthProvider";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { getAgencyName } from "../utils/agency";

interface AgenciesDropdownProps {
  value: string;
  onChange: (value: string, name: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}

const AGENCIES_INDEX = "agencies_name_desc";

export const AgenciesDropdown = ({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Select an agency...",
  id,
  autoFocus,
  onBlur,
}: AgenciesDropdownProps) => {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "super";

  const agencyFacetFilters = useMemo(
    () => (isAdmin ? [] : [[`metadata.uploadedBy:${appUser?.agencyId ?? ""}`]]),
    [isAdmin, appUser?.agencyId],
  );

  const { items: agencies, loading } = usePaginatedRecords({
    indexName: AGENCIES_INDEX,
    agencyId: isAdmin ? "all" : (appUser?.agencyId ?? ""),
    facetFilters: agencyFacetFilters,
    hitsPerPage: 1000,
  });

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        const name = e.target.selectedOptions[0]?.text ?? "";
        onChange(e.target.value, name);
      }}
      disabled={disabled}
      autoFocus={autoFocus}
      onBlur={onBlur}
      className={className}
    >
      <option value="">{placeholder}</option>
      {loading && <option disabled>Loading agencies...</option>}
      {!loading && agencies.length === 0 && (
        <option disabled>No agencies</option>
      )}
      {agencies.map((a) => (
        <option key={a.id as string} value={a.id as string}>
          {getAgencyName(a)}
        </option>
      ))}
    </select>
  );
};
