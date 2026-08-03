import { useDashboard } from "../../context/DashboardContext.jsx";
import DashboardMain from "../../components/DashboardMain.jsx";
import MediaEditor from "../../components/MediaEditor.jsx";

export default function DashboardMediaPage() {
  const { dashSlug, biz, setBiz } = useDashboard();
  return (
    <DashboardMain>
      <MediaEditor slug={dashSlug} biz={biz} setBiz={setBiz} />
    </DashboardMain>
  );
}
