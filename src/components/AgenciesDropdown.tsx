import { useAgencies, type AgencyOption } from "../hooks/useAgencies";

interface AgenciesDropdownProps {
  value: string;
  onChange: (value: string, name: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  agencies?: AgencyOption[];
  loading?: boolean;
}

export const AgenciesDropdown = ({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Select an agency...",
  id,
  autoFocus,
  onBlur,
  agencies: agenciesProp,
  loading: loadingProp,
}: AgenciesDropdownProps) => {
  const external = agenciesProp !== undefined;
  const internal = useAgencies({ enabled: !external });
  const agencies = agenciesProp ?? internal.agencies;
  const loading = loadingProp ?? (external ? false : internal.loading);

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
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
};
