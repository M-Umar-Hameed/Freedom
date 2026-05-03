import { invoke } from "@tauri-apps/api/core";
import logo from "./assets/logo.png";

export function Overlay() {
  const closeOverlay = async () => {
    await invoke("hide_overlay");
  };

  return (
    <div className="overlay-root">
      <div className="overlay-content">
        <img src={logo} alt="LibreAscent" style={{ width: '64px', height: '64px', marginBottom: '24px' }} />
        <p className="eyebrow">LibreAscent</p>
        <h1>Content Blocked</h1>
        <p className="message">
          This application or website has been blocked to help you stay focused.
        </p>
        <button className="btn-close" onClick={closeOverlay}>
          Go back to work
        </button>
      </div>
    </div>
  );
}
