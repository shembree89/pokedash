import { useEffect, useState } from "react";
import { loadData, type DataBundle } from "./loader";

type Status =
  | { state: "loading" }
  | { state: "ready"; data: DataBundle }
  | { state: "error"; error: Error };

export function useData(): Status {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    loadData()
      .then((data) => alive && setStatus({ state: "ready", data }))
      .catch((e) => alive && setStatus({ state: "error", error: e as Error }));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
