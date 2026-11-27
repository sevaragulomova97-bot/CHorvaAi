/* B. "Uy hayvonlari" va "Parrandalar" katalogi + zot tafsilotlari (4 bo‘lim) */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});
  var st = { group: "uy", species: "all", q: "" };

  function bind() {
    CH.$("#catalogSearch").addEventListener("input", function (e) { st.q = e.target.value.trim().toLowerCase(); renderGrid(); });
    CH.$("#speciesChips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-species]");
      if (!b) return;
      st.species = b.dataset.species;
      renderChips(); renderGrid();
    });
    CH.$("#catalogGrid").addEventListener("click", function (e) {
      var c = e.target.closest("[data-breed]");
      if (c) openBreed(c.dataset.breed);
    });
  }

  function render(group) {
    if (group !== st.group) { st.species = "all"; }
    st.group = group === "parranda" ? "parranda" : "uy";
    CH.$$(".seg-btn").forEach(function (a) { a.classList.toggle("active", a.dataset.group === st.group); });
    renderChips(); renderGrid();
  }

  function speciesOfGroup() {
    return Object.keys(CH.data.species).filter(function (k) { return CH.data.species[k].group === st.group; });
  }

  function renderChips() {
    var html = '<button type="button" class="chip' + (st.species === "all" ? " active" : "") + '" data-species="all">Barchasi</button>';
    speciesOfGroup().forEach(function (k) {
      var s = CH.data.species[k];
      html += '<button type="button" class="chip' + (st.species === k ? " active" : "") + '" data-species="' + k + '">' + s.emoji + " " + CH.esc(s.name) + "</button>";
    });
    CH.$("#speciesChips").innerHTML = html;
  }

  function renderGrid() {
    var list = CH.data.breeds.filter(function (b) {
      var sp = CH.data.species[b.species];
      if (sp.group !== st.group) return false;
      if (st.species !== "all" && b.species !== st.species) return false;
      if (st.q && (b.name + " " + sp.name + " " + b.direction.join(" ")).toLowerCase().indexOf(st.q) < 0) return false;
      return true;
    });
    CH.$("#catalogGrid").innerHTML = list.map(function (b) {
      var sp = CH.data.species[b.species];
      return '<button type="button" class="card" data-breed="' + b.id + '">' +
        '<div class="card-art">' + CH.breedArt(b, 500) + "</div>" +
        '<div class="card-body"><div class="card-title">' + CH.esc(b.name) + "</div>" +
        '<div class="card-sub">' + sp.emoji + " " + CH.esc(sp.name) + "</div>" + CH.dirTags(b.direction) + "</div></button>";
    }).join("");
    CH.$("#catalogEmpty").hidden = list.length > 0;
  }

  /* ---------- Zot tafsilotlari ---------- */
  function adgText(b) {
    var a = b.growth.adg;
    return a[0] >= 1000 ? CH.fmt(a[0] / 1000, 1) + "–" + CH.fmt(a[1] / 1000, 1) + " kg" : a[0] + "–" + a[1] + " g";
  }

  function tabGeneral(b, sp) {
    var g = b.general;
    return "<p>" + CH.esc(b.summary) + "</p>" +
      '<div class="stat-grid">' +
      '<div class="stat"><b>' + CH.esc(g.weight_f) + "</b><small>Urg‘ochisining vazni</small></div>" +
      '<div class="stat"><b>' + CH.esc(g.weight_m) + "</b><small>Erkagining vazni</small></div>" +
      '<div class="stat"><b>' + CH.esc(g.height) + "</b><small>" + CH.esc(sp.size_label) + "</small></div>" +
      '<div class="stat"><b>' + adgText(b) + "</b><small>Kunlik o‘sish (yosh davrida)</small></div>" +
      "</div><h3>🥛 Mahsuldorligi</h3>" + list(g.productivity) +
      "<h3>⭐ Xususiyatlari</h3>" + list(g.features) +
      '<div class="callout info">🌍 Kelib chiqishi: ' + CH.esc(b.origin) + "</div>";
  }

  function tabRation(b, sp) {
    var r = sp.ration;
    return "<p>" + CH.esc(r.intro) + "</p><h3>🌾 Nimalar bilan boqiladi</h3>" + list(r.items) +
      "<h3>⚖️ " + CH.esc(r.daily_title) + "</h3>" +
      '<table class="table"><thead><tr><th>Ozuqa</th><th>Miqdori</th></tr></thead><tbody>' +
      r.daily.map(function (row) { return "<tr><td>" + CH.esc(row[0]) + "</td><td><b>" + CH.esc(row[1]) + "</b></td></tr>"; }).join("") +
      "</tbody></table>" +
      '<div class="callout">💡 Kunlik quruq ozuqa ehtiyoji taxminan tirik vaznning ' + CH.fmt(sp.ration_pct[0]) + "–" + CH.fmt(sp.ration_pct[1]) +
      " foizini tashkil qiladi. “Mening hayvonlarim” bo‘limida bu sizning hayvoningiz vazni bo‘yicha avtomatik hisoblanadi.</div>";
  }

  function tabFattening(b, sp) {
    var f = sp.fattening;
    return "<p>" + CH.esc(f.intro) + "</p><h3>📈 Bo‘rdoqiga boqish texnologiyasi</h3>" + list(f.steps, true) +
      (b.tip ? '<div class="callout ok">⭐ ' + CH.esc(b.name) + ": " + CH.esc(b.tip) + "</div>" : "") +
      "<h3>🧪 Qo‘shimcha ozuqalar</h3>" + list(f.supplements) +
      (f.warning ? '<div class="callout bad">⚠️ ' + CH.esc(f.warning) + "</div>" : "");
  }

  function tabVaccines(b, sp) {
    return '<p>Quyidagi jadval O‘zbekiston sharoitida keng qo‘llanadigan profilaktik tadbirlar asosida tuzilgan.</p>' +
      '<table class="table"><thead><tr><th>Yoshi</th><th>Vaksina / tadbir</th><th>Izoh</th></tr></thead><tbody>' +
      sp.vaccines.map(function (v) {
        return "<tr><td>" + CH.esc(v.age) + "</td><td><b>" + CH.esc(v.name) + "</b></td><td>" + CH.esc(v.note) + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<div class="callout">💉 Emlash jadvali hududning epizootik holatiga qarab o‘zgaradi. Vaksinani faqat veterinar qilsin va emlash daftariga qayd ettiring. Majburiy emlashlar (kuydirgi, oqsil va boshqalar) tuman veterinariya bo‘limi tomonidan o‘tkaziladi.</div>';
  }

  function list(items, numbered) {
    return '<ul class="list' + (numbered ? " num" : "") + '">' + (items || []).map(function (t) { return "<li>" + CH.esc(t) + "</li>"; }).join("") + "</ul>";
  }

  function sourcesHtml(sp) {
    var keys = ["fao", "merck", "woah"];
    if (sp.group === "parranda") keys.push(sp.illus === "turkey" ? "aviagent" : "aviagen");
    if (sp.illus === "chicken") keys.push("lohmann");
    keys.push("uzvet");
    return '<div class="sources"><b>Manbalar:</b> ' + keys.map(function (k) {
      var s = CH.data.sources[k];
      return s.url ? '<a href="' + s.url + '" target="_blank" rel="noopener">' + CH.esc(s.name) + "</a>" : CH.esc(s.name);
    }).join(" · ") + "<br><small>" + CH.esc(CH.data.note) + "</small></div>";
  }

  var TABS = [
    { id: "umumiy", icon: "📋", name: "Umumiy", fn: tabGeneral },
    { id: "ratsion", icon: "🌾", name: "Ratsion", fn: tabRation },
    { id: "semirtirish", icon: "📈", name: "Semirtirish", fn: tabFattening },
    { id: "emlash", icon: "💉", name: "Emlash", fn: tabVaccines }
  ];

  function openBreed(id, tabId) {
    var b = CH.breedById[id];
    if (!b) return;
    var sp = CH.data.species[b.species];
    var html = '<div class="breed-hero">' + CH.breedArt(b, 960) +
      '<h2 id="sheetTitle">' + CH.esc(b.name) + "</h2>" +
      '<div class="muted small">' + sp.emoji + " " + CH.esc(sp.name) + " · " + CH.esc(CH.data.groups[sp.group].name) + "</div>" +
      CH.dirTags(b.direction) + (b.photo && b.photo.caption && b.photo.local ? '<span class="credit">📷 ' + CH.esc(b.photo.caption) + "</span>" : "") +
      (CH.photosOn() ? CH.photoCredit(b) : "") + "</div>" +
      '<div class="tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" class="tab" role="tab" data-tab="' + t.id + '"><span>' + t.icon + "</span>" + t.name + "</button>";
      }).join("") + "</div>" +
      '<div class="tab-panel" id="tabPanel" role="tabpanel"></div>' + sourcesHtml(sp) +
      '<div class="btn-row" style="margin-top:.8rem"><button type="button" class="btn btn-primary" id="btnAddBreed">➕ Mening hayvonlarimga qo‘shish</button></div>';
    var body = CH.sheet.open(html, { full: true });
    function show(tid) {
      var t = TABS.filter(function (x) { return x.id === tid; })[0] || TABS[0];
      CH.$$(".tab", body).forEach(function (x) {
        var on = x.dataset.tab === t.id;
        x.classList.toggle("active", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      CH.$("#tabPanel", body).innerHTML = t.fn(b, sp);
    }
    CH.$$(".tab", body).forEach(function (x) { x.addEventListener("click", function () { show(x.dataset.tab); }); });
    CH.$("#btnAddBreed", body).addEventListener("click", function () {
      CH.farm.openAddForm({ species: b.species, breed: b.id });
    });
    show(tabId || "umumiy");
  }

  CH.catalog = { bind: bind, render: render, openBreed: openBreed };
})();
