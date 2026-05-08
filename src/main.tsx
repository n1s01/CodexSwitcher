import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { I18nProvider } from "./shared/i18n/I18nProvider";
import { ToastProvider } from "./shared/ui/toast/ToastProvider";

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("dragstart", (event) => event.preventDefault());
document.addEventListener("selectstart", (event) => event.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>,
);
