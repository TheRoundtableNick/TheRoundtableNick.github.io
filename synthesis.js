/**
 * Race synthesis: Defensible insights computed from splits alone.
 * Every claim here must survive journalist (Seat 7) scrutiny: no inference,
 * no averaging beyond what the splits support.
 */

/**
 * Compute segment pace momentum for each runner.
 * Returns a new field for each runner: momentum_pct
 *  - Positive: accelerating (faster pace on last segment than overall)
 *  - Negative: decelerating (slower pace on last segment than overall)
 *  - Field also gets momentum_label for display: "▲", "▼", "−"
 */
function computeSegmentMomentum(live, stations) {
  if (!live || !live.runners || !stations) return;

  live.runners.forEach(function(r) {
    // Only compute for runners with at least 2 split times (at least 1 full segment)
    if (!r.splits || r.splits.length < 2) {
      r.momentum_pct = null;
      r.momentum_label = '';
      return;
    }

    // Get the last two split times
    var lastIdx = r.splits.length - 1;
    var t2 = r.splits[lastIdx];         // Time at last station
    var t1 = r.splits[lastIdx - 1];     // Time at previous station
    var segmentElapsed = t2 - t1;       // Elapsed time for last segment

    // Get the station mile values to compute distance
    if (lastIdx >= stations.length || lastIdx - 1 < 0) {
      r.momentum_pct = null;
      r.momentum_label = '';
      return;
    }

    var m2 = stations[lastIdx].mile;
    var m1 = stations[lastIdx - 1].mile;
    var segmentMiles = m2 - m1;

    if (segmentMiles <= 0 || segmentElapsed <= 0) {
      r.momentum_pct = null;
      r.momentum_label = '';
      return;
    }

    // Compute paces
    var segmentPace = (segmentElapsed / 60 / 60) / segmentMiles;  // hours per mile

    // urt-momentum-splits: overall pace comes from the runner's own last confirmed split,
    // NOT from elapsed_s. elapsed_s is not a finish time on an archived race: some feeds
    // write the race clock at archive time, and the LiveTrail archive path writes 0, which
    // made this divide by zero and print "Infinity%" under all 1,760 UTMB finishers and
    // every other archived field. splits[lastIdx] is the same series segmentPace is built
    // from, so this is both correct and internally consistent.
    var overallSec = r.splits[lastIdx];
    var overallMiles = stations[lastIdx].mile;
    if (overallSec == null || !(overallSec > 0) || !(overallMiles > 0)) {
      r.momentum_pct = null;
      r.momentum_label = '';
      return;
    }
    var overallPace = (overallSec / 60 / 60) / overallMiles;      // hours per mile
    if (!(overallPace > 0) || !isFinite(overallPace)) {
      r.momentum_pct = null;
      r.momentum_label = '';
      return;
    }

    // Momentum: percentage faster/slower than overall
    // Negative means faster (lower pace = faster running)
    var momentumPct = ((segmentPace - overallPace) / overallPace) * 100;
    if (!isFinite(momentumPct)) {
      r.momentum_pct = null;
      r.momentum_label = '';
      return;
    }

    r.momentum_pct = momentumPct;

    // Label for display: only show if difference is > 2% (noise threshold)
    if (Math.abs(momentumPct) < 2) {
      r.momentum_label = '−';
    } else if (momentumPct < 0) {
      r.momentum_label = '▲';  // Faster than overall pace
    } else {
      r.momentum_label = '▼';  // Slower than overall pace
    }
  });
}

/**
 * Compute top 3 runners by pace on each segment.
 * Returns: { [station_code]: [{ name, bib, pace_mph }, ...] }
 */
function computeSegmentLeaders(live, stations) {
  if (!live || !live.runners || !stations) return {};

  var leaders = {};

  // For each segment (pair of consecutive stations)
  for (var i = 1; i < stations.length; i++) {
    var prevMile = stations[i - 1].mile;
    var currMile = stations[i].mile;
    var segMiles = currMile - prevMile;
    if (segMiles <= 0) continue;

    var segCode = stations[i].code;
    var paces = [];

    live.runners.forEach(function(r) {
      if (!r.splits || r.splits.length <= i) return;

      var t1 = r.splits[i - 1];
      var t2 = r.splits[i];
      var elapsed = t2 - t1;

      if (elapsed <= 0) return;

      var paceHours = (elapsed / 60 / 60) / segMiles;
      var paceMph = 1 / paceHours;

      paces.push({
        name: r.name,
        bib: r.bib,
        pace_mph: paceMph.toFixed(2),
        time_hm: fmtTime(elapsed)
      });
    });

    // Sort by pace (fastest first = highest mph)
    paces.sort(function(a, b) { return parseFloat(b.pace_mph) - parseFloat(a.pace_mph); });

    // Take top 3
    leaders[segCode] = paces.slice(0, 3);
  }

  return leaders;
}

/**
 * Format seconds as HH:MM (for display in segment leaders).
 */
function fmtTime(seconds) {
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  return h + ':' + (m < 10 ? '0' : '') + m;
}

/**
 * Main entry point: compute all synthesis metrics.
 * Call this after LIVE is loaded but before rendering.
 */
function synthesize(live, stations) {
  if (!live || !live.runners) return;
  computeSegmentMomentum(live, stations);
  // Segment leaders computed on-demand to avoid cluttering the data structure.
}

/* Follow a RUNNER from a race page.
 *
 * Two gaps, both invisible until you open a specific runner:
 *
 *   The alert button ("NOTIFY ME WHEN THEY FINISH") only renders while a runner's status is
 *   running or due — so on all 109 archived races there is no follow affordance at all. You
 *   can watch Harvey Lewis's entire Badwater replay with no way to say "tell me when he races
 *   next".
 *
 *   careerHtml() links to a runner's athlete page only when they have 2+ races. 86% of runners
 *   have exactly one, so most people looking at a runner here cannot reach the page that now
 *   holds their story, their position chart and a Follow button.
 *
 * WHY THIS LIVES IN synthesis.js. Every race directory has its OWN 300 KB copy of index.html —
 * 112 of them, 89 distinct sizes, every one already drifted from the template. Editing the
 * shared template changes nothing that is live, and rewriting 112 copies is how they drifted in
 * the first place. synthesis.js is loaded by all 110 race pages from ONE absolute path, so a
 * change here reaches every one of them and cannot drift.
 *
 * The bib is resolved to a stable athlete path lazily, on first click: full coverage costs
 * 2 KB gzipped at Badwater but 123 KB at SainteLyon, and charging every visitor that on arrival
 * to serve the few who press Follow is the wrong trade.
 */
(function () {
  var panel = document.getElementById('detail');
  if (!panel) return;                       /* not a race page */

  var MAP = null;

  function base() {
    return location.pathname.replace(/\/?(index\.html)?$/, '') + '/';
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function map() {
    if (MAP) return Promise.resolve(MAP);
    return fetch(base() + 'follow.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { MAP = j || {}; return MAP; })
      .catch(function () { MAP = {}; return MAP; });
  }

  /* follow.js is not loaded by the race shell; pull it in once, on demand. */
  function follower() {
    if (window.URTFollow) return Promise.resolve(window.URTFollow);
    return new Promise(function (res) {
      var s = document.createElement('script');
      s.src = '/follow.js';
      s.onload = function () { res(window.URTFollow || null); };
      s.onerror = function () { res(null); };
      document.head.appendChild(s);
    });
  }

  /* The open panel carries the bib in the tracking link and the finish-card controls; read it
     from whichever the shell rendered rather than reaching into its internals. */
  function currentBib() {
    var el = panel.querySelector('[data-bib]');
    if (el) return el.getAttribute('data-bib');
    var n = panel.querySelector('#notif-go, #crew-open');
    if (n && n.getAttribute('data-bib')) return n.getAttribute('data-bib');
    var m = /\/r\/([^\/?#]+)/.exec((panel.querySelector('#trk-u') || {}).textContent || '');
    return m ? decodeURIComponent(m[1]) : null;
  }

  function currentName() {
    var h = panel.querySelector('h2, h3, .dname, .rn');
    return h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  }

  function inject() {
    if (!panel.querySelector('.crewbtn, #trk-u')) return;   /* panel not populated yet */
    if (panel.querySelector('.urt-followperson')) return;   /* already there */
    var bib = currentBib();
    if (!bib) return;

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'notifbtn urt-followperson';
    b.textContent = 'FOLLOW THIS RUNNER';
    var msg = document.createElement('div');
    msg.className = 'notifmsg urt-followmsg';

    var anchor = panel.querySelector('.crewbtn');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(b, anchor.nextSibling);
      b.parentNode.insertBefore(msg, b.nextSibling);
    } else { return; }

    b.addEventListener('click', function () {
      var nm = currentName() || ('Bib ' + bib);
      b.disabled = true;
      Promise.all([map(), follower()]).then(function (both) {
        var path = both[0][String(bib)], F = both[1];
        if (!path) {
          b.disabled = false;
          msg.textContent = 'No runner page for this bib yet.';
          return;
        }
        if (!F) { location.href = '/a/' + path; return; }
        var already = F.isFollowing('athletes', path);
        if (!already) F.toggle('athletes', path, { name: nm });
        b.innerHTML = '&#10003; FOLLOWING';
        b.classList.add('done');
        msg.innerHTML = '<a href="/a/' + esc(path) + '" style="color:inherit">' +
          (already ? 'Already on your list. See their record' : 'Saved. See their record') +
          ' &rarr;</a>';
      });
    });
  }

  /* The shell rewrites #detail wholesale each time a runner is opened, so watch it rather
     than trying to hook a function the shell does not expose. */
  new MutationObserver(function () { inject(); })
    .observe(panel, { childList: true, subtree: true });
  inject();
}());

/* Record watch has never worked. It asks for the file one directory too deep.
 *
 * loadRecords() builds its URL as raceKey().toLowerCase().replace(/\s+/g,'-') + '/records.json'
 * and fetches it RELATIVE to a page that already lives at /<race-slug>/. So on Badwater it asks
 * for /badwater-135/badwater-135/records.json, which 404s, while /badwater-135/records.json
 * returns 200 and holds exactly what it wants: the men's and women's course records and the
 * all-time top ten.
 *
 * The catch() swallows the 404, RECORDS_DATA stays null, and updateRecordWatch() returns on its
 * first line forever. 127 race directories have this file and 110 race pages have never read
 * one. The feature — "is anyone out there on course-record pace right now" — is the single most
 * exciting thing a tracker can say during a live race, and it has been silently dead.
 *
 * Fixed here rather than in the 110 drifted per-race copies of index.html, for the same reason
 * as everything else shared: this file is loaded by all of them from one absolute path.
 *
 * Note it only ever DISPLAYS while runners are on course, so on an archived race the correct
 * proof is that RECORDS_DATA becomes populated, not that the banner appears.
 */
(function () {
  if (!document.getElementById('record-watch')) return;   /* not a race page */

  function base() {
    return location.pathname.replace(/\/?(index\.html)?$/, '') + '/';
  }

  function load() {
    return fetch(base() + 'records.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return null;
        /* the page declares this at top level, so assigning here is the same variable */
        try { RECORDS_DATA = d; } catch (e) { window.RECORDS_DATA = d; }
        if (typeof updateRecordWatch === 'function') {
          try { updateRecordWatch(); } catch (e) {}
        }
        return d;
      })
      .catch(function () { return null; });
  }

  /* Replace the broken loader so anything that calls it later gets the right path too. */
  try { window.loadRecords = load; } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else { load(); }
}());

/* A crew standing at a checkpoint at 3am has the live race page open, not the site index.
   The plan for this race is one tap away from there, and only rendered when a plan actually
   exists — a link to a 404 is worse than no link at all. */
var CREW_PLANS = ["badwater-135", "ccc", "chianti", "hardrock-100", "high-lonesome-100", "lavaredo", "occ", "quad-rock", "restonica", "saintelyon-80k", "tarawera", "tds", "templiers", "the-bear-100", "transgrancanaria", "utmb", "western-states-100"];
(function () {
  try {
    var slug = (location.pathname.split('/').filter(Boolean)[0] || '');
    var fam = slug.replace(/-(19|20)\d{2}$/, '');
    if (CREW_PLANS.indexOf(fam) < 0) return;
    var host = document.querySelector('.rc-top') || document.querySelector('header') ||
               document.body;
    if (!host || document.getElementById('crewlink')) return;
    var a = document.createElement('a');
    a.id = 'crewlink';
    a.href = '/crew/' + fam + '/';
    a.textContent = 'Crew plan: where to be, and when';
    a.style.cssText = 'display:inline-block;margin:10px 0 0;padding:7px 13px;border-radius:8px;'
      + 'background:rgba(255,122,26,.14);border:1px solid rgba(255,122,26,.4);color:#ff9542;'
      + 'font:600 12.5px/1.2 ui-monospace,monospace;letter-spacing:.4px;text-decoration:none';
    host.appendChild(a);
  } catch (e) { /* never let a nav-to-nicety break a live race page */ }
}());

/* Official broadcast chip. Curated registry, one entry per race family, every entry verified
   against the organisation's own site or channel identity before inclusion — see streams.json.
   A family absent from the registry shows nothing: absence is the honest default. Sits beside
   the crew-plan chip in the header, the one proven-reachable host on these full-viewport
   pages (anything appended to body lands below an overflow:hidden fold, unreachable). */
var BROADCASTS = {"utmb": {"url": "https://live.utmb.world", "label": "UTMB Live"}, "ccc": {"url": "https://live.utmb.world", "label": "UTMB Live"}, "occ": {"url": "https://live.utmb.world", "label": "UTMB Live"}, "tds": {"url": "https://live.utmb.world", "label": "UTMB Live"}, "ptl": {"url": "https://live.utmb.world", "label": "UTMB Live"}, "western-states-100": {"url": "https://www.youtube.com/@WesternStates", "label": "Western States on YouTube"}, "badwater-135": {"url": "https://www.youtube.com/@adventurecorps", "label": "Badwater on YouTube"}};
(function () {
  try {
    var slug = (location.pathname.split('/').filter(Boolean)[0] || '');
    var fam = slug.replace(/-(19|20)\d{2}$/, '');
    var b = BROADCASTS[fam];
    if (!b) return;
    var host = document.querySelector('.rc-top') || document.querySelector('header');
    if (!host || document.getElementById('bcastlink')) return;
    var a = document.createElement('a');
    a.id = 'bcastlink';
    a.href = b.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = b.label;
    a.style.cssText = 'display:inline-block;margin:10px 0 0 8px;padding:7px 13px;'
      + 'border-radius:8px;background:rgba(53,208,255,.10);border:1px solid '
      + 'rgba(53,208,255,.35);color:#7fd8f7;font:600 12.5px/1.2 ui-monospace,monospace;'
      + 'letter-spacing:.4px;text-decoration:none';
    host.appendChild(a);
  } catch (e) { /* a nicety must never break a live race page */ }
}());
