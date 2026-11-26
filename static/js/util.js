/* Umumiy yordamchi funksiyalar — window.CH nomlar maydoni */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});
  var cfg = window.CHORVA_CONFIG || { apiBase: "" };

  CH.$ = function (sel, root) { return (root || document).querySelector(sel); };
  CH.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* HTML xavfsizligi: foydalanuvchi matnini doim shu orqali chiqaramiz */
  CH.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  /* Sonlarni o‘zbekcha formatlash: 1 234,5 */
  CH.fmt = function (n, digits) {
    if (n == null || isNaN(n)) return "—";
    var d = digits == null ? (Math.abs(n) < 10 ? 2 : 1) : digits;
    var s = Number(n).toFixed(d);
    if (d > 0) s = s.replace(/\.?0+$/, "");
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts.join(",");
  };
  CH.signed = function (n, digits) { return (n > 0 ? "+" : n < 0 ? "−" : "") + CH.fmt(Math.abs(n), digits); };
  CH.parseNum = function (v) {
    if (v == null) return null;
    var n = parseFloat(String(v).trim().replace(",", "."));
    return isFinite(n) ? n : null;
  };

  CH.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  CH.todayISO = function () {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  CH.parseISO = function (s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  };
  CH.daysBetween = function (a, b) {
    var da = CH.parseISO(a), db = CH.parseISO(b);
    if (!da || !db) return null;
    return Math.round((db - da) / 86400000);
  };
  var MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  CH.dateText = function (s) {
    var d = CH.parseISO(s);
    return d ? d.getDate() + "-" + MONTHS[d.getMonth()] + ", " + d.getFullYear() : "—";
  };
  CH.shortDate = function (s) {
    var d = CH.parseISO(s);
    return d ? String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") : s;
  };

  /* Xabarnoma */
  var toastTimer;
  CH.toast = function (msg, type) {
    var t = CH.$("#toast");
    t.textContent = msg;
    t.className = "toast" + (type === "err" ? " err" : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, type === "err" ? 4200 : 2600);
  };

  /* Backend bilan aloqa */
  CH.apiUrl = function (path) { return (cfg.apiBase || "").replace(/\/$/, "") + path; };
  CH.api = function (path, opts) {
    opts = opts || {};
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 60000) : null;
    return fetch(CH.apiUrl(path), {
      method: opts.method || "GET",
      body: opts.body,
      signal: ctrl ? ctrl.signal : undefined,
      cache: "no-store"
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok || data.ok === false) {
          var err = new Error(data.error || ("Server xatosi (" + r.status + ")"));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    }).catch(function (e) {
      if (e.name === "AbortError") throw new Error("Server javob bermadi. Internetni tekshiring.");
      if (e instanceof TypeError) throw new Error("Internet aloqasi yo‘q yoki server ishlamayapti.");
      throw e;
    }).finally(function () { if (timer) clearTimeout(timer); });
  };

  /* Bilimlar bazasi (oflayn ham ishlashi uchun statik fayldan olinadi) */
  CH.loadData = function () {
    return fetch("/static/data/data.json").then(function (r) {
      if (!r.ok) throw new Error("Ma’lumotlar bazasi yuklanmadi");
      return r.json();
    }).then(function (d) {
      CH.data = d;
      CH.breedById = {};
      d.breeds.forEach(function (b) { CH.breedById[b.id] = b; });
      return d;
    });
  };
  CH.breedsOf = function (speciesId) { return CH.data.breeds.filter(function (b) { return b.species === speciesId; }); };
  CH.slug = function (s) { return String(s).toLowerCase().replace(/[‘’'`ʻʼ]/g, "").replace(/[^a-z0-9]+/g, "-"); };
  CH.dirTags = function (dirs) {
    return '<div class="tags">' + (dirs || []).map(function (d) {
      return '<span class="tag ' + CH.slug(d) + '">' + CH.esc(d) + "</span>";
    }).join("") + "</div>";
  };

  /* Rasmlar */
  CH.loadImage = function (src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Rasmni ochib bo‘lmadi")); };
      img.src = src;
    });
  };
  /* Faylni/rasmni/canvasni kichraytirib JPEG ga aylantiradi: {blob, dataUrl, width, height} */
  CH.compress = function (source, maxSize, quality) {
    maxSize = maxSize || 1024; quality = quality || 0.85;
    var getImg;
    if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) {
      getImg = Promise.resolve(source);
    } else {
      var url = URL.createObjectURL(source);
      getImg = CH.loadImage(url).finally(function () { setTimeout(function () { URL.revokeObjectURL(url); }, 1000); });
    }
    return getImg.then(function (img) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      var scale = Math.min(1, maxSize / Math.max(w, h));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      var dataUrl = c.toDataURL("image/jpeg", quality);
      return new Promise(function (resolve) {
        c.toBlob(function (blob) {
          resolve({ blob: blob, dataUrl: dataUrl, width: c.width, height: c.height });
        }, "image/jpeg", quality);
      });
    });
  };

  CH.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
})();
