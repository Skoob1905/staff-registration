import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

const accordionMemory = new Map<string, string>();

export function useAccordionParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const [openValues, setOpenValues] = useState<string[]>(() => {
    const fromUrl = searchParams.get("open")?.split(",").filter(Boolean);
    if (fromUrl?.length) return fromUrl;
    const memory = accordionMemory.get(location.pathname);
    return memory ? memory.split(",").filter(Boolean) : [];
  });

  /* eslint-disable react-hooks/set-state-in-effect -- URL syncing with memory requires setState in effect */
  useEffect(() => {
    const fromUrl = searchParams.get("open")?.split(",").filter(Boolean) ?? [];
    if (fromUrl.length > 0) {
      setOpenValues(fromUrl);
      accordionMemory.set(location.pathname, fromUrl.join(","));
    } else {
      const memory = accordionMemory.get(location.pathname);
      if (memory) {
        const next = new URLSearchParams(searchParams);
        next.set("open", memory);
        setSearchParams(next, { replace: true });
      } else {
        setOpenValues([]);
      }
    }
  }, [searchParams, location.pathname, setSearchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleAccordionChange = useCallback(
    (values: string[]) => {
      setOpenValues(values);
      accordionMemory.set(location.pathname, values.join(","));
      const next = new URLSearchParams(searchParams);
      if (values.length > 0) next.set("open", values.join(","));
      else next.delete("open");
      setSearchParams(next);
    },
    [searchParams, setSearchParams, location.pathname],
  );

  return { openValues, handleAccordionChange } as const;
}
