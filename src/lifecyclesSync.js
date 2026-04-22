import { staleWhileRevalidate, setCache } from "./dataCache";
import {
  fetchActiveLifecycles,
  fetchLifecycleTemplateStats,
  fetchLifecycleTemplateTimeseries,
} from "./metabaseApi";

// Default window for "active" lifecycle discovery: 30 days.
var DEFAULT_SINCE_DAYS = 30;

function defaultSince() {
  var d = new Date();
  d.setDate(d.getDate() - DEFAULT_SINCE_DAYS);
  return d.toISOString().slice(0, 10);
}

function _rangeKey(since, until) {
  return (since || "_") + "__" + (until || "_");
}

// Load enumerated active lifecycles for the given date range.
// Uses stale-while-revalidate cache unless `forceRefresh` is true.
export async function loadLifecycles(opts) {
  opts = opts || {};
  var since = opts.since || defaultSince();
  var until = opts.until || null;
  var cacheKey = "lifecycles_list_v3_" + _rangeKey(since, until);

  if (opts.forceRefresh) {
    var fresh = await fetchActiveLifecycles(since, until);
    await setCache(cacheKey, fresh);
    return fresh;
  }

  var result = await staleWhileRevalidate(
    cacheKey,
    "lifecycle",
    function () { return fetchActiveLifecycles(since, until); },
    opts.onRefresh
  );
  console.log(
    "[lifecyclesSync] Loaded " + result.data.length + " active lifecycles" +
    (result.isStale ? " (from cache, refreshing...)" : "")
  );
  return result.data;
}

// Load full detail (per-template stats + 24h timeseries) for one lifecycle.
export async function loadLifecycleDetail(flowId, opts) {
  opts = opts || {};
  var since = opts.since || defaultSince();
  var until = opts.until || null;
  var hours = opts.hours || 24;
  var cacheKey = "lifecycle_detail_v2_" + flowId + "_" + _rangeKey(since, until);

  function doFetch() {
    return Promise.all([
      fetchLifecycleTemplateStats(flowId, since, until),
      fetchLifecycleTemplateTimeseries(flowId, hours),
    ]).then(function (parts) {
      var stats = parts[0];
      var ts = parts[1];
      for (var i = 0; i < stats.length; i++) {
        stats[i].timeseries = ts[stats[i].template_id] || [];
      }
      return { templates: stats, fetchedAt: Date.now() };
    });
  }

  if (opts.forceRefresh) {
    var fresh = await doFetch();
    await setCache(cacheKey, fresh);
    return fresh;
  }

  var result = await staleWhileRevalidate(
    cacheKey,
    "lifecycle",
    doFetch,
    opts.onRefresh
  );
  console.log(
    "[lifecyclesSync] Loaded detail for flow " + flowId + " — " +
    result.data.templates.length + " templates" +
    (result.isStale ? " (from cache, refreshing...)" : "")
  );
  return result.data;
}
