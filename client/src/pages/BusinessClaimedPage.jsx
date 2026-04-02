import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";

export default function BusinessClaimedPage() {
  return (
    <>
      <Seo title="نمونهٔ آگهی ادعا شده" noindex description="صفحهٔ نمونه داخلی." />
    <main className="container" style={{ padding: "2rem 0" }}>
      <h1>کلینیک پارس (نمونه ادعا شده)</h1>
      <p>
        <Link to="/listings">لیست</Link>
      </p>
    </main>
    </>
  );
}
