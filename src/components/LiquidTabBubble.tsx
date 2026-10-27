import React from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  animate,
  MotionValue,
} from 'motion/react';

export type LiquidBubbleVariant = 'amber' | 'rose' | 'nav' | 'glass';

export interface LiquidTabBubbleController<T extends string = string> {
  containerRef: React.RefObject<HTMLDivElement | null>;
  registerTab: (key: T) => (el: HTMLElement | null) => void;
  x: MotionValue<number>;
  width: MotionValue<number>;
  scaleX: MotionValue<number>;
  scaleY: MotionValue<number>;
  sheenX: MotionValue<string>;
  opacity: MotionValue<number>;
  ready: boolean;
}

export function useLiquidTabBubble<T extends string = string>(
  activeKey: T | null | undefined,
  extraDeps: ReadonlyArray<unknown> = []
): LiquidTabBubbleController<T> {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const tabRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const callbackCacheRef = React.useRef<Record<string, (el: HTMLElement | null) => void>>({});
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const deformControlRef = React.useRef<{ stop: () => void } | null>(null);

  const hasMeasuredRef = React.useRef(false);
  const prevKeyRef = React.useRef<T | null | undefined>(undefined);
  const directionRef = React.useRef<number>(1);
  const [ready, setReady] = React.useState(false);

  const springX = useSpring(0, {
    stiffness: 390,
    damping: 29,
    mass: 0.68,
    restDelta: 0.2,
  });

  const springWidth = useSpring(0, {
    stiffness: 420,
    damping: 32,
    mass: 0.64,
    restDelta: 0.2,
  });

  const opacity = useMotionValue(0);

  // Deformation progress: > 0 = horizontal stretch in flight, < 0 = gentle settling squish on arrival
  const deform = useMotionValue(0);

  const scaleX = useTransform(deform, (v) => {
    if (v >= 0) {
      return 1 + v * 0.095;
    }
    return 1 + v * 0.085;
  });

  const scaleY = useTransform(deform, (v) => {
    if (v >= 0) {
      return 1 - v * 0.068;
    }
    return 1 - v * 0.075;
  });

  const sheenX = useTransform(deform, (v) => {
    const shift = v * directionRef.current * 14;
    return `${shift.toFixed(1)}%`;
  });

  const registerTab = React.useCallback((key: T) => {
    if (!callbackCacheRef.current[key]) {
      callbackCacheRef.current[key] = (el: HTMLElement | null) => {
        const prevEl = tabRefs.current[key];
        if (prevEl && resizeObserverRef.current) {
          resizeObserverRef.current.unobserve(prevEl);
        }
        tabRefs.current[key] = el;
        if (el && resizeObserverRef.current) {
          resizeObserverRef.current.observe(el);
        }
      };
    }
    return callbackCacheRef.current[key];
  }, []);

  const syncGeometry = React.useCallback(
    (allowAnimation: boolean) => {
      if (!activeKey) {
        opacity.set(0);
        if (ready) setReady(false);
        hasMeasuredRef.current = false;
        prevKeyRef.current = activeKey;
        return;
      }

      const activeEl = tabRefs.current[activeKey];
      const containerEl = containerRef.current;
      if (!activeEl || !containerEl) return;

      const nextLeft = activeEl.offsetLeft;
      const nextWidth = activeEl.offsetWidth;

      if (nextWidth <= 0) {
        // Element is currently hidden (e.g. responsive display:none); wait for resizeObserver when it becomes visible
        hasMeasuredRef.current = false;
        return;
      }

      const isFirstMeasure = !hasMeasuredRef.current;
      const isKeyChanged = prevKeyRef.current !== activeKey;
      prevKeyRef.current = activeKey;

      if (isFirstMeasure || !allowAnimation || !isKeyChanged || prefersReducedMotion) {
        deformControlRef.current?.stop();
        springX.jump(nextLeft);
        springWidth.jump(nextWidth);
        deform.jump(0);
        opacity.set(1);
        hasMeasuredRef.current = true;
        if (!ready) setReady(true);
        return;
      }

      const currentX = springX.get();
      const deltaX = nextLeft - currentX;
      const dist = Math.abs(deltaX);
      directionRef.current = deltaX >= 0 ? 1 : -1;

      springX.set(nextLeft);
      springWidth.set(nextWidth);
      opacity.set(1);

      if (dist > 2) {
        const intensity = Math.min(1, Math.max(0.28, dist / 135));
        deformControlRef.current?.stop();
        deformControlRef.current = animate(
          deform,
          [deform.get(), intensity, -0.38 * intensity, 0.09 * intensity, 0],
          {
            duration: 0.46,
            times: [0, 0.3, 0.68, 0.86, 1],
            ease: 'easeInOut',
          }
        );
      }

      if (!ready) setReady(true);
    },
    [activeKey, prefersReducedMotion, ready, springX, springWidth, deform, opacity]
  );

  // Measure immediately on activeKey or dependency changes before paint
  React.useLayoutEffect(() => {
    syncGeometry(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, syncGeometry, ...extraDeps]);

  // Keep position & width locked during window resizes, orientation changes, and element reflows
  React.useEffect(() => {
    const handleViewportChange = () => {
      syncGeometry(false);
    };

    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('orientationchange', handleViewportChange, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncGeometry(false);
      });
      resizeObserverRef.current = resizeObserver;
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
      Object.values(tabRefs.current).forEach((el) => {
        if (el) resizeObserver?.observe(el);
      });
    }

    if (typeof document !== 'undefined' && 'fonts' in document) {
      (document as Document & { fonts?: FontFaceSet }).fonts?.ready
        .then(() => syncGeometry(false))
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      resizeObserver?.disconnect();
      resizeObserverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncGeometry, ...extraDeps]);

  return {
    containerRef,
    registerTab,
    x: springX,
    width: springWidth,
    scaleX,
    scaleY,
    sheenX,
    opacity,
    ready,
  };
}

interface LiquidTabBubbleProps<T extends string = string> {
  controller: LiquidTabBubbleController<T>;
  variant?: LiquidBubbleVariant;
  className?: string;
  showBottomCaustic?: boolean;
}

export function LiquidTabBubble<T extends string = string>({
  controller,
  variant = 'amber',
  className = 'top-1 bottom-1 rounded-[10px]',
  showBottomCaustic = false,
}: LiquidTabBubbleProps<T>) {
  const variantClass =
    variant === 'rose'
      ? 'cm-liquid-bubble-rose'
      : variant === 'nav'
      ? 'cm-liquid-bubble-nav'
      : variant === 'glass'
      ? 'cm-liquid-bubble-glass'
      : 'cm-liquid-bubble-amber';

  return (
    <motion.span
      aria-hidden="true"
      className={`pointer-events-none absolute left-0 z-0 overflow-hidden cm-liquid-bubble transition-colors duration-200 ${variantClass} ${className}`}
      style={{
        x: controller.x,
        width: controller.width,
        scaleX: controller.scaleX,
        scaleY: controller.scaleY,
        opacity: controller.opacity,
      }}
    >
      {/* Internal refractive water-surface sheen that shifts during motion */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          x: controller.sheenX,
          background:
            variant === 'nav' || variant === 'glass'
              ? 'radial-gradient(65% 85% at 50% 0%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.04) 52%, transparent 100%)'
              : 'radial-gradient(65% 85% at 50% 0%, rgba(255, 255, 255, 0.52) 0%, rgba(255, 255, 255, 0.1) 52%, transparent 100%)',
        }}
      />
      {/* Optional bottom amber caustic light bar for primary navigation capsules */}
      {showBottomCaustic && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-amber-400/20 via-amber-400 to-amber-400/20 shadow-[0_0_8px_rgba(245,158,11,0.65)]"
        />
      )}
    </motion.span>
  );
}
