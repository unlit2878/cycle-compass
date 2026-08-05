import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOTION,
  cancelMotionAnimation,
  getReducedMotionPreference,
  startMotionAnimation,
  waitForMotionAnimation,
} from '../animation';

function createAnimation() {
  return {
    cancel: vi.fn(),
    finished: new Promise<void>(() => undefined),
  } as unknown as Animation;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('motion preferences', () => {
  it('reads the live reduced motion preference', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    expect(getReducedMotionPreference()).toBe(true);
  });

  it('falls back safely when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(getReducedMotionPreference()).toBe(false);
  });
});

describe('WAAPI motion ownership', () => {
  it('cancels the previous owned animation before starting another', () => {
    const element = document.createElement('div');
    const first = createAnimation();
    const second = createAnimation();
    element.animate = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    startMotionAnimation(element, [{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.fastMs }, false);
    startMotionAnimation(element, [{ opacity: 1 }, { opacity: 0 }], { duration: MOTION.exitMs }, false);

    expect(first.cancel).toHaveBeenCalledOnce();
    expect(element.animate).toHaveBeenLastCalledWith(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: MOTION.exitMs },
    );

    cancelMotionAnimation(element);
    expect(second.cancel).toHaveBeenCalledOnce();
  });

  it('removes duration when reduced motion is requested', () => {
    const element = document.createElement('div');
    const animation = createAnimation();
    element.animate = vi.fn().mockReturnValue(animation);

    startMotionAnimation(element, [{ transform: 'translateX(10px)' }, { transform: 'none' }], { duration: 220 }, true);
    expect(element.animate).toHaveBeenCalledWith(expect.any(Array), { duration: 0 });
  });

  it('treats cancellation as a completed wait', async () => {
    const animation = {
      finished: Promise.reject(new DOMException('Cancelled', 'AbortError')),
    } as Animation;

    await expect(waitForMotionAnimation(animation)).resolves.toBeUndefined();
  });
});
