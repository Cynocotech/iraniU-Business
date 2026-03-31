import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet } from "../api.js";

/** هم‌خوان با مقادیر فرم صفحهٔ اصلی */
const CAT_HINTS = {
  food: ["رستوران", "غذا"],
  market: ["سوپر", "خرده", "فروش"],
  health: ["سلامت", "پزشک", "کلینیک"],
  legal: ["حقوق"],
  beauty: ["زیبایی", "آرایش"],
  auto: ["خودرو"],
};

function filterRows(rows, searchParams) {
  let out = [...rows];
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const city = (searchParams.get("city") || "").trim().toLowerCase();
  const cat = (searchParams.get("cat") || "").trim();
  if (city) {
    out = out.filter((b) => (b.city || "").toLowerCase().includes(city));
  }
  if (cat && CAT_HINTS[cat]) {
    const hints = CAT_HINTS[cat];
    out = out.filter((b) => {
      const c = b.category || "";
      return hints.some((h) => c.includes(h));
    });
  }
  if (q) {
    out = out.filter((b) => {
      const blob = `${b.name_fa || ""} ${b.category || ""} ${b.listing_title || ""} ${b.address || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }
  return out;
}

export default function ListingsPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    apiGet("/api/businesses")
      .then(setRows)
      .catch(() => setErr("خطا در بارگذاری"));
  }, []);

  const filtered = useMemo(() => filterRows(rows, searchParams), [rows, searchParams]);

  return (
    <main className="container" style={{ padding: "2rem 0" }}>
      <h1>لیست کسب‌وکارها</h1>
      <p className="field-hint">
        {filtered.length === rows.length
          ? `${rows.length} مورد`
          : `${filtered.length} مورد از ${rows.length} (با فیلتر جستجو)`}
      </p>
      {err && <p>{err}</p>}
      <ul className="listings-empty" style={{ listStyle: "none", padding: 0 }}>
        {filtered.map((b) => (
          <li key={b.slug} style={{ marginBottom: "1rem" }}>
            <Link to={`/business?slug=${encodeURIComponent(b.slug)}`}>
              <strong>{b.name_fa}</strong>
            </Link>{" "}
            — {b.category || "—"} — {b.address || "—"}
          </li>
        ))}
      </ul>
    </main>
  );
}
