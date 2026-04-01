// IndexedDB-based persistent cache with stale-while-revalidate pattern
// TTLs: threads 5min, CRM 10min, lifecycle 30min, template config 60min

var DB_NAME = "yago_cache";
var DB_VERSION = 1;
var STORE_NAME = "data";

var TTL = {
  threads: 5 * 60 * 1000,
  crm: 10 * 60 * 1000,
  lifecycle: 30 * 60 * 1000,
  config: 60 * 60 * 1000,
};

var _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = function(e) {
      _db = e.target.result;
      resolve(_db);
    };
    req.onerror = function() {
      console.warn("[cache] IndexedDB open error");
      reject(req.error);
    };
  });
}

function idbGet(key) {
  return openDb().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(STORE_NAME, "readonly");
      var store = tx.objectStore(STORE_NAME);
      var req = store.get(key);
      req.onsuccess = function() { resolve(req.result || null); };
      req.onerror = function() { resolve(null); };
    });
  }).catch(function() { return null; });
}

function idbSet(key, value) {
  return openDb().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(STORE_NAME, "readwrite");
      var store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { resolve(); };
    });
  }).catch(function() {});
}

// Get cached data if not expired
export function getCached(key, ttlType) {
  var ttl = TTL[ttlType] || TTL.threads;
  return idbGet(key).then(function(entry) {
    if (!entry) return null;
    var age = Date.now() - (entry._ts || 0);
    if (age > ttl) return null;
    return entry.data;
  });
}

// Get stale data (even if expired) for stale-while-revalidate
export function getStale(key) {
  return idbGet(key).then(function(entry) {
    if (!entry) return null;
    return entry.data;
  });
}

// Check if cache entry is fresh (not expired)
export function isFresh(key, ttlType) {
  var ttl = TTL[ttlType] || TTL.threads;
  return idbGet(key).then(function(entry) {
    if (!entry) return false;
    return (Date.now() - (entry._ts || 0)) <= ttl;
  });
}

// Store data in cache with timestamp
export function setCache(key, data) {
  return idbSet(key, { data: data, _ts: Date.now() });
}

// Stale-while-revalidate wrapper
// Returns { data, isStale } immediately from cache, then calls fetchFn in background
// onFresh is called when fresh data arrives (if different from stale)
export async function staleWhileRevalidate(key, ttlType, fetchFn, onFresh) {
  var stale = await getStale(key);
  var fresh = await isFresh(key, ttlType);

  if (stale && fresh) {
    // Cache is fresh, no need to fetch
    return { data: stale, isStale: false };
  }

  if (stale) {
    // Cache is stale — return stale data immediately, fetch in background
    fetchFn().then(function(freshData) {
      setCache(key, freshData);
      if (onFresh) onFresh(freshData);
    }).catch(function(e) {
      console.warn("[cache] Background refresh failed for " + key + ":", e.message);
    });
    return { data: stale, isStale: true };
  }

  // No cache at all — must wait for fetch
  var data = await fetchFn();
  await setCache(key, data);
  return { data: data, isStale: false };
}
