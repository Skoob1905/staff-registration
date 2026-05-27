import { useCallback, useEffect, useMemo } from "react";
import { useAppStore } from "../stores/appStore";
import { useAuth } from "../context/AuthProvider";
import { findValueByNormalizedKey } from "../utils/staff";

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
  const clients = useAppStore((s) => s.clients);
  const clientsLoading = useAppStore((s) => s.clientsLoading);
  const clientsLoaded = useAppStore((s) => s.clientsLoaded);
  const loadClients = useAppStore((s) => s.loadClients);

  useEffect(() => {
    if (appUser?.agencyId && !clientsLoaded && !clientsLoading) {
      loadClients(appUser.agencyId);
    }
  }, [appUser?.agencyId, clientsLoaded, clientsLoading, loadClients]);

  const getClientName = useCallback((client: (typeof clients)[number]): string =>
    (client.business_name as string) ||
    (client.Company_Name as string) ||
    (client.company_name as string) ||
    (client.name as string) ||
    (client.agencyName as string) ||
    findValueByNormalizedKey(client as Record<string, unknown>, "businessname", "name", "agencyname", "organisation", "company") ||
    "Unknown", []);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) => {
        const nameA = getClientName(a);
        const nameB = getClientName(b);
        return nameA.localeCompare(nameB);
      }),
    [clients, getClientName],
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
      {clientsLoading && (
        <option disabled>Loading clients...</option>
      )}
      {!clientsLoading && clients.length === 0 && (
        <option disabled>No clients</option>
      )}
      {sortedClients.map((c) => (
        <option key={c.id} value={c.id}>
          {getClientName(c)}
        </option>
      ))}
    </select>
  );
};
