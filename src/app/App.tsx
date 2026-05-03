import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import styles from "./App.module.css";
import "./styles.css";
import { getNavItems } from "../features/navigation/model/nav-items";
import type { TabId } from "../features/navigation/model/types";
import { AccountsPage } from "../pages/accounts/ui/AccountsPage";
import { HomePage } from "../pages/home/ui/HomePage";
import { SettingsPage } from "../pages/settings/ui/SettingsPage";
import { useI18n } from "../shared/i18n/I18nProvider";
import { Sidebar } from "../widgets/sidebar/Sidebar";
import { Titlebar } from "../widgets/titlebar/Titlebar";

const pageByTab: Record<TabId, ReactNode> = {
  home: <HomePage />,
  accounts: <AccountsPage />,
  settings: <SettingsPage />,
};

const DEFAULT_SIDEBAR_WIDTH = 280;
const COLLAPSED_SIDEBAR_WIDTH = 76;
const MIN_EXPANDED_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH_RATIO = 0.35;
const RESIZE_HANDLE_WIDTH = 12;
const SIDEBAR_EXPAND_DURATION = 380;
const SIDEBAR_COLLAPSE_DURATION = 320;

type SidebarMotionState = "idle" | "expanding" | "collapsing";

function detectOs() {
  const platform = `${navigator.platform} ${navigator.userAgent}`;

  if (/Mac|iPhone|iPad|iPod/i.test(platform)) {
    return "macos";
  }

  if (/Win/i.test(platform)) {
    return "windows";
  }

  return "other";
}

export function App() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [maxSidebarWidth, setMaxSidebarWidth] = useState(() => window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO);
  const [isResizing, setIsResizing] = useState(false);
  const [dragSidebarWidth, setDragSidebarWidth] = useState<number | null>(null);
  const [sidebarMotionState, setSidebarMotionState] = useState<SidebarMotionState>("idle");
  const workspaceRef = useRef<HTMLDivElement>(null);
  const resizeGrabOffsetRef = useRef(RESIZE_HANDLE_WIDTH / 2);
  const sidebarMotionTimeoutRef = useRef<number | null>(null);
  const os = detectOs();
  const navItems = getNavItems(t);
  const isMac = os === "macos";
  const isWindows = os === "windows";
  const canExpandSidebar = maxSidebarWidth >= MIN_EXPANDED_SIDEBAR_WIDTH;
  const collapsedWidth = Math.min(COLLAPSED_SIDEBAR_WIDTH, maxSidebarWidth);
  const resizingWidth =
    dragSidebarWidth === null
      ? collapsed ? collapsedWidth : Math.min(Math.max(sidebarWidth, collapsedWidth), maxSidebarWidth)
      : Math.min(Math.max(dragSidebarWidth, collapsedWidth), maxSidebarWidth);
  const expandedWidth = Math.min(Math.max(sidebarWidth, MIN_EXPANDED_SIDEBAR_WIDTH), maxSidebarWidth);
  const currentSidebarWidth = isResizing ? resizingWidth : collapsed ? collapsedWidth : expandedWidth;
  const disableSidebarTransition = isResizing;

  const getSidebarSnapState = (width: number) => {
    if (!canExpandSidebar) {
      return "collapsed" as const;
    }

    const snappedExpandedWidth = Math.min(Math.max(width, MIN_EXPANDED_SIDEBAR_WIDTH), maxSidebarWidth);
    const distanceToCollapsed = Math.abs(width - collapsedWidth);
    const distanceToExpanded = Math.abs(snappedExpandedWidth - width);

    return distanceToExpanded <= distanceToCollapsed ? "expanded" : "collapsed";
  };

  useEffect(() => {
    const workspace = workspaceRef.current;

    if (!workspace) {
      return undefined;
    }

    const updateMaxSidebarWidth = (workspaceWidth: number) => {
      setMaxSidebarWidth(Math.max(workspaceWidth * MAX_SIDEBAR_WIDTH_RATIO, 0));
    };

    updateMaxSidebarWidth(workspace.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => {
      updateMaxSidebarWidth(entry.contentRect.width);
    });

    observer.observe(workspace);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    setSidebarWidth((currentWidth) => Math.min(currentWidth, maxSidebarWidth));
    setDragSidebarWidth((currentWidth) => {
      if (currentWidth === null) {
        return null;
      }

      return Math.min(currentWidth, maxSidebarWidth);
    });
  }, [maxSidebarWidth]);

  useEffect(() => {
    return () => {
      if (sidebarMotionTimeoutRef.current !== null) {
        window.clearTimeout(sidebarMotionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!collapsed && !canExpandSidebar) {
      setCollapsed(true);
    }
  }, [canExpandSidebar, collapsed]);

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const workspace = workspaceRef.current;

      if (!workspace) {
        return;
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const nextWidth = event.clientX - workspaceRect.left - resizeGrabOffsetRef.current;
      const nextMaxWidth = workspaceRect.width * MAX_SIDEBAR_WIDTH_RATIO;
      const clampedWidth = Math.min(Math.max(nextWidth, collapsedWidth), nextMaxWidth);

      setDragSidebarWidth(clampedWidth);
      setSidebarWidth(clampedWidth);

      if (clampedWidth < MIN_EXPANDED_SIDEBAR_WIDTH || nextMaxWidth < MIN_EXPANDED_SIDEBAR_WIDTH) {
        setCollapsed(true);
        return;
      }

      setCollapsed(false);
    };

    const stopResizing = () => {
      const finalWidth = dragSidebarWidth ?? currentSidebarWidth;

      setDragSidebarWidth(null);
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (getSidebarSnapState(finalWidth) === "expanded") {
        startSidebarMotion("expanding");
        setSidebarWidth(Math.min(Math.max(finalWidth, MIN_EXPANDED_SIDEBAR_WIDTH), maxSidebarWidth));
        setCollapsed(false);
        return;
      }

      startSidebarMotion("collapsing");
      setCollapsed(true);
    };

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
    };
  }, [canExpandSidebar, collapsedWidth, currentSidebarWidth, dragSidebarWidth, isResizing, maxSidebarWidth]);

  const startSidebarMotion = (nextMotionState: SidebarMotionState) => {
    if (sidebarMotionTimeoutRef.current !== null) {
      window.clearTimeout(sidebarMotionTimeoutRef.current);
    }

    setSidebarMotionState(nextMotionState);

    if (nextMotionState === "idle") {
      sidebarMotionTimeoutRef.current = null;
      return;
    }

    const duration =
      nextMotionState === "expanding"
        ? SIDEBAR_EXPAND_DURATION
        : SIDEBAR_COLLAPSE_DURATION;

    sidebarMotionTimeoutRef.current = window.setTimeout(() => {
      setSidebarMotionState("idle");
      sidebarMotionTimeoutRef.current = null;
    }, duration);
  };

  const handleToggleCollapse = () => {
    if (collapsed) {
      if (!canExpandSidebar) {
        return;
      }

      startSidebarMotion("expanding");
      setSidebarWidth((currentWidth) => Math.min(Math.max(currentWidth, MIN_EXPANDED_SIDEBAR_WIDTH), maxSidebarWidth));
      setCollapsed(false);
      return;
    }

    startSidebarMotion("collapsing");
    setCollapsed(true);
  };

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    startSidebarMotion("idle");
    const workspace = workspaceRef.current;

    if (workspace) {
      const workspaceRect = workspace.getBoundingClientRect();
      resizeGrabOffsetRef.current = event.clientX - workspaceRect.left - currentSidebarWidth;
    } else {
      resizeGrabOffsetRef.current = RESIZE_HANDLE_WIDTH / 2;
    }

    setDragSidebarWidth(currentSidebarWidth);
    setIsResizing(true);
  };

  return (
    <div className={styles.shell}>
      <Titlebar isMac={isMac} isWindows={isWindows} />

      <div
        ref={workspaceRef}
        className={`${styles.workspace} ${isResizing ? styles.workspaceResizing : ""}`}
      >
        <Sidebar
          items={navItems}
          activeTab={activeTab}
          isCollapsed={collapsed}
          motionState={sidebarMotionState}
          width={currentSidebarWidth}
          disableTransition={disableSidebarTransition}
          onTabChange={setActiveTab}
          onToggleCollapse={handleToggleCollapse}
        />

        <div
          className={styles.resizeHandle}
          role="separator"
          aria-orientation="vertical"
          aria-label={t("app.sidebar.resize")}
          onPointerDown={handleResizeStart}
        >
          <div className={styles.resizeHandleGrip} />
        </div>

        <main className={styles.content}>
          <div className={styles.contentInner}>
            {pageByTab[activeTab]}
          </div>
        </main>
      </div>
    </div>
  );
}
