import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../../api.js";

const PAGE_SIZE = 10;

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const nearby = new Set([1, total, current, current - 1, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...nearby].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push(null);
    result.push(p);
    prev = p;
  }
  return result;
}

function Pagination({ page, totalPages, setPage, toFa }) {
  if (totalPages <= 1) return null;
  const range = getPageRange(page, totalPages);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", padding: "1rem 1.25rem", borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
      <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
        style={{ padding: "0.4rem 0.8rem", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: "inherit", fontSize: "0.85rem" }}>
        <i className="fa-solid fa-chevron-right" />
      </button>
      {range.map((p, i) =>
        p === null ? (
          <span key={`ellipsis-${i}`} style={{ padding: "0.4rem 0.3rem", color: "#94a3b8", fontSize: "0.85rem", userSelect: "none" }}>…</span>
        ) : (
          <button key={p} type="button" onClick={() => setPage(p)}
            style={{ padding: "0.4rem 0.75rem", borderRadius: 8, border: "1.5px solid", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: p === page ? 800 : 400, cursor: "pointer", background: p === page ? "#6366f1" : "#fff", color: p === page ? "#fff" : "#475569", borderColor: p === page ? "#6366f1" : "#e2e8f0", minWidth: 36 }}>
            {toFa(p)}
          </button>
        )
      )}
      <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
        style={{ padding: "0.4rem 0.8rem", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: "inherit", fontSize: "0.85rem" }}>
        <i className="fa-solid fa-chevron-left" />
      </button>
      <span style={{ fontSize: "0.8rem", color: "#94a3b8", marginRight: "0.5rem" }}>
        صفحه {toFa(page)} از {toFa(totalPages)}
      </span>
    </div>
  );
}

function toFaDigits(n) {
  return String(n ?? 0).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(iso).slice(0, 10);
  }
}

function daysLeft(ends_at) {
  if (!ends_at) return 0;
  const ms = new Date(ends_at) - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const PLAN_LABELS = { silver: "نقره‌ای", gold: "طلایی", platinum: "پلاتینیوم" };

export default function AdminTokensPage() {
  const [wallets, setWallets] = useState([]);
  const [boosts, setBoosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("wallets");

  // Grant modal
  const [grantSlug, setGrantSlug] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantDesc, setGrantDesc] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState(null);
  const [showGrant, setShowGrant] = useState(false);

  const [search, setSearch] = useState("");
  const [walletsPage, setWalletsPage] = useState(1);
  const [boostsSearch, setBoostsSearch] = useState("");
  const [boostsPage, setBoostsPage] = useState(1);

  const load = () => {
    setLoading(true);
    Promise.all([
      apiGet("/api/admin/wallets"),
      apiGet("/api/admin/wallets/boosts"),
    ])
      .then(([w, b]) => {
        setWallets(Array.isArray(w) ? w : []);
        setBoosts(Array.isArray(b) ? b : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openGrant = (slug) => {
    setGrantSlug(slug);
    setGrantAmount("");
    setGrantDesc("");
    setGrantMsg(null);
    setShowGrant(true);
  };

  const submitGrant = async (e) => {
    e.preventDefault();
    setGranting(true);
    setGrantMsg(null);
    try {
      await apiPost("/api/admin/wallets/grant", {
        business_slug: grantSlug,
        amount: parseInt(grantAmount, 10),
        description: grantDesc || "اعطای توکن توسط ادمین",
      });
      setGrantMsg({ type: "ok", text: "توکن با موفقیت اضافه شد." });
      load();
      setTimeout(() => { setShowGrant(false); setGrantMsg(null); }, 1500);
    } catch (e) {
      const msgs = {
        business_not_found: "این نامک در پایگاه داده موجود نیست. نامک را دوباره بررسی کنید.",
        missing_fields: "نامک کسب‌وکار و مقدار توکن الزامی است.",
        invalid_amount: "مقدار توکن باید عدد صحیح بین ۱ و ۱۰۰۰۰ باشد.",
        unauthorized: "دسترسی مجاز نیست.",
      };
      setGrantMsg({ type: "err", text: msgs[e.message] || e.message });
    } finally {
      setGranting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return wallets.filter((w) => !q || (w.business_slug || "").includes(q) || (w.name_fa || "").includes(q));
  }, [wallets, search]);

  const filteredBoosts = useMemo(() => {
    const q = boostsSearch.toLowerCase().trim();
    return boosts.filter((b) => !q || (b.business_slug || "").includes(q) || (b.name_fa || "").includes(q));
  }, [boosts, boostsSearch]);

  useEffect(() => { setWalletsPage(1); }, [search]);
  useEffect(() => { setBoostsPage(1); }, [boostsSearch]);

  const walletsTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const walletsSlice = filtered.slice((walletsPage - 1) * PAGE_SIZE, walletsPage * PAGE_SIZE);

  const boostsTotalPages = Math.max(1, Math.ceil(filteredBoosts.length / PAGE_SIZE));
  const boostsSlice = filteredBoosts.slice((boostsPage - 1) * PAGE_SIZE, boostsPage * PAGE_SIZE);

  const totalBalance = wallets.reduce((s, w) => s + (w.balance || 0), 0);
  const totalEarned = wallets.reduce((s, w) => s + (w.total_earned || 0), 0);
  const activeBoostsCount = wallets.filter((w) => w.active_boost_plan).length;

  return (
    <>
      {/* Page header */}
      <div className="panel-page-title">
        <div>
          <h2>مدیریت توکن‌ها</h2>
          <p>مشاهده کیف‌های توکن کسب‌وکارها، اعطای توکن و بررسی تبلیغات فعال</p>
        </div>
        <button type="button" className="pbtn pbtn--primary" onClick={() => { setGrantSlug(""); setGrantAmount(""); setGrantDesc(""); setGrantMsg(null); setShowGrant(true); }}>
          <i className="fa-solid fa-plus" /> اعطای توکن
        </button>
      </div>

      {/* Stats */}
      <div className="panel-stats" style={{ marginBottom: "1.5rem" }}>
        <div className="panel-stat panel-stat--blue">
          <div className="panel-stat__icon"><i className="fa-solid fa-coins" /></div>
          <div>
            <p className="panel-stat__value">{toFaDigits(totalBalance)}</p>
            <p className="panel-stat__label">کل موجودی در گردش</p>
          </div>
        </div>
        <div className="panel-stat panel-stat--green">
          <div className="panel-stat__icon"><i className="fa-solid fa-wallet" /></div>
          <div>
            <p className="panel-stat__value">{toFaDigits(wallets.length)}</p>
            <p className="panel-stat__label">تعداد کیف‌ها</p>
          </div>
        </div>
        <div className="panel-stat panel-stat--orange">
          <div className="panel-stat__icon"><i className="fa-solid fa-rocket" /></div>
          <div>
            <p className="panel-stat__value">{toFaDigits(activeBoostsCount)}</p>
            <p className="panel-stat__label">تبلیغ فعال</p>
          </div>
        </div>
        <div className="panel-stat panel-stat--purple">
          <div className="panel-stat__icon"><i className="fa-solid fa-star" /></div>
          <div>
            <p className="panel-stat__value">{toFaDigits(totalEarned)}</p>
            <p className="panel-stat__label">کل توکن اعطا‌شده</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {[["wallets", "کیف‌های توکن"], ["boosts", "تبلیغات فعال"]].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              padding: "0.5rem 1.2rem", borderRadius: 10, border: "1.5px solid",
              fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit",
              background: tab === key ? "#6366f1" : "#fff",
              color: tab === key ? "#fff" : "#475569",
              borderColor: tab === key ? "#6366f1" : "#e2e8f0",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Wallets tab */}
      {tab === "wallets" && (
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">کیف‌های توکن کسب‌وکارها</h3>
            <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
              {toFaDigits(filtered.length)} نتیجه
            </span>
          </div>

          {/* Search bar */}
          <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ position: "relative", maxWidth: 420 }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", top: "50%", right: "0.85rem", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.85rem", pointerEvents: "none" }} />
              <input
                type="search"
                placeholder="جستجو بر اساس نام یا نامک کسب‌وکار…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "0.55rem 2.4rem 0.55rem 0.85rem", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} style={{ position: "absolute", top: "50%", left: "0.75rem", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, fontSize: "0.85rem" }}>
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "2rem", color: "#94a3b8", textAlign: "center" }}>در حال بارگذاری…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "2rem", color: "#94a3b8", textAlign: "center" }}>کیف توکنی یافت نشد.</div>
          ) : (
            <>
              <div className="panel-biz-list">
                {walletsSlice.map((w) => (
                  <div key={w.business_slug} className="panel-biz-item">
                    <div className="panel-biz-item__avatar" style={{ background: "linear-gradient(135deg,#6366f1,#a78bfa)" }}>
                      {(w.name_fa || w.business_slug || "?")[0]}
                    </div>
                    <div className="panel-biz-item__body">
                      <p className="panel-biz-item__name">{w.name_fa || w.business_slug}</p>
                      <p className="panel-biz-item__meta" dir="ltr">{w.business_slug} {w.category ? `· ${w.category}` : ""}</p>
                    </div>

                    <div style={{ display: "flex", gap: "1.5rem", flexShrink: 0, fontSize: "0.82rem", textAlign: "center" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "#0f172a" }}>{toFaDigits(w.balance || 0)}</p>
                        <p style={{ margin: 0, color: "#94a3b8" }}>موجودی</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#16a34a" }}>+{toFaDigits(w.total_earned || 0)}</p>
                        <p style={{ margin: 0, color: "#94a3b8" }}>دریافتی</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#dc2626" }}>-{toFaDigits(w.total_spent || 0)}</p>
                        <p style={{ margin: 0, color: "#94a3b8" }}>مصرف</p>
                      </div>
                    </div>

                    <div className="panel-biz-item__badges">
                      {w.active_boost_plan ? (
                        <span className="pbadge pbadge--purple">
                          <i className="fa-solid fa-rocket" style={{ marginInlineEnd: "0.3rem", fontSize: "0.7rem" }} />
                          {PLAN_LABELS[w.active_boost_plan] || w.active_boost_plan} · {toFaDigits(daysLeft(w.boost_ends_at))} روز
                        </span>
                      ) : null}
                    </div>

                    <div className="panel-biz-item__actions">
                      <button type="button" className="pact-btn pact-btn--primary" onClick={() => openGrant(w.business_slug)}>
                        <i className="fa-solid fa-plus" /> توکن
                      </button>
                      <Link className="pact-btn pact-btn--ghost" to={`/business?slug=${encodeURIComponent(w.business_slug)}`} target="_blank">
                        پیش‌نمایش
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination page={walletsPage} totalPages={walletsTotalPages} setPage={setWalletsPage} toFa={toFaDigits} />
            </>
          )}
        </div>
      )}

      {/* Boosts tab */}
      {tab === "boosts" && (
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">تاریخچه تبلیغات</h3>
            <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>{toFaDigits(filteredBoosts.length)} نتیجه</span>
          </div>

          {/* Search bar */}
          <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ position: "relative", maxWidth: 420 }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", top: "50%", right: "0.85rem", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.85rem", pointerEvents: "none" }} />
              <input
                type="search"
                placeholder="جستجو بر اساس نام یا نامک کسب‌وکار…"
                value={boostsSearch}
                onChange={(e) => setBoostsSearch(e.target.value)}
                style={{ width: "100%", padding: "0.55rem 2.4rem 0.55rem 0.85rem", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
              {boostsSearch && (
                <button type="button" onClick={() => setBoostsSearch("")} style={{ position: "absolute", top: "50%", left: "0.75rem", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, fontSize: "0.85rem" }}>
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          </div>

          {filteredBoosts.length === 0 ? (
            <div style={{ padding: "2rem", color: "#94a3b8", textAlign: "center" }}>هیچ تبلیغی ثبت نشده است.</div>
          ) : (
            <>
              <div className="panel-biz-list">
                {boostsSlice.map((b) => (
                  <div key={b.id} className="panel-biz-item">
                    <div style={{ fontSize: "1.5rem", flexShrink: 0 }}>
                      {b.plan_id === "platinum" ? "💎" : b.plan_id === "gold" ? "🥇" : "🥈"}
                    </div>
                    <div className="panel-biz-item__body">
                      <p className="panel-biz-item__name">{b.name_fa || b.business_slug}</p>
                      <p className="panel-biz-item__meta" dir="ltr">
                        پلن {PLAN_LABELS[b.plan_id] || b.plan_id} · {b.boost_days} روز · {toFaDigits(b.tokens_spent)} توکن · شروع: {formatDate(b.starts_at)}
                      </p>
                    </div>
                    <span className={`pbadge ${b.is_active && new Date(b.ends_at) > new Date() ? "pbadge--green" : "pbadge--red"}`}>
                      {b.is_active && new Date(b.ends_at) > new Date() ? `${toFaDigits(daysLeft(b.ends_at))} روز باقی` : "پایان‌یافته"}
                    </span>
                  </div>
                ))}
              </div>

              <Pagination page={boostsPage} totalPages={boostsTotalPages} setPage={setBoostsPage} toFa={toFaDigits} />
            </>
          )}
        </div>
      )}

      {/* Grant modal */}
      {showGrant && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }} onClick={(e) => e.target === e.currentTarget && setShowGrant(false)}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "2rem", width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1.25rem", fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
              <i className="fa-solid fa-coins" style={{ marginInlineEnd: "0.5rem", color: "#6366f1" }} />
              اعطای توکن به کسب‌وکار
            </h3>
            <form onSubmit={submitGrant} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="pfield">
                <label>نامک کسب‌وکار *</label>
                <input
                  dir="ltr"
                  value={grantSlug}
                  onChange={(e) => setGrantSlug(e.target.value)}
                  placeholder="my-restaurant"
                  required
                  list="wallet-slugs-list"
                />
                <datalist id="wallet-slugs-list">
                  {wallets.map((w) => <option key={w.business_slug} value={w.business_slug}>{w.name_fa}</option>)}
                </datalist>
              </div>
              <div className="pfield">
                <label>تعداد توکن *</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  dir="ltr"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  placeholder="مثلاً ۱۰۰"
                  required
                />
              </div>
              <div className="pfield">
                <label>توضیحات</label>
                <input
                  value={grantDesc}
                  onChange={(e) => setGrantDesc(e.target.value)}
                  placeholder="دلیل اعطا (اختیاری)"
                />
              </div>
              {grantMsg && (
                <p className={`panel-form-msg ${grantMsg.type === "ok" ? "panel-form-msg--ok" : "panel-form-msg--error"}`} style={{ margin: 0 }}>
                  {grantMsg.text}
                </p>
              )}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
                <button type="submit" className="pbtn pbtn--primary" disabled={granting} style={{ flex: 1 }}>
                  {granting ? <><i className="fa-solid fa-spinner fa-spin" /> در حال ذخیره…</> : <><i className="fa-solid fa-plus" /> اعطای توکن</>}
                </button>
                <button type="button" className="pbtn pbtn--ghost" onClick={() => setShowGrant(false)}>
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
