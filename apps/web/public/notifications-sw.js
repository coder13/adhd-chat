self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url || self.location.origin || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(
      async (clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            await client.focus();
            if ('navigate' in client) {
              await client.navigate(targetUrl);
            }
            return;
          }
        }

        if (self.clients.openWindow) {
          await self.clients.openWindow(targetUrl);
        }
      }
    )
  );
});
