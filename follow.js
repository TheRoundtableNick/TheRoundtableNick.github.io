/* Follow. The one thing this site has never had.
 *
 * 4,292 people watched Badwater and never came back, because there was nothing to come back
 * to. The archive is 32 years deep, the athlete pages are permanent, web push and verified
 * email both work, and none of it was joined to anything a person could follow. Every visit
 * was somebody's first.
 *
 * This is the join. Follow a runner or a race, and the site remembers.
 *
 * NO ACCOUNTS, ON PURPOSE. There is no login on this site and there should not be: it is free
 * for runners and crews and it stays that way, it runs on static files, and asking a family
 * to make an account before they can watch their mother run is the opposite of the product.
 * So follows live in localStorage, keyed per device. That is a real limitation and it is
 * stated plainly rather than hidden: this device remembers, and an email backup carries it to
 * another one when somebody wants that.
 *
 * The shape is deliberately small. A set of athlete paths and a set of race slugs, versioned,
 * with a timestamp so a later sync can merge sensibly instead of guessing.
 */
(function (root) {
  'use strict';

  var KEY = 'urt_follow_v1';
  var listeners = [];

  function blank() {
    return { v: 1, athletes: {}, races: {}, updated: 0 };
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var d = JSON.parse(raw);
      if (!d || d.v !== 1) return blank();
      d.athletes = d.athletes || {};
      d.races = d.races || {};
      return d;
    } catch (e) {
      /* private mode, quota, corrupt value. Following simply does not persist, and the rest
         of the page carries on working, which matters more than the feature. */
      return blank();
    }
  }

  function write(d) {
    d.updated = Math.floor(Date.now() / 1000);
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](d); } catch (e) {}
    }
    return d;
  }

  function isFollowing(kind, id) {
    var d = read();
    return !!(d[kind] && d[kind][id]);
  }

  function toggle(kind, id, meta) {
    var d = read();
    if (!d[kind]) d[kind] = {};
    if (d[kind][id]) {
      delete d[kind][id];
    } else {
      /* keep the label with the id so a following list can render without 40,000 lookups */
      d[kind][id] = { at: Math.floor(Date.now() / 1000), name: (meta && meta.name) || id };
    }
    write(d);
    return !!d[kind][id];
  }

  function list(kind) {
    var d = read(), out = [];
    for (var k in d[kind] || {}) {
      if (Object.prototype.hasOwnProperty.call(d[kind], k)) {
        out.push({ id: k, name: d[kind][k].name, at: d[kind][k].at });
      }
    }
    out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return out;
  }

  function count() {
    return list('athletes').length + list('races').length;
  }

  function onChange(fn) { listeners.push(fn); }


  /* ---- notifications ---------------------------------------------------------------
     Following stores a runner on this device. That is worth something on its own, but the
     thing people actually want is to be told when that runner next toes a line - which they
     cannot get by remembering to come back and look.

     The offer appears only after a follow succeeds, and only once per device: a permission
     prompt that reappears on every follow is how a domain gets notifications blocked for good.
  */
  var ASKED = 'urt_push_asked_v1';

  function b64ToU8(b64) {
    var pad = '='.repeat((4 - (b64.length % 4)) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function pushSupported() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) &&
      ('Notification' in window);
  }

  /* Register the ROOT worker: the per-race ones are scoped to their own directory and cannot
     act on /a/... pages. */
  function register() {
    return navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  function subscribe(kind, id, meta) {
    if (!pushSupported()) return Promise.reject(new Error('unsupported'));
    return register().then(function (reg) {
      return Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') throw new Error('denied');
        return fetch('/api/push/key', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (kr) {
            if (!kr || !kr.key) throw new Error('no key');
            return reg.pushManager.getSubscription().then(function (existing) {
              return existing || reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: b64ToU8(kr.key),
              });
            });
          })
          .then(function (sub) {
            return fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ athlete: id, subscription: sub.toJSON() }),
            }).then(function (r) { return r.json(); });
          })
          .then(function (j) {
            if (!j || !j.ok) throw new Error((j && j.error) || 'subscribe failed');
            /* the worker cannot read localStorage, so hand it the follow directly */
            if (reg.active) {
              reg.active.postMessage({
                type: 'follow-athlete', path: id, name: (meta && meta.name) || '',
              });
            }
            return true;
          });
      });
    });
  }

  function offerPush(btn, kind, id, meta) {
    if (kind !== 'athletes' || !pushSupported()) return;
    try { if (localStorage.getItem(ASKED)) return; } catch (e) { return; }
    if (Notification.permission === 'denied') return;

    var wrap = document.createElement('span');
    wrap.className = 'urt-pushoffer';
    wrap.innerHTML = '<button type="button" class="urt-fbtn urt-pushyes">' +
      'Tell me when they race</button>';
    if (btn.parentNode) btn.parentNode.insertBefore(wrap, btn.nextSibling);

    var yes = wrap.querySelector('.urt-pushyes');
    yes.addEventListener('click', function () {
      try { localStorage.setItem(ASKED, '1'); } catch (e) {}
      yes.disabled = true;
      yes.textContent = 'Setting up...';
      subscribe(kind, id, meta).then(function () {
        yes.textContent = 'We will tell you';
        yes.setAttribute('aria-pressed', 'true');
      }).catch(function () {
        /* Silent on failure: the follow already worked, and a red error about a thing they
           did not have a minute ago is not worth the alarm. */
        wrap.remove();
      });
    });
  }

  /* A button that says what it will do, and afterwards says what it did. Injected rather than
     templated because there are 40,244 athlete pages and they are static. */
  function button(kind, id, meta, opts) {
    opts = opts || {};
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'urt-fbtn' + (opts.className ? ' ' + opts.className : '');
    function paint() {
      var on = isFollowing(kind, id);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? 'Following' : (opts.label || 'Follow');
      b.title = on
        ? 'Saved on this device. Click to stop following.'
        : 'Saved on this device. No account needed.';
    }
    b.addEventListener('click', function () {
      toggle(kind, id, meta);
      paint();
      if (opts.onToggle) opts.onToggle(isFollowing(kind, id));
      /* only when turning a follow ON, and only after it has already been saved */
      if (isFollowing(kind, id)) offerPush(b, kind, id, meta);
    });
    paint();
    onChange(paint);
    return b;
  }

  root.URTFollow = {
    subscribe: subscribe, pushSupported: pushSupported,
    read: read, list: list, count: count,
    isFollowing: isFollowing, toggle: toggle,
    button: button, onChange: onChange, KEY: KEY
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
