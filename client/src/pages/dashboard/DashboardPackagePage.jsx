import { useDashboard } from "../../context/DashboardContext.jsx";
import DashboardPanelHead, { dashboardIcons } from "../../components/DashboardPanelHead.jsx";
import DashboardMain from "../../components/DashboardMain.jsx";

export default function DashboardPackagePage() {
  const { biz } = useDashboard();
  const pkgLabel = biz?.package === "featured" ? "ویژه" : biz?.package === "basic" ? "پایه" : "—";

  return (
    <DashboardMain>
      <section className="dashboard-panel" id="package" aria-labelledby="package-heading">
        <DashboardPanelHead headingId="package-heading" title="بسته آگهی" icon={dashboardIcons.package} />
        <p>
          بسته فعلی: <strong>{pkgLabel}</strong>
        </p>
        <p className="field-hint">برای تغییر بسته در صورت نیاز با پشتیبانی هماهنگ کنید.</p>
      </section>
    </DashboardMain>
  );
}
