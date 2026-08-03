import { useDashboard } from "../../context/DashboardContext.jsx";
import DashboardBusinessForm from "../../components/DashboardBusinessForm.jsx";
import DashboardMain from "../../components/DashboardMain.jsx";

export default function DashboardEditPage() {
  const { dashSlug, onSlugChange, setBiz } = useDashboard();

  return (
    <DashboardMain>
      <DashboardBusinessForm slug={dashSlug} onSlugChange={onSlugChange} onLoaded={setBiz} hideSlugPicker />
    </DashboardMain>
  );
}
