import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  WindowCloseIcon,
  WindowMaximizeIcon,
  WindowMinimizeIcon,
} from "../../shared/ui/icons/AppIcons";
import { useI18n } from "../../shared/i18n/I18nProvider";
import styles from "./Titlebar.module.css";

type TitlebarProps = {
  isMac: boolean;
  isWindows: boolean;
};

export function Titlebar({ isMac, isWindows }: TitlebarProps) {
  const { t } = useI18n();

  const runWindowAction = (action: (appWindow: ReturnType<typeof getCurrentWindow>) => unknown) => {
    try {
      void action(getCurrentWindow());
    } catch {
    }
  };

  const handleMinimize = () => {
    runWindowAction((appWindow) => appWindow.minimize());
  };

  const handleToggleMaximize = () => {
    runWindowAction((appWindow) => appWindow.toggleMaximize());
  };

  const handleClose = () => {
    runWindowAction((appWindow) => appWindow.close());
  };

  return (
    <header className={styles.titlebar} data-tauri-drag-region>
      <div className={styles.titlebarLead} data-tauri-drag-region>
        {isMac && <div className={styles.trafficLightsOffset} data-tauri-drag-region />}
      </div>

      {isWindows && (
        <div className={styles.windowControls}>
          <button
            className={styles.windowControl}
            type="button"
            aria-label={t("app.window.minimize")}
            onClick={handleMinimize}
          >
            <WindowMinimizeIcon />
          </button>
          <button
            className={styles.windowControl}
            type="button"
            aria-label={t("app.window.maximize")}
            onClick={handleToggleMaximize}
          >
            <WindowMaximizeIcon />
          </button>
          <button
            className={`${styles.windowControl} ${styles.windowControlClose}`}
            type="button"
            aria-label={t("app.window.close")}
            onClick={handleClose}
          >
            <WindowCloseIcon />
          </button>
        </div>
      )}
    </header>
  );
}
