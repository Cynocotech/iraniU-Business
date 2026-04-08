import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet } from "../api.js";
import { useAuth } from "./AuthContext.jsx";
import { pickPreferredManagerSlug } from "../lib/managerDashboardSlug.js";

export const STORAGE_SLUG = "iraniu_dashboard_business_slug";

function readImpersonation() {
  try {
    const s = sessionStorage.getItem("iraniu_impersonate");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { me, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [heroQr, setHeroQr] = useState("—");
  const [dashSlug, setDashSlug] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_SLUG) || "clinic-pars";
    } catch {
      return "clinic-pars";
    }
  });
  const [biz, setBiz] = useState(null);
  const [phoneClickCount, setPhoneClickCount] = useState(null);
  const [impersonation, setImpersonation] = useState(() => readImpersonation());
  const [twilioModuleEnabled, setTwilioModuleEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet("/api/twilio-module-status")
      .then((d) => {
        if (!cancelled && d && typeof d.enabled === "boolean") setTwilioModuleEnabled(d.enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGet(`/api/businesses/${encodeURIComponent(dashSlug)}`)
      .then((b) => {
        if (!cancelled) setBiz(b);
      })
      .catch(() => {
        if (!cancelled) setBiz(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dashSlug]);

  /** هم‌تراز با آگهی‌های واقعی مدیر؛ از نامک قدیمی localStorage جلوگیری می‌کند */
  useEffect(() => {
    if (authLoading) return;
    if (impersonation) return;
    if (me?.role !== "manager") return;
    let cancelled = false;
    const fallback = Array.isArray(me?.user?.linked_businesses) ? me.user.linked_businesses : [];

    const syncFromLinked = (linked) => {
      if (!Array.isArray(linked) || linked.length === 0) return;
      const preferred = pickPreferredManagerSlug(linked);
      if (!preferred) return;

      let forceExchange = false;
      try {
        if (sessionStorage.getItem("iraniu_exchange_onboarding") === "1") {
          sessionStorage.removeItem("iraniu_exchange_onboarding");
          forceExchange = true;
        }
      } catch (_) {}

      const inList = linked.some((b) => b.slug === dashSlug);
      if ((forceExchange || !inList) && dashSlug !== preferred) {
        try {
          localStorage.setItem(STORAGE_SLUG, preferred);
        } catch (_) {}
        setDashSlug(preferred);
      }
    };

    apiGet("/api/manager/linked-businesses")
      .then((d) => {
        if (cancelled) return;
        const linked = Array.isArray(d?.linked_businesses) ? d.linked_businesses : fallback;
        syncFromLinked(linked);
      })
      .catch(() => {
        if (!cancelled) syncFromLinked(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, me, impersonation, dashSlug]);

  const asManagerParam = searchParams.get("asManager");
  const asExchangeManagerParam = searchParams.get("asExchangeManager");

  useEffect(() => {
    const managerParam = asManagerParam || asExchangeManagerParam;
    if (!managerParam) return;
    const id = parseInt(String(managerParam), 10);
    if (!Number.isFinite(id)) {
      setSearchParams({}, { replace: true });
      return;
    }
    const endpoint = asExchangeManagerParam ? `/api/exchange-managers/${id}` : `/api/managers/${id}`;
    let cancelled = false;
    apiGet(endpoint)
      .then((data) => {
        if (cancelled) return;
        const list = data.linked_businesses || [];
        const noBusiness = list.length === 0;
        try {
          sessionStorage.setItem(
            "iraniu_impersonate",
            JSON.stringify({
              managerId: data.id,
              name: data.name,
              email: data.email,
              phone: data.phone || "",
              noBusiness,
            })
          );
        } catch (_) {}
        setImpersonation({
          managerId: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone || "",
          noBusiness,
        });
        if (list.length > 0) {
          const slug = pickPreferredManagerSlug(list) || list[0].slug;
          try {
            localStorage.setItem(STORAGE_SLUG, slug);
          } catch (_) {}
          setDashSlug(slug);
        }
        setSearchParams({}, { replace: true });
      })
      .catch(() => {
        if (!cancelled) setSearchParams({}, { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [asManagerParam, asExchangeManagerParam, setSearchParams]);

  const onSlugChange = useCallback((s) => {
    try {
      localStorage.setItem(STORAGE_SLUG, s);
    } catch (_) {}
    setDashSlug(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhoneClickCount(null);
    apiGet(`/api/phone/stats/${encodeURIComponent(dashSlug)}`)
      .then((d) => {
        if (cancelled) return;
        const n = d && typeof d.count === "number" ? d.count : 0;
        setPhoneClickCount(n);
      })
      .catch(() => {
        if (!cancelled) setPhoneClickCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dashSlug]);

  const endImpersonation = useCallback(() => {
    try {
      sessionStorage.removeItem("iraniu_impersonate");
    } catch (_) {}
    setImpersonation(null);
    navigate("/admin-managers");
  }, [navigate]);

  const value = useMemo(
    () => ({
      dashSlug,
      setDashSlug,
      onSlugChange,
      biz,
      setBiz,
      heroQr,
      setHeroQr,
      phoneClickCount,
      impersonation,
      endImpersonation,
      twilioModuleEnabled,
    }),
    [dashSlug, onSlugChange, biz, setBiz, heroQr, phoneClickCount, impersonation, endImpersonation, twilioModuleEnabled]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used under DashboardProvider");
  return ctx;
}
