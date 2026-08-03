import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch, apiPatchJson } from "../../api.js";
import DashboardMain from "../../components/DashboardMain.jsx";
import DashboardPanelHead, { dashboardIcons } from "../../components/DashboardPanelHead.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useDashboard } from "../../context/DashboardContext.jsx";

export default function DashboardTwilioSettingsPage() {
  const { isSuperAdmin } = useAuth();
  const { dashSlug, biz, setBiz } = useDashboard();

  const [moduleEnabled, setModuleEnabled] = useState(true);

  // ── Twilio account credentials ──
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioTokenMasked, setTwilioTokenMasked] = useState("");
  const [twilioTokenSet, setTwilioTokenSet] = useState(false);
  const [twilioMsg, setTwilioMsg] = useState("");
  const [twilioSaving, setTwilioSaving] = useState(false);

  // ── Call tracking (per-business) ──
  const [callTrackingEnabled, setCallTrackingEnabled] = useState(false);
  const [callTrackingNumber, setCallTrackingNumber] = useState("");
  const [callForwardNumber, setCallForwardNumber] = useState("");
  const [trackingMsg, setTrackingMsg] = useState("");
  const [trackingSaving, setTrackingSaving] = useState(false);

  useEffect(() => {
    apiGet("/api/twilio-module-status")
      .then((d) => { if (d && typeof d.enabled === "boolean") setModuleEnabled(d.enabled); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isSuperAdmin) return;
    apiGet("/api/manager/twilio-settings")
      .then((d) => {
        if (typeof d.module_enabled === "boolean") setModuleEnabled(d.module_enabled);
        setTwilioSid(d.twilio_account_sid || "");
        setTwilioPhone(d.twilio_phone_number || "");
        setTwilioTokenSet(!!d.twilio_auth_token_set);
        setTwilioTokenMasked(d.twilio_auth_token_masked || "");
      })
      .catch(() => setTwilioMsg("بارگذاری تنظیمات ناموفق بود."));
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!biz) return;
    setCallTrackingEnabled(!!biz.call_tracking_enabled);
    setCallTrackingNumber(biz.call_tracking_number || "");
    setCallForwardNumber(biz.call_forward_number || "");
  }, [biz]);

  const saveTwilio = async (e) => {
    e.preventDefault();
    if (isSuperAdmin) return;
    setTwilioSaving(true);
    setTwilioMsg("");
    try {
      const payload = { twilio_account_sid: twilioSid, twilio_phone_number: twilioPhone };
      if (twilioToken.trim()) payload.twilio_auth_token = twilioToken.trim();
      const d = await apiPatchJson("/api/manager/twilio-settings", payload);
      setTwilioToken("");
      setTwilioTokenSet(!!d.twilio_auth_token_set);
      setTwilioTokenMasked(d.twilio_auth_token_masked || "");
      setTwilioMsg("تنظیمات Twilio ذخیره شد.");
    } catch (err) {
      setTwilioMsg(`خطا: ${err.message || "نامشخص"}`);
    } finally {
      setTwilioSaving(false);
    }
  };

  const saveTracking = async (e) => {
    e.preventDefault();
    setTrackingSaving(true);
    setTrackingMsg("");
    try {
      const updated = await apiPatch(`/api/businesses/${encodeURIComponent(dashSlug)}`, {
        call_tracking_enabled: callTrackingEnabled ? 1 : 0,
        call_tracking_number: callTrackingNumber,
        call_forward_number: callForwardNumber,
      });
      setBiz(updated);
      setTrackingMsg("تنظیمات ردیابی تماس ذخیره شد.");
    } catch (err) {
      setTrackingMsg(`خطا: ${err.message || "نامشخص"}`);
    } finally {
      setTrackingSaving(false);
    }
  };

  if (!moduleEnabled) {
    return (
      <DashboardMain>
        <section className="dashboard-panel" aria-labelledby="twilio-heading">
          <DashboardPanelHead headingId="twilio-heading" title="ردیابی تماس (Twilio)" icon={dashboardIcons.overview} />
          <p className="field-hint">
            ماژول Twilio توسط سوپرادمین غیرفعال شده است. برای فعال‌سازی از{" "}
            <Link to="/admin-settings#security">تنظیمات</Link> در پنل سوپرادمین، بخش «ماژول Twilio» را باز کنید.
          </p>
        </section>
      </DashboardMain>
    );
  }

  return (
    <DashboardMain>
      <section className="dashboard-panel" aria-labelledby="twilio-heading">
        <DashboardPanelHead headingId="twilio-heading" title="ردیابی تماس (Twilio)" icon={dashboardIcons.overview} />

        <div className="panel-card" style={{ marginBottom: "1.25rem", borderRight: "4px solid #f59e0b" }}>
          <div className="panel-card__body" style={{ padding: "1rem 1.25rem" }}>
            <p style={{ margin: 0, lineHeight: 1.8, fontSize: "0.9rem", color: "#374151" }}>
              <strong>Twilio</strong> یک سرویس ابری است که به کسب‌وکار شما یک شماره تلفن مجازی می‌دهد.
              وقتی مشتری با این شماره تماس می‌گیرد، تماس به شماره اصلی شما فوروارد می‌شود —
              و همزمان در پنل <strong>گزارش تماس‌ها</strong> ثبت می‌شود.
            </p>
            <ul style={{ margin: "0.6rem 0 0", paddingInlineStart: "1.25rem", lineHeight: 2, fontSize: "0.9rem", color: "#374151" }}>
              <li>بدانید چند مشتری از طریق آگهی ایرانیو با شما تماس گرفته‌اند</li>
              <li>شماره واقعی کسب‌وکار خود را پنهان نگه دارید</li>
              <li>آمار تماس را در داشبورد مشاهده کنید</li>
            </ul>
          </div>
        </div>

        {/* ── Twilio credentials ── */}
        <div className="panel-card" style={{ marginBottom: "1.25rem" }}>
          <div className="panel-card__head">
            <h3 className="panel-card__title">
              <i className="fa-solid fa-key" style={{ marginInlineEnd: "0.5rem", color: "#f59e0b" }} />
              اعتبارنامه Twilio
            </h3>
          </div>
          <div className="panel-card__body" style={{ padding: "1.25rem" }}>
            {isSuperAdmin ? (
              <p className="field-hint">
                این بخش مخصوص حساب مدیر است. برای ویرایش تنظیمات Twilio مدیرها از{" "}
                <Link to="/admin-managers">حساب‌های مدیر</Link> در پنل سوپرادمین استفاده کنید.
              </p>
            ) : (
              <p className="field-hint" style={{ marginTop: 0 }}>تنظیمات این بخش برای حساب همین مدیر ذخیره می‌شود.</p>
            )}
            <form className="form-grid" onSubmit={saveTwilio}>
              <div className="field field--block">
                <label htmlFor="mgr-twilio-sid">Twilio Account SID</label>
                <input id="mgr-twilio-sid" value={twilioSid} onChange={(e) => setTwilioSid(e.target.value)} dir="ltr" disabled={isSuperAdmin} />
              </div>
              <div className="field field--block">
                <label htmlFor="mgr-twilio-phone">Twilio Number (default)</label>
                <input id="mgr-twilio-phone" value={twilioPhone} onChange={(e) => setTwilioPhone(e.target.value)} dir="ltr" disabled={isSuperAdmin} />
              </div>
              <div className="field field--block">
                <label htmlFor="mgr-twilio-token">Twilio Auth Token</label>
                <input
                  id="mgr-twilio-token"
                  type="password"
                  value={twilioToken}
                  onChange={(e) => setTwilioToken(e.target.value)}
                  dir="ltr"
                  placeholder={twilioTokenSet ? `فعلی: ${twilioTokenMasked}` : "Paste token"}
                  disabled={isSuperAdmin}
                />
              </div>
              <div className="dashboard-actions">
                <button type="submit" className="btn btn--primary" disabled={twilioSaving || isSuperAdmin}>
                  {twilioSaving ? "در حال ذخیره…" : "ذخیره اعتبارنامه"}
                </button>
              </div>
              {twilioMsg && <p className="field-hint">{twilioMsg}</p>}
            </form>
          </div>
        </div>

        {/* ── Call tracking (per-business) ── */}
        <div className="panel-card">
          <div className="panel-card__head">
            <h3 className="panel-card__title">
              <i className="fa-solid fa-phone-volume" style={{ marginInlineEnd: "0.5rem", color: "#f59e0b" }} />
              ردیابی تماس کسب‌وکار
            </h3>
          </div>
          <div className="panel-card__body" style={{ padding: "1.25rem" }}>
            <form className="form-grid" onSubmit={saveTracking}>
              <div className="field field--block">
                <label htmlFor="dash-call-track-enabled">فعالسازی شماره ابری و ثبت تماس</label>
                <select
                  id="dash-call-track-enabled"
                  value={callTrackingEnabled ? "1" : "0"}
                  onChange={(e) => setCallTrackingEnabled(e.target.value === "1")}
                >
                  <option value="0">غیرفعال</option>
                  <option value="1">فعال</option>
                </select>
              </div>
              <div className="field field--block">
                <label htmlFor="dash-call-track-number">شماره ابری (Twilio Number)</label>
                <input
                  id="dash-call-track-number"
                  value={callTrackingNumber}
                  onChange={(e) => setCallTrackingNumber(e.target.value)}
                  dir="ltr"
                  placeholder="+44..."
                />
              </div>
              <div className="field field--block">
                <label htmlFor="dash-call-forward-number">شماره مقصد برای فوروارد</label>
                <input
                  id="dash-call-forward-number"
                  value={callForwardNumber}
                  onChange={(e) => setCallForwardNumber(e.target.value)}
                  dir="ltr"
                  placeholder="+44..."
                />
                <p className="field-hint">
                  اگر خالی باشد، شماره اصلی کسب‌وکار استفاده می‌شود. در Twilio webhook را روی
                  <span dir="ltr"> /api/twilio/voice/incoming </span> بگذارید.
                </p>
              </div>
              <div className="dashboard-actions">
                <button type="submit" className="btn btn--primary" disabled={trackingSaving}>
                  {trackingSaving ? "در حال ذخیره…" : "ذخیره ردیابی تماس"}
                </button>
              </div>
              {trackingMsg && <p className="field-hint">{trackingMsg}</p>}
            </form>
          </div>
        </div>

      </section>
    </DashboardMain>
  );
}
