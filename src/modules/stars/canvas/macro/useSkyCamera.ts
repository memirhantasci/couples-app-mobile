import { useCallback, useEffect, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { createFlightPlan, FLIGHT_INSTANT, sampleFlight, type FlightPlan } from './flyToPath';
import {
  cameraAnchoredAt,
  clampDec,
  clampZoom,
  decLimit,
  MAX_ZOOM,
  MIN_ZOOM,
  panStep,
  pinchStep,
  pxPerDegree,
  screenToWorld,
  type SkyCamera,
} from './skyProjection';

// The rendered camera is derived from one of these modes. Gestures always
// write MODE_DIRECT; animations own the camera until they finish or a touch
// "bakes" the current frame back into the direct values.
const MODE_DIRECT = 0;
const MODE_FLING = 1;
const MODE_SETTLE = 2;
const MODE_FLY = 3;

const FLING_MIN_VELOCITY = 140; // px/s
const FLING_DECELERATION = 0.998;
const SETTLE_DURATION_MS = 320;
const TAP_ZOOM_DURATION_MS = 300;
/**
 * Releasing within this long after a pinch never flings: the remaining
 * finger's velocity still comes from the pinch, and the map must stay
 * exactly where the fingers left it (like Google Maps). A real single-finger
 * flick after a pinch is longer than this.
 */
const PINCH_FLING_GUARD_MS = 300;
const MOVING_NOTIFY_INTERVAL_MS = 200;

const SETTLE_EASING = Easing.out(Easing.cubic);
const FLIGHT_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

interface SettleParams {
  readonly anchorRa: number;
  readonly anchorDec: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly logZoomFrom: number;
  readonly logZoomTo: number;
  /** Elastic dec overshoot at the start, eased out over the animation. */
  readonly decExcess: number;
}

const EMPTY_SETTLE: SettleParams = {
  anchorRa: 0,
  anchorDec: 0,
  anchorX: 0,
  anchorY: 0,
  logZoomFrom: 0,
  logZoomTo: 0,
  decExcess: 0,
};

export interface SkyFlightRequest {
  /** Change it to start a new flight, even to the same target. */
  readonly id: number;
  readonly ra: number;
  readonly dec: number;
  /** Keeps the current zoom when omitted. */
  readonly zoom?: number;
}

/** Wall-clock time for gesture bookkeeping (worklet; never used during render). */
function eventTimeMs() {
  'worklet';
  return Date.now();
}

/** Every shared value the rendered camera is computed from. */
interface CameraSources {
  readonly mode: SharedValue<number>;
  readonly baseRa: SharedValue<number>;
  readonly baseDec: SharedValue<number>;
  readonly baseZoom: SharedValue<number>;
  readonly flingX: SharedValue<number>;
  readonly flingY: SharedValue<number>;
  readonly settleParams: SharedValue<SettleParams>;
  readonly settleProgress: SharedValue<number>;
  readonly flightPlan: SharedValue<FlightPlan | null>;
  readonly flightProgress: SharedValue<number>;
}

/** The camera as it should be on screen right now, for whichever mode owns it. */
function resolveCamera(sources: CameraSources, width: number, height: number): SkyCamera {
  'worklet';
  const mode = sources.mode.get();
  if (mode === MODE_FLING) {
    const zoom = sources.baseZoom.get();
    const scale = pxPerDegree(zoom, height);
    return {
      ra: sources.baseRa.get() - sources.flingX.get() / scale,
      dec: sources.baseDec.get() + sources.flingY.get() / scale,
      zoom,
    };
  }
  if (mode === MODE_SETTLE) {
    const params = sources.settleParams.get();
    const progress = sources.settleProgress.get();
    const zoom = Math.exp(params.logZoomFrom + (params.logZoomTo - params.logZoomFrom) * progress);
    const anchored = cameraAnchoredAt(params.anchorRa, params.anchorDec, params.anchorX, params.anchorY, zoom, width, height);
    return { ra: anchored.ra, dec: anchored.dec + params.decExcess * (1 - progress), zoom };
  }
  if (mode === MODE_FLY) {
    const plan = sources.flightPlan.get();
    if (plan) return sampleFlight(plan, sources.flightProgress.get());
  }
  return { ra: sources.baseRa.get(), dec: sources.baseDec.get(), zoom: sources.baseZoom.get() };
}

export interface UseSkyCameraOptions {
  readonly width: number;
  readonly height: number;
  readonly initialCamera: SkyCamera;
  /** Throttled (~200ms) while the camera moves. Velocities are in degrees/second. */
  readonly onMoving?: (ra: number, dec: number, zoom: number, raVelocity: number, decVelocity: number) => void;
  /** The camera settled (gesture released without momentum, or an animation finished). */
  readonly onIdle?: (ra: number, dec: number, zoom: number) => void;
  /** Single tap, with the camera exactly as rendered at that moment. */
  readonly onTap?: (x: number, y: number, ra: number, dec: number, zoom: number) => void;
}

/** Keeps the latest callback without re-creating worklets on every render. */
function useLatestCallback<Args extends unknown[]>(callback: ((...args: Args) => void) | undefined) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  return useCallback((...args: Args) => {
    ref.current?.(...args);
  }, []);
}

/**
 * The macro sky camera, owned entirely by the UI thread.
 *
 * Pan, pinch, momentum, rubber band, double-tap zoom and fly-to all write
 * shared values; the JS thread is only notified (throttled) so it can stream
 * tiles. Nothing here depends on a rendered baseline, so zoom limits and the
 * focal point behave identically everywhere on the sky.
 */
export function useSkyCamera({
  width,
  height,
  initialCamera,
  onMoving,
  onIdle,
  onTap,
}: UseSkyCameraOptions) {
  const emitMoving = useLatestCallback(onMoving);
  const emitIdle = useLatestCallback(onIdle);
  const emitTap = useLatestCallback(onTap);

  const baseRa = useSharedValue(initialCamera.ra);
  const baseZoom = useSharedValue(clampZoom(initialCamera.zoom));
  const baseDec = useSharedValue(clampDec(initialCamera.dec, clampZoom(initialCamera.zoom)));
  const mode = useSharedValue(MODE_DIRECT);
  /** Bumped whenever an animation is replaced, so stale callbacks are ignored. */
  const epoch = useSharedValue(0);

  const flingX = useSharedValue(0);
  const flingY = useSharedValue(0);
  const pendingFlingParts = useSharedValue(0);
  const settleProgress = useSharedValue(0);
  const settleParams = useSharedValue<SettleParams>(EMPTY_SETTLE);
  const flightProgress = useSharedValue(0);
  const flightPlan = useSharedValue<FlightPlan | null>(null);

  const panActive = useSharedValue(false);
  const pinchActive = useSharedValue(false);
  const skipNextPanDelta = useSharedValue(false);
  const panVelocityX = useSharedValue(0);
  const panVelocityY = useSharedValue(0);
  const lastFocalX = useSharedValue(width / 2);
  const lastFocalY = useSharedValue(height / 2);
  /** True while the pinch is tracking two fingers (its focal point is their midpoint). */
  const pinchTwoFingers = useSharedValue(false);
  /** Last time a pinch zoomed or ended; releases close to it never fling. */
  const lastPinchAt = useSharedValue(0);

  const flightRequest = useSharedValue<SkyFlightRequest | null>(null);
  const idleRa = useSharedValue(Number.NaN);
  const idleDec = useSharedValue(Number.NaN);
  const idleZoom = useSharedValue(Number.NaN);
  const lastMovingNotifyAt = useSharedValue(0);
  const lastSampleAt = useSharedValue(0);
  const raVelocity = useSharedValue(0);
  const decVelocity = useSharedValue(0);

  // Reanimated subscribes a derived value only to shared values its updater
  // captures directly, or inside plain objects/arrays it captures; it never
  // looks into helper functions. Both the rendered camera and the gesture
  // reads therefore capture this object rather than wrapping each other.
  // Shared values keep their identity, so it is built once (state keeps it
  // stable for memoization).
  const [cameraSources] = useState<CameraSources>(() => ({
    mode,
    baseRa,
    baseDec,
    baseZoom,
    flingX,
    flingY,
    settleParams,
    settleProgress,
    flightPlan,
    flightProgress,
  }));

  const readCamera = (): SkyCamera => {
    'worklet';
    return resolveCamera(cameraSources, width, height);
  };

  const camera = useDerivedValue(() => {
    'worklet';
    return resolveCamera(cameraSources, width, height);
  });

  const setDirect = (next: SkyCamera) => {
    'worklet';
    baseRa.set(next.ra);
    baseDec.set(next.dec);
    baseZoom.set(next.zoom);
  };

  /** Freeze whatever is on screen into the direct camera and stop animations. */
  const bake = () => {
    'worklet';
    const current = readCamera();
    epoch.set(epoch.get() + 1);
    cancelAnimation(flingX);
    cancelAnimation(flingY);
    cancelAnimation(settleProgress);
    cancelAnimation(flightProgress);
    setDirect(current);
    mode.set(MODE_DIRECT);
  };

  const stopMotion = () => {
    'worklet';
    if (mode.get() !== MODE_DIRECT) bake();
  };

  const notifyIdle = () => {
    'worklet';
    const ra = baseRa.get();
    const dec = baseDec.get();
    const zoom = baseZoom.get();
    if (ra === idleRa.get() && dec === idleDec.get() && zoom === idleZoom.get()) return;
    idleRa.set(ra);
    idleDec.set(dec);
    idleZoom.set(zoom);
    scheduleOnRN(emitIdle, ra, dec, zoom);
  };

  /** Animate zoom to `targetZoom` around a fixed screen point. */
  const startSettle = (anchorX: number, anchorY: number, targetZoom: number, durationMs: number) => {
    'worklet';
    bake();
    const current = readCamera();
    const anchor = screenToWorld(anchorX, anchorY, current, width, height);
    const anchoredNow = cameraAnchoredAt(anchor.ra, anchor.dec, anchorX, anchorY, current.zoom, width, height);
    const params: SettleParams = {
      anchorRa: anchor.ra,
      anchorDec: anchor.dec,
      anchorX,
      anchorY,
      logZoomFrom: Math.log(current.zoom),
      logZoomTo: Math.log(targetZoom),
      decExcess: current.dec - anchoredNow.dec,
    };
    if (Math.abs(params.logZoomTo - params.logZoomFrom) < 1e-6 && Math.abs(params.decExcess) < 1e-9) {
      notifyIdle();
      return;
    }
    settleParams.set(params);
    settleProgress.set(0);
    mode.set(MODE_SETTLE);
    const animationEpoch = epoch.get();
    settleProgress.set(
      withTiming(1, { duration: durationMs, easing: SETTLE_EASING }, (finished) => {
        if (!finished || epoch.get() !== animationEpoch) return;
        bake();
        notifyIdle();
      }),
    );
  };

  /** Momentum after a drag; also springs dec back inside the pole limit. */
  const startFling = (velocityX: number, velocityY: number) => {
    'worklet';
    bake();
    const zoom = baseZoom.get();
    const dec = baseDec.get();
    const scale = pxPerDegree(zoom, height);
    const limit = decLimit(zoom);
    const decOutside = dec > limit || dec < -limit;
    const flingHorizontal = Math.abs(velocityX) > FLING_MIN_VELOCITY;
    const flingVertical = decOutside || Math.abs(velocityY) > FLING_MIN_VELOCITY;
    if (!flingHorizontal && !flingVertical) {
      notifyIdle();
      return;
    }

    flingX.set(0);
    flingY.set(0);
    mode.set(MODE_FLING);
    pendingFlingParts.set((flingHorizontal ? 1 : 0) + (flingVertical ? 1 : 0));
    const animationEpoch = epoch.get();
    const onPartFinished = (finished?: boolean) => {
      'worklet';
      if (!finished || epoch.get() !== animationEpoch) return;
      const remaining = pendingFlingParts.get() - 1;
      pendingFlingParts.set(remaining);
      if (remaining > 0) return;
      bake();
      notifyIdle();
    };

    if (flingHorizontal) {
      flingX.set(withDecay({ velocity: velocityX, deceleration: FLING_DECELERATION }, onPartFinished));
    }
    if (decOutside) {
      const targetY = (Math.max(-limit, Math.min(limit, dec)) - dec) * scale;
      flingY.set(withTiming(targetY, { duration: SETTLE_DURATION_MS, easing: SETTLE_EASING }, onPartFinished));
    } else if (flingVertical) {
      flingY.set(
        withDecay(
          {
            velocity: velocityY,
            deceleration: FLING_DECELERATION,
            clamp: [(-limit - dec) * scale, (limit - dec) * scale],
          },
          onPartFinished,
        ),
      );
    }
  };

  /** Called whenever a gesture finalizes; acts once all fingers are up. */
  const settleAfterGesture = () => {
    'worklet';
    if (panActive.get() || pinchActive.get() || mode.get() !== MODE_DIRECT) return;
    const zoom = baseZoom.get();
    const velocityX = panVelocityX.get();
    const velocityY = panVelocityY.get();
    panVelocityX.set(0);
    panVelocityY.set(0);

    // Past a zoom limit: spring back around the fingers (rubber band).
    if (zoom > MAX_ZOOM || zoom < MIN_ZOOM) {
      startSettle(lastFocalX.get(), lastFocalY.get(), clampZoom(zoom), SETTLE_DURATION_MS);
      return;
    }
    // After a pinch the camera stays exactly where the fingers left it: no
    // zoom inertia and no fling (only a pole overshoot is eased back).
    const afterPinch = eventTimeMs() - lastPinchAt.get() < PINCH_FLING_GUARD_MS;
    startFling(afterPinch ? 0 : velocityX, afterPinch ? 0 : velocityY);
  };

  /** Fly-to entry point; runs on the UI thread so it starts from the live camera. */
  const startFlight = (targetRa: number, targetDec: number, targetZoom: number) => {
    'worklet';
    bake();
    const from = readCamera();
    const zoom = Number.isFinite(targetZoom) && targetZoom > 0 ? targetZoom : from.zoom;
    const plan = createFlightPlan(from, { ra: targetRa, dec: targetDec, zoom }, width, height);
    if (plan.kind === FLIGHT_INSTANT) {
      setDirect(sampleFlight(plan, 1));
      notifyIdle();
      return;
    }
    flightPlan.set(plan);
    flightProgress.set(0);
    mode.set(MODE_FLY);
    const animationEpoch = epoch.get();
    flightProgress.set(
      withTiming(1, { duration: plan.durationMs, easing: FLIGHT_EASING }, (finished) => {
        if (!finished || epoch.get() !== animationEpoch) return;
        bake();
        notifyIdle();
      }),
    );
  };

  // Fly-to requests arrive from JS as data; the flight starts on the UI thread
  // from the live camera, so a request never races an in-flight gesture.
  useAnimatedReaction(
    () => {
      'worklet';
      return flightRequest.get();
    },
    (request, previous) => {
      'worklet';
      if (!request || request.id === previous?.id) return;
      startFlight(request.ra, request.dec, request.zoom ?? Number.NaN);
    },
  );

  // Throttled motion reports for tile streaming.
  useAnimatedReaction(
    () => {
      'worklet';
      return camera.get();
    },
    (current, previous) => {
      'worklet';
      if (!previous) return;

      const now = eventTimeMs();
      const elapsedSec = Math.max(0.001, (now - lastSampleAt.get()) / 1000);
      lastSampleAt.set(now);
      if (elapsedSec < 0.5) {
        raVelocity.set(raVelocity.get() * 0.6 + ((current.ra - previous.ra) / elapsedSec) * 0.4);
        decVelocity.set(decVelocity.get() * 0.6 + ((current.dec - previous.dec) / elapsedSec) * 0.4);
      } else {
        raVelocity.set(0);
        decVelocity.set(0);
      }
      if (now - lastMovingNotifyAt.get() < MOVING_NOTIFY_INTERVAL_MS) return;
      lastMovingNotifyAt.set(now);
      scheduleOnRN(emitMoving, current.ra, current.dec, current.zoom, raVelocity.get(), decVelocity.get());
    },
  );

  // Explicit 'worklet' directives keep every callback on the UI thread even if
  // the compiler hoists it out of the builder chain.
  const pan = Gesture.Pan()
    .minDistance(10)
    .averageTouches(true)
    .onBegin(() => {
      'worklet';
      stopMotion();
    })
    .onStart(() => {
      'worklet';
      panActive.set(true);
    })
    .onChange((event) => {
      'worklet';
      // While two fingers pinch, the pinch moves the map with their midpoint.
      if (pinchActive.get() && pinchTwoFingers.get()) return;
      if (skipNextPanDelta.get()) {
        // First event after a pinch: the touch centroid may jump when a finger lifts.
        skipNextPanDelta.set(false);
        return;
      }
      if (mode.get() !== MODE_DIRECT) bake();
      setDirect(panStep(readCamera(), event.changeX, event.changeY, height));
    })
    .onEnd((event) => {
      'worklet';
      panVelocityX.set(event.velocityX);
      panVelocityY.set(event.velocityY);
    })
    .onFinalize(() => {
      'worklet';
      panActive.set(false);
      skipNextPanDelta.set(false);
      settleAfterGesture();
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      'worklet';
      stopMotion();
    })
    .onStart((event) => {
      'worklet';
      if (mode.get() !== MODE_DIRECT) bake();
      pinchActive.set(true);
      pinchTwoFingers.set(event.numberOfPointers >= 2);
      lastFocalX.set(event.focalX);
      lastFocalY.set(event.focalY);
    })
    .onChange((event) => {
      'worklet';
      if (event.numberOfPointers < 2) {
        // A finger lifted while the pinch is still alive (iOS): its focal
        // point jumps to the remaining finger, so stop zooming here and let
        // the pan follow that finger instead.
        if (pinchTwoFingers.get()) {
          pinchTwoFingers.set(false);
          skipNextPanDelta.set(true);
        }
        return;
      }
      if (!pinchTwoFingers.get()) {
        // Second finger back: re-anchor instead of applying the jump.
        pinchTwoFingers.set(true);
        lastFocalX.set(event.focalX);
        lastFocalY.set(event.focalY);
        return;
      }
      if (mode.get() !== MODE_DIRECT) bake();
      setDirect(
        pinchStep(
          readCamera(),
          lastFocalX.get(),
          lastFocalY.get(),
          event.focalX,
          event.focalY,
          event.scaleChange,
          width,
          height,
        ),
      );
      lastFocalX.set(event.focalX);
      lastFocalY.set(event.focalY);
      lastPinchAt.set(eventTimeMs());
    })
    .onFinalize(() => {
      'worklet';
      if (pinchActive.get()) {
        lastPinchAt.set(eventTimeMs());
        skipNextPanDelta.set(true);
      }
      pinchActive.set(false);
      pinchTwoFingers.set(false);
      settleAfterGesture();
    });

  const singleTap = Gesture.Tap()
    .maxDuration(450)
    .maxDistance(24)
    .onEnd((event, success) => {
      'worklet';
      if (!success) return;
      const current = readCamera();
      runOnJS(emitTap)(event.x, event.y, current.ra, current.dec, current.zoom);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .maxDistance(28)
    .onEnd((event, success) => {
      'worklet';
      if (!success) return;
      startSettle(event.x, event.y, clampZoom(readCamera().zoom * 2), TAP_ZOOM_DURATION_MS);
    });

  const twoFingerTap = Gesture.Tap()
    .minPointers(2)
    .maxDuration(280)
    .maxDistance(24)
    .onEnd((event, success) => {
      'worklet';
      if (!success) return;
      startSettle(event.x, event.y, clampZoom(readCamera().zoom / 2), TAP_ZOOM_DURATION_MS);
    });

  const gesture = Gesture.Simultaneous(
    pan,
    pinch,
    twoFingerTap,
    Gesture.Exclusive(doubleTap, singleTap),
  );

  return { camera, gesture, flightRequest };
}
