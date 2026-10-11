"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";

export type PushState = "checking" | "unsupported" | "install-first" | "off" | "on" | "blocked" | "working";

const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android";
  if (/mac/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows";
  return "Device";
}

async function registration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/** Real push notifications for this device (arrive with the app closed). */
export function usePush() {
  const [state, setState] = useState<PushState>("checking");

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIOS() && !isStandalone() ? "install-first" : "unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        if (sub && Notification.permission === "granted") {
          // Keep the server in sync (e.g. after a database reset).
          await adminApi("push_subscribe", { subscription: sub.toJSON(), device: deviceName() }).catch(() => {});
          setState("on");
        } else setState("off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  const enable = useCallback(async () => {
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "blocked" : "off");
      const reg = await registration();
      const { publicKey } = await adminApi<{ publicKey: string }>("push_key");
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
      await adminApi("push_subscribe", { subscription: sub.toJSON(), device: deviceName() });
      setState("on");
      return true;
    } catch (e) {
      console.error(e);
      setState("off");
      throw e;
    }
  }, []);

  const disable = useCallback(async () => {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await adminApi("push_unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setState("off");
  }, []);

  const test = useCallback(() => adminApi<{ sent: number; failed: number }>("push_test", {}), []);

  return { state, enable, disable, test };
}
