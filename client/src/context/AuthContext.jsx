import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const TOKEN_KEY = "iraniu_jwt";

function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function writeToken(t) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch (_) {}
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => readToken());
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const setToken = useCallback((t) => {
    writeToken(t);
    setTokenState(t || "");
  }, []);

  const loadMe = useCallback(async () => {
    const t = readToken();
    if (!t) {
      setMe(null);
      setLoading(false);
      return null;
    }
    try {
      const r = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
        credentials: "include",
      });
      if (!r.ok) {
        writeToken("");
        setTokenState("");
        setMe(null);
        setLoading(false);
        return null;
      }
      const data = await r.json();
      setMe(data);
      setLoading(false);
      return data;
    } catch {
      writeToken("");
      setTokenState("");
      setMe(null);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    setTokenState(readToken());
    loadMe();
  }, [loadMe]);

  const logout = useCallback(() => {
    writeToken("");
    setTokenState("");
    setMe(null);
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  const loginManager = useCallback(
    async (email, password, totp) => {
      const r = await fetch("/api/auth/login/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, totp: totp || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(data.hint || data.error || String(r.status));
        if (data.error) err.code = data.error;
        throw err;
      }
      if (data.token) {
        writeToken(data.token);
        setTokenState(data.token);
      }
      await loadMe();
      return data;
    },
    [loadMe]
  );

  const loginAdmin = useCallback(
    async (email, password, totp) => {
      const r = await fetch("/api/auth/login/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, totp: totp || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(data.hint || data.error || String(r.status));
        if (data.error) err.code = data.error;
        throw err;
      }
      if (data.token) {
        writeToken(data.token);
        setTokenState(data.token);
      }
      await loadMe();
      return data;
    },
    [loadMe]
  );

  const value = useMemo(
    () => ({
      token,
      me,
      loading,
      setToken,
      loadMe,
      logout,
      loginManager,
      loginAdmin,
      isManager: me?.role === "manager",
      isSuperAdmin: me?.role === "superadmin",
    }),
    [token, me, loading, setToken, loadMe, logout, loginManager, loginAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used under AuthProvider");
  return ctx;
}
