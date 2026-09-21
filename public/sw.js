self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Casa Común", body: "Tienes un nuevo aviso." };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/favicon.ico" }));
});