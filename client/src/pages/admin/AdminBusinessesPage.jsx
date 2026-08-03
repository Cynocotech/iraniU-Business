import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPatch } from "../../api.js";
import { useAdminPanelSearch } from "../../context/AdminPanelSearchContext.jsx";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500];
const DEFAULT_PAGE_SIZE = 10;

const CITY_OPTIONS = [
  "North London",
  "West London",
  "South London",
  "East London",
  "Central London",
  "London",
];

const CATEGORY_OPTIONS = [
  "رستوران","وکیل","بازسازی خانه","آرایشگاه","سالن زیبایی","دندانپزشک",
  "خدمات ساختمان","فروشگاه","مکانیک","پیتزا و ساندویچ","فرش","کافی شاپ",
  "کلینیک زیبایی","سایر خدمات","شرکت های صنعتی","خدمات مالی","صرافی",
  "دکتر","مشاور","آموزش","طراحی","بیمه","حمل و نقل","تعمیرات",
];

function fmtDate(str) {
  if (!str) return null;
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

function sortBusinessRows(list) {
  list.sort((a, b) => {
    const pa = a.listing_approval === "pending" ? 0 : 1;
    const pb = b.listing_approval === "pending" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return String(a.name_fa || "").localeCompare(String(b.name_fa || ""), "fa");
  });
}

function rowIsActive(r) {
  const s = r.status;
  return s == null || s === "" || s === "active";
}

export default function AdminBusinessesPage() {
  const { query, setQuery } = useAdminPanelSearch();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rows, setRows] = useState([]);
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [listMeta, setListMeta] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sendingSlug, setSendingSlug] = useState(null);
  const [toast, setToast] = useState(null);
  const [rejectSlug, setRejectSlug] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [claimingSlug, setClaimingSlug] = useState(null);
  const [claimModalSlug, setClaimModalSlug] = useState(null);
  const [filterApproval, setFilterApproval] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterClaimed, setFilterClaimed] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const selectAllRef = useRef(null);

  const fetchFromServer = useCallback(async (q, pageNum, limit, filters = {}) => {
    const params = new URLSearchParams({
      q,
      page: pageNum,
      limit,
      ...(filters.approval  ? { approval:  filters.approval  } : {}),
      ...(filters.city      ? { city:      filters.city      } : {}),
      ...(filters.claimed   ? { claimed:   filters.claimed   } : {}),
      ...(filters.category  ? { category:  filters.category  } : {}),
    });
    const raw = await apiGet(`/api/admin/businesses-search?${params.toString()}`);
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    sortBusinessRows(items);
    setRows(items);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      setListMeta({
        total: Number(raw.total) || 0,
        page: Number(raw.page) || 1,
        totalPages: Math.max(1, Number(raw.totalPages) || 1),
        pageSize: Number(raw.pageSize) || limit,
      });
      if (Number.isFinite(raw.page)) setPage(Number(raw.page));
    } else {
      setListMeta({
        total: items.length,
        page: 1,
        totalPages: 1,
        pageSize: limit,
      });
    }
  }, []);

  useEffect(() => {
    return () => setQuery("");
  }, [setQuery]);

  useEffect(() => {
    const ms = String(query).trim() ? 300 : 0;
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, ms);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setPage(1); }, [filterApproval, filterCity, filterClaimed, filterCategory]);

  useEffect(() => {
    let cancelled = false;
    const q = debouncedQuery;
    const p = page;
    const filters = { approval: filterApproval, city: filterCity, claimed: filterClaimed, category: filterCategory };
    (async () => {
      setErr(null);
      if (String(q).trim() || filterApproval || filterCity || filterClaimed || filterCategory) {
        setSearching(true);
      } else {
        setLoading(true);
      }
      try {
        await fetchFromServer(q, p, pageSize, filters);
      } catch {
        if (!cancelled) setErr("بارگذاری یا جستجو ناموفق بود. سرور را بررسی کنید.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSearching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, page, pageSize, filterApproval, filterCity, filterClaimed, filterCategory, fetchFromServer]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const ps = rows.map((r) => r.slug);
    const all = ps.length > 0 && ps.every((s) => selectedSlugs.includes(s));
    const some = ps.some((s) => selectedSlugs.includes(s));
    el.indeterminate = !all && some;
  }, [rows, selectedSlugs]);

  const refetchAfterMutation = async () => {
    setErr(null);
    setSearching(true);
    const filters = { approval: filterApproval, city: filterCity, claimed: filterClaimed, category: filterCategory };
    try {
      await fetchFromServer(debouncedQuery, page, pageSize, filters);
    } catch {
      setErr("بارگذاری ناموفق بود.");
    } finally {
      setSearching(false);
      setLoading(false);
    }
  };

  const setApproval = async (slug, action) => {
    setToast(null);
    setSendingSlug(slug + action);
    try {
      await apiPost(`/api/admin/businesses/${encodeURIComponent(slug)}/approve`, {});
      setToast({ type: "ok", text: "آگهی تأیید و در سایت منتشر شد؛ در صورت وجود ایمیل تماس، اطلاع‌رسانی ارسال می‌شود." });
      await refetchAfterMutation();
    } catch (e) {
      setToast({ type: "err", text: e.message || String(e) });
    } finally {
      setSendingSlug(null);
    }
  };

  const openRejectModal = (slug) => {
    setRejectSlug(slug);
    setRejectReason("");
    setToast(null);
  };

  const openClaimModal = (slug) => {
    setClaimModalSlug(slug);
  };

  const closeClaimModal = () => {
    if (claimingSlug) return;
    setClaimModalSlug(null);
  };

  const confirmMarkAsClaimed = async () => {
    if (!claimModalSlug || claimingSlug) return;

    setClaimingSlug(claimModalSlug);
    try {
      await apiPatch(`/api/businesses/${encodeURIComponent(claimModalSlug)}`, { claimed: 1 });
      setRows(prev => prev.map(r => r.slug === claimModalSlug ? { ...r, claimed: 1 } : r));
      setToast({ msg: `✅ ${claimModalSlug} marked as Claimed`, type: "success" });
      setTimeout(() => setToast(null), 3000);
      setClaimModalSlug(null);
    } catch (err) {
      setToast({ msg: `❌ Error: ${err.message}`, type: "error" });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setClaimingSlug(null);
    }
  };

  const handleUnclaim = async (slug) => {
    if (!window.confirm(`آیا مطمئن هستید؟ وضعیت "مالک‌دار" از آگهی ${slug} حذف می‌شود.`)) return;
    try {
      await apiPost(`/api/admin/businesses/${encodeURIComponent(slug)}/unclaim`, {});
      setRows(prev => prev.map(r => r.slug === slug ? { ...r, claimed: 0, manager_id: null, exchange_manager_id: null } : r));
      setToast({ type: "ok", text: `✅ وضعیت مالک‌دار از ${slug} برداشته شد.` });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({ type: "err", text: err.message || String(err) });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const closeRejectModal = () => {
    if (sendingSlug) return;
    setRejectSlug(null);
    setRejectReason("");
  };

  const confirmReject = async () => {
    const reason = rejectReason.trim();
    if (reason.length < 4) {
      setToast({ type: "err", text: "لطفاً دلیل رد را بنویسید (حداقل چند کاراکتر)." });
      return;
    }
    if (!rejectSlug) return;
    setToast(null);
    setSendingSlug(rejectSlug + "reject");
    try {
      await apiPost(`/api/admin/businesses/${encodeURIComponent(rejectSlug)}/reject`, { reason });
      setToast({ type: "ok", text: "آگهی رد شد؛ در صورت وجود ایمیل تماس، دلیل رد ارسال می‌شود." });
      setRejectSlug(null);
      setRejectReason("");
      await refetchAfterMutation();
    } catch (e) {
      setToast({ type: "err", text: e.message || String(e) });
    } finally {
      setSendingSlug(null);
    }
  };

  const sendToTelegram = async (slug) => {
    setToast(null);
    setSendingSlug(slug);
    try {
      await apiPost(`/api/admin/businesses/${encodeURIComponent(slug)}/send-to-telegram-channel`, {});
      setToast({ type: "ok", text: "آگهی در کانال دایرکتوری منتشر شد." });
      await refetchAfterMutation();
    } catch (e) {
      setToast({ type: "err", text: e.message || String(e) });
    } finally {
      setSendingSlug(null);
    }
  };

  const pageSlugs = rows.map((r) => r.slug);
  const allOnPageSelected = pageSlugs.length > 0 && pageSlugs.every((s) => selectedSlugs.includes(s));

  const toggleSlug = (slug) => {
    setSelectedSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      setSelectedSlugs((prev) => prev.filter((s) => !pageSlugs.includes(s)));
    } else {
      setSelectedSlugs((prev) => [...new Set([...prev, ...pageSlugs])]);
    }
  };

  const dedupeByName = async () => {
    setToast(null);
    setSearching(true);
    try {
      const preview = await apiGet("/api/admin/businesses/duplicate-names");
      const n = Number(preview.total_remove) || 0;
      if (n === 0) {
        setToast({ type: "ok", text: "آگهی با نام تکراری پیدا نشد." });
        return;
      }
      const ok = window.confirm(
        `نام‌های تکراری: ${preview.duplicate_name_count}\n` +
          `تعداد آگهی‌هایی که حذف می‌شوند: ${n}\n\n` +
          `در هر گروه، آگهی با شناسهٔ کم‌تر (قدیمی‌تر) نگه داشته می‌شود؛ بقیه با وابستگی‌ها (کلیک، گزارش، …) حذف می‌شوند.\n` +
          `این کار برگشت‌پذیر نیست. ادامه؟`
      );
      if (!ok) return;
      const data = await apiPost("/api/admin/businesses/dedupe-by-name", {});
      const removed = data.removed_count ?? 0;
      const fc = data.failed?.length ?? 0;
      setToast({
        type: "ok",
        text:
          fc > 0
            ? `حذف شد: ${removed} آگهی؛ ${fc} مورد خطا (جزئیات در لاگ سرور).`
            : `حذف شد: ${removed} آگهی تکراری (${preview.duplicate_name_count} نام تکراری).`,
      });
      await refetchAfterMutation();
    } catch (e) {
      setToast({ type: "err", text: e.message || String(e) });
    } finally {
      setSearching(false);
    }
  };

  const bulkDeleteSelected = async () => {
    if (selectedSlugs.length === 0) return;
    if (
      !window.confirm(
        `حذف ${selectedSlugs.length} آگهی انتخاب‌شده؟ ردیف‌های وابسته (کلیک، گزارش، ادعا، …) هم پاک می‌شود. این کار برگشت‌پذیر نیست.`
      )
    ) {
      return;
    }
    setToast(null);
    setSearching(true);
    try {
      const data = await apiPost("/api/admin/businesses/bulk-delete", { slugs: selectedSlugs });
      const n = data.deleted?.length ?? 0;
      setSelectedSlugs([]);
      setToast({
        type: "ok",
        text:
          n > 0
            ? `حذف شد: ${n} آگهی${data.not_found?.length ? ` (${data.not_found.length} نامک از قبل نبود)` : ""}`
            : "هیچ آگهی حذف نشد.",
      });
      await refetchAfterMutation();
    } catch (e) {
      setToast({ type: "err", text: e.message || String(e) });
    } finally {
      setSearching(false);
    }
  };

  const qTrim = query.trim();
  const dqTrim = debouncedQuery.trim();
  const hasFilter = dqTrim.length > 0 || !!filterApproval || !!filterCity || !!filterClaimed || !!filterCategory;
  const searchPending = qTrim !== dqTrim;
  const { total, totalPages } = listMeta;
  const displayPage = listMeta.page;
  const canPrev = displayPage > 1;
  const canNext = displayPage < totalPages;

  return (
    <>
      <div className="panel-page-title">
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>همه آگهی‌ها</h2>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.2rem 0 0" }}>
            <Link to="/admin">← داشبورد</Link>
            {" · "}
            <Link to="/admin-edit">ویرایش آگهی</Link>
          </p>
        </div>
      </div>
      <div className="panel-card">
        <div className="panel-card__head">
          <h3 className="panel-card__title">فهرست آگهی‌ها</h3>
        </div>
        <div className="panel-card__body" style={{ paddingBottom: 0 }}>

        <div
          className="dashboard-actions"
          style={{
            marginBottom: "var(--space-md)",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="admin-businesses-page-size" style={{ marginInlineEnd: "0.5rem" }}>
              تعداد در هر صفحه
            </label>
            <select
              id="admin-businesses-page-size"
              value={pageSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPageSize(Number.isFinite(n) ? n : DEFAULT_PAGE_SIZE);
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={selectedSlugs.length === 0 || !!sendingSlug || searching}
            onClick={bulkDeleteSelected}
            title="حذف آگهی‌های تیک‌خورده"
          >
            حذف انتخاب‌شده‌ها ({selectedSlugs.length})
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!!sendingSlug || searching}
            onClick={dedupeByName}
            title="آگهی‌هایی که پس از یکسان‌سازی نام، تکراری‌اند؛ قدیمی‌ترین (id کم‌تر) می‌ماند"
          >
            حذف تکراری‌ها (نام یکسان)
          </button>
        </div>

        {/* ── Filters ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "flex-end", marginBottom: "var(--space-md)" }}>
          <div className="field" style={{ margin: 0, minWidth: 140 }}>
            <label htmlFor="filter-approval" style={{ fontSize: "0.8rem", marginBottom: "0.2rem", display: "block" }}>وضعیت تأیید</label>
            <select id="filter-approval" value={filterApproval} onChange={(e) => setFilterApproval(e.target.value)}>
              <option value="">همه</option>
              <option value="approved">تأیید شده</option>
              <option value="pending">در انتظار</option>
              <option value="rejected">رد شده</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 160 }}>
            <label htmlFor="filter-city" style={{ fontSize: "0.8rem", marginBottom: "0.2rem", display: "block" }}>منطقه</label>
            <select id="filter-city" value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
              <option value="">همه مناطق</option>
              {CITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 140 }}>
            <label htmlFor="filter-claimed" style={{ fontSize: "0.8rem", marginBottom: "0.2rem", display: "block" }}>مالکیت</label>
            <select id="filter-claimed" value={filterClaimed} onChange={(e) => setFilterClaimed(e.target.value)}>
              <option value="">همه</option>
              <option value="claimed">مالک‌دار</option>
              <option value="unclaimed">بدون مالک</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 160 }}>
            <label htmlFor="filter-category" style={{ fontSize: "0.8rem", marginBottom: "0.2rem", display: "block" }}>دسته‌بندی</label>
            <select id="filter-category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">همه دسته‌ها</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {(filterApproval || filterCity || filterClaimed || filterCategory) && (
            <button
              type="button"
              className="btn btn--ghost"
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem", alignSelf: "flex-end" }}
              onClick={() => { setFilterApproval(""); setFilterCity(""); setFilterClaimed(""); setFilterCategory(""); }}
            >
              پاک کردن فیلترها ✕
            </button>
          )}
        </div>

        <div className="field field--block" style={{ maxWidth: "min(100%, 28rem)", marginBottom: "var(--space-md)" }}>
          <label htmlFor="admin-businesses-ajax-search">جستجو</label>
          <input
            id="admin-businesses-ajax-search"
            type="search"
            className="app-shell__search"
            style={{ width: "100%", maxWidth: "100%" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="نام، نامک، شهر، تلفن، شناسه، IU-…"
            autoComplete="off"
            aria-busy={searching || searchPending}
          />
        </div>

        {!loading && !err && (
          <p className="field-hint" role="status">
            {searching || searchPending ? (
              "در حال بارگذاری…"
            ) : hasFilter ? (
              <>
                نمایش <strong dir="ltr">{rows.length}</strong> آگهی در این صفحه، از مجموع <strong dir="ltr">{total}</strong> نتیجهٔ جستجو
                {rows.length === 0 && " — عبارت دیگری امتحان کنید یا جستجو را خالی کنید."}
              </>
            ) : (
              <>
                مجموع <strong dir="ltr">{total}</strong> آگهی — صفحه <strong dir="ltr">{displayPage}</strong> از <strong dir="ltr">{totalPages}</strong> (
                <strong dir="ltr">{listMeta.pageSize || pageSize}</strong> آگهی در هر صفحه)
              </>
            )}
          </p>
        )}

        {loading && <p className="field-hint">در حال بارگذاری…</p>}
        {!loading && searching && !hasFilter && <p className="field-hint">در حال به‌روزرسانی…</p>}
        {err && <p className="field-hint">{err}</p>}
        {toast && (
          <p
            className="field-hint"
            style={{
              color: toast.type === "ok" ? "var(--color-success, #2e7d32)" : "#b71c1c",
              marginBottom: "var(--space-sm)",
            }}
          >
            {toast.text}
          </p>
        )}
        {!loading && !err && (
          <div
            style={{ position: "relative", opacity: searching || searchPending ? 0.65 : 1, transition: "opacity 0.15s" }}
          >
            {(searching || searchPending) && (
              <span className="visually-hidden" aria-live="polite">
                در حال بارگذاری
              </span>
            )}
            <div className="panel-biz-list">
              {rows.map((r) => (
                <div className="panel-biz-item" key={r.slug}>
                  <div className="panel-biz-item__avatar" style={{
                    background: rowIsActive(r)
                      ? "linear-gradient(135deg,#6366f1,#a78bfa)"
                      : "linear-gradient(135deg,#94a3b8,#cbd5e1)"
                  }}>
                    {(r.name_fa || r.slug || "?")[0]}
                  </div>
                  <div className="panel-biz-item__body">
                    <p className="panel-biz-item__name">{r.name_fa || r.slug}</p>
                    <p className="panel-biz-item__meta" dir="ltr">
                      {[r.slug, r.category, r.city].filter(Boolean).join(" · ")}
                    </p>
                    {fmtDate(r.created_at) && (
                      <p className="panel-biz-item__meta" style={{ color: "#94a3b8", marginTop: "0.1rem" }}>
                        افزوده: {fmtDate(r.created_at)}
                      </p>
                    )}
                    {r.postcode_admin_ward && (
                      <p className="panel-biz-item__meta" dir="ltr" style={{ color: "#0369a1", marginTop: "0.1rem" }}>
                        📍 {r.postcode_admin_ward}
                        {r.postcode_primary_care_trust ? ` · ${r.postcode_primary_care_trust}` : ""}
                        {r.postcode_latitude ? ` (${Number(r.postcode_latitude).toFixed(4)}, ${Number(r.postcode_longitude).toFixed(4)})` : ""}
                      </p>
                    )}
                  </div>
                  <div className="panel-biz-item__badges">
                    {r.listing_approval === "pending" && (
                      <span className="pbadge pbadge--yellow">در انتظار</span>
                    )}
                    {r.listing_approval === "rejected" && (
                      <span className="pbadge pbadge--red">رد شده</span>
                    )}
                    {(!r.listing_approval || r.listing_approval === "approved") ? (
                      <span className={`pbadge ${rowIsActive(r) ? "pbadge--green" : "pbadge--red"}`}>
                        {rowIsActive(r) ? "فعال" : "غیرفعال"}
                      </span>
                    ) : null}
                    {r.claimed === 1 && <span className="pbadge pbadge--purple">مالک‌دار</span>}
                  </div>
                  <div className="panel-biz-item__actions">
                    {(r.listing_approval === "pending" || r.listing_approval === "rejected") && (
                      <button
                        type="button"
                        className="pact-btn pact-btn--green"
                        disabled={!!sendingSlug}
                        onClick={() => setApproval(r.slug, "approve")}
                      >
                        {sendingSlug === r.slug + "approve" ? "…" : "تأیید"}
                      </button>
                    )}
                    {r.listing_approval === "pending" && (
                      <button type="button" className="pact-btn pact-btn--danger" disabled={!!sendingSlug} onClick={() => openRejectModal(r.slug)}>
                        رد
                      </button>
                    )}
                    <Link className="pact-btn pact-btn--primary" to={`/admin-edit?slug=${encodeURIComponent(r.slug)}`}>
                      ویرایش
                    </Link>
                    <Link className="pact-btn pact-btn--ghost" to={`/business?slug=${encodeURIComponent(r.slug)}`} target="_blank" rel="noreferrer">
                      پیش‌نمایش
                    </Link>
                    <button type="button" className="pact-btn pact-btn--ghost" disabled={!!sendingSlug} onClick={() => sendToTelegram(r.slug)} title="ارسال به تلگرام">
                      <i className="fa-brands fa-telegram" />
                    </button>
                    {!r.claimed && (
                      <button type="button" className="pact-btn pact-btn--danger" disabled={!!claimingSlug} onClick={() => openClaimModal(r.slug)} title="Mark Claimed">
                        <i className="fa-solid fa-xmark" />
                      </button>
                    )}
                    {r.claimed === 1 && (
                      <button type="button" className="pact-btn pact-btn--ghost" onClick={() => handleUnclaim(r.slug)} style={{ fontSize: "0.7rem" }}>
                        Unclaim
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="panel-pager">
                <button className="panel-pager__btn" onClick={() => setPage((p) => p - 1)} disabled={!canPrev}>→</button>
                <span className="panel-pager__info">صفحه {displayPage} از {totalPages}</span>
                <button className="panel-pager__btn" onClick={() => setPage((p) => p + 1)} disabled={!canNext}>←</button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {rejectSlug ? (
        <div
          className="admin-reject-modal-overlay"
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={closeRejectModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reject-title"
            className="dashboard-panel"
            style={{
              maxWidth: "26rem",
              width: "100%",
              margin: 0,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-reject-title" style={{ marginTop: 0, fontSize: "1.1rem" }}>
              رد آگهی
            </h2>
            <p className="field-hint" style={{ marginTop: 0 }}>
              دلیل رد را بنویسید؛ این متن در ایمیل اطلاع‌رسانی (در صورت وجود ایمیل تماس در آگهی) به متقاضی ارسال می‌شود.
            </p>
            <div className="field field--block">
              <label htmlFor="admin-reject-reason">دلیل رد</label>
              <textarea
                id="admin-reject-reason"
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="مثلاً اطلاعات ناقص، تکراری بودن، یا عدم تطابق با قوانین…"
                style={{ width: "100%" }}
              />
            </div>
            <div className="dashboard-actions dashboard-actions--inline" style={{ borderTop: "none", marginTop: "0.75rem" }}>
              <button type="button" className="btn btn--ghost" onClick={closeRejectModal} disabled={!!sendingSlug}>
                انصراف
              </button>
              <button type="button" className="btn btn--primary" onClick={confirmReject} disabled={!!sendingSlug}>
                {sendingSlug === rejectSlug + "reject" ? "در حال رد…" : "تأیید رد"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {claimModalSlug ? (
        <div
          className="admin-claim-modal-overlay"
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={closeClaimModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-claim-title"
            className="dashboard-panel"
            style={{
              maxWidth: "28rem",
              width: "100%",
              margin: 0,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-claim-title" style={{ marginTop: 0, fontSize: "1.2rem", color: "#10b981" }}>
              ✓ Mark as Claimed
            </h2>
            <p style={{ marginTop: "0.75rem", marginBottom: "1rem", lineHeight: 1.6 }}>
              Are you sure you want to mark <strong style={{ color: "#10b981" }}>"{claimModalSlug}"</strong> as claimed?
            </p>
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: "6px",
                padding: "0.75rem",
                marginBottom: "1rem"
              }}
            >
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#166534" }}>
                <strong>What this does:</strong>
              </p>
              <ul style={{ margin: "0.5rem 0 0 0", paddingInlineStart: "1.5rem", fontSize: "0.9rem", color: "#166534" }}>
                <li>Hides the public "Claim Ownership" button</li>
                <li>Marks business as verified/claimed</li>
                <li>Shows "آگهی تأییدشده" message to users</li>
              </ul>
            </div>
            <p className="field-hint" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
              <strong>Note:</strong> This action can be reverted by updating the database manually if needed.
            </p>
            <div className="dashboard-actions dashboard-actions--inline" style={{ borderTop: "none", marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeClaimModal}
                disabled={!!claimingSlug}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={confirmMarkAsClaimed}
                disabled={!!claimingSlug}
                style={{
                  background: "#10b981",
                  borderColor: "#10b981"
                }}
              >
                {claimingSlug ? "Marking as Claimed..." : "✓ Yes, Mark as Claimed"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
