import {
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type Ref,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type SemanticClassNames<Slot extends string> = Partial<Record<Slot, string>>;
export type SemanticStyles<Slot extends string> = Partial<Record<Slot, CSSProperties>>;

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) {
    (ref as MutableRefObject<T | null>).current = value;
  }
}

export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (value: T | null) => void {
  return (value) => {
    refs.forEach((ref) => assignRef(ref, value));
  };
}

export interface ControllableStateOptions<T> {
  value: T | undefined;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: ControllableStateOptions<T>): [T, Dispatch<SetStateAction<T>>] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : uncontrolledValue;

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      const resolved =
        typeof nextValue === "function"
          ? (nextValue as (previous: T) => T)(currentValue)
          : nextValue;

      if (!controlled) {
        setUncontrolledValue(resolved);
      }

      if (!Object.is(resolved, currentValue)) {
        onChange?.(resolved);
      }
    },
    [controlled, currentValue, onChange],
  );

  return [currentValue, setValue];
}

export function useMediaQuery(query: string): boolean {
  const getMatch = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const media = window.matchMedia(query);
    const handleChange = () => setMatches(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

/**
 * Runs visual elapsed-time updates only while the document is visible.
 * Keeping the latest callback in a ref avoids restarting the interval when a
 * consumer passes an inline formatter or state updater.
 */
export function useDocumentVisibleInterval(
  callback: () => void,
  delay: number,
  enabled: boolean,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    let interval: number | undefined;
    const stop = () => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
    };
    const start = () => {
      stop();
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        callbackRef.current();
        interval = window.setInterval(() => callbackRef.current(), Math.max(100, delay));
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [delay, enabled]);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "An unexpected error occurred.";
}

export function composeStyles(
  base: CSSProperties | undefined,
  override: CSSProperties | undefined,
): CSSProperties | undefined {
  if (!base) return override;
  if (!override) return base;
  return { ...base, ...override };
}
