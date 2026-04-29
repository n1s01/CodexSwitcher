import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  WindowCloseIcon,
  WindowMaximizeIcon,
  WindowMinimizeIcon,
} from "../../shared/ui/icons/AppIcons";
import styles from "./Titlebar.module.css";

type TitlebarProps = {
  isMac: boolean;
  isWindows: boolean;
};

export function Titlebar({ isMac, isWindows }: TitlebarProps) {
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
            aria-label="Свернуть"
            onClick={handleMinimize}
          >
            <WindowMinimizeIcon />
          </button>
          <button
            className={styles.windowControl}
            type="button"
            aria-label="Развернуть"
            onClick={handleToggleMaximize}
          >
            <WindowMaximizeIcon />
          </button>
          <button
            className={`${styles.windowControl} ${styles.windowControlClose}`}
            type="button"
            aria-label="Закрыть"
            onClick={handleClose}
          >
            <WindowCloseIcon />
          </button>
        </div>
      )}
    </header>
  );
}
