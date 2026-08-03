import { useDashboard } from "../../context/DashboardContext.jsx";
import DashboardQrSection from "../../components/DashboardQrSection.jsx";
import DashboardMain from "../../components/DashboardMain.jsx";

export default function DashboardQrPage() {
  const { dashSlug, biz, setHeroQr } = useDashboard();

  return (
    <DashboardMain>
      <DashboardQrSection
        onScanCount={(n) => {
          if (n === null || n === undefined) setHeroQr("—");
          else setHeroQr(String(n));
        }}
        businessSlug={dashSlug}
        syncedGoogleReviewUrl={biz?.google_review_url ?? ""}
        syncedBusinessName={biz?.name_fa ?? ""}
        syncedQrTrackingUrl={biz?.qr_tracking_url ?? ""}
      />
    </DashboardMain>
  );
}
