/* Device-only storage. IndexedDB holds one record: the whole ledger state as JSON.
   Nothing is ever sent over the network. */
(function (root) {
  'use strict';
  const DB = 'payday-runway', STORE = 'kv', KEY = 'state', LS_KEY = 'payday-runway-state';
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!('indexedDB' in root)) return reject(new Error('no indexedDB'));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function load() {
    try {
      const db = await open();
      const v = await new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).get(KEY); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      if (v) return JSON.parse(v);
    } catch (e) { /* fall through to localStorage */ }
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  async function save(state) {
    const json = JSON.stringify(state);
    try {
      const db = await open();
      await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(json, KEY); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
      return true;
    } catch (e) {
      try { localStorage.setItem(LS_KEY, json); return true; } catch (e2) { return false; }
    }
  }
  async function erase() {
    try { const db = await open(); await new Promise(res => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(KEY); tx.oncomplete = res; tx.onerror = res; }); } catch (e) {}
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }
  // Ask the browser not to clear this site's data under storage pressure.
  async function persistStorage() { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; } }
  root.Store = { load, save, erase, persistStorage };
})(window);
