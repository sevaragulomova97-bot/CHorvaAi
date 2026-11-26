/* Pastdan chiquvchi oyna (Bottom Sheet) — telefondagi “Orqaga” tugmasi bilan ham yopiladi */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});
  var sheet, backdrop, body, handle, closeBtn;
  var state = { open: false, locked: false, pushed: false, ignorePop: false, onClose: null };

  function init() {
    sheet = CH.$("#sheet"); backdrop = CH.$("#sheetBackdrop"); body = CH.$("#sheetBody");
    handle = CH.$("#sheetHandle"); closeBtn = CH.$("#sheetClose");
    closeBtn.addEventListener("click", function () { CH.sheet.close(); });
    backdrop.addEventListener("click", function () { if (!state.locked) CH.sheet.close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && state.open && !state.locked) CH.sheet.close(); });

    window.addEventListener("popstate", function () {
      if (state.ignorePop) { state.ignorePop = false; return; }
      if (!state.open) return;
      if (state.locked) { history.pushState({ sheet: 1 }, ""); return; }
      state.pushed = false;
      hide();
    });

    /* Pastga surib yopish */
    var startY = null, dy = 0;
    handle.addEventListener("touchstart", function (e) { if (!state.locked) { startY = e.touches[0].clientY; dy = 0; sheet.style.transition = "none"; } }, { passive: true });
    handle.addEventListener("touchmove", function (e) {
      if (startY == null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      sheet.style.transform = "translateY(" + dy + "px)";
    }, { passive: true });
    handle.addEventListener("touchend", function () {
      if (startY == null) return;
      sheet.style.transition = ""; sheet.style.transform = "";
      if (dy > 90) CH.sheet.close();
      startY = null;
    });
  }

  function hide() {
    state.open = false;
    sheet.classList.add("enter");
    backdrop.hidden = true;
    document.body.style.overflow = "";
    var cb = state.onClose; state.onClose = null;
    setTimeout(function () {
      if (!state.open) { sheet.hidden = true; body.innerHTML = ""; }
    }, 260);
    if (cb) cb();
  }

  CH.sheet = {
    /* html — oyna mazmuni; opts: {full, locked, onClose} */
    open: function (html, opts) {
      opts = opts || {};
      if (!sheet) init();
      var wasOpen = state.open;
      if (wasOpen && state.onClose) { var cb = state.onClose; state.onClose = null; cb(); }
      state.open = true; state.locked = !!opts.locked; state.onClose = opts.onClose || null;
      sheet.classList.toggle("full", !!opts.full);
      sheet.classList.toggle("locked", !!opts.locked);
      body.innerHTML = html;
      body.scrollTop = 0;
      sheet.hidden = false; backdrop.hidden = false;
      document.body.style.overflow = "hidden";
      if (!wasOpen) {
        var t = document.getElementById("toast");
        if (t) t.hidden = true;
        sheet.classList.add("enter");
        requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.remove("enter"); }); });
        if (!state.pushed) { history.pushState({ sheet: 1 }, ""); state.pushed = true; }
      } else {
        sheet.classList.remove("enter");
      }
      var first = body.querySelector("[autofocus]");
      if (first) setTimeout(function () { first.focus(); }, 300);
      return body;
    },
    close: function () {
      if (!state.open) return;
      hide();
      if (state.pushed) { state.pushed = false; state.ignorePop = true; history.back(); }
    },
    /* Oynani yopib, boshqa sahifaga o‘tish (tarix to‘g‘ri saqlanadi) */
    closeAndGo: function (hash) {
      if (state.open) {
        hide();
        if (state.pushed) { state.pushed = false; history.replaceState(null, "", hash); window.dispatchEvent(new HashChangeEvent("hashchange")); return; }
      }
      if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = hash;
    },
    isOpen: function () { return state.open; },
    body: function () { return body; },
    init: function () { if (!sheet) init(); }
  };
})();
