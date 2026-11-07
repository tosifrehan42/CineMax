import { useEffect, useState } from 'react';
import { useReducedMotion, type Transition, type Variants } from 'motion/react';

/**
 * CineMax Global Cinematic Motion System
 * Provides unified easing curves, damped spring presets, reusable motion variants,
 * and accessibility/device-capability hooks across the entire application.
 */

export const CINEMATIC_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const CINEMATIC_SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const CINEMATIC_EXIT_EASE: [number, number, number, number] = [0.4, 0, 1, 1];

export const MOTION_DURATIONS = {
  micro: 0.16,
  fast: 0.22,
  normal: 0.34,
  medium: 0.34,
  slow: 0.52,
  hero: 0.85,
} as const;

export const SPRING_TACTILE: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 28,
  mass: 0.65,
};

export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 28,
  mass: 0.8,
};

export const SPRING_MODAL: Transition = {
  type: 'spring',
  stiffness: 340,
  damping: 30,
  mass: 0.75,
};

export const SPRING_CARD_TILT = {
  stiffness: 260,
  damping: 24,
  mass: 0.6,
} as const;

/**
 * Reusable Animation Variants
 */
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  initial: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATIONS.medium, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATIONS.medium, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.18, ease: CINEMATIC_EXIT_EASE },
  },
};

export const fadeDownVariants: Variants = {
  hidden: { opacity: 0, y: -12 },
  initial: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: MOTION_DURATIONS.micro, ease: CINEMATIC_EXIT_EASE },
  },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  initial: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.28, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.28, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: CINEMATIC_EXIT_EASE },
  },
};

export const scaleRevealVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  initial: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.32, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.32, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: { duration: 0.18, ease: CINEMATIC_EXIT_EASE },
  },
};

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  initial: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  initial: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATIONS.medium, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATIONS.medium, ease: CINEMATIC_EASE },
  },
};

export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  initial: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: MOTION_DURATIONS.fast, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    transition: { duration: MOTION_DURATIONS.fast, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: CINEMATIC_EXIT_EASE },
  },
};

export const modalPanelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.965, y: 14 },
  initial: { opacity: 0, scale: 0.965, y: 14 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.28, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.28, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.975,
    y: 10,
    transition: { duration: 0.18, ease: CINEMATIC_EXIT_EASE },
  },
};

export const popoverMenuVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: -6 },
  initial: { opacity: 0, scale: 0.94, y: -6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING_TACTILE,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING_TACTILE,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: { duration: 0.14, ease: CINEMATIC_EXIT_EASE },
  },
};

export const pageTransitionVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  initial: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.15, ease: CINEMATIC_EXIT_EASE },
  },
};

export const reducedMotionVariants: Variants = {
  hidden: { opacity: 1, y: 0, scale: 1 },
  initial: { opacity: 1, y: 0, scale: 1 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.01 } },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

/**
 * Calculates a bounded stagger delay so large poster grids or paginated lists
 * never accumulate long delays.
 */
export function getBoundedStaggerDelay(
  index: number,
  stepSeconds = 0.032,
  maxItems = 10
): number {
  return Math.min(Math.max(0, index), maxItems) * stepSeconds;
}

/**
 * Detects whether the user has requested reduced motion and whether the active
 * device supports desktop fine-pointer hover interactions.
 */
export function useCinematicMotion() {
  const rawReducedMotion = useReducedMotion();
  const prefersReducedMotion = Boolean(rawReducedMotion);

  const [canHoverDesktop, setCanHoverDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const handleChange = (e: MediaQueryListEvent) => {
      setCanHoverDesktop(e.matches);
    };
    setCanHoverDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return {
    prefersReducedMotion,
    canHoverDesktop,
    canHover: !prefersReducedMotion && canHoverDesktop,
    enable3DTilt: !prefersReducedMotion && canHoverDesktop,
  };
}
