/* Ilovaning asosiy boshqaruvchisi: marshrutlash (router), ishga tushirish, service worker */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});
  var onboarding = false;

  var SCREENS = { home: "#screen-home", catalog: "#screen-catalog", farm: "#screen-farm", animal: "#screen-animal", settings: "#screen-settings" };

  function show(name) {
    Object.keys(SCREENS).forEach(function (k) { CH.$(SCREENS[k]).hidden = k !== name; });
    var home = name === "home";
    document.body.classList.toggle("on-scan", home);
    CH.$("#bottomNav").hidden = home;
    var navKey = name === "animal" ? "farm" : name;
    CH.$$("#bottomNav a, #topNav a").forEach(function (a) { a.classList.toggle("active", a.dataset.nav === navKey); });
    CH.$("#topMy").hidden = name === "farm" || name === "animal";
    if (home && !onboarding) CH.camera.start(); else CH.camera.stop();
    if (name !== "animal") CH.farm.destroyCharts();
    if (!home) window.scrollTo(0, 0);
  }

  function route() {
    var parts = (location.hash || "#/").replace(/^#\/?/, "").split("/").map(function (p) { return decodeURIComponent(p || ""); });
    switch (parts[0]) {
      case "katalog":
        show("catalog");
        CH.catalog.render(parts[1] || "uy");
        document.title = (parts[1] === "parranda" ? "Parrandalar" : "Uy hayvonlari") + " — Chorva AI";
        break;
      case "mening":
        show("farm"); CH.farm.renderList(); document.title = "Mening hayvonlarim — Chorva AI";
        break;
      case "hayvon":
        show("animal"); CH.farm.renderAnimal(parts[1]); document.title = "Hayvon — Chorva AI";
        break;
      case "sozlamalar":
        show("settings"); CH.settings.render(); document.title = "Sozlamalar — Chorva AI";
        break;
      default:
        show("home"); document.title = "Chorva AI — aqlli chorvachilik yordamchisi";
    }
  }

  function registerSW() {
    if (!("serviceWorker" in navigator) || window.Capacitor || location.protocol === "file:") return;
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      // Yangi versiya o‘rnatildi — eski fayllar qolmasligi uchun sahifa bir marta yangilanadi
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(function (reg) {
        reg.update();
      }).catch(function () { /* SW ixtiyoriy */ });
    });
  }

  function init() {
    CH.sheet.init();
    CH.camera.bind();
    CH.catalog.bind();
    registerSW();
    CH.loadData().then(function () {
      return CH.db.kvGet("onboarded");
    }).then(function (done) {
      window.addEventListener("hashchange", route);
      if (!done) {
        onboarding = true;
        route();
        CH.farm.onboarding(function () {
          onboarding = false;
          route();
        });
      } else {
        route();
      }
    }).catch(function (e) {
      document.body.innerHTML = '<div style="padding:2rem;text-align:center;font-family:sans-serif"><h2>Ilovani yuklab bo‘lmadi</h2><p>' +
        CH.esc(e.message) + '</p><a href="./">Qayta urinish</a></div>';
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
