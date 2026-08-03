import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api.js";
import { useDashboard } from "../../context/DashboardContext.jsx";

const PLAN_ICONS = { silver: "🥈", gold: "🥇", platinum: "💎", diamond: "💠" };
const PLAN_COLORS = {
  silver:   { icon: "#374151", bg: "#f3f4f6", border: "#d1d5db" },
  gold:     { icon: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  platinum: { icon: "#5b21b6", bg: "#ede9fe", border: "#a78bfa" },
  diamond:  { icon: "#0891b2", bg: "#ecfeff", border: "#67e8f9" },
};

function toFaDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function daysLeft(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86_400_000));
}

function TxIcon({ type }) {
  if (type === "admin_grant") return <i className="fa-solid fa-gift" style={{ color: "#6366f1" }} />;
  if (type?.startsWith("earn_")) return <i className="fa-solid fa-star" style={{ color: "#f59e0b" }} />;
  if (type?.startsWith("spend_")) return <i className="fa-solid fa-rocket" style={{ color: "#ef4444" }} />;
  return <i className="fa-solid fa-circle" style={{ color: "#94a3b8" }} />;
}

function MilestoneRow({ m }) {
  const isProfileUpdate = m.type === "earn_profile_update";

  if (m.on_cooldown) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ width: 36, height: 36, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#dcfce7" }}>
          <i className="fa-solid fa-check" style={{ color: "#16a34a", fontSize: "0.95rem" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 0.1rem", fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>{m.label}</p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
            قابل دریافت مجدد از {formatDate(m.next_available_at)}
          </p>
        </div>
        <span style={{ background: "#dcfce7", color: "#166534", padding: "0.2rem 0.6rem", borderRadius: 6, fontSize: "0.78rem", fontWeight: 800, whiteSpace: "nowrap" }}>
          دریافت شد
        </span>
      </div>
    );
  }

  const badgeStyle = m.earned
    ? { background: "#dbeafe", color: "#1e40af" }
    : { background: "#fef3c7", color: "#92400e" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ width: 36, height: 36, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: m.earned ? "#fef3c7" : "#f1f5f9" }}>
        {m.earned
          ? <i className="fa-solid fa-rotate-right" style={{ color: "#d97706", fontSize: "0.85rem" }} />
          : <i className="fa-solid fa-lock" style={{ color: "#94a3b8", fontSize: "0.85rem" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 0.1rem", fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>{m.label}</p>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
          {isProfileUpdate ? m.hint : m.earned ? `هر ${toFaDigits(m.cooldown_days)} روز یک‌بار` : m.hint}
        </p>
      </div>
      <span style={{ ...badgeStyle, padding: "0.2rem 0.6rem", borderRadius: 6, fontSize: "0.78rem", fontWeight: 800, whiteSpace: "nowrap" }}>
        +{toFaDigits(m.amount)}
      </span>
    </div>
  );
}

function PlanCard({ plan, balance, boosting, onBoost }) {
  const c = PLAN_COLORS[plan.id] || PLAN_COLORS.silver;
  const days = daysLeft(plan.active_until);

  // Determine state
  let state;
  if (plan.is_active && plan.can_renew) state = "renew";
  else if (plan.is_active) state = "active";
  else if (plan.blocked_by_other) state = "blocked";
  else if (plan.on_cooldown) state = "cooldown";
  else if (balance < plan.tokens) state = "broke";
  else state = "available";

  const isActive = plan.is_active;
  const borderColor = isActive ? "#6366f1" : c.border;
  const bg = isActive ? "#eef2ff" : c.bg;

  let btnLabel, btnDisabled, btnStyle;
  switch (state) {
    case "renew":
      btnLabel = <><i className="fa-solid fa-rotate-right" style={{ marginInlineEnd: "0.4rem" }} />تمدید</>;
      btnDisabled = !!boosting;
      btnStyle = { background: "#6366f1", color: "#fff" };
      break;
    case "active":
      btnLabel = "فعال است";
      btnDisabled = true;
      btnStyle = { background: "#e2e8f0", color: "#94a3b8" };
      break;
    case "blocked":
      btnLabel = "طرح دیگری فعال است";
      btnDisabled = true;
      btnStyle = { background: "#e2e8f0", color: "#94a3b8" };
      break;
    case "cooldown":
      btnLabel = "در انتظار";
      btnDisabled = true;
      btnStyle = { background: "#e2e8f0", color: "#94a3b8" };
      break;
    case "broke":
      btnLabel = "موجودی کم";
      btnDisabled = true;
      btnStyle = { background: "#e2e8f0", color: "#94a3b8" };
      break;
    default:
      btnLabel = "فعال‌سازی";
      btnDisabled = !!boosting;
      btnStyle = { background: "#6366f1", color: "#fff" };
  }

  let statusLine = null;
  if (state === "active" || state === "renew") {
    statusLine = (
      <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#475569" }}>
        <strong>{toFaDigits(days)}</strong> روز باقی‌مانده · تا {formatDate(plan.active_until)}
      </p>
    );
  } else if (state === "cooldown") {
    statusLine = (
      <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
        از {formatDate(plan.cooldown_until)}
      </p>
    );
  } else if (state === "active" && plan.cooldown_until) {
    statusLine = (
      <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
        تمدید از {formatDate(plan.cooldown_until)}
      </p>
    );
  }

  return (
    <div style={{ border: `2px solid ${borderColor}`, borderRadius: 16, background: bg, padding: "1.5rem 1rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", position: "relative" }}>
      {isActive && (
        <span style={{ position: "absolute", top: -10, right: "50%", transform: "translateX(50%)", background: "#6366f1", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.6rem", borderRadius: 6 }}>
          فعال
        </span>
      )}
      <div style={{ fontSize: "2rem" }}>{PLAN_ICONS[plan.id]}</div>
      <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>{plan.label}</p>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", lineHeight: 1.4 }}>{plan.description}</p>
      <div style={{ margin: "0.25rem 0" }}>
        <span style={{ fontSize: "1.6rem", fontWeight: 900, color: c.icon }}>{toFaDigits(plan.tokens)}</span>
        <span style={{ fontSize: "0.8rem", color: "#94a3b8", marginInlineStart: "0.3rem" }}>توکن</span>
      </div>
      {statusLine}
      <button
        type="button"
        className="pbtn pbtn--primary"
        style={{ width: "100%", marginTop: "auto", ...btnStyle }}
        disabled={btnDisabled}
        onClick={() => !btnDisabled && onBoost(plan.id)}
      >
        {boosting === plan.id ? <i className="fa-solid fa-spinner fa-spin" /> : btnLabel}
      </button>
    </div>
  );
}

export default function DashboardWalletPage() {
  const { dashSlug, impersonation } = useDashboard();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [boosting, setBoosting] = useState(null);
  const [boostMsg, setBoostMsg] = useState(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    const url = impersonation ? `/api/wallet?slug=${encodeURIComponent(dashSlug)}` : "/api/wallet";
    apiGet(url)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [impersonation?.managerId, dashSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const buyBoost = async (planId) => {
    if (boosting) return;
    setBoostMsg(null);
    setBoosting(planId);
    try {
      await apiPost("/api/wallet/boost", impersonation ? { plan_id: planId, slug: dashSlug } : { plan_id: planId });
      setBoostMsg({ type: "ok", text: "تبلیغ با موفقیت فعال شد! آگهی شما در صدر نتایج جستجو قرار می‌گیرد." });
      load();
    } catch (e) {
      const code = e.code || e.message;
      if (code === "plan_on_cooldown") {
        const until = e.next_available_at ? ` از ${formatDate(e.next_available_at)}` : "";
        setBoostMsg({ type: "err", text: `این طرح هنوز در دوره انتظار است. قابل فعال‌سازی مجدد${until}.` });
      } else if (code === "active_boost_exists") {
        const until = e.active_until ? ` (تا ${formatDate(e.active_until)})` : "";
        setBoostMsg({ type: "err", text: `یک تبلیغ فعال دارید${until}. پس از پایان آن می‌توانید طرح جدید فعال کنید.` });
      } else if (code === "insufficient_tokens") {
        setBoostMsg({ type: "err", text: "موجودی توکن کافی نیست." });
      } else {
        setBoostMsg({ type: "err", text: e.message || code });
      }
    } finally {
      setBoosting(null);
    }
  };

  if (loading) return <p style={{ padding: "2rem", color: "#64748b" }}>در حال بارگذاری کیف توکن…</p>;
  if (err === "no_business" || err === "404") return (
    <div style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
      <i className="fa-solid fa-store-slash" style={{ fontSize: "2.5rem", color: "#c7d2fe", display: "block", marginBottom: "0.75rem" }} />
      <p style={{ fontWeight: 700, color: "#1e293b", margin: "0 0 0.4rem" }}>آگهی‌ای به این حساب متصل نیست</p>
      <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0 }}>برای استفاده از کیف توکن، ابتدا باید یک آگهی کسب‌وکار داشته باشید.</p>
    </div>
  );
  if (err) return <p style={{ padding: "2rem", color: "#b91c1c" }}>خطا: {err}</p>;
  if (!data) return null;

  const { wallet, transactions, activeBoost, milestones, plans, weeklyBonusUsed, weeklyBonusNext } = data;
  const balance = wallet?.balance || 0;
  const totalEarned = wallet?.total_earned || 0;
  const totalSpent = wallet?.total_spent || 0;

  return (
    <>
      <div className="panel-page-title">
        <div>
          <h2>کیف توکن</h2>
          <p>با تکمیل پروفایل توکن بگیرید و با آن آگهی خود را تبلیغ کنید</p>
        </div>
      </div>

      {/* Balance cards */}
      <div className="panel-stats" style={{ marginBottom: "1.5rem" }}>
        <div className="panel-stat panel-stat--blue" style={{ gridColumn: "span 2" }}>
          <div className="panel-stat__icon" style={{ width: 64, height: 64, fontSize: "1.8rem", background: "linear-gradient(135deg,#6366f1,#a78bfa)" }}>
            <i className="fa-solid fa-coins" style={{ color: "#fff" }} />
          </div>
          <div>
            <p className="panel-stat__value" style={{ fontSize: "2.8rem" }}>{toFaDigits(balance)}</p>
            <p className="panel-stat__label">موجودی فعلی توکن</p>
          </div>
        </div>
        <div className="panel-stat panel-stat--green">
          <div className="panel-stat__icon"><i className="fa-solid fa-arrow-down" /></div>
          <div>
            <p className="panel-stat__value">{toFaDigits(totalEarned)}</p>
            <p className="panel-stat__label">کل دریافتی</p>
          </div>
        </div>
        <div className="panel-stat panel-stat--red">
          <div className="panel-stat__icon"><i className="fa-solid fa-arrow-up" /></div>
          <div>
            <p className="panel-stat__value">{toFaDigits(totalSpent)}</p>
            <p className="panel-stat__label">کل مصرف‌شده</p>
          </div>
        </div>
      </div>

      {/* Active boost banner */}
      {activeBoost && (
        <div className="panel-card" style={{ marginBottom: "1.5rem", borderRight: "4px solid #6366f1" }}>
          <div className="panel-card__body" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ fontSize: "2rem" }}>{PLAN_ICONS[activeBoost.plan_id] || "🚀"}</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 0.2rem", fontWeight: 800, color: "#0f172a" }}>
                تبلیغ فعال — پلن {plans?.find((p) => p.id === activeBoost.plan_id)?.label || activeBoost.plan_id}
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569" }}>
                آگهی شما در صدر نتایج جستجو است ·{" "}
                <strong>{toFaDigits(daysLeft(activeBoost.ends_at))}</strong> روز باقی‌مانده ·
                تا {formatDate(activeBoost.ends_at)}
              </p>
            </div>
            <span className="pbadge pbadge--green" style={{ fontSize: "0.85rem", padding: "0.3rem 0.8rem" }}>
              <i className="fa-solid fa-circle" style={{ fontSize: "0.5rem", marginInlineEnd: "0.4rem" }} />
              فعال
            </span>
          </div>
        </div>
      )}

      <div className="panel-cols" style={{ gap: "1.5rem" }}>

        {/* Milestones */}
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">
              <i className="fa-solid fa-star" style={{ marginInlineEnd: "0.5rem", color: "#f59e0b" }} />
              روش‌های کسب توکن
            </h3>
            {weeklyBonusUsed > 0 && (
              <span style={{ fontSize: "0.78rem", color: weeklyBonusUsed >= 2 ? "#dc2626" : "#64748b" }}>
                ویرایش هفتگی: {toFaDigits(weeklyBonusUsed)}/۲
                {weeklyBonusUsed >= 2 && weeklyBonusNext ? ` — مجدد از ${formatDate(weeklyBonusNext)}` : ""}
              </span>
            )}
          </div>
          <div style={{ padding: "0.5rem 0" }}>
            {milestones?.map((m) => <MilestoneRow key={m.type} m={m} />)}
          </div>
        </div>

        {/* Transaction history */}
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">
              <i className="fa-solid fa-clock-rotate-left" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
              تاریخچه تراکنش‌ها
            </h3>
          </div>
          {transactions?.length > 0 ? (
            <div>
              {transactions.map((tx) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.7rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "10px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <TxIcon type={tx.type} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 0.1rem", fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8" }} dir="ltr">{formatDate(tx.created_at)}</p>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: "0.92rem", color: tx.amount > 0 ? "#16a34a" : "#dc2626", whiteSpace: "nowrap" }}>
                    {tx.amount > 0 ? "+" : ""}{toFaDigits(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "2rem 1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.88rem" }}>
              هنوز تراکنشی ثبت نشده است.
            </div>
          )}
        </div>
      </div>

      {/* Boost plans */}
      <div className="panel-card" style={{ marginTop: "0.25rem" }}>
        <div className="panel-card__head">
          <h3 className="panel-card__title">
            <i className="fa-solid fa-rocket" style={{ marginInlineEnd: "0.5rem", color: "#6366f1" }} />
            پلن‌های تبلیغاتی
          </h3>
          <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
            {activeBoost
              ? `تبلیغ فعال — پس از پایان، طرح جدید انتخاب کنید`
              : "یک طرح را انتخاب کنید"}
          </span>
        </div>
        <div className="panel-card__body">
          {boostMsg && (
            <div className={`panel-form-msg ${boostMsg.type === "ok" ? "panel-form-msg--ok" : "panel-form-msg--error"}`} style={{ marginBottom: "1.25rem" }}>
              {boostMsg.text}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
            {plans?.map((plan) => (
              <PlanCard key={plan.id} plan={plan} balance={balance} boosting={boosting} onBoost={buyBoost} />
            ))}
          </div>
          <p style={{ margin: "1rem 0 0", fontSize: "0.78rem", color: "#94a3b8", textAlign: "center" }}>
            با فعال‌سازی تبلیغ، آگهی شما در صدر نتایج جستجو و فهرست کسب‌وکارها نمایش داده می‌شود.
            هر پلن پس از پایان، دوره‌ای برای دریافت مجدد توکن و تمدید دارد.
          </p>
        </div>
      </div>
    </>
  );
}
