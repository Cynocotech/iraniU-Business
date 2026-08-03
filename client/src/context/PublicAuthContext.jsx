import { createContext, useContext, useEffect, useState } from "react";
import { getV1Token, setV1Token, clearV1Token, v1Get, v1Post } from "../api-v1.js";

const PublicAuthCtx = createContext(null);

export function PublicAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getV1Token();
    if (!t) { setLoading(false); return; }
    v1Get("/api/v1/auth/me")
      .then(setUser)
      .catch(() => clearV1Token())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await v1Post("/api/v1/auth/login", { email, password });
    setV1Token(res.token);
    setUser(res.user);
    return res;
  }

  async function register(name, email, password) {
    const res = await v1Post("/api/v1/auth/register", { name, email, password });
    setV1Token(res.token);
    setUser(res.user);
    return res;
  }

  function logout() {
    clearV1Token();
    setUser(null);
  }

  return (
    <PublicAuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </PublicAuthCtx.Provider>
  );
}

export function usePublicAuth() {
  const ctx = useContext(PublicAuthCtx);
  if (!ctx) throw new Error("usePublicAuth must be inside PublicAuthProvider");
  return ctx;
}
