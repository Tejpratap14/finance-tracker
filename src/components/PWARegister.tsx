'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && (window as any).workbox === undefined) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('PWA Service Worker registered with scope: ', registration.scope);
          },
          (err) => {
            console.log('PWA Service Worker registration failed: ', err);
          }
        );
      });
    }
  }, []);

  return null;
}
