self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    await Promise.all(windowClients.map((client) => client.navigate(client.url)));
  })());
});
