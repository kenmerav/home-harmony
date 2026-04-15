import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();

    const reloadKey = "homehub:vite-preload-reload-target";
    const currentTarget = `${window.location.pathname}${window.location.search}`;
    const attemptedTarget = window.sessionStorage.getItem(reloadKey);

    if (attemptedTarget !== currentTarget) {
      window.sessionStorage.setItem(reloadKey, currentTarget);
      window.location.reload();
    }
  });

  const clearReloadTarget = () => {
    window.sessionStorage.removeItem("homehub:vite-preload-reload-target");
  };

  window.addEventListener("pageshow", clearReloadTarget);
}

createRoot(document.getElementById("root")!).render(<App />);
