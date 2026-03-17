import { registerSW } from 'virtual:pwa-register';

let pwaRegistrationStarted = false;

export function registerPwa() {
  if (
    pwaRegistrationStarted ||
    typeof window === 'undefined' ||
    import.meta.env.DEV
  ) {
    return;
  }

  pwaRegistrationStarted = true;

  registerSW({
    immediate: true,
    onRegisteredSW(
      _swUrl: string,
      registration: ServiceWorkerRegistration | undefined
    ) {
      if (!registration) {
        return;
      }

      window.setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    },
    onNeedRefresh() {
      window.location.reload();
    },
  });
}
