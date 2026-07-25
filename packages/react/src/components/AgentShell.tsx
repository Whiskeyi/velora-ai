import {
  forwardRef,
  type AriaRole,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useComponentClass } from "./VeloraProvider";
import {
  composeStyles,
  cx,
  assignRef,
  type SemanticClassNames,
  type SemanticStyles,
  useControllableState,
} from "./utils";

const SIDEBAR_DRAWER_MAX_WIDTH = 680;
const INSPECTOR_DRAWER_MAX_WIDTH = 960;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export type AgentShellSlot =
  | "root"
  | "sidebar"
  | "workspace"
  | "header"
  | "content"
  | "composer"
  | "inspector"
  | "overlay"
  | "mobileControls"
  | "sidebarToggle"
  | "inspectorToggle"
  | "backdrop";

export interface AgentShellProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  sidebar?: ReactNode;
  header?: ReactNode;
  composer?: ReactNode;
  inspector?: ReactNode;
  overlay?: ReactNode;
  sidebarLabel?: string;
  inspectorLabel?: string;
  /** Controls the responsive sidebar drawer. Wide layouts always keep the sidebar in-flow. */
  mobileSidebarOpen?: boolean;
  defaultMobileSidebarOpen?: boolean;
  onMobileSidebarOpenChange?: (open: boolean) => void;
  /** Controls the responsive inspector drawer. Wide layouts always keep the inspector in-flow. */
  mobileInspectorOpen?: boolean;
  defaultMobileInspectorOpen?: boolean;
  onMobileInspectorOpenChange?: (open: boolean) => void;
  sidebarToggleIcon?: ReactNode;
  inspectorToggleIcon?: ReactNode;
  openSidebarLabel?: string;
  closeSidebarLabel?: string;
  openInspectorLabel?: string;
  closeInspectorLabel?: string;
  closePanelsLabel?: string;
  /** Optional landmark role. Omitted by default so shells can be safely nested in an existing main. */
  contentRole?: AriaRole;
  classNames?: SemanticClassNames<AgentShellSlot>;
  styles?: SemanticStyles<AgentShellSlot>;
}

export const AgentShell = forwardRef<HTMLDivElement, AgentShellProps>(function AgentShell(
  {
    children,
    sidebar,
    header,
    composer,
    inspector,
    overlay,
    sidebarLabel = "Conversations",
    inspectorLabel = "Inspector",
    mobileSidebarOpen,
    defaultMobileSidebarOpen = false,
    onMobileSidebarOpenChange,
    mobileInspectorOpen,
    defaultMobileInspectorOpen = false,
    onMobileInspectorOpenChange,
    sidebarToggleIcon,
    inspectorToggleIcon,
    openSidebarLabel = "Open conversations",
    closeSidebarLabel = "Close conversations",
    openInspectorLabel = "Open inspector",
    closeInspectorLabel = "Close inspector",
    closePanelsLabel = "Close open panel",
    contentRole,
    onKeyDown,
    className,
    style,
    classNames,
    styles,
    ...rest
  },
  ref,
) {
  const rootClass = useComponentClass("agent-shell");
  const generatedId = useId().replace(/:/g, "");
  const sidebarId = `vl-agent-shell-${generatedId}-sidebar`;
  const inspectorId = `vl-agent-shell-${generatedId}-inspector`;
  const sidebarToggleRef = useRef<HTMLButtonElement | null>(null);
  const inspectorToggleRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const inspectorRef = useRef<HTMLElement | null>(null);
  const [shellWidth, setShellWidth] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useControllableState({
    value: mobileSidebarOpen,
    defaultValue: defaultMobileSidebarOpen,
    onChange: onMobileSidebarOpenChange,
  });
  const [inspectorOpen, setInspectorOpen] = useControllableState({
    value: mobileInspectorOpen,
    defaultValue: defaultMobileInspectorOpen,
    onChange: onMobileInspectorOpenChange,
  });
  const sidebarIsDrawer = shellWidth != null && shellWidth <= SIDEBAR_DRAWER_MAX_WIDTH;
  const inspectorIsDrawer =
    shellWidth != null && shellWidth <= INSPECTOR_DRAWER_MAX_WIDTH;
  const modalPanel = sidebar != null && sidebarOpen && sidebarIsDrawer
    ? "sidebar"
    : inspector != null && inspectorOpen && inspectorIsDrawer
      ? "inspector"
      : null;
  const modalOpen = modalPanel != null;
  const activePanelRef = modalPanel === "sidebar" ? sidebarRef : inspectorRef;

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const measure = () => setShellWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width != null) setShellWidth(width);
      });
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!modalPanel) return;
    const panel = activePanelRef.current;
    if (!panel) return;
    const firstFocusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel).focus();
  }, [activePanelRef, modalPanel]);

  const toggleSidebar = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    if (next) setInspectorOpen(false);
  };

  const toggleInspector = () => {
    const next = !inspectorOpen;
    setInspectorOpen(next);
    if (next) setSidebarOpen(false);
  };

  const closePanels = () => {
    const returnTarget = modalPanel === "inspector"
      ? inspectorToggleRef.current
      : sidebarToggleRef.current;
    setSidebarOpen(false);
    setInspectorOpen(false);
    queueMicrotask(() => returnTarget?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && modalOpen) {
      event.preventDefault();
      closePanels();
      return;
    }
    if (event.key === "Tab" && modalPanel) {
      const panel = activePanelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      {...rest}
      ref={(node) => {
        rootRef.current = node;
        assignRef(ref, node);
      }}
      className={cx(rootClass, classNames?.root, className)}
      style={composeStyles(styles?.root, style)}
      onKeyDown={handleKeyDown}
      data-slot="root"
      data-mobile-sidebar-open={sidebarOpen ? "true" : "false"}
      data-mobile-inspector-open={inspectorOpen ? "true" : "false"}
      data-sidebar-mode={sidebarIsDrawer ? "drawer" : "inline"}
      data-inspector-mode={inspectorIsDrawer ? "drawer" : "inline"}
    >
      {sidebar != null ? (
        <aside
          ref={sidebarRef}
          id={sidebarId}
          className={cx("vl-agent-shell__sidebar", classNames?.sidebar)}
          style={styles?.sidebar}
          aria-label={sidebarLabel}
          aria-modal={modalPanel === "sidebar" || undefined}
          role={modalPanel === "sidebar" ? "dialog" : undefined}
          tabIndex={modalPanel === "sidebar" ? -1 : undefined}
          inert={modalPanel === "inspector" ? true : undefined}
          aria-hidden={modalPanel === "inspector" || undefined}
          data-slot="sidebar"
          data-open={sidebarOpen ? "true" : "false"}
        >
          {sidebar}
        </aside>
      ) : null}

      <section
        className={cx("vl-agent-shell__workspace", classNames?.workspace)}
        style={styles?.workspace}
        data-slot="workspace"
        inert={modalPanel ? true : undefined}
        aria-hidden={modalPanel ? true : undefined}
      >
        {header != null || sidebar != null || inspector != null ? (
          <header
            className={cx("vl-agent-shell__header", classNames?.header)}
            style={styles?.header}
            data-slot="header"
          >
            <div className="vl-agent-shell__header-content">{header}</div>
            <div
              className={cx("vl-agent-shell__mobile-controls", classNames?.mobileControls)}
              style={styles?.mobileControls}
              data-slot="mobileControls"
            >
              {sidebar != null ? (
                <button
                  ref={sidebarToggleRef}
                  className={cx("vl-agent-shell__panel-toggle", classNames?.sidebarToggle)}
                  style={styles?.sidebarToggle}
                  type="button"
                  aria-controls={sidebarId}
                  aria-expanded={sidebarOpen}
                  aria-label={sidebarOpen ? closeSidebarLabel : openSidebarLabel}
                  onClick={toggleSidebar}
                  data-panel="sidebar"
                  data-slot="sidebarToggle"
                >
                  {sidebarToggleIcon ?? (
                    <span className="vl-agent-shell__toggle-icon" aria-hidden="true" />
                  )}
                </button>
              ) : null}
              {inspector != null ? (
                <button
                  ref={inspectorToggleRef}
                  className={cx("vl-agent-shell__panel-toggle", classNames?.inspectorToggle)}
                  style={styles?.inspectorToggle}
                  type="button"
                  aria-controls={inspectorId}
                  aria-expanded={inspectorOpen}
                  aria-label={inspectorOpen ? closeInspectorLabel : openInspectorLabel}
                  onClick={toggleInspector}
                  data-panel="inspector"
                  data-slot="inspectorToggle"
                >
                  {inspectorToggleIcon ?? (
                    <span
                      className="vl-agent-shell__toggle-icon"
                      data-icon="inspector"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ) : null}
            </div>
          </header>
        ) : null}
        <div
          className={cx("vl-agent-shell__content", classNames?.content)}
          style={styles?.content}
          role={contentRole}
          data-slot="content"
        >
          {children}
        </div>
        {composer != null ? (
          <footer
            className={cx("vl-agent-shell__composer", classNames?.composer)}
            style={styles?.composer}
            data-slot="composer"
          >
            {composer}
          </footer>
        ) : null}
      </section>

      {inspector != null ? (
        <aside
          ref={inspectorRef}
          id={inspectorId}
          className={cx("vl-agent-shell__inspector", classNames?.inspector)}
          style={styles?.inspector}
          aria-label={inspectorLabel}
          aria-modal={modalPanel === "inspector" || undefined}
          role={modalPanel === "inspector" ? "dialog" : undefined}
          tabIndex={modalPanel === "inspector" ? -1 : undefined}
          inert={modalPanel === "sidebar" ? true : undefined}
          aria-hidden={modalPanel === "sidebar" || undefined}
          data-slot="inspector"
          data-open={inspectorOpen ? "true" : "false"}
        >
          {inspector}
        </aside>
      ) : null}

      {overlay != null ? (
        <div
          className={cx("vl-agent-shell__overlay", classNames?.overlay)}
          style={styles?.overlay}
          inert={modalOpen ? true : undefined}
          aria-hidden={modalOpen ? true : undefined}
          data-slot="overlay"
        >
          {overlay}
        </div>
      ) : null}

      {(sidebar != null || inspector != null) ? (
        <button
          className={cx("vl-agent-shell__backdrop", classNames?.backdrop)}
          style={styles?.backdrop}
          type="button"
          aria-label={closePanelsLabel}
          aria-hidden={modalOpen ? undefined : true}
          onClick={closePanels}
          tabIndex={modalOpen ? 0 : -1}
          data-open={modalOpen ? "true" : "false"}
          data-slot="backdrop"
        />
      ) : null}
    </div>
  );
});
