import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Fixed circular control — browser history back (same as دکمهٔ عقب مرورگر).
 */
export default function FloatingBackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (pathname === "/") return null;

  return (
    <div className="floating-back">
      <button type="button" className="floating-back__btn" onClick={onBack} aria-label="بازگشت" title="بازگشت">
        <i className="fa-solid fa-chevron-right floating-back__ico" aria-hidden="true" />
        <span className="floating-back__label">بازگشت</span>
      </button>
    </div>
  );
}
