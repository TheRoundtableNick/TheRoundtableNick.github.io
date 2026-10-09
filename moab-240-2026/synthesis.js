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
    var overallPace = (r.elapsed_s / 60 / 60) / r.mile;           // hours per mile

    // Momentum: percentage faster/slower than overall
    // Negative means faster (lower pace = faster running)
    var momentumPct = ((segmentPace - overallPace) / overallPace) * 100;

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
