/* A. Bosh oyna: jonli kamera, AR ramka va AI skanerlash */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});
  var $ = CH.$;
  var st = { stream: null, track: null, mode: "auto", frozen: false, busy: false, torch: false, active: false, starting: false };
  var el = {};

  var METHOD_TEXT = {
    ai_foto: "AI foto-baholash",
    prognoz: "Zot me’yori bo‘yicha prognoz",
    "zot_o‘rtacha": "Zotning o‘rtacha ko‘rsatkichi"
  };

  function bind() {
    ["camVideo", "camFrozen", "camCanvas", "camFallback", "camFallbackText", "scanOverlay", "viewfinder", "vfLabel",
      "btnScan", "btnGallery", "btnDemo", "btnTorch", "btnLive", "galleryInput",
      "btnFallbackGallery", "btnFallbackDemo", "btnRetryCam"].forEach(function (id) { el[id] = $("#" + id); });

    CH.$$(".mode-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        st.mode = b.dataset.mode;
        CH.$$(".mode-chip").forEach(function (x) {
          var on = x === b;
          x.classList.toggle("active", on);
          x.setAttribute("aria-checked", on ? "true" : "false");
        });
        el.vfLabel.textContent = st.mode === "parranda" ? "Parrandani ramka ichiga joylashtiring"
          : st.mode === "uy" ? "Uy hayvonini ramka ichiga joylashtiring" : "Hayvonni ramka ichiga joylashtiring";
      });
    });
    el.btnScan.addEventListener("click", scan);
    el.btnGallery.addEventListener("click", pickFile);
    el.btnFallbackGallery.addEventListener("click", pickFile);
    el.btnDemo.addEventListener("click", demo);
    el.btnFallbackDemo.addEventListener("click", demo);
    el.btnRetryCam.addEventListener("click", function () { start(true); });
    el.btnLive.addEventListener("click", unfreeze);
    el.btnTorch.addEventListener("click", toggleTorch);
    el.galleryInput.addEventListener("change", function () {
      var f = el.galleryInput.files && el.galleryInput.files[0];
      el.galleryInput.value = "";
      if (!f) return;
      CH.compress(f, 1600, 0.9).then(function (res) {
        freeze(res.dataUrl);
        return waitImg().then(scan);
      }).catch(function (e) { CH.toast(e.message, "err"); });
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopStream();
      else if (st.active && !st.frozen) start();
    });
  }

  function pickFile() { el.galleryInput.click(); }

  function showFallback(text) {
    el.camFallbackText.textContent = text;
    el.camFallback.hidden = st.frozen;
    el.viewfinder.hidden = !st.frozen;
  }

  function start(force) {
    st.active = true;
    if (st.frozen || st.starting || (st.stream && !force)) return;
    if (!window.isSecureContext) {
      return showFallback("Kamera faqat xavfsiz (https://) ulanishda ishlaydi. Saytni https orqali oching yoki rasmni galereyadan yuklang.");
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return showFallback("Bu brauzer kamerani qo‘llab-quvvatlamaydi. Rasmni galereyadan yuklang yoki demo rejimni sinab ko‘ring.");
    }
    stopStream();
    st.starting = true;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    }).then(function (stream) {
      st.starting = false;
      if (!st.active || st.frozen) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      st.stream = stream;
      st.track = stream.getVideoTracks()[0];
      el.camVideo.srcObject = stream;
      el.camVideo.hidden = false;
      var p = el.camVideo.play();
      if (p && p.catch) p.catch(function () {});
      el.camFallback.hidden = true;
      el.viewfinder.hidden = false;
      var caps = st.track && st.track.getCapabilities ? st.track.getCapabilities() : {};
      el.btnTorch.hidden = !caps.torch;
    }).catch(function (err) {
      st.starting = false;
      var name = err && err.name;
      var msg = name === "NotAllowedError" || name === "SecurityError"
        ? "Kameraga ruxsat berilmadi. Brauzer sozlamalarida kameraga ruxsat bering yoki rasmni galereyadan yuklang."
        : name === "NotFoundError" || name === "OverconstrainedError"
          ? "Qurilmada kamera topilmadi. Kompyuterdan kirgan bo‘lsangiz, rasmni galereyadan yuklang yoki demo rejimni sinang."
          : name === "NotReadableError"
            ? "Kamera boshqa ilova tomonidan band. Uni yopib, qayta urinib ko‘ring."
            : "Kamerani ochib bo‘lmadi. Rasmni galereyadan yuklang yoki demo rejimni sinang.";
      showFallback(msg);
    });
  }

  function stopStream() {
    if (st.stream) st.stream.getTracks().forEach(function (t) { t.stop(); });
    st.stream = null; st.track = null; st.torch = false;
    el.btnTorch && el.btnTorch.classList.remove("on");
    if (el.camVideo) el.camVideo.srcObject = null;
  }

  function stop() { st.active = false; stopStream(); }

  function freeze(src) {
    st.frozen = true;
    el.camFrozen.src = src;
    el.camFrozen.hidden = false;
    el.camVideo.hidden = true;
    el.camFallback.hidden = true;
    el.viewfinder.hidden = false;
    el.btnLive.hidden = false;
    stopStream();
  }
  function waitImg() {
    var img = el.camFrozen;
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return new Promise(function (resolve, reject) { img.onload = resolve; img.onerror = function () { reject(new Error("Rasm ochilmadi")); }; });
  }
  function unfreeze() {
    st.frozen = false;
    el.camFrozen.hidden = true;
    el.camFrozen.removeAttribute("src");
    el.btnLive.hidden = true;
    el.camVideo.hidden = false;
    if (st.active) start(true);
  }

  function toggleTorch() {
    if (!st.track) return;
    st.torch = !st.torch;
    st.track.applyConstraints({ advanced: [{ torch: st.torch }] }).then(function () {
      el.btnTorch.classList.toggle("on", st.torch);
    }).catch(function () { st.torch = false; CH.toast("Chiroqni yoqib bo‘lmadi", "err"); });
  }

  function demo() {
    var list = CH.data.breeds.filter(function (b) {
      return st.mode === "auto" || CH.data.species[b.species].group === st.mode;
    });
    var breed = list[Math.floor(Math.random() * list.length)];
    CH.toast("Demo: namunaviy rasm skanerlanmoqda");
    CH.illusToCanvas(breed.id).then(function (canvas) {
      freeze(canvas.toDataURL("image/jpeg", 0.9));
      return waitImg().then(scan);
    }).catch(function (e) { CH.toast(e.message, "err"); });
  }

  /* Joriy kadrni (jonli yoki tanlangan rasm) olish */
  function grabSource() {
    if (st.frozen) return Promise.resolve(el.camFrozen);
    var v = el.camVideo;
    if (!st.stream || !v.videoWidth) return Promise.reject(new Error("Kamera tayyor emas. Galereyadan rasm yuklang yoki demo rejimni sinang."));
    var c = el.camCanvas;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return Promise.resolve(c);
  }

  function setBusy(on) {
    st.busy = on;
    el.btnScan.disabled = on;
    el.scanOverlay.hidden = !on;
    el.viewfinder.classList.toggle("busy", on);
  }

  function scan() {
    if (st.busy) return;
    grabSource().then(function (src) {
      setBusy(true);
      return Promise.all([CH.compress(src, 1024, 0.85), CH.compress(src, 480, 0.75)]);
    }).then(function (imgs) {
      if (!st.frozen) freeze(imgs[0].dataUrl);
      var fd = new FormData();
      fd.append("image", imgs[0].blob, "skan.jpg");
      fd.append("category", st.mode);
      return CH.api("/api/scan", { method: "POST", body: fd, timeout: 75000 }).then(function (r) {
        setBusy(false);
        showResult(r, imgs[1].dataUrl);
      });
    }).catch(function (e) {
      setBusy(false);
      CH.toast(e.message, "err");
    });
  }

  function metric(value, unit, label, extra) {
    return '<div class="metric"><div class="v">' + value + (unit ? " <small>" + unit + "</small>" : "") + "</div>" +
      '<div class="l">' + label + "</div>" + (extra || "") + "</div>";
  }

  function bcsScale(bcs) {
    var html = '<div class="bcs-scale' + (bcs < 2.75 || bcs >= 4.5 ? " warn" : "") + '">';
    for (var i = 1; i <= 5; i++) html += "<i" + (i <= Math.round(bcs) ? ' class="on"' : "") + "></i>";
    return html + "</div>";
  }

  function modeBadge(r) {
    if (r.mode === "ai") {
      var name = r.provider === "anthropic" ? "Claude" : r.provider === "gemini" ? "Gemini" : "AI";
      return '<span class="badge ai">🤖 AI tahlil · ' + name + "</span>";
    }
    return '<span class="badge demo">🧪 Demo rejim</span>';
  }

  function showResult(r, photo) {
    CH.lastScan = { result: r, photo: photo };
    var html;
    if (!r.animal_found) {
      html = '<div class="result-head"><div class="result-art"><img src="' + photo + '" alt=""></div><div>' + modeBadge(r) +
        '<h2 id="sheetTitle">Hayvon aniqlanmadi</h2></div></div>' +
        '<div class="callout">' + CH.esc(r.message) + "</div>" +
        (r.note ? '<p class="muted small">' + CH.esc(r.note) + "</p>" : "") +
        '<button type="button" class="btn btn-primary btn-block" data-act="rescan">🔄 Qayta skanerlash</button>';
      CH.sheet.open(html, { onClose: unfreeze });
      bindResult();
      return;
    }
    var sp = CH.data.species[r.species_id];
    var w = r.weight_kg;
    html = '<div class="result-head"><div class="result-art"><img src="' + photo + '" alt="Skanerlangan rasm"></div><div>' +
      modeBadge(r) + '<h2 id="sheetTitle">' + CH.esc(r.breed_name) + "</h2>" +
      '<div class="muted small">' + sp.emoji + " " + CH.esc(r.species_name) + " · " + CH.esc(CH.data.groups[r.group].name) + "</div></div></div>";
    html += '<div class="metrics">' +
      metric(w != null ? CH.fmt(w, w < 10 ? 2 : 0) : "—", "kg", "Taxminiy tirik vazn<br><small>" + CH.esc(METHOD_TEXT[r.weight_method] || "") + "</small>") +
      metric(r.height_cm != null ? CH.fmt(r.height_cm, 0) : "—", "sm", CH.esc(r.size_label)) +
      metric(r.bcs != null ? CH.fmt(r.bcs, 1) : "—", "/ 5", "Tana holati (BCS)" + (r.bcs_text ? " — " + CH.esc(r.bcs_text) : ""), r.bcs != null ? bcsScale(r.bcs) : "") +
      metric(r.confidence != null ? r.confidence : "—", "%", "Aniqlash ishonchi", '<div class="conf-bar"><i style="width:' + (r.confidence || 0) + '%"></i></div>') +
      "</div>";
    if (r.condition && r.mode === "ai") html += '<div class="callout info">🩺 ' + CH.esc(r.condition) + "</div>";
    html += "<h3>⚡ Tezkor tavsiya</h3><ul class=\"list\">" + (r.advice || []).map(function (a) { return "<li>" + CH.esc(a) + "</li>"; }).join("") + "</ul>";
    if (r.note) html += '<div class="callout">' + CH.esc(r.note) + "</div>";
    html += '<div class="btn-row">' +
      '<button type="button" class="btn btn-primary" data-act="add">➕ Hayvonlarimga qo‘shish</button>' +
      (r.breed_id ? '<button type="button" class="btn btn-secondary" data-act="catalog">📚 Zot haqida</button>' : "") +
      '<button type="button" class="btn btn-outline" data-act="rescan">🔄 Qayta skanerlash</button></div>';
    CH.sheet.open(html, { onClose: unfreeze });
    bindResult();
  }

  function bindResult() {
    var body = CH.sheet.body();
    CH.$$("[data-act]", body).forEach(function (b) {
      b.addEventListener("click", function () {
        var act = b.dataset.act, s = CH.lastScan;
        if (act === "rescan") CH.sheet.close();
        else if (act === "catalog") CH.catalog.openBreed(s.result.breed_id);
        else if (act === "add") {
          CH.farm.openAddForm({
            species: s.result.species_id, breed: s.result.breed_id,
            weight: s.result.weight_kg, photo: s.photo,
            source: s.result.mode === "ai" ? "ai_foto" : "prognoz"
          });
        }
      });
    });
  }

  CH.camera = { bind: bind, start: start, stop: stop, unfreeze: unfreeze };
})();
