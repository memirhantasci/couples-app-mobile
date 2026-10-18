import { useCallback, useEffect, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { createFlightPlan, FLIGHT_INSTANT, sampleFlight, type FlightPlan } from './flyToPath';
import {
  bandForZoomWithHysteresis,
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
const ZOOM_INERTIA_DURATION_MS = 380;
/** Projected log-zoom travel after release = log velocity × this (seconds). */
const ZOOM_INERTIA_SEC = 0.16;
const ZOOM_INERTIA_MIN_LOG_VELOCITY = 0.6;
/** Release velocities spike when fingers lift; cap the projected zoom change (≈ ×1.9). */
const ZOOM_INERTIA_MAX_LOG_VELOCITY = 4;
/** A pan release this soon after a pinch is pinch-driven and must not fling. */
const PINCH_RELEASE_WINDOW_MS = 150;
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

export interface UseSkyCameraOptions {
  readonly width: number;
  readonly height: number;
  readonly initialCamera: SkyCamera;
  /** Throttled (~200ms) while the camera moves. Velocities are in degrees/second. */
  readonly onMoving?: (ra: number, dec: number, zoom: number, raVelocity: number, decVelocity: number) => void;
  /** The camera settled (gesture released without momentum, or an animation finished). */
  readonly onIdle?: (ra: number, dec: number, zoom: number) => void;
  /** The star picture zoom band changed (with hysteresis). */
  readonly onBandChange?: (band: number) => void;
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
  onBandChange,
  onTap,
}: UseSkyCameraOptions) {
  const emitMoving = useLatestCallback(onMoving);
  const emitIdle = useLatestCallback(onIdle);
  const emitBandChange = useLatestCallback(onBandChange);
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
  const pinchLogVelocity = useSharedValue(0);
  const pinchEndedAt = useSharedValue(0);

  const flightRequest = useSharedValue<SkyFlightRequest | null>(null);
  const idleRa = useSharedValue(Number.NaN);
  const idleDec = useSharedValue(Number.NaN);
  const idleZoom = useSharedValue(Number.NaN);
  const lastMovingNotifyAt = useSharedValue(0);
  const lastSampleAt = useSharedValue(0);
  const raVelocity = useSharedValue(0);
  const decVelocity = useSharedValue(0);
  const notifiedBand = useSharedValue(-1);

  const readCamera = (): SkyCamera => {
    'worklet';
    const currentMode = mode.get();
    if (currentMode === MODE_FLING) {
      const zoom = baseZoom.get();
      const scale = pxPerDegree(zoom, height);
      return { ra: baseRa.get() - flingX.get() / scale, dec: baseDec.get() + flingY.get() / scale, zoom };
    }
    if (currentMode === MODE_SETTLE) {
      const params = settleParams.get();
      const progress = settleProgress.get();
      const zoom = Math.exp(params.logZoomFrom + (params.logZoomTo - params.logZoomFrom) * progress);
      const anchored = cameraAnchoredAt(params.anchorRa, params.anchorDec, params.anchorX, params.anchorY, zoom, width, height);
      return { ra: anchored.ra, dec: anchored.dec + params.decExcess * (1 - progress), zoom };
    }
    if (currentMode === MODE_FLY) {
      const plan = flightPlan.get();
      if (plan) return sampleFlight(plan, flightProgress.get());
    }
    return { ra: baseRa.get(), dec: baseDec.get(), zoom: baseZoom.get() };
  };

  const camera = useDerivedValue(() => {
    'worklet';
    return readCamera();
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

    if (zoom > MAX_ZOOM || zoom < MIN_ZOOM) {
      startSettle(lastFocalX.get(), lastFocalY.get(), clampZoom(zoom), SETTLE_DURATION_MS);
      return;
    }
    const pinchJustEnded = eventTimeMs() - pinchEndedAt.get() < PINCH_RELEASE_WINDOW_MS;
    if (pinchJustEnded) {
      const logVelocity = Math.max(
        -ZOOM_INERTIA_MAX_LOG_VELOCITY,
        Math.min(ZOOM_INERTIA_MAX_LOG_VELOCITY, pinchLogVelocity.get()),
      );
      pinchLogVelocity.set(0);
      if (Math.abs(logVelocity) > ZOOM_INERTIA_MIN_LOG_VELOCITY) {
        const target = clampZoom(zoom * Math.exp(logVelocity * ZOOM_INERTIA_SEC));
        startSettle(lastFocalX.get(), lastFocalY.get(), target, ZOOM_INERTIA_DURATION_MS);
        return;
      }
      startFling(0, 0);
      return;
    }
    startFling(velocityX, velocityY);
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

  // Throttled motion reports for tile streaming, plus band changes.
  useAnimatedReaction(
    () => {
      'worklet';
      return camera.get();
    },
    (current, previous) => {
      'worklet';
      const band = bandForZoomWithHysteresis(current.zoom, notifiedBand.get());
      if (band !== notifiedBand.get()) {
        notifiedBand.set(band);
        scheduleOnRN(emitBandChange, band);
      }
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
    .minDistance(4)
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
      if (pinchActive.get()) return;
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
      lastFocalX.set(event.focalX);
      lastFocalY.set(event.focalY);
    })
    .onChange((event) => {
      'worklet';
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
    })
    .onEnd((event) => {
      'worklet';
      pinchLogVelocity.set(event.scale > 0 ? event.velocity / event.scale : 0);
    })
    .onFinalize(() => {
      'worklet';
      if (pinchActive.get()) {
        pinchEndedAt.set(eventTimeMs());
        skipNextPanDelta.set(true);
      }
      pinchActive.set(false);
      settleAfterGesture();
    });

  const singleTap = Gesture.Tap()
    .maxDuration(300)
    .maxDistance(16)
    .onEnd((event, success) => {
      'worklet';
      if (!success) return;
      const current = readCamera();
      scheduleOnRN(emitTap, event.x, event.y, current.ra, current.dec, current.zoom);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .maxDistance(24)
    .onEnd((event, success) => {
      'worklet';
      if (!success) return;
      startSettle(event.x, event.y, clampZoom(readCamera().zoom * 2), TAP_ZOOM_DURATION_MS);
    });

  const twoFingerTap = Gesture.Tap()
    .minPointers(2)
    .maxDuration(260)
    .maxDistance(20)
    .onEnd((event, success) => {
      'worklet';
      if (!success) return;
      startSettle(event.x, event.y, clampZoom(readCamera().zoom / 2), TAP_ZOOM_DURATION_MS);
    });

  const gesture = Gesture.Race(
    Gesture.Simultaneous(pan, pinch),
    Gesture.Exclusive(twoFingerTap, doubleTap, singleTap),
  );

  return { camera, gesture, flightRequest };
}
