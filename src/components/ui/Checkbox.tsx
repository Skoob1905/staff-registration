export const Checkbox = ({
  label,
  count,
  checked,
  onChange,
  disabled,
  id,
}: {
  label: string;
  count?: number;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  id?: string;
}) => (
  <label
    htmlFor={id}
    className="flex cursor-pointer items-center gap-2 text-[11px] sm:text-sm"
  >
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="rounded shrink-0"
    />
    <span className="min-w-0 line-clamp-2">
      {label}
      {count !== undefined ? <> ({count})</> : null}
    </span>
  </label>
);
