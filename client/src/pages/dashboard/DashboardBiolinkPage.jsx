import { useDashboard } from "../../context/DashboardContext.jsx";
import DashboardMain from "../../components/DashboardMain.jsx";
import BiolinkEditor from "../../components/BiolinkEditor.jsx";

export default function DashboardBiolinkPage() {
  const { dashSlug, biz, setBiz } = useDashboard();
  return (
    <DashboardMain>
      <BiolinkEditor slug={dashSlug} biz={biz} setBiz={setBiz} />
    </DashboardMain>
  );
}
