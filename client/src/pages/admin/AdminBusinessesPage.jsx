import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../../api.js";
import { useAdminPanelSearch } from "../../context/AdminPanelSearchContext.jsx";

const PAGE_SIZE = 10;

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
  const [rows, setRows] = useState([]);
  const [listMeta, setListMeta] = useState({ total: 0, page: 1, totalPages: 1, pageSize: PAGE_SIZE });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sendingSlug, setSendingSlug] = useState(null);
  const [toast, setToast] = useState(null);
  const [rejectSlug, setRejectSlug] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchFromServer = useCallback(async (q, pageNum) => {
    const raw = await apiGet(
      `/api/admin/businesses-search?q=${encodeURIComponent(q)}&page=${pageNum}&limit=${PAGE_SIZE}`
    );
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    sortBusinessRows(items);
    setRows(items);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      setListMeta({
        total: Number(raw.total) || 0,
        page: Number(raw.page) || 1,
        totalPages: Math.max(1, Number(raw.totalPages) || 1),
        pageSize: Number(raw.pageSize) || PAGE_SIZE,
      });
      if (Number.isFinite(raw.page)) setPage(Number(raw.page));
    } else {
      setListMeta({
        total: items.length,
        page: 1,
        totalPages: 1,
        pageSize: PAGE_SIZE,
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

  useEffect(() => {
    let cancelled = false;
    const q = debouncedQuery;
    const p = page;
    (async () => {
      setErr(null);
      if (String(q).trim()) {
        setSearching(true);
      } else {
        setLoading(true);
      }
      try {
        await fetchFromServer(q, p);
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
  }, [debouncedQuery, page, fetchFromServer]);

  const refetchAfterMutation = async () => {
    setErr(null);
    setSearching(true);
    try {
      await fetchFromServer(debouncedQuery, page);
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

  const qTrim = query.trim();
  const dqTrim = debouncedQuery.trim();
  const hasFilter = dqTrim.length > 0;
  const searchPending = qTrim !== dqTrim;
  const { total, totalPages } = listMeta;
  const displayPage = listMeta.page;
  const canPrev = displayPage > 1;
  const canNext = displayPage < totalPages;

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
        {" · "}
        <Link to="/admin-edit">ویرایش آگهی</Link>
      </p>
      <section className="dashboard-panel">
        <h2>همه آگهی‌ها</h2>
        <p className="field-hint">
          آگهی‌های ثبت‌شده از فرم عمومی «ثبت کسب‌وکار» تا زمان تأیید شما در ستون «انتشار» در حالت «در انتظار» می‌مانند و در سایت دیده نمی‌شوند.
          آگهی با وضعیت «غیرفعال» در سایت عمومی نمایش داده نمی‌شود. جستجو با تأخیر کوتاه (Ajax) از سرور انجام می‌شود؛ هر صفحه حداکثر {PAGE_SIZE}{" "}
          آگهی است. فیلد زیر با نوار جستجوی بالای پنل یکی است.
        </p>

        <div className="field field--block" style={{ maxWidth: "min(100%, 28rem)", marginBottom: "var(--space-md)" }}>
          <label htmlFor="admin-businesses-ajax-search">جستجوی Ajax در آگهی‌ها</label>
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
                مجموع <strong dir="ltr">{total}</strong> آگهی — صفحه <strong dir="ltr">{displayPage}</strong> از <strong dir="ltr">{totalPages}</strong> ({PAGE_SIZE}{" "}
                آگهی در هر صفحه)
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
            className="table-wrap"
            style={{ position: "relative", opacity: searching || searchPending ? 0.65 : 1, transition: "opacity 0.15s" }}
          >
            {(searching || searchPending) && (
              <span className="visually-hidden" aria-live="polite">
                در حال بارگذاری
              </span>
            )}
            <table className="data-table">
              <thead>
                <tr>
                  <th>نام</th>
                  <th>نامک</th>
                  <th>دسته</th>
                  <th>انتشار</th>
                  <th>پذیرش قوانین</th>
                  <th>وضعیت آگهی</th>
                  <th>پیش‌نمایش</th>
                  <th>کانال تلگرام</th>
                  <th>اقدام</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.slug}>
                    <td>{r.name_fa}</td>
                    <td>
                      <span lang="en" dir="ltr">
                        {r.slug}
                      </span>
                    </td>
                    <td>{r.category}</td>
                    <td>
                      {r.listing_approval === "pending" ? (
                        <span className="status-pill" style={{ background: "rgba(183, 28, 28, 0.12)", color: "#b71c1c" }}>
                          در انتظار تأیید
                        </span>
                      ) : r.listing_approval === "rejected" ? (
                        <span className="status-pill">رد شده</span>
                      ) : (
                        <span className="status-pill status-pill--claimed">منتشر شده</span>
                      )}
                    </td>
                    <td dir="ltr" style={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
                      {r.listing_terms_accepted_at ? (
                        <>
                          <span style={{ fontWeight: 600 }} title={`نسخهٔ متن: ${r.listing_terms_version || "—"}`}>
                            نسخه {r.listing_terms_version || "—"}
                          </span>
                          <br />
                          <time dateTime={r.listing_terms_accepted_at}>
                            {new Date(r.listing_terms_accepted_at).toLocaleString("fa-IR")}
                          </time>
                        </>
                      ) : (
                        <span className="field-hint">—</span>
                      )}
                    </td>
                    <td>
                      <span className={rowIsActive(r) ? "status-pill status-pill--claimed" : "status-pill"}>
                        {rowIsActive(r) ? "فعال" : "غیرفعال"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="btn btn--ghost"
                        to={`/business?slug=${encodeURIComponent(r.slug)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        پیش‌نمایش
                      </Link>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--accent"
                        disabled={!!sendingSlug}
                        onClick={() => sendToTelegram(r.slug)}
                        title="ارسال به کانال دایرکتوری ایرانیو (نیاز به تنظیم ربات و کانال در سرور)"
                      >
                        {sendingSlug === r.slug ? "در حال ارسال…" : "ارسال به کانال"}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                        {(r.listing_approval === "pending" || r.listing_approval === "rejected") && (
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={!!sendingSlug}
                            onClick={() => setApproval(r.slug, "approve")}
                          >
                            {sendingSlug === r.slug + "approve" ? "…" : "تأیید انتشار"}
                          </button>
                        )}
                        {r.listing_approval === "pending" && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={!!sendingSlug}
                            onClick={() => openRejectModal(r.slug)}
                          >
                            رد
                          </button>
                        )}
                        <Link className="btn btn--primary" to={`/admin-edit?slug=${encodeURIComponent(r.slug)}`}>
                          ویرایش
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <nav
                className="field-hint"
                aria-label="صفحه‌بندی آگهی‌ها"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginTop: "var(--space-md)",
                  justifyContent: "flex-start",
                }}
              >
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!canPrev || searching || searchPending}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  صفحهٔ قبل
                </button>
                <span dir="ltr">
                  {displayPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!canNext || searching || searchPending}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  صفحهٔ بعد
                </button>
              </nav>
            )}
          </div>
        )}
      </section>

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
    </>
  );
}
