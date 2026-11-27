/* Sozlamalar: profil, ko‘rinish, AI holati, zaxira nusxa, ilovani o‘rnatish */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});
  var installEvt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; });

  function regionOptions(sel) {
    var list = ["Andijon viloyati", "Buxoro viloyati", "Farg‘ona viloyati", "Jizzax viloyati", "Xorazm viloyati", "Namangan viloyati",
      "Navoiy viloyati", "Qashqadaryo viloyati", "Qoraqalpog‘iston Respublikasi", "Samarqand viloyati", "Sirdaryo viloyati",
      "Surxondaryo viloyati", "Toshkent viloyati", "Toshkent shahri"];
    return '<option value="">Tanlang…</option>' + list.map(function (r) { return "<option" + (r === sel ? " selected" : "") + ">" + r + "</option>"; }).join("");
  }

  function render() {
    var page = CH.$("#settingsPage");
    CH.db.kvGet("profile").then(function (p) {
      p = p || {};
      var theme = document.documentElement.getAttribute("data-theme") || "auto";
      var standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
      var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      page.innerHTML = '<div class="page-head"><h1>⚙️ Sozlamalar</h1></div>' +
        '<div class="set-group"><h2>Profil</h2><form class="form" id="setProfile" style="padding:.4rem 1rem 1rem">' +
        '<label class="field"><span>Ismingiz</span><input name="name" maxlength="40" value="' + CH.esc(p.name || "") + '"></label>' +
        '<label class="field"><span>Xo‘jalik nomi</span><input name="farm" maxlength="60" value="' + CH.esc(p.farm || "") + '"></label>' +
        '<label class="field"><span>Viloyat</span><select name="region">' + regionOptions(p.region) + "</select></label>" +
        '<button type="submit" class="btn btn-secondary">💾 Saqlash</button></form></div>' +

        '<div class="set-group"><h2>Ko‘rinish</h2>' +
        '<div class="set-row"><span class="grow">🌓 Mavzu</span><select id="setTheme">' +
        [["auto", "Avtomatik"], ["light", "Yorug‘"], ["dark", "Qorong‘i"]].map(function (o) {
          return '<option value="' + o[0] + '"' + (o[0] === theme ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("") + "</select></div>" +
        "</div>" +

        '<div class="set-group"><h2>AI tahlil</h2><div class="set-row"><span class="grow" id="aiStatus"><span class="status-dot"></span>Tekshirilmoqda…</span></div></div>' +

        '<div class="set-group"><h2>Ilova</h2><div class="set-row"><span class="grow">📲 Telefonga o‘rnatish<small>' +
        (standalone ? "Ilova allaqachon o‘rnatilgan ✓" : ios ? "Safari’da: “Ulashish” → “Bosh ekranga qo‘shish”" : "Bosh ekranda ilova sifatida ochiladi va oflayn ishlaydi") +
        "</small></span>" + (!standalone && !ios ? '<button type="button" class="btn btn-primary btn-sm" id="btnInstall">O‘rnatish</button>' : "") + "</div></div>" +

        '<div class="set-group"><h2>Ma’lumotlar</h2>' +
        '<div class="set-row"><span class="grow">💾 Zaxira nusxa olish<small>Barcha hayvonlar, yozuvlar va rasmlar (JSON fayl)</small></span><button type="button" class="btn btn-outline btn-sm" id="btnExport">Yuklab olish</button></div>' +
        '<div class="set-row"><span class="grow">📥 Zaxiradan tiklash<small>Boshqa telefondan ko‘chirish uchun</small></span><button type="button" class="btn btn-outline btn-sm" id="btnImport">Fayl tanlash</button><input type="file" id="importFile" accept="application/json,.json" hidden></div>' +
        '<div class="set-row"><span class="grow">🗑 Barcha ma’lumotlarni o‘chirish</span><button type="button" class="btn btn-danger btn-sm" id="btnWipe">O‘chirish</button></div></div>' +

        '<div class="set-group"><h2>Ilova haqida</h2><div class="set-row"><span class="grow">Chorva AI v' + CH.esc((window.CHORVA_CONFIG || {}).version || "") +
        "<small>" + CH.esc(CH.data.note) + "</small></span></div>" +
        "</div>";

      CH.$("#setProfile", page).addEventListener("submit", function (e) {
        e.preventDefault();
        var f = e.target.elements;
        CH.db.kvSet("profile", { name: f.name.value.trim(), farm: f.farm.value.trim(), region: f.region.value })
          .then(function () { CH.toast("Profil saqlandi ✓"); });
      });
      CH.$("#setTheme", page).addEventListener("change", function (e) {
        document.documentElement.setAttribute("data-theme", e.target.value);
        try { localStorage.setItem("chorva-theme", e.target.value); } catch (err) { /* e’tiborsiz */ }
      });
      var inst = CH.$("#btnInstall", page);
      if (inst) inst.addEventListener("click", function () {
        if (!installEvt) { CH.toast("Brauzer menyusidan “Ilovani o‘rnatish” yoki “Bosh ekranga qo‘shish”ni tanlang"); return; }
        installEvt.prompt();
        installEvt.userChoice.then(function () { installEvt = null; });
      });
      CH.$("#btnExport", page).addEventListener("click", function () {
        CH.db.exportAll().then(function (d) {
          CH.download("chorva-ai-zaxira-" + CH.todayISO() + ".json", JSON.stringify(d));
          CH.toast("Zaxira nusxa yuklab olindi");
        });
      });
      var fileIn = CH.$("#importFile", page);
      CH.$("#btnImport", page).addEventListener("click", function () { fileIn.click(); });
      fileIn.addEventListener("change", function () {
        var f = fileIn.files && fileIn.files[0];
        fileIn.value = "";
        if (!f) return;
        f.text().then(function (t) { return CH.db.importAll(JSON.parse(t)); })
          .then(function (n) { CH.toast(n + " ta hayvon tiklandi ✓"); render(); })
          .catch(function (e) { CH.toast("Tiklab bo‘lmadi: " + e.message, "err"); });
      });
      CH.$("#btnWipe", page).addEventListener("click", function () {
        if (!window.confirm("Barcha hayvonlar, yozuvlar va profil o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.")) return;
        CH.db.clearAll().then(function () { CH.toast("Barcha ma’lumotlar o‘chirildi"); location.hash = "#/"; location.reload(); });
      });

      CH.api("/api/health", { timeout: 15000 }).then(function (h) {
        var on = h.provider !== "demo";
        var name = h.provider === "anthropic" ? "Anthropic Claude" : h.provider === "gemini" ? "Google Gemini" : "";
        CH.$("#aiStatus", page).innerHTML = '<span class="status-dot' + (on ? " on" : "") + '"></span>' +
          (on ? "Ulangan: " + CH.esc(name) + "<small>Model: " + CH.esc(h.model) + "</small>"
            : "Demo rejim<small>Serverda ANTHROPIC_API_KEY yoki GEMINI_API_KEY o‘rnatilsa, haqiqiy AI tahlil yoqiladi (README’ga qarang).</small>");
      }).catch(function () {
        CH.$("#aiStatus", page).innerHTML = '<span class="status-dot"></span>Server bilan aloqa yo‘q<small>Katalog va hayvonlaringiz oflayn ishlaydi; skanerlash uchun internet kerak.</small>';
      });
    });
  }

  CH.settings = { render: render };
})();
