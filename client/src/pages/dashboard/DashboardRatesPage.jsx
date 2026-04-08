import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPatch } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useDashboard } from "../../context/DashboardContext.jsx";
import DashboardMain from "../../components/DashboardMain.jsx";
import DashboardPanelHead, { dashboardIcons } from "../../components/DashboardPanelHead.jsx";
import ExchangeRatesEditor from "../../components/ExchangeRatesEditor.jsx";
import ExchangePaymentMethodIcon from "../../components/ExchangePaymentMethodIcon.jsx";
import {
  EXCHANGE_DEFAULT_FEATURE_IDS,
  EXCHANGE_DEFAULT_PAYMENT_METHOD_IDS,
  EXCHANGE_DEFAULT_RATES,
  EXCHANGE_FEATURES,
  EXCHANGE_PAYMENT_METHODS,
  isExchangeBusiness,
  parseExchangeFeaturesJson,
  parseExchangePaymentMethodsJson,
  parseExchangeRatesJson,
  sanitizeExchangeRatesRows,
} from "../../lib/exchangeRates.js";

export default function DashboardRatesPage() {
  const { dashSlug, biz, setBiz } = useDashboard();
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState(() => parseExchangeRatesJson(biz?.exchange_rates_json) || [...EXCHANGE_DEFAULT_RATES]);
  const [paymentMethods, setPaymentMethods] = useState(
    () => parseExchangePaymentMethodsJson(biz?.payment_methods_json) || [...EXCHANGE_DEFAULT_PAYMENT_METHOD_IDS]
  );
  const [exchangeFeatures, setExchangeFeatures] = useState(
    () => parseExchangeFeaturesJson(biz?.exchange_features_json) || [...EXCHANGE_DEFAULT_FEATURE_IDS]
  );
  const [exchangeTodayRateEnabled, setExchangeTodayRateEnabled] = useState(Number(biz?.exchange_today_rate_enabled) !== 0);
  const [exchangeCompanyVerified, setExchangeCompanyVerified] = useState(Number(biz?.exchange_company_verified) === 1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const isExchange = isExchangeBusiness(biz);

  const togglePaymentMethod = (methodId, enabled) => {
    setPaymentMethods((prev) => {
      const exists = prev.includes(methodId);
      if (enabled) return exists ? prev : [...prev, methodId];
      return prev.filter((id) => id !== methodId);
    });
  };

  const toggleExchangeFeature = (featureId, enabled) => {
    setExchangeFeatures((prev) => {
      const exists = prev.includes(featureId);
      if (enabled) return exists ? prev : [...prev, featureId];
      return prev.filter((id) => id !== featureId);
    });
  };

  const onSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const updated = await apiPatch(`/api/businesses/${encodeURIComponent(dashSlug)}`, {
        exchange_rates_json: JSON.stringify(sanitizeExchangeRatesRows(rows)),
        payment_methods_json: JSON.stringify(paymentMethods),
        exchange_features_json: JSON.stringify(exchangeFeatures),
        exchange_today_rate_enabled: exchangeTodayRateEnabled ? 1 : 0,
        ...(isSuperAdmin ? { exchange_company_verified: exchangeCompanyVerified ? 1 : 0 } : {}),
      });
      setBiz(updated);
      setMsg("نرخ‌ها و تنظیمات صرافی ذخیره شد.");
    } catch (e) {
      setMsg(`خطا: ${e.message || "نامشخص"}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isExchange) {
    return (
      <DashboardMain>
        <section className="dashboard-panel">
          <DashboardPanelHead headingId="rates-heading" title="نرخ‌ها" icon={dashboardIcons.package} />
          <p className="field-hint">این بخش فقط برای آگهی‌های صرافی فعال است.</p>
          <Link className="btn btn--ghost" to="/dashboard/edit">
            بازگشت به ویرایش آگهی
          </Link>
        </section>
      </DashboardMain>
    );
  }

  return (
    <DashboardMain>
      <section className="dashboard-panel" aria-labelledby="rates-heading">
        <DashboardPanelHead headingId="rates-heading" title="نرخ ارز و رمز ارز (ویژهٔ صرافی)" icon={dashboardIcons.package} />
        <p className="field-hint">
          ارزها را از جستجو اضافه کنید؛ برای هر ارز می‌توانید خرید یا فروش را غیرفعال کنید. نرخ‌ها در صفحهٔ عمومی و ماشین‌حساب نمایش داده می‌شوند.
        </p>

        <ExchangeRatesEditor rows={rows} setRows={setRows} />

        <div className="field field--block" style={{ marginTop: "0.85rem" }}>
          <label>روش‌های پرداخت قابل نمایش در صفحهٔ عمومی</label>
          <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.45rem" }}>
            {EXCHANGE_PAYMENT_METHODS.map((m) => (
              <label key={m.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={paymentMethods.includes(m.id)} onChange={(e) => togglePaymentMethod(m.id, e.target.checked)} />
                <ExchangePaymentMethodIcon methodId={m.id} className="exchange-pay-badge__icon--dash" />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field field--block" style={{ marginTop: "0.85rem" }}>
          <label>ویژگی‌های صرافی برای نمایش روی کارت لیست</label>
          <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.45rem" }}>
            {EXCHANGE_FEATURES.map((f) => (
              <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={exchangeFeatures.includes(f.id)} onChange={(e) => toggleExchangeFeature(f.id, e.target.checked)} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field field--block" style={{ marginTop: "0.85rem" }}>
          <label htmlFor="dash-rates-page-today-rate-enabled">نمایش «نرخ ویژه امروز» در صفحه جزئیات صرافی</label>
          <select
            id="dash-rates-page-today-rate-enabled"
            value={exchangeTodayRateEnabled ? "1" : "0"}
            onChange={(e) => setExchangeTodayRateEnabled(e.target.value === "1")}
          >
            <option value="1">فعال</option>
            <option value="0">غیرفعال</option>
          </select>
        </div>

        {isSuperAdmin ? (
          <div className="field field--block dashboard-exchange-verified" style={{ marginTop: "0.85rem" }}>
            <label htmlFor="dash-rates-page-company-verified">وضعیت صرافی (فقط سوپرادمین)</label>
            <select
              id="dash-rates-page-company-verified"
              value={exchangeCompanyVerified ? "1" : "0"}
              onChange={(e) => setExchangeCompanyVerified(e.target.value === "1")}
            >
              <option value="0">خصوصی / غیر شرکتی — هشدار نارنجی در صفحهٔ عمومی</option>
              <option value="1">کسب‌وکار ثبت‌شده — تیک آبی در سایت</option>
            </select>
          </div>
        ) : null}

        <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
          <button type="button" className="btn btn--primary" onClick={onSave} disabled={saving}>
            {saving ? "در حال ذخیره…" : "ذخیره نرخ‌ها"}
          </button>
          <Link className="btn btn--ghost" to="/dashboard/edit">
            ویرایش اطلاعات آگهی
          </Link>
        </div>
        {msg ? <p className="field-hint">{msg}</p> : null}
      </section>
    </DashboardMain>
  );
}

