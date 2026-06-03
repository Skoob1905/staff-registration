import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthProvider";
import { usePaginatedRecords } from "../hooks/usePaginatedRecords";
import { findValueByNormalizedKey } from "../utils/keyHeaderNormalisation";

interface ClientsDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}

export const ClientsDropdown = ({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Select a client...",
  id,
  autoFocus,
  onBlur,
}: ClientsDropdownProps) => {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  const clientFacetFilters = useMemo(
    () => isAdmin ? [] : [[`metadata.uploadedBy:${appUser?.agencyId ?? ""}`]],
    [isAdmin, appUser?.agencyId],
  );

  const { items: clients, loading } = usePaginatedRecords({
    indexName: "clients_name_desc",
    agencyId: isAdmin ? "all" : (appUser?.agencyId ?? ""),
    facetFilters: clientFacetFilters,
    hitsPerPage: 1000,
  });

  const getClientName = useCallback(
    (client: Record<string, unknown>): string =>
      (client.business_name as string) ||
      (client.Company_Name as string) ||
      (client.company_name as string) ||
      (client.name as string) ||
      (client.agencyName as string) ||
      findValueByNormalizedKey(
        client,
        "businessname",
        "name",
        "agencyname",
        "organisation",
        "company",
      ) ||
      "Unknown",
    [],
  );



  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      autoFocus={autoFocus}
      onBlur={onBlur}
      className={className}
    >
      <option value="">{placeholder}</option>
      {loading && (
        <option disabled>Loading clients...</option>
      )}
      {!loading && clients.length === 0 && (
        <option disabled>No clients</option>
      )}
      {clients.map((c) => (
        <option key={c.id as string} value={c.id as string}>
          {getClientName(c)}
        </option>
      ))}
    </select>
  );
};
