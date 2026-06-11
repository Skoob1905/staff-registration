export interface ParsedCVName {
  firstname: string;
  surname: string;
  fullname: string;
}

export function parseCVFileName(name: string): ParsedCVName | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const withoutExt = trimmed.replace(/\.pdf$/i, "");
  if (!withoutExt) return null;

  let parts = withoutExt.split(/[\s-_]+/).filter(Boolean);

  if (parts.length < 2) {
    parts = withoutExt.split(/(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
  }

  if (parts.length < 2) return null;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const firstname = capitalize(parts[0]);
  const surname = parts.slice(1).map(capitalize).join(" ");
  const fullname = `${firstname} ${surname}`;

  return { firstname, surname, fullname };
}
