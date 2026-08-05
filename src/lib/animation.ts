export const MOTION = {
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeMove: 'cubic-bezier(0.77, 0, 0.175, 1)',
  easePanel: 'cubic-bezier(0.32, 0.72, 0, 1)',
  pressMs: 120,
  exitMs: 140,
  fastMs: 180,
  standardMs: 220,
  panelMs: 420,
} as const;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const activeAnimations = new WeakMap<Element, Animation>();

export function getReducedMotionPreference() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function getReducedMotionQuery() {
  return REDUCED_MOTION_QUERY;
}

export function cancelMotionAnimation(element: Element) {
  const animation = activeAnimations.get(element);
  if (!animation) return;

  animation.cancel();
  activeAnimations.delete(element);
}

export function startMotionAnimation(
  element: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
  reducedMotion = getReducedMotionPreference(),
) {
  cancelMotionAnimation(element);

  const animation = element.animate(keyframes, {
    ...options,
    duration: reducedMotion ? 0 : options.duration,
  });
  activeAnimations.set(element, animation);

  void animation.finished
    .catch(() => undefined)
    .finally(() => {
      if (activeAnimations.get(element) === animation) {
        activeAnimations.delete(element);
      }
    });

  return animation;
}

export async function waitForMotionAnimation(animation: Animation | null | undefined) {
  if (!animation) return;
  await animation.finished.catch(() => undefined);
}
