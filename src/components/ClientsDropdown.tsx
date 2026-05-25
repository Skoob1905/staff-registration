import { useEffect, useMemo } from "react";
import { useAppStore } from "../stores/appStore";
import { useAuth } from "../context/AuthProvider";

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

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) => {
        const nameA = (a.business_name as string) || (a.Company_Name as string) || (a.company_name as string) || (a.name as string) || "";
        const nameB = (b.business_name as string) || (b.Company_Name as string) || (b.company_name as string) || (b.name as string) || "";
        return nameA.localeCompare(nameB);
      }),
    [clients],
  );

  const getClientName = (client: (typeof clients)[number]): string =>
    (client.business_name as string) ||
    (client.Company_Name as string) ||
    (client.company_name as string) ||
    (client.name as string) ||
    (client.agencyName as string) ||
    "Unknown";

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
