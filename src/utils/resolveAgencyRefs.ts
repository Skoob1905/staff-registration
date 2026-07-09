import { getAgency } from "../services/firestore";
import { getClientRef } from "./getClientRef";

export const resolveAgencyRefs = async (ids: string[]): Promise<string[]> => {
  const refs: string[] = [];
  for (const id of ids) {
    const data = await getAgency(id);
    refs.push(data ? getClientRef(data) : id);
  }
  return refs;
};
