import React, { useState } from "react";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { WatchAdModal } from "@/components/ui/WatchAdModal";
import { PermissionPrimingModal } from "@/components/common/PermissionPrimingModal";
import { DateTimePickerSheet } from "@/components/ui/DateTimePickerSheet";
import { OrigamiBirdAnimation } from "@/components/letters/OrigamiBirdAnimation";
import { SpotlightTour } from "@/components/tour/SpotlightTour";
import { CoupleWrappedModal } from "@/components/wrapped/CoupleWrappedModal";

/**
 * Pencere / örtü bileşenleri görünmezken bile her ekran açılışında baştan kurulup çiziliyordu
 * (ekran başına 5-8 adet). Burada sarılan sürümler ilk kez görünür olana kadar hiç kurulmaz;
 * görününce kurulur ve (kapanış animasyonu için) açık kalır. Prop'lar ve davranış aynıdır.
 */
export function withLazyMount<P extends { visible?: boolean }>(Component: React.ComponentType<P>) {
  function LazyMounted(props: P) {
    const [mounted, setMounted] = useState(!!props.visible);
    if (props.visible && !mounted) setMounted(true);
    return mounted ? <Component {...props} /> : null;
  }
  LazyMounted.displayName = `LazyMount(${Component.displayName || Component.name || "Component"})`;
  return LazyMounted;
}

export const LazyPremiumPaywall = withLazyMount(PremiumPaywall);
export const LazyPageTourModal = withLazyMount(PageTourModal);
export const LazyDemoActionModal = withLazyMount(DemoActionModal);
export const LazyWatchAdModal = withLazyMount(WatchAdModal);
export const LazyPermissionPrimingModal = withLazyMount(PermissionPrimingModal);
export const LazyDateTimePickerSheet = withLazyMount(DateTimePickerSheet);
export const LazyOrigamiBirdAnimation = withLazyMount(OrigamiBirdAnimation);
export const LazySpotlightTour = withLazyMount(SpotlightTour);
export const LazyCoupleWrappedModal = withLazyMount(CoupleWrappedModal);
