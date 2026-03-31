import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatchJson } from "../../api.js";
import DashboardMain from "../../components/DashboardMain.jsx";
import DashboardPanelHead, { dashboardIcons } from "../../components/DashboardPanelHead.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function DashboardTwilioSettingsPage() {
  const { isSuperAdmin } = useAuth();
  const [moduleEnabled, setModuleEnabled] = useState(true);
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioPhone, setTwilioPhone] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioTokenMasked, setTwilioTokenMasked] = useState("");
  const [twilioTokenSet, setTwilioTokenSet] = useState(false);
  const [twilioMsg, setTwilioMsg] = useState("");
  const [twilioSaving, setTwilioSaving] = useState(false);

  const loadTwilio = () => {
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
  };

  useEffect(() => {
    apiGet("/api/twilio-module-status")
      .then((d) => {
        if (d && typeof d.enabled === "boolean") setModuleEnabled(d.enabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTwilio();
  }, [isSuperAdmin]);

  const saveTwilio = async (e) => {
    e.preventDefault();
    if (isSuperAdmin) return;
    setTwilioSaving(true);
    setTwilioMsg("");
    try {
      const payload = {
        twilio_account_sid: twilioSid,
        twilio_phone_number: twilioPhone,
      };
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

  if (!moduleEnabled) {
    return (
      <DashboardMain>
        <section className="dashboard-panel" aria-labelledby="twilio-settings-heading">
          <DashboardPanelHead headingId="twilio-settings-heading" title="تنظیمات Twilio" icon={dashboardIcons.overview} />
          <p className="field-hint">
            ماژول Twilio توسط سوپرادمین غیرفعال شده است. برای فعال‌سازی از{" "}
            <Link to="/admin-security">امنیت و ۲FA</Link> در پنل سوپرادمین، بخش «ماژول Twilio» را باز کنید.
          </p>
        </section>
      </DashboardMain>
    );
  }

  return (
    <DashboardMain>
      <section className="dashboard-panel" aria-labelledby="twilio-settings-heading">
        <DashboardPanelHead headingId="twilio-settings-heading" title="تنظیمات Twilio" icon={dashboardIcons.overview} />
        {isSuperAdmin ? (
          <p className="field-hint">
            این بخش مخصوص حساب مدیر است. برای ویرایش تنظیمات Twilio مدیرها از{" "}
            <Link to="/admin-managers">حساب‌های مدیر</Link> در پنل سوپرادمین استفاده کنید.
          </p>
        ) : (
          <p className="field-hint">تنظیمات این بخش برای حساب همین مدیر ذخیره می‌شود.</p>
        )}
        <form className="form-grid" onSubmit={saveTwilio}>
          <div className="field field--block">
            <label htmlFor="mgr-twilio-sid">Twilio Account SID</label>
            <input id="mgr-twilio-sid" value={twilioSid} onChange={(e) => setTwilioSid(e.target.value)} dir="ltr" />
          </div>
          <div className="field field--block">
            <label htmlFor="mgr-twilio-phone">Twilio Number (default)</label>
            <input id="mgr-twilio-phone" value={twilioPhone} onChange={(e) => setTwilioPhone(e.target.value)} dir="ltr" />
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
            />
          </div>
          <div className="dashboard-actions">
            <button type="submit" className="btn btn--primary" disabled={twilioSaving || isSuperAdmin}>
              {twilioSaving ? "در حال ذخیره…" : "ذخیره تنظیمات Twilio"}
            </button>
          </div>
          {twilioMsg ? <p className="field-hint">{twilioMsg}</p> : null}
        </form>
      </section>
    </DashboardMain>
  );
}
