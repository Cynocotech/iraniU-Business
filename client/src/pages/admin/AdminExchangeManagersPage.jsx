import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../api.js";
import { formatAdId } from "../../lib/businessIds.js";

function isExchangeManager(row) {
  const linked = Array.isArray(row?.linked_businesses) ? row.linked_businesses : [];
  return linked.some((b) => String(b?.name_fa || "").includes("صراف") || String(b?.slug || "").includes("exchange"));
}

export default function AdminExchangeManagersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet("/api/managers")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const exchangeRows = useMemo(() => rows.filter(isExchangeManager), [rows]);

  return (
    <section className="dashboard-panel" aria-labelledby="admin-exchange-managers-h" style={{ marginTop: "var(--space-md)" }}>
      <h2 id="admin-exchange-managers-h">مدیران صرافی</h2>
      <p className="field-hint">
        فقط مدیرانی که آگهی صرافی به حساب‌شان وصل است. مدیران غیرصرافی در صفحه{" "}
        <Link to="/admin-managers">مدیران</Link> باقی می‌مانند.
      </p>

      {loading ? <p>در حال بارگذاری…</p> : null}
      {!loading && exchangeRows.length === 0 ? <p className="field-hint">فعلاً مدیر صرافی ثبت نشده است.</p> : null}

      {!loading && exchangeRows.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>شناسه</th>
                <th>نام</th>
                <th>ایمیل</th>
                <th>نام کاربری</th>
                <th>تلفن</th>
                <th>آگهی‌های صرافی</th>
                <th>پنل</th>
              </tr>
            </thead>
            <tbody>
              {exchangeRows.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr">{r.id}</td>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.email}</td>
                  <td dir="ltr">{r.login_username || "—"}</td>
                  <td dir="ltr">{r.phone || "—"}</td>
                  <td style={{ minWidth: "12rem", maxWidth: "22rem" }}>
                    <ul style={{ margin: 0, paddingInlineStart: "1.1rem" }}>
                      {(r.linked_businesses || []).map((b) => (
                        <li key={b.slug} style={{ marginBottom: "0.25rem" }}>
                          <strong>{b.name_fa}</strong>
                          <span className="field-hint" dir="ltr">
                            {" "}
                            ({formatAdId(b.id) || b.slug})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <Link className="btn btn--primary" to={`/dashboard?asManager=${r.id}`}>
                      ورود به پنل مدیر
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
