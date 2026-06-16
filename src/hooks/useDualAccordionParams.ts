import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

const dualAccordionMemory = new Map<string, [string, string]>();

export function useDualAccordionParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const parseUrl = useCallback((): [string, string] => {
    const raw = searchParams.get("open") ?? "";
    const parts = raw.split(",");
    return [parts[0] ?? "", parts[1] ?? ""];
  }, [searchParams]);

  const [leftValue, setLeftValue] = useState<string>(() => {
    const [l] = parseUrl();
    if (l) return l;
    const memory = dualAccordionMemory.get(location.pathname);
    return memory?.[0] ?? "";
  });

  const [rightValue, setRightValue] = useState<string>(() => {
    const [, r] = parseUrl();
    if (r) return r;
    const memory = dualAccordionMemory.get(location.pathname);
    return memory?.[1] ?? "";
  });

  /* eslint-disable react-hooks/set-state-in-effect -- URL syncing with memory requires setState in effect */
  useEffect(() => {
    const [l, r] = parseUrl();
    if (l || r) {
      setLeftValue(l);
      setRightValue(r);
      dualAccordionMemory.set(location.pathname, [l, r]);
    } else {
      const memory = dualAccordionMemory.get(location.pathname);
      if (memory && (memory[0] || memory[1])) {
        const next = new URLSearchParams(searchParams);
        next.set("open", memory.join(","));
        setSearchParams(next, { replace: true });
      } else {
        setLeftValue("");
        setRightValue("");
      }
    }
  }, [searchParams, location.pathname, setSearchParams, parseUrl]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onLeftChange = useCallback(
    (value: string) => {
      setLeftValue(value);
      const next = new URLSearchParams(searchParams);
      next.set("open", [value, rightValue].join(","));
      setSearchParams(next);
      dualAccordionMemory.set(location.pathname, [value, rightValue]);
    },
    [searchParams, setSearchParams, location.pathname, rightValue],
  );

  const onRightChange = useCallback(
    (value: string) => {
      setRightValue(value);
      const next = new URLSearchParams(searchParams);
      next.set("open", [leftValue, value].join(","));
      setSearchParams(next);
      dualAccordionMemory.set(location.pathname, [leftValue, value]);
    },
    [searchParams, setSearchParams, location.pathname, leftValue],
  );

  return { leftValue, rightValue, onLeftChange, onRightChange } as const;
}
