import {
  createContext,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { cx } from "./utils";

export type VeloraTheme = "light" | "dark" | "system";
export type VeloraDensity = "compact" | "comfortable";

export interface VeloraTokens {
  accent: string;
  accentContrast: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
  radius: string;
  radiusSmall: string;
  shadow: string;
  blur: string;
  fontSans: string;
  fontMono: string;
}

export interface VeloraContextValue {
  prefixCls: string;
  theme: VeloraTheme;
  density: VeloraDensity;
  direction: "ltr" | "rtl";
  reducedMotion: boolean | "system";
  getPrefixCls: (component?: string, customPrefix?: string) => string;
}

const defaultContext: VeloraContextValue = {
  prefixCls: "vl",
  theme: "system",
  density: "comfortable",
  direction: "ltr",
  reducedMotion: "system",
  getPrefixCls: (component, customPrefix) =>
    component ? `${customPrefix ?? "vl"}-${component}` : (customPrefix ?? "vl"),
};

const VeloraContext = createContext<VeloraContextValue>(defaultContext);

export interface VeloraProviderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "dir"> {
  children: ReactNode;
  /** Class-name prefix used by component semantic DOM. Built-in `vl-*` classes remain as styling hooks. */
  prefixCls?: string;
  theme?: VeloraTheme;
  density?: VeloraDensity;
  direction?: "ltr" | "rtl";
  /** Set to true to disable non-essential motion, false to force it, or system to follow the OS. */
  reducedMotion?: boolean | "system";
  /** Design-token overrides. Values should be valid CSS values. */
  tokens?: Partial<VeloraTokens>;
}

type TokenStyle = React.CSSProperties & Record<`--vl-${string}`, string | number | undefined>;

const tokenVariables: Record<keyof VeloraTokens, `--vl-${string}`> = {
  accent: "--vl-accent",
  accentContrast: "--vl-accent-contrast",
  background: "--vl-background",
  surface: "--vl-surface",
  surfaceElevated: "--vl-surface-elevated",
  text: "--vl-text",
  textMuted: "--vl-text-muted",
  border: "--vl-border",
  danger: "--vl-danger",
  success: "--vl-success",
  warning: "--vl-warning",
  radius: "--vl-radius",
  radiusSmall: "--vl-radius-sm",
  shadow: "--vl-shadow",
  blur: "--vl-blur",
  fontSans: "--vl-font-sans",
  fontMono: "--vl-font-mono",
};

export const VeloraProvider = forwardRef<HTMLDivElement, VeloraProviderProps>(
  function VeloraProvider(
    {
      children,
      prefixCls = "vl",
      theme = "system",
      density = "comfortable",
      direction = "ltr",
      reducedMotion = "system",
      tokens,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    const getPrefixCls = useCallback(
      (component?: string, customPrefix?: string) => {
        const prefix = customPrefix ?? prefixCls;
        return component ? `${prefix}-${component}` : prefix;
      },
      [prefixCls],
    );

    const value = useMemo<VeloraContextValue>(
      () => ({ prefixCls, theme, density, direction, reducedMotion, getPrefixCls }),
      [density, direction, getPrefixCls, prefixCls, reducedMotion, theme],
    );

    const tokenStyle = useMemo<TokenStyle>(() => {
      const next: TokenStyle = { ...style };
      if (tokens) {
        (Object.keys(tokens) as Array<keyof VeloraTokens>).forEach((key) => {
          next[tokenVariables[key]] = tokens[key];
        });
      }
      return next;
    }, [style, tokens]);

    const customClass = prefixCls === "vl" ? undefined : `${prefixCls}-provider`;

    return (
      <VeloraContext.Provider value={value}>
        <div
          {...rest}
          ref={ref}
          className={cx("vl-provider", customClass, className)}
          style={tokenStyle}
          data-vl-theme={theme}
          data-vl-density={density}
          data-vl-reduced-motion={String(reducedMotion)}
          dir={direction}
        >
          {children}
        </div>
      </VeloraContext.Provider>
    );
  },
);

export function useVelora(): VeloraContextValue {
  return useContext(VeloraContext);
}

export function useComponentClass(component: string, customPrefix?: string): string {
  const { getPrefixCls } = useVelora();
  const className = getPrefixCls(component, customPrefix);
  const builtInClass = `vl-${component}`;
  return className === builtInClass ? builtInClass : `${builtInClass} ${className}`;
}
