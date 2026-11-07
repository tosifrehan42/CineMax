import { useSyncExternalStore } from 'react';
import type { Transition, Variants } from 'motion/react';

/**
 * CineMax Global Cinematic Motion System (Performance-Optimized)
 * - Centralizes reduced-motion and desktop fine-pointer hover detection into a
 *   single shared browser media-query store (zero per-component matchMedia listeners).
 * - Restricts JS animations to high-value surfaces (modals, popovers, hero crossfade)
 *   using compositor-only opacity and transform properties.
 */

export const CINEMATIC_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const CINEMATIC_SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const CINEMATIC_EXIT_EASE: [number, number, number, number] = [0.4, 0, 1, 1];

export const MOTION_DURATIONS = {
  micro: 0.14,
  fast: 0.18,
  normal: 0.26,
  medium: 0.26,
  slow: 0.36,
  hero: 0.32,
} as const;

export const SPRING_TACTILE: Transition = {
  type: 'spring',
  stiffness: 460,
  damping: 32,
  mass: 0.6,
};

export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 30,
  mass: 0.75,
};

export const SPRING_MODAL: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 32,
  mass: 0.7,
};

/**
 * Reusable Animation Variants (Opacity + Transform Only)
 */
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  initial: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATIONS.normal, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION_DURATIONS.normal, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: MOTION_DURATIONS.micro, ease: CINEMATIC_EXIT_EASE },
  },
};

export const fadeDownVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  initial: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: MOTION_DURATIONS.micro, ease: CINEMATIC_EXIT_EASE },
  },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  initial: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.2, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: MOTION_DURATIONS.micro, ease: CINEMATIC_EXIT_EASE },
  },
};

export const scaleRevealVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 6 },
  initial: { opacity: 0, scale: 0.98, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    transition: { duration: MOTION_DURATIONS.micro, ease: CINEMATIC_EXIT_EASE },
  },
};

export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  initial: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.18, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.18, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.14, ease: CINEMATIC_EXIT_EASE },
  },
};

export const modalPanelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 8 },
  initial: { opacity: 0, scale: 0.98, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    y: 6,
    transition: { duration: 0.14, ease: CINEMATIC_EXIT_EASE },
  },
};

export const popoverMenuVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  initial: { opacity: 0, scale: 0.96, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: CINEMATIC_EASE },
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: CINEMATIC_EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -3,
    transition: { duration: 0.11, ease: CINEMATIC_EXIT_EASE },
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
 * Centralized Singleton Capability Store
 * Attaches at most ONE matchMedia listener per query across the entire browser session,
 * preventing per-component listener overhead.
 */
interface MotionCapabilitySnapshot {
  prefersReducedMotion: boolean;
  canHoverDesktop: boolean;
  canHover: boolean;
}

const SERVER_SNAPSHOT: MotionCapabilitySnapshot = {
  prefersReducedMotion: false,
  canHoverDesktop: false,
  canHover: false,
};

let currentSnapshot: MotionCapabilitySnapshot = SERVER_SNAPSHOT;
let storeInitialized = false;
const subscribers = new Set<() => void>();

function computeSnapshot(): MotionCapabilitySnapshot {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return SERVER_SNAPSHOT;
  }
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  const canHoverDesktop = window.matchMedia(
    '(hover: hover) and (pointer: fine)'
  ).matches;
  const canHover = !prefersReducedMotion && canHoverDesktop;

  if (
    storeInitialized &&
    currentSnapshot.prefersReducedMotion === prefersReducedMotion &&
    currentSnapshot.canHoverDesktop === canHoverDesktop &&
    currentSnapshot.canHover === canHover
  ) {
    return currentSnapshot;
  }

  currentSnapshot = {
    prefersReducedMotion,
    canHoverDesktop,
    canHover,
  };
  return currentSnapshot;
}

function initCapabilityStore(): void {
  if (storeInitialized || typeof window === 'undefined' || !window.matchMedia) {
    return;
  }
  storeInitialized = true;
  currentSnapshot = computeSnapshot();

  const reducedMql = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hoverMql = window.matchMedia('(hover: hover) and (pointer: fine)');

  const handleChange = () => {
    const prev = currentSnapshot;
    const next = computeSnapshot();
    if (prev !== next) {
      subscribers.forEach((listener) => listener());
    }
  };

  reducedMql.addEventListener('change', handleChange);
  hoverMql.addEventListener('change', handleChange);
}

function subscribeCapabilities(listener: () => void): () => void {
  initCapabilityStore();
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

function getCapabilitySnapshot(): MotionCapabilitySnapshot {
  initCapabilityStore();
  return currentSnapshot;
}

function getServerCapabilitySnapshot(): MotionCapabilitySnapshot {
  return SERVER_SNAPSHOT;
}

export function useCinematicMotion(): MotionCapabilitySnapshot {
  return useSyncExternalStore(
    subscribeCapabilities,
    getCapabilitySnapshot,
    getServerCapabilitySnapshot
  );
}
