import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { apiGet, apiPost, apiPatchJson } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";

function errMessage(code) {
  const map = {
    invalid_totp: "کد شش‌رقمی نادرست است.",
    invalid_password: "رمز عبور نادرست است.",
    setup_first: "ابتدا راه‌اندازی را انجام دهید.",
    unauthorized: "نشست نامعتبر است؛ دوباره وارد شوید.",
  };
  return map[code] || code;
}

export default function AdminSecurityPage({ embedded = false }) {
  const { me, loadMe } = useAuth();
  const totpOn = !!me?.totp_enabled;
  const mustEnroll2fa = me?.role === "superadmin" && !!me?.totp_setup_required && !me?.totp_enabled;

  const [telegramCfg, setTelegramCfg] = useState(null);
  const [tgForm, setTgForm] = useState({
    chat_id: "",
    directory_channel_id: "",
    public_site_url: "",
    new_bot_token: "",
    new_webhook_secret: "",
  });
  const [tgSaveBusy, setTgSaveBusy] = useState(false);
  const [tgSaveMsg, setTgSaveMsg] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secretB32, setSecretB32] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);

  const [enableCode, setEnableCode] = useState("");
  const [disablePw, setDisablePw] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [telegramTestMsg, setTelegramTestMsg] = useState(null);
  const [telegramTestBusy, setTelegramTestBusy] = useState(false);

  const [twilioModule, setTwilioModule] = useState({ enabled: true });
  const [twilioModuleBusy, setTwilioModuleBusy] = useState(false);
  const [twilioModuleMsg, setTwilioModuleMsg] = useState(null);

  const [careersModule, setCareersModule] = useState({ enabled: true });
  const [careersModuleBusy, setCareersModuleBusy] = useState(false);
  const [careersModuleMsg, setCareersModuleMsg] = useState(null);

  const [desktopGate, setDesktopGate] = useState({ enabled: true });
  const [desktopGateBusy, setDesktopGateBusy] = useState(false);
  const [desktopGateMsg, setDesktopGateMsg] = useState(null);

  const [s3Config, setS3Config] = useState(null);
  const [s3Form, setS3Form] = useState({
    access_key_id: "",
    secret_access_key: "",
    region: "us-east-1",
    bucket: "",
  });
  const [s3SaveBusy, setS3SaveBusy] = useState(false);
  const [s3SaveMsg, setS3SaveMsg] = useState(null);
  const [s3TestBusy, setS3TestBusy] = useState(false);
  const [s3TestMsg, setS3TestMsg] = useState(null);

  const loadTelegramConfig = useCallback(() => {
    apiGet("/api/admin/telegram-config")
      .then((d) => {
        setTelegramCfg(d);
        setTgForm((f) => ({
          ...f,
          chat_id: d.chat_id || "",
          directory_channel_id: d.directory_channel_id || "",
          public_site_url: d.public_site_url || "",
        }));
      })
      .catch(() => setTelegramCfg({}));
  }, []);

  const loadTwilioModule = useCallback(() => {
    apiGet("/api/admin/twilio-module")
      .then((d) => setTwilioModule(d && typeof d.enabled === "boolean" ? d : { enabled: true }))
      .catch(() => setTwilioModule({ enabled: true }));
  }, []);

  const loadCareersModule = useCallback(() => {
    apiGet("/api/admin/careers-module")
      .then((d) => setCareersModule(d && typeof d.enabled === "boolean" ? d : { enabled: true }))
      .catch(() => setCareersModule({ enabled: true }));
  }, []);

  const loadDesktopGate = useCallback(() => {
    apiGet("/api/admin/desktop-gate")
      .then((d) => setDesktopGate(d && typeof d.enabled === "boolean" ? d : { enabled: true }))
      .catch(() => setDesktopGate({ enabled: true }));
  }, []);

  const loadS3Config = useCallback(() => {
    apiGet("/api/admin/s3-config")
      .then((d) => {
        setS3Config(d);
        setS3Form((f) => ({
          ...f,
          access_key_id: d.access_key_id || "",
          secret_access_key: d.secret_access_key_masked || "",
          region: d.region || "us-east-1",
          bucket: d.bucket || "",
        }));
      })
      .catch(() => setS3Config({}));
  }, []);

  useEffect(() => {
    if (mustEnroll2fa) return;
    loadTelegramConfig();
  }, [mustEnroll2fa, loadTelegramConfig]);

  useEffect(() => {
    if (mustEnroll2fa) return;
    loadTwilioModule();
  }, [mustEnroll2fa, loadTwilioModule]);

  useEffect(() => {
    if (mustEnroll2fa) return;
    loadCareersModule();
  }, [mustEnroll2fa, loadCareersModule]);

  useEffect(() => {
    if (mustEnroll2fa) return;
    loadDesktopGate();
  }, [mustEnroll2fa, loadDesktopGate]);

  useEffect(() => {
    if (mustEnroll2fa) return;
    loadS3Config();
  }, [mustEnroll2fa, loadS3Config]);

  const setTwilioModuleEnabled = async (nextEnabled) => {
    setTwilioModuleMsg(null);
    setTwilioModuleBusy(true);
    try {
      const d = await apiPatchJson("/api/admin/twilio-module", { enabled: nextEnabled });
      setTwilioModule(d);
      setTwilioModuleMsg(nextEnabled ? "ماژول Twilio فعال شد." : "ماژول Twilio غیرفعال شد؛ منوی Twilio در پنل مدیر و فیلدهای شماره ابری مخفی می‌شوند.");
    } catch (err) {
      setTwilioModuleMsg(err.message || String(err));
    } finally {
      setTwilioModuleBusy(false);
    }
  };

  const setCareersModuleEnabled = async (nextEnabled) => {
    setCareersModuleMsg(null);
    setCareersModuleBusy(true);
    try {
      const d = await apiPatchJson("/api/admin/careers-module", { enabled: nextEnabled });
      setCareersModule(d);
      setCareersModuleMsg(nextEnabled ? "ماژول Job Vacancies فعال شد." : "ماژول Job Vacancies غیرفعال شد؛ فیلدهای Careers در فرم ویرایش آگهی مخفی می‌شوند.");
    } catch (err) {
      setCareersModuleMsg(err.message || String(err));
    } finally {
      setCareersModuleBusy(false);
    }
  };

  const setDesktopGateEnabled = async (nextEnabled) => {
    setDesktopGateMsg(null);
    setDesktopGateBusy(true);
    try {
      const d = await apiPatchJson("/api/admin/desktop-gate", { enabled: nextEnabled });
      setDesktopGate(d);
      setDesktopGateMsg(nextEnabled ? "حالت فقط موبایل/تبلت فعال شد." : "حالت فقط موبایل/تبلت غیرفعال شد؛ سایت روی دسکتاپ هم باز می‌شود.");
    } catch (err) {
      setDesktopGateMsg(err.message || String(err));
    } finally {
      setDesktopGateBusy(false);
    }
  };

  const saveS3Config = async (e) => {
    e.preventDefault();
    setS3SaveMsg(null);
    setS3SaveBusy(true);
    try {
      const patch = {
        access_key_id: s3Form.access_key_id.trim(),
        secret_access_key: s3Form.secret_access_key.trim(),
        region: s3Form.region.trim(),
        bucket: s3Form.bucket.trim(),
      };
      const d = await apiPatchJson("/api/admin/s3-config", patch);
      setS3Config(d);
      setS3SaveMsg("تنظیمات S3 ذخیره شد. سرور خودکار از S3 استفاده خواهد کرد.");
      loadS3Config();
    } catch (err) {
      setS3SaveMsg(err.message || String(err));
    } finally {
      setS3SaveBusy(false);
    }
  };

  const saveTelegramConfig = async (e) => {
    e.preventDefault();
    setTgSaveMsg(null);
    setTgSaveBusy(true);
    try {
      const patch = {
        chat_id: tgForm.chat_id.trim(),
        directory_channel_id: tgForm.directory_channel_id.trim(),
        public_site_url: tgForm.public_site_url.trim(),
      };
      if (tgForm.new_bot_token.trim()) patch.bot_token = tgForm.new_bot_token.trim();
      if (tgForm.new_webhook_secret.trim()) patch.webhook_secret = tgForm.new_webhook_secret.trim();
      const next = await apiPatchJson("/api/admin/telegram-config", patch);
      setTelegramCfg(next);
      setTgForm((f) => ({ ...f, new_bot_token: "", new_webhook_secret: "" }));
      setTgSaveMsg("تنظیمات ذخیره شد.");
    } catch (err) {
      setTgSaveMsg(err.message || String(err));
    } finally {
      setTgSaveBusy(false);
    }
  };

  const clearTelegramOverride = async (field) => {
    setTgSaveMsg(null);
    setTgSaveBusy(true);
    try {
      const next = await apiPatchJson("/api/admin/telegram-config", { [field]: "" });
      setTelegramCfg(next);
      if (field === "bot_token") setTgForm((f) => ({ ...f, new_bot_token: "" }));
      if (field === "webhook_secret") setTgForm((f) => ({ ...f, new_webhook_secret: "" }));
      setTgSaveMsg("بازگشت به مقدار .env انجام شد (در صورت تعریف).");
    } catch (err) {
      setTgSaveMsg(err.message || String(err));
    } finally {
      setTgSaveBusy(false);
    }
  };

  const startSetup = async () => {
    setMsg(null);
    setBusy(true);
    setQrDataUrl("");
    setSecretB32("");
    try {
      const data = await apiPost("/api/auth/admin/2fa/setup", {});
      setSecretB32(data.secret || "");
      setSetupOpen(true);
      if (data.otpauth_url) {
        const url = await QRCode.toDataURL(data.otpauth_url, { width: 220, margin: 2 });
        setQrDataUrl(url);
      }
    } catch (e) {
      setMsg(errMessage(String(e.message)) || String(e));
    } finally {
      setBusy(false);
    }
  };

  const enable2fa = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await apiPost("/api/auth/admin/2fa/enable", { token: enableCode.trim() });
      setEnableCode("");
      setSetupOpen(false);
      setQrDataUrl("");
      setSecretB32("");
      await loadMe();
      setMsg("Google Authenticator فعال شد.");
    } catch (e) {
      setMsg(errMessage(String(e.message)) || String(e));
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await apiPost("/api/auth/admin/2fa/disable", { password: disablePw });
      setDisablePw("");
      await loadMe();
      setMsg("ورود دو مرحله‌ای غیرفعال شد.");
    } catch (e) {
      setMsg(errMessage(String(e.message)) || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!embedded ? (
        <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
          <Link to="/admin">← داشبورد</Link>
        </p>
      ) : null}

      {mustEnroll2fa ? (
        <div
          className="dashboard-panel"
          style={{
            marginBottom: "1rem",
            border: "1px solid rgba(183, 28, 28, 0.35)",
            background: "rgba(255, 235, 238, 0.95)",
          }}
          role="status"
        >
          <p style={{ margin: 0, fontWeight: 600 }}>ورود دو مرحله‌ای الزامی است</p>
          <p className="field-hint" style={{ margin: "0.5rem 0 0" }}>
            قبل از استفاده از بقیهٔ پنل سوپرادمین، بخش زیر را باز کنید، QR را در Google Authenticator اسکن کنید و ۲FA را
            فعال کنید.
          </p>
        </div>
      ) : null}

      <section className="dashboard-panel">
        <h2>ورود دو مرحله‌ای (Google Authenticator)</h2>
        <p className="field-hint">
          با اسکن QR در اپ Google Authenticator یا مشابه، کدهای شش‌رقمی برای ورود به پنل سوپرادمین دریافت می‌کنید.
        </p>

        {totpOn ? (
          <div className="field-hint" style={{ color: "var(--color-success, #2e7d32)", marginBottom: "1rem" }}>
            وضعیت: <strong>فعال</strong> — هنگام ورود از صفحهٔ <Link to="/admin/login">ورود سوپرادمین</Link> کد را وارد کنید.
          </div>
        ) : (
          <div className="field-hint" style={{ marginBottom: "1rem" }}>
            وضعیت: <strong>غیرفعال</strong>
          </div>
        )}

        {!totpOn && (
          <>
            {!setupOpen && (
              <button type="button" className="btn btn--primary" disabled={busy} onClick={startSetup}>
                {busy ? "در حال آماده‌سازی…" : "راه‌اندازی و نمایش QR"}
              </button>
            )}

            {setupOpen && (
              <div style={{ marginTop: "1.25rem" }}>
                {qrDataUrl ? (
                  <p style={{ marginBottom: "0.75rem" }}>
                    <img src={qrDataUrl} alt="QR برای Google Authenticator" width={220} height={220} />
                  </p>
                ) : null}
                {secretB32 ? (
                  <p className="field-hint" dir="ltr" style={{ wordBreak: "break-all" }}>
                    کلید دستی (در صورت نیاز): <code>{secretB32}</code>
                  </p>
                ) : null}
                <form onSubmit={enable2fa} className="form-grid" style={{ marginTop: "1rem", maxWidth: "22rem" }}>
                  <div className="field field--block">
                    <label htmlFor="adm-totp-enable">کد شش‌رقمی از اپ</label>
                    <input
                      id="adm-totp-enable"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={enableCode}
                      onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="۶ رقم"
                      dir="ltr"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={busy || enableCode.length < 6}>
                    تأیید و فعال‌سازی
                  </button>
                </form>
                <p className="field-hint" style={{ marginTop: "1rem" }}>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => startSetup()}>
                    تولید QR جدید
                  </button>
                </p>
              </div>
            )}
          </>
        )}

        {totpOn && (
          <form onSubmit={disable2fa} className="form-grid" style={{ marginTop: "1rem", maxWidth: "22rem" }}>
            <div className="field field--block">
              <label htmlFor="adm-totp-disable-pw">رمز عبور فعلی برای غیرفعال کردن ۲FA</label>
              <input
                id="adm-totp-disable-pw"
                type="password"
                autoComplete="current-password"
                value={disablePw}
                onChange={(e) => setDisablePw(e.target.value)}
                dir="ltr"
                required
              />
            </div>
            <button type="submit" className="btn btn--ghost" disabled={busy}>
              غیرفعال کردن ورود دو مرحله‌ای
            </button>
          </form>
        )}

        {msg && (
          <p className="field-hint" style={{ marginTop: "1rem", color: msg.includes("فعال") || msg.includes("غیرفعال") ? undefined : "#b71c1c" }}>
            {msg}
          </p>
        )}
      </section>

      {!mustEnroll2fa ? (
      <section className="dashboard-panel" style={{ marginTop: "1.5rem" }}>
        <h2>پیکربندی تلگرام</h2>
        <p className="field-hint">
          مقادیر را اینجا ذخیره کنید یا در <code dir="ltr">server/.env</code> بگذارید — مقدار ذخیره‌شده در دیتابیس
          بر متغیر محیطی اولویت دارد. فقط با <strong>ورود سوپرادمین</strong> از{" "}
          <Link to="/admin/login">/admin/login</Link> اعلان ورود ارسال می‌شود.
        </p>

        <form onSubmit={saveTelegramConfig} className="form-grid" style={{ maxWidth: "36rem", marginTop: "1rem" }}>
          <div className="field field--block">
            <label htmlFor="tg-bot-token">
              توکن ربات <span className="field-hint">(BotFather)</span>
            </label>
            <input
              id="tg-bot-token"
              type="password"
              autoComplete="off"
              placeholder={telegramCfg?.bot_token_masked ? `فعلی: ${telegramCfg.bot_token_masked}` : "توکن جدید را وارد کنید"}
              value={tgForm.new_bot_token}
              onChange={(e) => setTgForm((f) => ({ ...f, new_bot_token: e.target.value }))}
              dir="ltr"
            />
            <p className="field-hint" style={{ marginTop: "0.35rem" }}>
              منبع فعلی: <strong>{telegramCfg?.bot_token_source === "database" ? "دیتابیس" : ".env"}</strong>
              {telegramCfg?.bot_token_source === "database" ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ padding: "0.15rem 0.5rem", fontSize: "0.85rem" }}
                    disabled={tgSaveBusy}
                    onClick={() => clearTelegramOverride("bot_token")}
                  >
                    حذف از دیتابیس
                  </button>
                </>
              ) : null}
            </p>
          </div>

          <div className="field field--block">
            <label htmlFor="tg-chat-id">شناسهٔ چت اعلان‌ها (عدد یا نام کاربری)</label>
            <input
              id="tg-chat-id"
              type="text"
              value={tgForm.chat_id}
              onChange={(e) => setTgForm((f) => ({ ...f, chat_id: e.target.value }))}
              placeholder="مثلاً 123456789"
              dir="ltr"
            />
          </div>

          <div className="field field--block">
            <label htmlFor="tg-webhook-secret">رمز وب‌هوک (Kick out)</label>
            <input
              id="tg-webhook-secret"
              type="password"
              autoComplete="off"
              placeholder={telegramCfg?.webhook_secret_masked ? `فعلی: ${telegramCfg.webhook_secret_masked}` : "مخفی جدید"}
              value={tgForm.new_webhook_secret}
              onChange={(e) => setTgForm((f) => ({ ...f, new_webhook_secret: e.target.value }))}
              dir="ltr"
            />
            <p className="field-hint" style={{ marginTop: "0.35rem" }}>
              منبع: <strong>{telegramCfg?.webhook_secret_source === "database" ? "دیتابیس" : ".env"}</strong>
              {telegramCfg?.webhook_secret_source === "database" ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ padding: "0.15rem 0.5rem", fontSize: "0.85rem" }}
                    disabled={tgSaveBusy}
                    onClick={() => clearTelegramOverride("webhook_secret")}
                  >
                    حذف از دیتابیس
                  </button>
                </>
              ) : null}
            </p>
          </div>

          <div className="field field--block">
            <label htmlFor="tg-dir-ch">شناسهٔ کانال دایرکتوری</label>
            <input
              id="tg-dir-ch"
              type="text"
              value={tgForm.directory_channel_id}
              onChange={(e) => setTgForm((f) => ({ ...f, directory_channel_id: e.target.value }))}
              placeholder="@YourChannel یا -100…"
              dir="ltr"
            />
          </div>

          <div className="field field--block">
            <label htmlFor="tg-public-url">آدرس عمومی سایت (لینک آگهی و تصویر)</label>
            <input
              id="tg-public-url"
              type="url"
              value={tgForm.public_site_url}
              onChange={(e) => setTgForm((f) => ({ ...f, public_site_url: e.target.value }))}
              placeholder="https://example.com"
              dir="ltr"
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <button type="submit" className="btn btn--primary" disabled={tgSaveBusy}>
              {tgSaveBusy ? "در حال ذخیره…" : "ذخیرهٔ تنظیمات تلگرام"}
            </button>
          </div>
          {tgSaveMsg && (
            <p
              className="field-hint"
              style={{ color: tgSaveMsg.includes("ذخیره") || tgSaveMsg.includes("بازگشت") ? "var(--color-success, #2e7d32)" : "#b71c1c" }}
            >
              {tgSaveMsg}
            </p>
          )}
        </form>

        <p className="field-hint" style={{ marginTop: "1rem" }}>
          قبل از اولین اعلان، در تلگرام به ربات یک بار <code dir="ltr">/start</code> بزنید (چت خصوصی).
        </p>

        {telegramCfg?.telegram_configured === true && (
          <p className="field-hint" style={{ color: "var(--color-success, #2e7d32)" }}>
            توکن و چت برای اعلان ورود تنظیم شده‌اند.
          </p>
        )}
        {telegramCfg?.telegram_configured === true && telegramCfg?.kick_button_ready === false && (
          <p className="field-hint" style={{ color: "#5d4037" }}>
            برای دکمهٔ <strong>Kick out</strong>، رمز وب‌هوک را بالا ذخیره کنید و با آدرس HTTPS عمومی{" "}
            <code dir="ltr">https://دامنه‌شما/api/telegram/webhook</code> برای ربات <code dir="ltr">setWebhook</code> بزنید
            (همان <code dir="ltr">secret_token</code> با مقدار رمز وب‌هوک). روی localhost بدون ngrok وب‌هوک کار
            نمی‌کند.
          </p>
        )}
        {telegramCfg?.kick_button_ready === true && (
          <p className="field-hint" style={{ color: "var(--color-success, #2e7d32)" }}>
            دکمهٔ Kick out آماده است.
          </p>
        )}
        {telegramCfg?.directory_channel_ready === true && (
          <p className="field-hint" style={{ color: "var(--color-success, #2e7d32)" }}>
            ارسال آگهی به کانال دایرکتوری از فهرست آگهی‌ها آماده است — ربات را در کانال ادمین کنید.
          </p>
        )}
        {telegramCfg?.telegram_configured === true && telegramCfg?.directory_channel_ready === false && (
          <p className="field-hint" style={{ color: "#5d4037" }}>
            برای <strong>ارسال به کانال</strong>، شناسهٔ کانال دایرکتوری و آدرس عمومی سایت را در فرم بالا پر کنید.
          </p>
        )}
        {telegramCfg?.telegram_configured === false && (
          <p className="field-hint">
            هنوز توکن و چت اعلان کامل نیست — فرم بالا را پر کنید یا در{" "}
            <code dir="ltr">server/.env</code> متغیرهای <code dir="ltr">TELEGRAM_BOT_TOKEN</code> و{" "}
            <code dir="ltr">TELEGRAM_CHAT_ID</code> را بگذارید. ربات:{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
              BotFather
            </a>
            .
          </p>
        )}

        <p className="field-hint" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={telegramTestBusy || telegramCfg?.telegram_configured === false}
            onClick={async () => {
              setTelegramTestMsg(null);
              setTelegramTestBusy(true);
              try {
                await apiPost("/api/admin/telegram-test", {});
                setTelegramTestMsg("پیام آزمایشی ارسال شد؛ تلگرام را بررسی کنید.");
                loadTelegramConfig();
              } catch (e) {
                setTelegramTestMsg(e.message || String(e));
              } finally {
                setTelegramTestBusy(false);
              }
            }}
          >
            {telegramTestBusy ? "در حال ارسال…" : "ارسال پیام آزمایشی به تلگرام"}
          </button>
        </p>
        {telegramTestMsg && (
          <p className="field-hint" style={{ color: telegramTestMsg.includes("ارسال") ? "var(--color-success, #2e7d32)" : "#b71c1c" }}>
            {telegramTestMsg}
          </p>
        )}
      </section>
      ) : null}

      {!mustEnroll2fa ? (
      <section className="dashboard-panel" style={{ marginTop: "1.5rem" }}>
        <h2>ماژول Twilio</h2>
        <p className="field-hint">
          با غیرفعال کردن، وب‌هوک‌های صوتی Twilio پاسخ نمی‌دهند، منوی «تنظیمات Twilio» و «لاگ تماس‌ها» در پنل مدیر
          مخفی می‌شود و مدیران نمی‌توانند تنظیمات Twilio را ذخیره کنند. داده‌های ذخیره‌شده در دیتابیس پاک نمی‌شود.
        </p>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          وضعیت فعلی:{" "}
          <strong>{twilioModule.enabled ? "فعال" : "غیرفعال"}</strong>
        </p>
        <div className="dashboard-actions dashboard-actions--inline">
          {twilioModule.enabled ? (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={twilioModuleBusy}
              onClick={() => setTwilioModuleEnabled(false)}
            >
              {twilioModuleBusy ? "در حال ذخیره…" : "غیرفعال کردن ماژول Twilio"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={twilioModuleBusy}
              onClick={() => setTwilioModuleEnabled(true)}
            >
              {twilioModuleBusy ? "در حال ذخیره…" : "فعال کردن ماژول Twilio"}
            </button>
          )}
        </div>
        {twilioModuleMsg ? (
          <p
            className="field-hint"
            style={{ marginTop: "0.75rem", color: twilioModuleMsg.includes("غیرفعال") || twilioModuleMsg.includes("فعال") ? "var(--color-success, #2e7d32)" : "#b71c1c" }}
          >
            {twilioModuleMsg}
          </p>
        ) : null}
      </section>
      ) : null}

      {!mustEnroll2fa ? (
      <section className="dashboard-panel" style={{ marginTop: "1.5rem" }}>
        <h2>ماژول Job Vacancies (Careers)</h2>
        <p className="field-hint">
          با غیرفعال کردن، فیلدهای Job Vacancies (careers_title و careers_text) در فرم ویرایش آگهی مخفی می‌شوند.
          داده‌های ذخیره‌شده در دیتابیس پاک نمی‌شود.
        </p>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          وضعیت فعلی:{" "}
          <strong>{careersModule.enabled ? "فعال" : "غیرفعال"}</strong>
        </p>
        <div className="dashboard-actions dashboard-actions--inline">
          {careersModule.enabled ? (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={careersModuleBusy}
              onClick={() => setCareersModuleEnabled(false)}
            >
              {careersModuleBusy ? "در حال ذخیره…" : "غیرفعال کردن ماژول Job Vacancies"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={careersModuleBusy}
              onClick={() => setCareersModuleEnabled(true)}
            >
              {careersModuleBusy ? "در حال ذخیره…" : "فعال کردن ماژول Job Vacancies"}
            </button>
          )}
        </div>
        {careersModuleMsg ? (
          <p
            className="field-hint"
            style={{ marginTop: "0.75rem", color: careersModuleMsg.includes("غیرفعال") || careersModuleMsg.includes("فعال") ? "var(--color-success, #2e7d32)" : "#b71c1c" }}
          >
            {careersModuleMsg}
          </p>
        ) : null}
      </section>
      ) : null}

      {!mustEnroll2fa ? (
      <section className="dashboard-panel" style={{ marginTop: "1.5rem" }}>
        <h2>Open this on mobile</h2>
        <p className="field-hint">
          با فعال بودن این حالت، سایت (به‌جز پنل مدیر/مدیر صرافی و صفحات ورود) روی دسکتاپ مسدود می‌شود و این پیام نمایش داده می‌شود:
        </p>
        <p className="field-hint" style={{ fontStyle: "italic" }}>
          "This site is for phones and tablets only. Please open this address on your mobile device."
          <br />
          «این نسخه فقط برای موبایل و تبلت است. لطفاً با گوشی یا تبلت همان آدرس را باز کنید.»
        </p>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          وضعیت فعلی:{" "}
          <strong>{desktopGate.enabled ? "فعال" : "غیرفعال"}</strong>
        </p>
        <div className="dashboard-actions dashboard-actions--inline">
          {desktopGate.enabled ? (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={desktopGateBusy}
              onClick={() => setDesktopGateEnabled(false)}
            >
              {desktopGateBusy ? "در حال ذخیره…" : "غیرفعال کردن (نمایش روی دسکتاپ هم)"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={desktopGateBusy}
              onClick={() => setDesktopGateEnabled(true)}
            >
              {desktopGateBusy ? "در حال ذخیره…" : "فعال کردن (فقط موبایل/تبلت)"}
            </button>
          )}
        </div>
        {desktopGateMsg ? (
          <p
            className="field-hint"
            style={{ marginTop: "0.75rem", color: desktopGateMsg.includes("غیرفعال") || desktopGateMsg.includes("فعال") ? "var(--color-success, #2e7d32)" : "#b71c1c" }}
          >
            {desktopGateMsg}
          </p>
        ) : null}
      </section>
      ) : null}

      {!mustEnroll2fa ? (
      <section className="dashboard-panel" style={{ marginTop: "1.5rem" }}>
        <h2>تنظیمات Amazon S3</h2>
        <p className="field-hint">
          برای ذخیره‌سازی فایل‌های آپلود شده (تصاویر بنر صرافی، تصاویر آگهی) روی Amazon S3 به جای فضای دیسک سرور.
          اگر خالی بگذارید، سیستم از فضای محلی سرور استفاده می‌کند.
        </p>

        {s3Config && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "var(--color-card-hover, #f5f5f5)", borderRadius: "4px" }}>
            <p className="field-hint" style={{ marginBottom: "0.5rem" }}>
              <strong>وضعیت فعلی:</strong> {s3Config.storage_mode === "s3" ? "✅ S3 فعال است" : "📂 فضای محلی"}
            </p>
            {s3Config.access_key_id_source !== "none" && (
              <p className="field-hint" style={{ marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                منبع تنظیمات: {s3Config.access_key_id_source === "database" ? "دیتابیس (پنل ادمین)" : "فایل .env"}
              </p>
            )}
          </div>
        )}

        <form onSubmit={saveS3Config} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="s3-access-key">AWS Access Key ID</label>
            <input
              id="s3-access-key"
              type="text"
              value={s3Form.access_key_id}
              onChange={(e) => setS3Form((f) => ({ ...f, access_key_id: e.target.value }))}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              dir="ltr"
            />
          </div>

          <div>
            <label htmlFor="s3-secret-key">AWS Secret Access Key</label>
            <input
              id="s3-secret-key"
              type="password"
              value={s3Form.secret_access_key}
              onChange={(e) => setS3Form((f) => ({ ...f, secret_access_key: e.target.value }))}
              placeholder={s3Config?.secret_access_key_set ? "••••••••" : "wJalrXUtnFEMI/K7MDENG/..."}
              dir="ltr"
            />
            {s3Config?.secret_access_key_set && (
              <p className="field-hint" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                کلید فعلی: {s3Config.secret_access_key_masked} (برای تغییر، کلید جدید وارد کنید)
              </p>
            )}
          </div>

          <div>
            <label htmlFor="s3-region">AWS Region</label>
            <select
              id="s3-region"
              value={s3Form.region}
              onChange={(e) => setS3Form((f) => ({ ...f, region: e.target.value }))}
              dir="ltr"
            >
              <option value="us-east-1">us-east-1 (N. Virginia)</option>
              <option value="us-east-2">us-east-2 (Ohio)</option>
              <option value="us-west-1">us-west-1 (N. California)</option>
              <option value="us-west-2">us-west-2 (Oregon)</option>
              <option value="eu-west-1">eu-west-1 (Ireland)</option>
              <option value="eu-west-2">eu-west-2 (London)</option>
              <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
              <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
              <option value="ap-southeast-2">ap-southeast-2 (Sydney)</option>
              <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
            </select>
          </div>

          <div>
            <label htmlFor="s3-bucket">S3 Bucket Name</label>
            <input
              id="s3-bucket"
              type="text"
              value={s3Form.bucket}
              onChange={(e) => setS3Form((f) => ({ ...f, bucket: e.target.value }))}
              placeholder="my-bucket-name"
              dir="ltr"
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <button type="submit" className="btn btn--primary" disabled={s3SaveBusy}>
              {s3SaveBusy ? "در حال ذخیره…" : "ذخیرهٔ تنظیمات S3"}
            </button>

            <button
              type="button"
              className="btn btn--secondary"
              disabled={s3TestBusy}
              onClick={async () => {
                setS3TestMsg(null);
                setS3TestBusy(true);
                try {
                  await apiPost("/api/admin/s3-test", {});
                  setS3TestMsg("✅ تست موفق! اتصال به S3 کار می‌کند.");
                } catch (e) {
                  setS3TestMsg(`❌ ${e.message || String(e)}`);
                } finally {
                  setS3TestBusy(false);
                }
              }}
            >
              {s3TestBusy ? "در حال تست…" : "تست اتصال S3"}
            </button>
          </div>

          {s3SaveMsg && (
            <p
              className="field-hint"
              style={{
                color: s3SaveMsg.includes("ذخیره") ? "var(--color-success, #2e7d32)" : "#b71c1c",
              }}
            >
              {s3SaveMsg}
            </p>
          )}

          {s3TestMsg && (
            <p
              className="field-hint"
              style={{
                color: s3TestMsg.includes("✅") ? "var(--color-success, #2e7d32)" : "#b71c1c",
              }}
            >
              {s3TestMsg}
            </p>
          )}
        </form>

        <p className="field-hint" style={{ marginTop: "1rem", fontSize: "0.88rem" }}>
          💡 <strong>راهنما:</strong> برای راه‌اندازی AWS S3، باکت ایجاد کنید، IAM user با دسترسی S3 بسازید و کلیدها را اینجا وارد کنید.
          مستندات کامل: <code>S3_SETUP_GUIDE.md</code>
        </p>

        {s3Config?.is_configured && (
          <p className="field-hint" style={{ color: "var(--color-success, #2e7d32)", marginTop: "0.5rem" }}>
            ✅ S3 پیکربندی شده است. تمام آپلودهای جدید به S3 می‌روند.
          </p>
        )}
      </section>
      ) : null}
    </>
  );
}
