import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatchJson, apiPost } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";
import {
  businessHasExchangeRatesData,
  isExchangeBusiness,
  parseExchangeRatesJson,
} from "../../lib/exchangeRates.js";

function rateSummary(exchangeRatesJson) {
  const rows = parseExchangeRatesJson(exchangeRatesJson);
  const filled = rows.filter(
    (r) => String(r?.buy || "").trim() || String(r?.sell || "").trim()
  );
  if (!filled.length) return "—";
  const codes = filled.map((r) => r.code).slice(0, 5);
  const more = filled.length > 5 ? ` +${filled.length - 5}` : "";
  return `${codes.join("، ")}${more}`;
}

function rowMatchesQuery(row, q) {
  const s = String(q || "")
    .trim()
    .toLowerCase();
  if (!s) return true;
  const hay = [
    row?.name_fa,
    row?.slug,
    row?.city,
    row?.category,
    row?.phone,
    formatAdId(row?.id),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

function rowIsActive(r) {
  const s = r.status;
  return s == null || s === "" || s === "active";
}

export default function AdminExchangesPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [togglingSlug, setTogglingSlug] = useState(null);
  const selectAllRef = useRef(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiGet("/api/businesses");
      const list = Array.isArray(data) ? data : [];
      setRows(list.filter(isExchangeBusiness));
    } catch {
      setErr("بارگذاری صرافی‌ها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) =>
      String(a?.name_fa || "").localeCompare(String(b?.name_fa || ""), "fa")
    );
  }, [rows]);

  const filtered = useMemo(() => {
    return sortedRows.filter((r) => rowMatchesQuery(r, query));
  }, [sortedRows, query]);

  const filteredSlugs = useMemo(() => filtered.map((r) => r.slug), [filtered]);

  const allFilteredSelected =
    filteredSlugs.length > 0 && filteredSlugs.every((s) => selectedSlugs.includes(s));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const some = filteredSlugs.some((s) => selectedSlugs.includes(s));
    el.indeterminate = !allFilteredSelected && some;
  }, [filteredSlugs, selectedSlugs, allFilteredSelected]);

  const toggleSelectAllFiltered = () => {
    if (filteredSlugs.length === 0) return;
    if (allFilteredSelected) {
      setSelectedSlugs((prev) => prev.filter((s) => !filteredSlugs.includes(s)));
    } else {
      setSelectedSlugs((prev) => [...new Set([...prev, ...filteredSlugs])]);
    }
  };

  const toggleRowSelected = (slug) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const patchRowStatus = (slug, status) => {
    setRows((prev) => prev.map((r) => (r.slug === slug ? { ...r, status } : r)));
  };

  const onToggleActive = async (r) => {
    const next = rowIsActive(r) ? "inactive" : "active";
    setTogglingSlug(r.slug);
    setToast(null);
    try {
      await apiPatchJson(`/api/businesses/${encodeURIComponent(r.slug)}`, { status: next });
      patchRowStatus(r.slug, next);
      setToast({ type: "ok", text: next === "active" ? "آگهی فعال شد." : "آگهی غیرفعال شد." });
    } catch (e) {
      setToast({ type: "err", text: e.message || String(e) });
    } finally {
      setTogglingSlug(null);
    }
  };

  const bulkDeleteSelected = async () => {
    if (selectedSlugs.length === 0) return;
    if (
      !window.confirm(
        `حذف ${selectedSlugs.length} صرافی انتخاب‌شده؟ ردیف‌های وابسته هم پاک می‌شود. برگشت ندارد.`
      )
    ) {
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const data = await apiPost("/api/admin/businesses/bulk-delete", { slugs: selectedSlugs });
      const n = data.deleted?.length ?? 0;
      setSelectedSlugs([]);
      setToast({
        type: "ok",
        text:
          n > 0
            ? `حذف شد: ${n} آگهی${data.not_found?.length ? ` (${data.not_found.length} نامک نبود)` : ""}`
            : "هیچ آگهی حذف نشد.",
      });
      await loadRows();
    } catch (e) {
      setToast({ type: "err", text: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-exchange-hub__panel dashboard-panel" aria-labelledby="admin-exchanges-list-h">
      <div className="admin-exchange-hub__panel-head">
        <div>
          <h2 id="admin-exchanges-list-h" style={{ margin: 0 }}>
            فهرست عملیاتی صرافی‌ها
          </h2>
          <p className="field-hint" style={{ margin: "0.35rem 0 0" }}>
            انتخاب، حذف گروهی، و فعال/غیرفعال کردن نمایش در سایت. ویرایش جزئیات از «ویرایش آگهی».
          </p>
        </div>
        <div className="admin-exchange-hub__stats" aria-live="polite">
          <span className="admin-exchange-hub__stat">
            <strong>{loading ? "…" : rows.length}</strong>
            <small>صرافی</small>
          </span>
          {!loading && query.trim() ? (
            <span className="admin-exchange-hub__stat">
              <strong>{filtered.length}</strong>
              <small>نتیجهٔ فیلتر</small>
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="dashboard-actions"
        style={{
          marginBottom: "var(--space-md)",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <Link className="btn btn--accent" to="/admin/exchanges/add">
          افزودن آگهی صرافی
        </Link>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={selectedSlugs.length === 0 || busy}
          onClick={bulkDeleteSelected}
        >
          حذف انتخاب‌شده‌ها ({selectedSlugs.length})
        </button>
      </div>

      <div className="field field--block admin-exchange-hub__search">
        <label htmlFor="admin-exchanges-q">جستجو در این فهرست</label>
        <input
          id="admin-exchanges-q"
          type="search"
          autoComplete="off"
          placeholder="نام، نامک، شهر، تلفن، شناسه…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {toast ? (
        <p
          className="field-hint"
          style={{
            color: toast.type === "ok" ? "var(--color-success, #2e7d32)" : "#b71c1c",
            marginBottom: "var(--space-sm)",
          }}
        >
          {toast.text}
        </p>
      ) : null}

      {loading ? <p>در حال بارگذاری…</p> : null}
      {!loading && err ? <p className="listings-error">{err}</p> : null}

      {!loading && !err ? (
        filtered.length === 0 ? (
          <p>{rows.length === 0 ? "فعلاً هیچ آگهی صرافی ثبت نشده است." : "نتیجه‌ای برای جستجو نیست."}</p>
        ) : (
          <div className="table-wrap admin-exchange-hub__table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "2.5rem" }}>
                    <span className="visually-hidden">انتخاب</span>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="انتخاب همه در نتایج فعلی"
                    />
                  </th>
                  <th>نام</th>
                  <th>شناسه</th>
                  <th>شهر</th>
                  <th>نرخ (خلاصه)</th>
                  <th>نمایش</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.slug}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedSlugs.includes(r.slug)}
                        onChange={() => toggleRowSelected(r.slug)}
                        aria-label={`انتخاب ${r.name_fa || r.slug}`}
                      />
                    </td>
                    <td>{r.name_fa || "—"}</td>
                    <td dir="ltr">{formatAdId(r.id) || r.slug}</td>
                    <td>{r.city || "—"}</td>
                    <td dir="ltr" className="admin-exchange-hub__rates-cell">
                      {rateSummary(r.exchange_rates_json)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`admin-exchange-hub__toggle${rowIsActive(r) ? " admin-exchange-hub__toggle--on" : ""}`}
                        disabled={togglingSlug === r.slug || busy}
                        onClick={() => onToggleActive(r)}
                        aria-pressed={rowIsActive(r)}
                        title={rowIsActive(r) ? "غیرفعال کردن در سایت" : "فعال کردن در سایت"}
                      >
                        {rowIsActive(r) ? "فعال" : "غیرفعال"}
                      </button>
                    </td>
                    <td>
                      <div className="admin-exchange-hub__row-actions">
                        <Link
                          className="btn btn--sm btn--accent"
                          to={`/admin-edit?slug=${encodeURIComponent(r.slug)}`}
                        >
                          ویرایش آگهی
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
}
