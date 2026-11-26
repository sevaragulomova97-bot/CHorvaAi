/* Mahalliy ma’lumotlar ombori: IndexedDB (rasmlar bilan), bo‘lmasa localStorage.
   Ma’lumotlar telefonning o‘zida saqlanadi — internet bo‘lmasa ham ishlaydi. */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});
  var DB_NAME = "chorva-ai", DB_VER = 1;
  var dbPromise = null;

  function req(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function openIDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB yo‘q"));
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
        if (!db.objectStoreNames.contains("animals")) db.createObjectStore("animals", { keyPath: "id" });
        if (!db.objectStoreNames.contains("records")) {
          db.createObjectStore("records", { keyPath: "id" }).createIndex("animalId", "animalId", { unique: false });
        }
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.onblocked = function () { reject(new Error("Ma’lumotlar bazasi band")); };
    });
    return dbPromise;
  }

  /* ---- IndexedDB amalga oshirilishi ---- */
  var idb = {
    run: function (store, mode, fn) {
      return openIDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(store, mode);
          var result;
          Promise.resolve(fn(tx.objectStore(store), tx)).then(function (r) { result = r; });
          tx.oncomplete = function () { resolve(result); };
          tx.onerror = function () { reject(tx.error); };
          tx.onabort = function () { reject(tx.error || new Error("Saqlash bekor qilindi (xotira to‘lgan bo‘lishi mumkin)")); };
        });
      });
    },
    get: function (store, key) { return idb.run(store, "readonly", function (s) { return req(s.get(key)); }); },
    all: function (store) { return idb.run(store, "readonly", function (s) { return req(s.getAll()); }); },
    put: function (store, obj) { return idb.run(store, "readwrite", function (s) { s.put(obj); return obj; }); },
    del: function (store, key) { return idb.run(store, "readwrite", function (s) { s.delete(key); }); },
    byIndex: function (store, index, value) {
      return idb.run(store, "readonly", function (s) { return req(s.index(index).getAll(value)); });
    },
    clear: function (store) { return idb.run(store, "readwrite", function (s) { s.clear(); }); }
  };

  /* ---- Zaxira: localStorage amalga oshirilishi ---- */
  var LS_KEY = "chorva-ai-db";
  var mem = null;
  function lsLoad() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch (e) { mem = null; }
    mem = mem || { kv: {}, animals: {}, records: {} };
    return mem;
  }
  function lsSave() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(mem)); }
    catch (e) { return Promise.reject(new Error("Xotira to‘lgan: eski rasmlarni o‘chiring")); }
    return Promise.resolve();
  }
  function keyOf(store) { return store === "kv" ? "key" : "id"; }
  var ls = {
    get: function (store, key) { return Promise.resolve(lsLoad()[store][key]); },
    all: function (store) { var s = lsLoad()[store]; return Promise.resolve(Object.keys(s).map(function (k) { return s[k]; })); },
    put: function (store, obj) { lsLoad()[store][obj[keyOf(store)]] = obj; return lsSave().then(function () { return obj; }); },
    del: function (store, key) { delete lsLoad()[store][key]; return lsSave(); },
    byIndex: function (store, index, value) {
      return ls.all(store).then(function (a) { return a.filter(function (o) { return o[index] === value; }); });
    },
    clear: function (store) { lsLoad()[store] = {}; return lsSave(); }
  };

  var impl = null;
  function backend() {
    if (impl) return Promise.resolve(impl);
    return openIDB().then(function () { impl = idb; return impl; }).catch(function () { impl = ls; return impl; });
  }
  function call(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return backend().then(function (b) { return b[method].apply(b, args); });
  }

  /* ---- Ochiq API ---- */
  CH.db = {
    kvGet: function (key) { return call("get", "kv", key).then(function (r) { return r ? r.value : null; }); },
    kvSet: function (key, value) { return call("put", "kv", { key: key, value: value }); },

    animals: function () {
      return call("all", "animals").then(function (list) {
        return list.sort(function (a, b) { return (b.created || "").localeCompare(a.created || ""); });
      });
    },
    animal: function (id) { return call("get", "animals", id); },
    saveAnimal: function (a) {
      a.id = a.id || CH.uid();
      a.created = a.created || new Date().toISOString();
      return call("put", "animals", a);
    },
    deleteAnimal: function (id) {
      return CH.db.records(id).then(function (recs) {
        return Promise.all(recs.map(function (r) { return call("del", "records", r.id); }));
      }).then(function () { return call("del", "animals", id); });
    },

    records: function (animalId) {
      return call("byIndex", "records", "animalId", animalId).then(function (list) {
        return list.sort(function (a, b) { return a.date === b.date ? (a.created || "").localeCompare(b.created || "") : a.date.localeCompare(b.date); });
      });
    },
    allRecords: function () { return call("all", "records"); },
    saveRecord: function (r) {
      r.id = r.id || CH.uid();
      r.created = r.created || new Date().toISOString();
      return call("put", "records", r);
    },
    deleteRecord: function (id) { return call("del", "records", id); },

    exportAll: function () {
      return Promise.all([call("all", "kv"), call("all", "animals"), call("all", "records")]).then(function (r) {
        return { app: "chorva-ai", format: 1, exported: new Date().toISOString(), kv: r[0], animals: r[1], records: r[2] };
      });
    },
    importAll: function (data) {
      if (!data || data.app !== "chorva-ai" || !Array.isArray(data.animals) || !Array.isArray(data.records)) {
        return Promise.reject(new Error("Bu fayl Chorva AI zaxira nusxasi emas"));
      }
      var jobs = [];
      (data.kv || []).forEach(function (o) { if (o && o.key) jobs.push(call("put", "kv", o)); });
      data.animals.forEach(function (o) { if (o && o.id) jobs.push(call("put", "animals", o)); });
      data.records.forEach(function (o) { if (o && o.id && o.animalId) jobs.push(call("put", "records", o)); });
      return Promise.all(jobs).then(function () { return data.animals.length; });
    },
    clearAll: function () {
      return Promise.all([call("clear", "kv"), call("clear", "animals"), call("clear", "records")]);
    }
  };
})();
