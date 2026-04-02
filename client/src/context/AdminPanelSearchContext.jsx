import { createContext, useContext, useMemo, useState } from "react";

const AdminPanelSearchContext = createContext(null);

export function AdminPanelSearchProvider({ children }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <AdminPanelSearchContext.Provider value={value}>{children}</AdminPanelSearchContext.Provider>;
}

export function useAdminPanelSearch() {
  const v = useContext(AdminPanelSearchContext);
  if (!v) {
    return { query: "", setQuery: () => {} };
  }
  return v;
}
