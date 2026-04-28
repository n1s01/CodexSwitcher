import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  WindowCloseIcon,
  WindowMaximizeIcon,
  WindowMinimizeIcon,
} from "../../shared/ui/icons/AppIcons";
import styles from "./Titlebar.module.css";

const appWindow = getCurrentWindow();

type TitlebarProps = {
  isMac: boolean;
  isWindows: boolean;
};

export function Titlebar({ isMac, isWindows }: TitlebarProps) {
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
            aria-label="Свернуть"
            onClick={() => void appWindow.minimize()}
          >
            <WindowMinimizeIcon />
          </button>
          <button
            className={styles.windowControl}
            type="button"
            aria-label="Развернуть"
            onClick={() => void appWindow.toggleMaximize()}
          >
            <WindowMaximizeIcon />
          </button>
          <button
            className={`${styles.windowControl} ${styles.windowControlClose}`}
            type="button"
            aria-label="Закрыть"
            onClick={() => void appWindow.close()}
          >
            <WindowCloseIcon />
          </button>
        </div>
      )}
    </header>
  );
}
