/* Root service worker: notifications for followed runners, and nothing else.
 *
 * The per-race workers under /<race-slug>/ handle a race you are watching. They cannot help on
 * an athlete page, because a service worker only controls its own scope and /a/... is outside
 * every one of them. This one is registered at the root so it covers the whole site.
 *
 * DELIBERATELY NO fetch HANDLER. A root worker that intercepted fetches would sit in front of
 * every page on the site, and a caching mistake there is a stale site for everyone with no
 * obvious way to notice. This worker does exactly two things: remember which runners you
 * follow, and show a notification when one of them starts a race.
 *
 * The push carries no payload. Encrypting one needs aes128gcm and a shared secret per
 * subscription; the existing race workers already solve this by treating the push as a nudge
 * and fetching the state themselves, and this does the same. /follow_now.json lists who is
 * on course right now, this worker matches that against the follows it holds, and a device
 * that follows nobody in the race shows nothing.
 *
 * Follows live in the Cache API rather than localStorage, which a worker cannot read.
 */
var FOLLOW = 'urt-follow-athletes-v1';

function key() { return new Request('urt-followed-athletes.json'); }

function readFollows() {
  return caches.open(FOLLOW).then(function (c) {
    return c.match(key()).then(function (hit) {
      return hit ? hit.json().catch(function () { return []; }) : [];
    });
  });
}

function writeFollows(list) {
  return caches.open(FOLLOW).then(function (c) {
    return c.put(key(), new Response(JSON.stringify(list),
      { headers: { 'Content-Type': 'application/json' } }));
  });
}

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

/* The page tells the worker who is followed; the worker cannot read localStorage itself. */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type !== 'follow-athlete' && d.type !== 'unfollow-athlete') return;
  e.waitUntil(readFollows().then(function (list) {
    list = (list || []).filter(function (x) { return x && x.path !== d.path; });
    if (d.type === 'follow-athlete' && d.path) {
      list.push({ path: d.path, name: d.name || '' });
    }
    return writeFollows(list);
  }));
});

/* A push that shows no notification makes Chrome invent one reading "This site has been
   updated in the background" - our name on a message we did not write. Rare, because the
   server only pushes devices following somebody on course, but a device that unfollowed
   locally still holds a live subscription. */
function fallbackNote() {
  return self.registration.showNotification('A race is under way', {
    body: 'Someone you followed may be running. Open UltraRunTrack to see who is out there.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'urt-generic',
    data: { url: '/' },
  });
}

self.addEventListener('push', function (e) {
  e.waitUntil(readFollows().then(function (list) {
    if (!list || !list.length) return fallbackNote();
    return fetch('/follow_now.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var racing = (j && j.racing) || {};
        var hits = list.filter(function (f) { return racing[f.path]; });
        if (!hits.length) return fallbackNote();

        /* One notification per race, however many followed runners are in it: three separate
           buzzes about the same race reads as spam and gets notifications turned off. */
        var byRace = {};
        hits.forEach(function (f) {
          var info = racing[f.path];
          var k = info.race;
          (byRace[k] = byRace[k] || { event: info.event || k, who: [] })
            .who.push(f.name || info.name || 'Your runner');
        });

        return Promise.all(Object.keys(byRace).map(function (k) {
          var b = byRace[k];
          var who = b.who.length === 1 ? b.who[0]
            : b.who.length === 2 ? (b.who[0] + ' and ' + b.who[1])
            : (b.who[0] + ' and ' + (b.who.length - 1) + ' others');
          return self.registration.showNotification(who + ' is racing', {
            body: who + ' just started ' + b.event + '. Follow it live.',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'urt-racing-' + k,
            data: { url: '/' + k + '/' },
          });
        }));
      })
      .catch(function () { return fallbackNote(); });
  }).catch(function () { return fallbackNote(); }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(function (ws) {
      for (var i = 0; i < ws.length; i++) {
        if (ws[i].url.indexOf(url) !== -1 && 'focus' in ws[i]) return ws[i].focus();
      }
      return clients.openWindow ? clients.openWindow(url) : null;
    }));
});
