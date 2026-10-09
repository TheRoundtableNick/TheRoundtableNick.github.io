/* Scroll reveal, and nothing else.
 *
 * Sponsors judge a page in the first two seconds, and a page that assembles itself as you
 * scroll reads as considered. The movement is deliberately small -- 10px over 420ms. Any
 * more and someone evaluating the site is waiting on it instead of reading it.
 *
 * Everything animates only ONCE and the observer disconnects, so scrolling back up does
 * not replay it. Anyone who has asked their OS for reduced motion gets nothing at all.
 */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  function arm() {
    /* Only block-level content, and never the hero: the first screen must be there the
       instant it paints, not fade in. */
    var sel = 'section > .wrap > *, .card, .slot, .big, .aud, .su-box, .rdband, .prepg';
    var els = [];
    document.querySelectorAll(sel).forEach(function (e) {
      if (e.closest('.hero')) return;
      if (e.getBoundingClientRect().top < window.innerHeight) return;  /* already visible */
      els.push(e);
    });
    if (!els.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('urt-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });

    els.forEach(function (e) { e.classList.add('urt-rise'); io.observe(e); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm);
  } else { arm(); }
})();

/* Athlete profile.
 *
 * The page used to open with "Finished 1 ultramarathon (2026)" over three tiles reading
 * 1 FINISH / 1 START / 2026 RACING. That was our archive's view of Max Jolliffe. His actual
 * record sat in the same JSON the page had already fetched: 12 ultras since 2022, five wins,
 * 1,097 miles raced, longest 238 - and he had just won Badwater 135 in the fastest time in our
 * 25-edition archive. The page was not short of data, it was short of arithmetic and hierarchy.
 *
 * Order matters here and got it wrong once already: our own archive result is merged into the
 * career BEFORE any statistic is computed. The first cut counted the external career for the
 * hero and the merged list for the table, so the page said "12 ultras" above "13 ultras".
 * Every number on this page now comes from one list, computed once.
 *
 * The lede picks a win we hold a replay of over a longer win we do not, then the most recent,
 * then the longest. Jolliffe's Badwater win is both the newest and the one this site actually
 * tracked; leading with a 2024 Moab win instead was technically true and editorially wrong.
 *
 * A runner with no external profile gets exactly the page they had before.
 */
(function () {
  var m = location.pathname.match(/^\/a\/([^\/]+?)(?:\.html)?$/);
  if (!m) return;
  var me = m[1];

  var CSS = [
    '.pv2{background:#0b0f14;margin:0 0 26px;padding:34px 0 30px;position:relative;',
      'overflow:hidden;isolation:isolate}',
    '.pv2:before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;',
      'background:radial-gradient(120% 90% at 82% 10%,rgba(255,138,40,.20),transparent 62%),',
      'radial-gradient(80% 70% at 8% 95%,rgba(53,208,255,.08),transparent 60%)}',
    '.pv2in{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:0 26px;',
      'display:flex;gap:26px;align-items:flex-start;flex-wrap:wrap}',
    '.pv2 img.face{width:132px;height:132px;border-radius:16px;object-fit:cover;',
      'flex:0 0 132px;border:1px solid rgba(255,255,255,.16);',
      'box-shadow:0 14px 40px rgba(0,0,0,.5)}',
    '.pv2 .body{flex:1 1 380px;min-width:0}',
    '.pv2 h1{font-family:var(--display,inherit);color:#fff;margin:0 0 8px;line-height:1.02;',
      'font-size:clamp(30px,4.4vw,50px);letter-spacing:-.035em}',
    '.pv2 .meta{font-family:var(--mono,ui-monospace,monospace);font-size:10.5px;',
      'letter-spacing:1.5px;text-transform:uppercase;color:#8b95a3;margin:0 0 14px}',
    '.pv2 .meta b{color:#d6dde6;font-weight:600}',
    '.pv2 .lede{color:#e8edf4;font-size:17px;line-height:1.5;margin:0 0 20px;max-width:62ch}',
    '.pv2 .lede em{font-style:normal;color:#ff9542;font-weight:700}',
    '.pv2 .cred{font-family:var(--mono,ui-monospace,monospace);font-size:10px;',
      'letter-spacing:.6px;color:#67717f;margin:16px 0 0}',
    '.pv2 .cred a{color:#98a3b1}',
    '.pv2 .nums{display:flex;gap:30px;flex-wrap:wrap;padding:16px 0 0;',
      'border-top:1px solid rgba(255,255,255,.11)}',
    '.pv2 .nums div{min-width:74px}',
    '.pv2 .nums b{display:block;font-family:var(--display,inherit);font-size:27px;',
      'color:#fff;line-height:1;letter-spacing:-.02em}',
    '.pv2 .nums b.hot{color:#ff9542}',
    '.pv2 .nums s{text-decoration:none;display:block;',
      'font-family:var(--mono,ui-monospace,monospace);font-size:9px;letter-spacing:1.4px;',
      'text-transform:uppercase;color:#7d8794;margin-top:6px}',
    '.pvstrip{margin:26px 0 0}',
    '.pvstrip .bars{display:flex;align-items:flex-end;gap:3px;height:70px}',
    '.pvstrip .bars i{flex:1 1 0;min-width:3px;background:#ded5c7;border-radius:2px 2px 0 0;',
      'display:block}',
    '.pvstrip .bars i.w{background:var(--acc-bright,#ff7a1a)}',
    '.pvstrip .bars i.p{background:#e8b48f}',
    '.pvstrip .ax{display:flex;justify-content:space-between;gap:12px;',
      'font-family:var(--mono,ui-monospace,monospace);font-size:9.5px;color:var(--ink-3,#8a8378);',
      'letter-spacing:.8px;margin-top:8px}',
    '.pvtab{width:100%;border-collapse:collapse;font-size:13.5px}',
    '.pvtab th{font-family:var(--mono,ui-monospace,monospace);font-size:9.5px;',
      'letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-3,#8a8378);',
      'text-align:left;font-weight:400;padding:0 12px 8px 0}',
    '.pvtab td{padding:9px 12px 9px 0;border-top:1px solid var(--line,#e8e0d4);',
      'vertical-align:baseline}',
    '.pvtab tr.win td{background:rgba(255,122,26,.055)}',
    '.pvtab td.n{font-family:var(--mono,ui-monospace,monospace);font-size:12px;',
      'color:var(--ink-2,#4d463f);white-space:nowrap}',
    '.pvtab .pl{font-family:var(--mono,ui-monospace,monospace);font-size:12px;',
      'color:var(--ink-3,#8a8378);white-space:nowrap}',
    '.pvtab .pl.first{color:var(--acc,#a83a06);font-weight:700;font-size:12.5px}',
    '.pvtab a.rep{font-family:var(--mono,ui-monospace,monospace);font-size:9.5px;',
      'letter-spacing:1px;text-transform:uppercase;color:var(--acc,#a83a06);text-decoration:none;',
      'border:1px solid rgba(168,58,6,.3);border-radius:999px;padding:3px 9px;white-space:nowrap}',
    '.pvtab a.rep:hover{background:rgba(255,122,26,.12)}',
    '.pvh{font-family:var(--display,inherit);font-size:20px;letter-spacing:-.02em;',
      'margin:30px 0 3px}',
    '.pvsub{font-size:12.5px;color:var(--ink-3,#8a8378);margin:0 0 14px}',
    '.pvsub a{color:var(--acc,#a83a06)}',
    '@media(max-width:700px){',
      '.pv2 img.face{width:92px;height:92px;flex-basis:92px}',
      '.pv2in{gap:18px}.pv2 .nums{gap:20px}.pv2 .nums b{font-size:22px}',
      '.pvtab .hidesm{display:none}}',
  ].join('');

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  var DIST = /([\d.]+)\s*(mi|miles|km|k)\b/i;
  function km(s) {
    var x = DIST.exec(String(s || ''));
    if (!x) return null;
    var v = parseFloat(x[1]);
    return /^mi/i.test(x[2]) ? v * 1.609344 : v;
  }
  /* One format for the distance column. Sources store "135 miles", "200mi", "50km",
     "99.9 km" and "48km" for what are, respectively, a 135 miler, a 200 miler, a 50K, a 100K
     and a 50K. Rounded, and in the unit the race is actually known by. */
  function dist(raw) {
    var t = String(raw || '').trim();
    if (!t) return '';
    var x = DIST.exec(t);
    if (!x) return t;                       /* timed or unbounded: keep the source wording */
    var v = parseFloat(x[1]);
    if (!isFinite(v)) return t;
    if (/^mi/i.test(x[2])) return Math.round(v) + ' mi';
    /* 99.9 and 100.1 are both a 100K to everyone who runs them */
    return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + ' km';
  }

  function rank(r) {
    var v = parseInt(r, 10);
    return isFinite(v) && v > 0 ? v : null;
  }
  function ord(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function key(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
  }

  Promise.all([
    fetch('/athlete_profiles.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    /* races.json supplies the date and distance for our own archive rows, which arrive from
       the page's table with neither and rendered as two blank cells. */
    fetch('/races.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ]).then(function (both) {
    var d = both[0], rj = both[1];
    var p = d && d.athletes && d.athletes[me];
    if (!p || p.none) return;

    var races = (p.races || []).slice();
    if (!p.photo && !races.length) return;

    var RM = {};
    var rlist = rj && (rj.races || (rj.length ? rj : []));
    (rlist || []).forEach(function (r) {
      if (r && r.path) RM[String(r.path).replace(/^\/|\/$/g, '')] = r;
    });

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var h1 = document.querySelector('h1');
    if (!h1) return;
    var wrap = h1.parentNode;
    var name = h1.textContent;

    /* ---- 1. read our own results BEFORE touching the DOM ------------------------- */
    var mine = [];
    var oldTable = wrap.querySelector('table');
    if (oldTable) {
      Array.prototype.forEach.call(oldTable.querySelectorAll('tbody tr'), function (tr) {
        var a = tr.querySelector('a[href]');
        var td = tr.querySelectorAll('td');
        if (!a || td.length < 3) return;
        mine.push({
          name: a.textContent.trim(),
          href: a.getAttribute('href'),
          time: ((td[2] || {}).textContent || '').trim(),
          place: ((td[3] || {}).textContent || '').trim(),
        });
      });
    }

    /* ---- 2. merge, filling date and distance from races.json --------------------- */
    var seen = {};
    races.forEach(function (r) { seen[key(r.name)] = 1; });
    var byKey = {};
    mine.forEach(function (r) { byKey[key(r.name)] = r; });

    mine.forEach(function (r) {
      if (seen[key(r.name)]) return;
      var slug = String(r.href || '').replace(/^\/|\/$/g, '');
      var meta = RM[slug] || {};
      races.push({
        name: r.name,
        date: meta.date || '',
        distance: meta.distance || '',
        time: r.time,
        rank: (r.place || '').replace(/\D/g, ''),
        _ours: r.href,
      });
    });
    races.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

    /* ---- 3. every statistic, computed ONCE from the merged list ------------------ */
    var ranks = races.map(function (r) { return rank(r.rank); }).filter(Boolean);
    var wins = ranks.filter(function (r) { return r === 1; }).length;
    var podium = ranks.filter(function (r) { return r <= 3; }).length;
    var kms = races.map(function (r) { return km(r.distance); }).filter(Boolean);
    var totalKm = kms.reduce(function (a, b) { return a + b; }, 0);
    var longest = kms.length ? Math.max.apply(null, kms) : 0;

    var winRows = races.filter(function (r) { return rank(r.rank) === 1; });
    winRows.sort(function (a, b) {
      if (!!b._ours !== !!a._ours) return b._ours ? 1 : -1;   /* one we can replay */
      var dc = String(b.date).localeCompare(String(a.date));  /* then most recent */
      if (dc) return dc;
      return (km(b.distance) || 0) - (km(a.distance) || 0);   /* then longest */
    });
    var best = winRows[0] || null;

    var lede = '';
    if (best) {
      lede = 'Won <em>' + esc(best.name) + '</em>' +
        (best.distance ? ' over ' + esc(dist(best.distance)) : '') +
        (best.time ? ' in ' + esc(best.time) : '') + '.';
      if (wins > 1) lede += ' One of <em>' + wins + ' wins</em> from ' +
        races.length + ' ultras.';
    } else if (ranks.length) {
      lede = 'Best finish <em>' + ord(Math.min.apply(null, ranks)) + '</em> across ' +
        races.length + ' ultras.';
    } else if (races.length) {
      lede = '<em>' + races.length + '</em> ultras on record.';
    }

    /* ---- 4. dark hero ------------------------------------------------------------ */
    var meta = [];
    if (p.club) meta.push('<b>' + esc(p.club) + '</b>');
    if (p.residence) meta.push(esc(p.residence));
    if (p.utmb_index) meta.push('UTMB Index <b>' + esc(p.utmb_index) + '</b>');

    var nums = [];
    if (races.length) nums.push(['', races.length, 'Ultras finished']);
    if (wins) nums.push(['hot', wins, wins === 1 ? 'Win' : 'Wins']);
    if (podium > wins) nums.push(['', podium, 'Podiums']);
    if (totalKm) nums.push(['', num(Math.round(totalKm / 1.609344)), 'Miles raced']);
    if (longest) nums.push(['', Math.round(longest / 1.609344) + 'mi', 'Longest']);

    var cred = [];
    if (p.utmb_profile) cred.push('<a href="' + esc(p.utmb_profile) +
      '" target="_blank" rel="noopener">UTMB World</a>');
    if (p.duv_profile) cred.push('<a href="' + esc(p.duv_profile) +
      '" target="_blank" rel="noopener">DUV</a>');

    var hero = document.createElement('section');
    hero.className = 'pv2';
    hero.innerHTML = '<div class="pv2in">' +
      (p.photo ? '<img class="face" src="' + esc(p.photo) + '" alt="" ' +
        'referrerpolicy="no-referrer" onerror="this.remove()">' : '') +
      '<div class="body">' +
        '<h1>' + esc(name) + '</h1>' +
        (meta.length ? '<p class="meta">' + meta.join(' &nbsp;·&nbsp; ') + '</p>' : '') +
        (lede ? '<p class="lede">' + lede + '</p>' : '') +
        (nums.length ? '<div class="nums">' + nums.map(function (n) {
          return '<div><b class="' + n[0] + '">' + esc(n[1]) + '</b><s>' +
            esc(n[2]) + '</s></div>';
        }).join('') + '</div>' : '') +
        (cred.length ? '<p class="cred">Photo and career via ' + cred.join(' &middot; ') +
          '</p>' : '') +
      '</div></div>';

    wrap.parentNode.insertBefore(hero, wrap);
    h1.remove();
    var sum = wrap.querySelector('p.sum');
    if (sum) sum.remove();
    var facts = wrap.querySelector('.facts');
    if (facts && races.length) facts.remove();

    if (!races.length) return;

    /* ---- 5. career strip and the one table --------------------------------------- */
    var chron = races.slice().reverse();
    var maxKm = Math.max.apply(null, chron.map(function (r) { return km(r.distance) || 0; }));
    var strip = '';
    if (maxKm > 0 && chron.length > 2) {
      var y0 = String((chron[0] || {}).date || '').slice(0, 4);
      var y1 = String((chron[chron.length - 1] || {}).date || '').slice(0, 4);
      strip = '<h2 class="pvh">Every race, by distance</h2>' +
        '<div class="pvstrip"><div class="bars">' + chron.map(function (r) {
        var k = km(r.distance) || 0, rk = rank(r.rank);
        var h = k ? Math.max(7, Math.round(100 * k / maxKm)) : 7;
        var cls = rk === 1 ? 'w' : (rk && rk <= 3 ? 'p' : '');
        return '<i class="' + cls + '" style="height:' + h + '%" title="' +
          esc(r.name + (r.distance ? ' · ' + dist(r.distance) : '') +
              (rk ? ' · ' + ord(rk) : '')) + '"></i>';
      }).join('') + '</div><div class="ax"><span>' + esc(y0) + '</span>' +
        '<span>each bar is a race &middot; height is distance &middot; orange is a win</span>' +
        '<span>' + esc(y1) + '</span></div></div>';
    }

    var rows = races.map(function (r) {
      var rk = rank(r.rank);
      var ours = r._ours || (byKey[key(r.name)] || {}).href;
      return '<tr' + (rk === 1 ? ' class="win"' : '') + '>' +
        '<td class="n">' + esc(String(r.date).slice(0, 10)) + '</td>' +
        '<td>' + esc(r.name) +
          (ours ? ' <a class="rep" href="' + esc(ours) + '">Replay</a>' : '') + '</td>' +
        '<td class="n hidesm">' + esc(dist(r.distance)) + '</td>' +
        '<td class="n">' + esc(r.time || '') + '</td>' +
        '<td class="pl' + (rk === 1 ? ' first' : '') + '">' +
          (rk ? ord(rk) : '') + '</td></tr>';
    }).join('');

    var sec = document.createElement('div');
    sec.innerHTML = strip +
      '<h2 class="pvh">Career</h2>' +
      '<p class="pvsub">' + races.length + ' ultras' +
        (wins ? ', ' + wins + ' won' : '') +
        (cred.length ? ' &middot; results from ' + cred.join(' and ') : '') + '.</p>' +
      '<table class="pvtab"><thead><tr><th>Date</th><th>Race</th>' +
      '<th class="hidesm">Distance</th><th>Time</th><th>Place</th></tr></thead><tbody>' +
      rows + '</tbody></table>';

    if (oldTable) oldTable.parentNode.replaceChild(sec, oldTable);
    else {
      var note = wrap.querySelector('p.note');
      if (note) wrap.insertBefore(sec, note); else wrap.appendChild(sec);
    }
  }).catch(function () {});
}());

/* The race a runner actually ran, on their own page.
 *
 * A quarter of athlete pages now carry a headshot and a career because that runner exists in
 * UTMB World or DUV. The other ~39,000 do not, and still read "Finished 1 ultramarathon (2021)"
 * over three tiles restating the same thing. For most of those runners there is no external
 * record to fetch - but there is something no other site has: their splits.
 *
 * Rank the field at every checkpoint and one anonymous row becomes a race:
 *
 *     "Finished 833rd of 1,665 at UTMB 2025. Moved up 672 places after Col Voza."
 *
 * That is worth more to the person who ran it than any headshot, and it is as true of the back
 * of the pack as the front - which matters, because the back of the pack is who this is for.
 * A DNF gets one too: "Reached Courmayeur in 94th before stopping" is a real day, and rendering
 * it as an empty row is the opposite of what that runner wants to see.
 *
 * THE CHART IS INVERTED ON PURPOSE. It plots position through the race with the y-axis
 * flipped, so the line rising means moving up the field. Drawn with the axis the natural way
 * round, every good race would look like a decline.
 *
 * Numbers come from build_race_stories.py and are counted, not estimated. A finisher's movement
 * is measured against other finishers at every checkpoint, so it never counts other people's
 * DNFs as places gained.
 */
(function () {
  var m = location.pathname.match(/^\/a\/([^\/]+?)(?:\.html)?$/);
  if (!m) return;
  var me = m[1];
  var hash = me.split('-').pop();

  var CSS = [
    '.rs{margin:22px auto 6px;max-width:1180px;padding:18px 20px;',
      'background:var(--panel,#fdfaf4);',
      'border:1px solid var(--line,#e8e0d4);border-left:3px solid var(--acc-bright,#ff7a1a);',
      'border-radius:12px}',
    '.rs.solo{background:none;border:0;border-left:0;padding:0;margin:6px 0 4px}',
    '.rs.solo .ttl{font-size:10.5px;letter-spacing:1.6px;margin-bottom:10px}',
    '.rs.solo .say{font-size:clamp(19px,2.6vw,26px);line-height:1.32;font-weight:600;',
      'letter-spacing:-.015em;max-width:24ch}',
    '.rs.solo .say b{color:var(--acc,#a83a06)}',
    '.rs.solo svg{height:78px;margin-top:20px}',
    '.rs .ttl{font-family:var(--mono,ui-monospace,monospace);font-size:9.5px;letter-spacing:1.4px;',
      'text-transform:uppercase;color:var(--ink-3,#8a8378);margin:0 0 7px}',
    '.rs .say{font-size:16.5px;line-height:1.5;color:var(--ink,#141d26);margin:0;max-width:64ch}',
    '.rs .say b{color:var(--acc,#a83a06)}',
    '.rs .say2{font-size:14.5px;line-height:1.55;color:var(--ink-2,#4a5568);',
      'margin:8px 0 0;max-width:64ch}',
    '.rs .say2 b{color:var(--ink,#141d26);font-weight:600}',
    '.chw{margin:26px auto 6px;max-width:1180px;padding:0 20px}',
    '.chw .chh{font-family:var(--mono,ui-monospace,monospace);font-size:9.5px;',
      'letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-3,#8a8378);',
      'margin:0 0 14px}',
    '.chw .chh b{color:var(--acc,#a83a06);font-weight:600}',
    '.chw ul{list-style:none;margin:0;padding:0;display:grid;gap:11px;max-width:70ch}',
    '.chw li{margin:0;padding:0 0 11px;border-bottom:1px solid var(--line,#e8e0d4)}',
    '.chw li:last-child{border-bottom:0}',
    '.chw q{display:block;font-size:16px;line-height:1.45;color:var(--ink,#141d26);',
      'quotes:none}',
    '.chw q:before,.chw q:after{content:""}',
    '.chw cite{display:block;font-family:var(--mono,ui-monospace,monospace);font-size:10.5px;',
      'letter-spacing:.9px;text-transform:uppercase;color:var(--ink-3,#8a8378);',
      'font-style:normal;margin-top:5px}',
    '.chw .more{font-family:var(--mono,ui-monospace,monospace);font-size:11px;',
      'color:var(--ink-3,#8a8378);margin:12px 0 0}',
    '.rs.solo .say2{font-size:16px;margin-top:12px;max-width:58ch}',
    '.rs svg{display:block;width:100%;height:64px;margin:14px 0 0;overflow:visible}',
    '.rs .lg{font-family:var(--mono,ui-monospace,monospace);font-size:9px;letter-spacing:.9px;',
      'color:var(--ink-3,#8a8378);display:flex;justify-content:space-between;margin-top:5px}',
  ].join('');

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function ord(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function title(slug) {
    return String(slug || '').replace(/-/g, ' ')
      .replace(/\b([a-z])/g, function (c) { return c.toUpperCase(); });
  }

  /* Some feeds publish place names (Courmayeur, Pointed Rocks), a few publish position codes
     (P10, BSM, 100m). Naming a code tells the reader nothing and reads like a bug, so the
     sentence drops the place rather than printing it. */
  function placeName(nm) {
    nm = String(nm || '').trim();
    if (!nm || nm.length <= 3) return '';
    if (/^(?:p|cp|c|k|km|pc|ck|st|pt)?\s*\d+[a-z]?$/i.test(nm)) return '';
    return nm;
  }

  /* Elapsed time. Ultras routinely run past 24h, so hours never roll into days. */
  function hhmm(sec) {
    if (!sec || sec <= 0) return '';
    var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (m === 60) { h += 1; m = 0; }
    return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
  }

  /* The lede is chosen by where in the field they finished; see the file header for why that
     is a correctness question. Returns {lead, rest} — never a bare string. */
  function sentence(s) {
    var lead = '', rest = [];
    var t = hhmm(s.secs);
    var fin = s.finishers || 0;
    var co = s.cohort;

    if (s.rank) {
      var pos = fin ? s.rank / fin : 1;

      if (s.rank <= 3) {
        lead = s.rank === 1
          ? 'Won it' + (t ? ', in <b>' + t + '</b>' : '') + '.'
          : 'Finished <b>' + ord(s.rank) + '</b> of ' + num(fin) + (t ? ', in <b>' + t + '</b>' : '') + '.';

      } else if (pos <= 0.25) {
        lead = 'Finished <b>' + ord(s.rank) + '</b> of ' + num(fin)
             + (s.pct ? ', inside the top ' + s.pct + '%' : '') + (t ? ', in <b>' + t + '</b>' : '') + '.';

      } else if (pos <= 0.75) {
        /* The band the panel was talking about. A placing here means nothing on its own;
           who they were actually running with does. */
        if (co && co.n >= 5) {
          var where = placeName(co.at);
          lead = 'Of the <b>' + num(co.n) + '</b> runners bunched together '
               + (where ? 'at ' + esc(where) : 'early on')
               + ', <b>' + num(co.ahead) + '</b> finished behind.';
          rest.push(ord(s.rank) + ' of ' + num(fin) + ' overall' + (t ? ', in ' + t : '') + '.');
        } else {
          lead = 'Finished <b>' + ord(s.rank) + '</b> of ' + num(fin) + (t ? ', in <b>' + t + '</b>' : '') + '.';
        }

      } else {
        /* Back of the field. The placing is the least of what happened. */
        if (s.dnf_total && s.field) {
          lead = num(s.field) + ' started. <b>' + num(s.dnf_total)
               + '</b> did not finish. This one did' + (t ? ', in <b>' + t + '</b>' : '') + '.';
          rest.push(ord(s.rank) + ' across the line.');
        } else {
          lead = 'Finished <b>' + ord(s.rank) + '</b> of ' + num(fin) + (t ? ', in <b>' + t + '</b>' : '') + '.';
        }
        if (co && co.n >= 5 && co.ahead >= 3) {
          var w2 = placeName(co.at);
          rest.push('Came in ahead of ' + num(co.ahead) + ' of the ' + num(co.n)
                  + (w2 ? ' who reached ' + esc(w2) + ' alongside them.'
                        : ' who were alongside them early on.'));
        }
      }

      /* Supporting facts, at most two, so the lede keeps its weight. */
      if (rest.length < 2 && s.close && Math.abs(s.close.gained) >= 3) {
        rest.push(s.close.gained > 0
          ? 'Gained ' + num(s.close.gained) + ' place' + (s.close.gained === 1 ? '' : 's')
            + ' over the closing third.'
          : 'Lost ' + num(-s.close.gained) + ' place' + (s.close.gained === -1 ? '' : 's')
            + ' over the closing third.');
      }
      if (rest.length < 2 && s.best_leg && s.best_leg.gain >= 8) {
        rest.push('Strongest stretch was <b>' + esc(s.best_leg.from) + '</b> to <b>'
                + esc(s.best_leg.to) + '</b>, taking ' + s.best_leg.gain + ' places.');
      }

    } else if (s.dnf_at) {
      var dw = placeName(s.dnf_at) || s.dnf_at;
      lead = 'Reached <b>' + esc(dw) + '</b>'
           + (s.dnf_mile ? ' at ' + Math.round(s.dnf_mile) + ' miles' : '')
           + ' before stopping'
           + (s.dnf_pct ? ' — <b>' + s.dnf_pct + '%</b> of the way round' : '') + '.';
      if (s.dnf_rank) rest.push(ord(s.dnf_rank) + ' at that point' + (t ? ', ' + t + ' in' : '') + '.');
      /* A checkpoint where many races ended is a hard place on a hard course. Saying so is the
         difference between a record and an acknowledgement. */
      if (s.dnf_company >= 3) {
        rest.push('<b>' + num(s.dnf_company) + '</b> other runners\' races ended there too.');
      }
    }

    return { lead: lead, rest: rest.slice(0, 2).join(' ') };
  }

  /* Position through the race, y-axis flipped so rising = moving up the field. */
  function chart(s) {
    var r = s.ranks || [];
    if (r.length < 4) return '';
    var lo = Math.min.apply(null, r), hi = Math.max.apply(null, r);
    if (hi === lo) return '';
    var W = 1000, H = 100, n = r.length;
    var pts = r.map(function (v, i) {
      var x = (i / (n - 1)) * W;
      var y = ((v - lo) / (hi - lo)) * H;          /* bigger rank number = lower on the page */
      return [x, y];
    });
    var d = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
    var area = d + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    var last = pts[pts.length - 1];
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
      'aria-label="Position through the race">' +
      '<path d="' + area + '" fill="rgba(255,122,26,.12)"/>' +
      '<path d="' + d + '" fill="none" stroke="var(--acc-bright,#ff7a1a)" stroke-width="2.5" ' +
        'vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="4" ' +
        'fill="var(--acc,#a83a06)" vector-effect="non-scaling-stroke"/>' +
      '</svg>' +
      '<div class="lg"><span>' + esc(placeName((s.at || [])[0]) || 'start') + '</span>' +
      '<span>position through the race &middot; higher is better</span>' +
      '<span>' + esc(placeName((s.at || [])[(s.at || []).length - 1]) || 'finish') +
        '</span></div>';
  }

  fetch('/a/' + encodeURIComponent(hash) + '.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      var byRace = j && j.s;
      if (!byRace) return;

      /* the race worth leading with: the best placing, then the most recent */
      var slugs = Object.keys(byRace);
      slugs.sort(function (a, b) {
        var A = byRace[a], B = byRace[b];
        var ra = A.rank || 1e9, rb = B.rank || 1e9;
        if (ra !== rb) return ra - rb;
        return String(b).localeCompare(String(a));
      });
      var slug = slugs[0];
      var s = byRace[slug];
      var say = sentence(s);
      if (!say || !say.lead) return;

      var st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);

      /* One race, no external profile: the story is the whole page, so lead with it and
         drop the three elements that only restate it. 86% of unprofiled athletes are here. */
      var hero = document.querySelector('.pv2');
      var rows = document.querySelectorAll('.wrap table tbody tr').length;
      var soloLede = !hero && slugs.length === 1 && rows <= 1;

      var box = document.createElement('div');
      box.className = 'rs' + (soloLede ? ' solo' : '');
      box.innerHTML = '<p class="ttl">' + esc(title(slug)) + '</p>' +
        '<p class="say">' + say.lead + '</p>' +
        (say.rest ? '<p class="say2">' + say.rest + '</p>' : '') + chart(s);

      /* Always inside .wrap. Inserting it next to the hero put it OUTSIDE the content
         column, so it ran the full width of the viewport while everything else did not. */
      var wrap = document.querySelector('.wrap');


      if (soloLede) {
        /* "Finished 1 ultramarathon (2021)" and the 1 FINISH / 1 START / 2021 RACING tiles
           both restate the sentence above them, and the table below states it a third time.
           The table stays — it is the canonical record and holds the link to the race. */
        var sumEl = document.querySelector('p.sum');
        if (sumEl) sumEl.remove();
        var factsEl = document.querySelector('.facts');
        if (factsEl) factsEl.remove();
      }

      var anchor = document.querySelector('p.sum') || document.querySelector('h1');
      if (anchor && anchor.parentNode && anchor.parentNode.closest &&
          anchor.parentNode.closest('.wrap')) {
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
      } else if (wrap) {
        wrap.insertBefore(box, wrap.firstChild);
      } else if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
      }

      /* The messages people wrote to this runner while they were on course.
         Every one was posted publicly to the live cheer wall during the race, where the
         runner could not read it. This is the first time the person it was addressed to
         can see it. */
      var cheers = j && j.c;
      if (cheers) {
        var craces = Object.keys(cheers).filter(function (k) {
          return cheers[k] && (cheers[k].msgs || []).length;
        });
        if (craces.length) {
          /* lead with the race the story is about, so the page reads as one thing */
          craces.sort(function (a, b) { return (a === slug ? -1 : b === slug ? 1 : 0); });
          var cslug = craces[0], cd = cheers[cslug];
          var msgs = (cd.msgs || []).slice().reverse();
          var shown = msgs.slice(0, 12);

          var head = '<b>' + num(cd.n) + '</b> ' +
            (cd.n === 1 ? 'person' : 'people') + ' cheered during ' + esc(title(cslug));
          /* cd.nm is how many people actually wrote; msgs is the capped list we display.
             Reporting the cap here claimed 40 people wrote to a runner when 100 had. */
          var nmsg = (typeof cd.nm === 'number') ? cd.nm : msgs.length;
          if (nmsg) {
            head += ' &middot; <b>' + num(nmsg) + '</b> left a message';
          }

          var items = shown.map(function (m) {
            var who = (m.n || '').trim();
            return '<li><q>' + esc(m.m) + '</q>' +
              (who ? '<cite>' + esc(who) + '</cite>' : '') + '</li>';
          }).join('');

          var cbox = document.createElement('div');
          cbox.className = 'chw';
          cbox.innerHTML = '<p class="chh">' + head + '</p><ul>' + items + '</ul>' +
            (nmsg > shown.length
              ? '<p class="more">and ' + num(nmsg - shown.length) + ' more</p>'
              : '');
          if (box && box.parentNode) {
            box.parentNode.insertBefore(cbox, box.nextSibling);
          } else if (wrap) {
            wrap.appendChild(cbox);
          }
        }
      }
    })
    .catch(function () {});
}());

/* The navigation bar, on the 40,244 pages that never got one.
 *
 * add_nav.py put a nav on the homepage, /upcoming/, /vs/, the crew planners and the race
 * reports. It could not put one on the athlete pages, because those are generated by
 * athlete_page.py and there are 40,244 of them. So the site's LARGEST surface — and the one
 * most likely to be somebody's first arrival, since search sends people to a runner's name —
 * has a logo, a search box and no way out.
 *
 * Injected here rather than by regenerating every page, and injected only where a nav is
 * genuinely absent so the pages that already have one are untouched.
 *
 * The CSS now lives in urt.css instead of being inlined into each page separately. It was
 * duplicated into every consumer, which is the same shape as the relative-path bug that served
 * 110 race pages as empty shells for weeks: one copy per directory, and only the copies
 * somebody remembered to update are correct.
 */
(function () {
  if (document.querySelector('.urtnav')) return;          /* page already has one */

  var LINKS = [
    ['/', 'Races'],
    ['/upcoming/', 'Upcoming'],
    ['/vs/', 'Head to head'],
    ['/crew/', 'Crew'],
    ['/race-directors.html', 'For race directors'],
    ['/sponsors.html', 'Sponsors'],
    ['/about.html', 'About'],
    ['/contact.html', 'Contact'],
  ];

  function build() {
    var here = location.pathname;
    var nav = document.createElement('nav');
    nav.className = 'urtnav';
    nav.innerHTML = LINKS.map(function (l) {
      /* /a/... is a runner, which lives under Races; mark that so the bar is never blank */
      var cur = (l[0] === here) ||
        (l[0] === '/' && (here === '/' || /^\/a\//.test(here) || /^\/[a-z0-9-]+\/$/.test(here)
          && !/^\/(upcoming|vs|crew|report)\//.test(here)));
      return '<a href="' + l[0] + '"' + (cur ? ' aria-current="page"' : '') + '>' +
        l[1] + '</a>';
    }).join('');

    var bar = document.createElement('div');
    bar.className = 'urtnavbar';
    bar.appendChild(nav);

    var header = document.querySelector('header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(bar, header.nextSibling);
    } else if (document.body) {
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else { build(); }
}());

/* Where to follow along.
 *
 * Only accounts that actually exist appear here. A row of platform buttons where five of them
 * 404 reads as abandoned, which is worse than one link that works. Add to SOCIALS as each
 * account is registered and confirmed.
 */
(function () {
  var SOCIALS = [
    { name: 'Instagram', url: 'https://www.instagram.com/ultraruntrack/' }
  ];
  if (!SOCIALS.length) return;
  if (document.getElementById('urt-social')) return;

  /* Page types end differently: the homepage and about have a <footer>, athlete pages end in
     div.foot and have no footer at all, crew pages have neither. Checked in a browser, not
     assumed from the templates. */
  var host = document.querySelector('footer .wrap') ||
             document.querySelector('footer') ||
             document.querySelector('.foot') ||
             document.querySelector('.cw') ||
             document.querySelector('.cx') ||
             document.querySelector('.wrap');
  if (!host) return;

  var css = document.createElement('style');
  css.textContent =
    '#urt-social{font-family:var(--mono,ui-monospace,monospace);font-size:10.5px;' +
      'letter-spacing:1.1px;text-transform:uppercase;margin:14px 0 0;line-height:1.9}' +
    '#urt-social a{color:inherit;opacity:.75;text-decoration:none;' +
      'border-bottom:1px solid currentColor;padding-bottom:1px}' +
    '#urt-social a:hover{opacity:1}' +
    '#urt-social s{text-decoration:none;opacity:.5;margin-right:8px}';
  document.head.appendChild(css);

  var p = document.createElement('p');
  p.id = 'urt-social';
  p.innerHTML = '<s>Follow along</s>' + SOCIALS.map(function (s) {
    return '<a href="' + s.url + '" rel="me noopener" target="_blank">' + s.name + '</a>';
  }).join(' &middot; ');
  host.appendChild(p);
}());
