import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiPatch } from "../../api.js";
import { useDashboard } from "../../context/DashboardContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import DashboardPanelHead, { dashboardIcons } from "../../components/DashboardPanelHead.jsx";
import DashboardMain from "../../components/DashboardMain.jsx";
import RichEditor from "../../components/RichEditor.jsx";

export default function DashboardCareersPage() {
  const { isSuperAdmin } = useAuth();
  const { dashSlug, biz, setBiz } = useDashboard();
  const [careersTitle, setCareersTitle] = useState("");
  const [careersText, setCareersText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    setCareersTitle(biz?.careers_title || "");
    setCareersText(biz?.careers_text || "");
  }, [biz?.careers_title, biz?.careers_text]);

  const previewHref = `/business?slug=${encodeURIComponent(dashSlug)}#biz-careers-section`;

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await apiPatch(`/api/businesses/${encodeURIComponent(dashSlug)}`, {
        careers_title: careersTitle,
        careers_text: careersText,
      });
      setBiz(updated);
      setSaveMsg("ذخیره شد.");
    } catch (err) {
      setSaveMsg(`خطا: ${err.message || "نامشخص"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardMain>
      <section className="dashboard-panel" id="panel-careers" aria-labelledby="careers-heading">
        <DashboardPanelHead
          headingId="careers-heading"
          title="فرصت‌های شغلی (Careers)"
          icon={dashboardIcons.careers}
        />
        <p className="field-hint" style={{ marginTop: 0 }}>
          اگر متن بگذارید، بخش «فرصت‌های شغلی»
          {isSuperAdmin ? (
            <>
              {" "}
              روی{" "}
              <Link to={previewHref} target="_blank" rel="noreferrer">
                صفحهٔ عمومی آگهی
              </Link>{" "}
            </>
          ) : (
            " "
          )}
          نمایش داده می‌شود.
        </p>

        <form onSubmit={onSubmit}>
          <div className="form-grid" style={{ marginTop: "1rem" }}>
            <div className="field field--block">
              <label htmlFor="dash-careers-title">زیرعنوان (اختیاری — زیر «فرصت‌های شغلی» در سایت)</label>
              <input
                id="dash-careers-title"
                value={careersTitle}
                onChange={(e) => setCareersTitle(e.target.value)}
                placeholder="مثال: استخدام آشپز و سالن‌دار"
              />
            </div>
            <div className="field field--block">
              <label>جزئیات استخدام و همکاری</label>
              <RichEditor
                value={careersText}
                onChange={setCareersText}
                placeholder="موقعیت‌ها، شرایط، نحوهٔ ارسال رزومه، ایمیل تماس…"
                minHeight={280}
              />
            </div>
          </div>

          <div className="dashboard-actions" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "در حال ذخیره…" : "ذخیره در سرور"}
            </button>
            {isSuperAdmin ? (
              <Link className="btn btn--ghost" to={previewHref} target="_blank" rel="noreferrer">
                پیش‌نمایش بخش استخدام
              </Link>
            ) : null}
          </div>
          {saveMsg && <p className="field-hint">{saveMsg}</p>}
        </form>
      </section>
    </DashboardMain>
  );
}
