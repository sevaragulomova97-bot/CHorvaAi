/* C. "Mening hayvonlarim": ro‘yxatdan o‘tish, hayvon qo‘shish, oylik rasm tahlili va statistika */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});
  var charts = [];
  var REGIONS = ["Andijon viloyati", "Buxoro viloyati", "Farg‘ona viloyati", "Jizzax viloyati", "Xorazm viloyati",
    "Namangan viloyati", "Navoiy viloyati", "Qashqadaryo viloyati", "Qoraqalpog‘iston Respublikasi", "Samarqand viloyati",
    "Sirdaryo viloyati", "Surxondaryo viloyati", "Toshkent viloyati", "Toshkent shahri"];
  var SOURCE_TEXT = {
    tarozi: "⚖️ Tarozi", olcham: "📏 Lenta o‘lchovi", ai_foto: "🤖 AI foto-tahlil",
    prognoz: "📈 Me’yor bo‘yicha prognoz", boshlangich: "📝 Boshlang‘ich vazn", qolda: "✍️ Qo‘lda tuzatilgan"
  };

  function sp(a) { return CH.data.species[a.species]; }
  function br(a) { return CH.breedById[a.breed]; }
  function kgText(w) { return w == null ? "—" : CH.fmt(w, w < 10 ? 2 : 1) + " kg"; }

  function thumb(a) {
    return a.photo ? '<img src="' + a.photo + '" alt="">' : CH.breedArt(br(a), 330);
  }

  /* ---------- Statistika hisob-kitobi ---------- */
  function computeStats(a, recs) {
    var b = br(a), s = sp(a);
    var st = { count: recs.length };
    if (!recs.length) return st;
    var last = recs[recs.length - 1], first = recs[0];
    st.last = last; st.weight = last.weight;
    st.age = CH.growth.ageDays(a.birth);
    if (recs.length > 1) {
      var prev = recs[recs.length - 2];
      var d = CH.daysBetween(prev.date, last.date);
      st.change = last.weight - prev.weight;
      st.changeDays = d;
      st.lastAdg = d > 0 ? st.change * 1000 / d : null;
      var total = CH.daysBetween(first.date, last.date);
      if (total > 0) {
        st.totalGain = last.weight - first.weight;
        st.totalDays = total;
        st.avgAdg = st.totalGain * 1000 / total;
        st.changePct = first.weight ? st.totalGain / first.weight * 100 : 0;
      }
    }
    if (st.age != null) {
      var ageAtLast = CH.growth.ageDays(a.birth, last.date);
      st.normWeight = CH.growth.expectedWeight(b, a.sex, ageAtLast);
      st.normAdg = CH.growth.expectedAdg(b, a.sex, ageAtLast) * 1000;
      st.adult = CH.growth.isAdult(b, ageAtLast);
    }
    st.ration = CH.growth.ration(s, last.weight, a.count || 1);
    st.status = statusOf(st, b);
    return st;
  }

  function statusOf(st, b) {
    if (st.lastAdg == null) return { cls: "info", text: "Kunlik o‘sishni hisoblash uchun keyingi oyda yana vazn yoki rasm kiriting." };
    var adg = st.lastAdg;
    if (st.adult) {
      if (st.change / (st.weight - st.change) < -0.03) return { cls: "bad", text: "Vazn kamaymoqda. Katta yoshdagi hayvonda bu kasallik, gijja yoki ozuqa yetishmasligi belgisi bo‘lishi mumkin — veterinarga ko‘rsating." };
      return { cls: "ok", text: "Katta yoshdagi hayvon: vazn barqaror bo‘lishi me’yor. Sog‘in yoki tuxumdor bo‘lsa, mahsuldorlikni kuzating." };
    }
    var target = st.normAdg != null ? st.normAdg : (b.growth.adg[0] + b.growth.adg[1]) / 2;
    var lo = st.normAdg != null ? Math.min(target * 0.75, b.growth.adg[0]) : b.growth.adg[0];
    var hi = st.normAdg != null ? Math.max(target * 1.3, b.growth.adg[1]) : b.growth.adg[1] * 1.2;
    var range = "kutiladigan: " + CH.fmt(lo, 0) + "–" + CH.fmt(hi, 0) + " g/kun";
    if (adg < 0) return { cls: "bad", text: "Vazn kamaygan (" + CH.signed(adg, 0) + " g/kun). Ozuqa, suv, gijja va sog‘liqni zudlik bilan tekshiring." };
    if (adg < lo) return { cls: "bad", text: "Kunlik o‘sish me’yordan past (" + range + "). Ratsionni energiya va oqsilga boyiting, gijjaga qarshi ishlov o‘tkazing." };
    if (adg > hi) return { cls: "info", text: "Kunlik o‘sish yuqori (" + range + "). Bo‘rdoqi uchun a’lo; naslchilik uchun bo‘lsa, ortiqcha semirishni nazorat qiling." };
    return { cls: "ok", text: "Kunlik o‘sish me’yorida (" + range + "). Joriy ratsionni davom ettiring." };
  }

  /* Internet bo‘lmaganda ham ishlaydigan prognoz */
  function localPrognoz(a, recs, dateISO) {
    var b = br(a);
    var prev = recs.filter(function (r) { return r.date <= dateISO; }).slice(-1)[0];
    if (prev) {
      var days = CH.daysBetween(prev.date, dateISO);
      if (a.birth) return prev.weight + CH.growth.expectedGain(b, a.sex, CH.growth.ageDays(a.birth, prev.date), days);
      return prev.weight + (b.growth.adg[0] + b.growth.adg[1]) / 2 / 1000 * days;
    }
    if (a.birth) return CH.growth.expectedWeight(b, a.sex, CH.growth.ageDays(a.birth, dateISO));
    return null;
  }

  /* ---------- Ro‘yxat ---------- */
  function renderList() {
    var page = CH.$("#farmPage");
    Promise.all([CH.db.kvGet("profile"), CH.db.animals(), CH.db.allRecords()]).then(function (r) {
      var profile = r[0] || {}, animals = r[1], records = r[2];
      var byAnimal = {};
      records.forEach(function (x) { (byAnimal[x.animalId] = byAnimal[x.animalId] || []).push(x); });
      var total = 0, uy = 0, par = 0;
      animals.forEach(function (a) {
        var n = a.count || 1; total += n;
        if (sp(a).group === "uy") uy += n; else par += n;
      });
      var html = '<div class="greeting"><h1>Assalomu alaykum' + (profile.name ? ", " + CH.esc(profile.name) : "") + "! 👋</h1>" +
        "<p>" + (profile.farm ? CH.esc(profile.farm) + " · " : "") + (profile.region ? CH.esc(profile.region) : "Xo‘jaligingiz statistikasi") + "</p></div>" +
        '<div class="summary"><div><b>' + total + "</b><small>Jami bosh</small></div><div><b>" + uy +
        "</b><small>Uy hayvonlari</small></div><div><b>" + par + "</b><small>Parrandalar</small></div></div>" +
        '<div class="page-head"><h1>📋 Mening hayvonlarim</h1><button type="button" class="btn btn-primary btn-sm" id="btnAddAnimal">+ Yangi hayvon qo‘shish</button></div>';
      if (!animals.length) {
        html += '<div class="empty-state"><div class="big">🐄🐑🐔</div><h2>Hali hayvon qo‘shilmagan</h2>' +
          '<p class="muted">Hayvonlaringizni qo‘shing va har oy rasmga olib, o‘sishini kuzatib boring.</p>' +
          '<button type="button" class="btn btn-primary" id="btnAddEmpty">+ Birinchi hayvonni qo‘shish</button></div>';
      } else {
        html += '<div class="animal-list">' + animals.map(function (a) {
          var recs = (byAnimal[a.id] || []).sort(function (x, y) { return x.date.localeCompare(y.date); });
          var last = recs[recs.length - 1], prev = recs[recs.length - 2];
          var ch = last && prev ? last.weight - prev.weight : null;
          var age = CH.growth.ageDays(a.birth);
          return '<a class="animal-item" href="#/hayvon/' + encodeURIComponent(a.id) + '">' +
            '<div class="animal-thumb">' + thumb(a) + "</div>" +
            '<div class="animal-info"><b>' + CH.esc(a.name) + "</b><small>" + sp(a).emoji + " " + CH.esc(br(a).name) +
            (a.count > 1 ? " · " + a.count + " bosh" : "") + "</small><small>" + (age != null ? CH.growth.ageText(age) + " · " : "") +
            recs.length + " ta yozuv</small></div>" +
            '<div class="animal-w">' + (last ? kgText(last.weight) : "—") +
            (ch != null ? '<small class="' + (ch >= 0 ? "up" : "down") + '">' + CH.signed(ch, Math.abs(ch) < 10 ? 2 : 1) + " kg</small>" : "") +
            "</div></a>";
        }).join("") + "</div>";
      }
      page.innerHTML = html;
      var add = function () { openAddForm({}); };
      CH.$("#btnAddAnimal", page).addEventListener("click", add);
      var e = CH.$("#btnAddEmpty", page); if (e) e.addEventListener("click", add);
    });
  }

  /* ---------- Bitta hayvon sahifasi ---------- */
  function destroyCharts() { charts.forEach(function (c) { c.destroy(); }); charts = []; }

  function renderAnimal(id) {
    var page = CH.$("#animalPage");
    destroyCharts();
    Promise.all([CH.db.animal(id), CH.db.records(id)]).then(function (r) {
      var a = r[0], recs = r[1];
      if (!a) {
        page.innerHTML = '<div class="empty-state"><div class="big">🔍</div><h2>Hayvon topilmadi</h2><a class="btn btn-primary" href="#/mening">Mening hayvonlarim</a></div>';
        return;
      }
      var b = br(a), s = sp(a), st = computeStats(a, recs), chartHtml = "";
      var age = CH.growth.ageDays(a.birth);
      var html = '<div class="animal-grid"><div class="col-a">' +
        '<div class="animal-hero"><div class="animal-thumb">' + thumb(a) + "</div><div>" +
        "<h1>" + CH.esc(a.name) + "</h1>" +
        '<div class="muted small">' + s.emoji + " " + CH.esc(b.name) + " · " + CH.esc(s.name) + "</div>" +
        '<div class="muted small">' + (a.sex === "erkak" ? "♂ Erkak" : "♀ Urg‘ochi") + (age != null ? " · " + CH.growth.ageText(age) : "") +
        (a.count > 1 ? " · " + a.count + " bosh" : "") + "</div></div></div>" +
        '<button type="button" class="btn btn-primary btn-block" id="btnMonthly">📸 Oylik rasm yuklash va tahlil qilish</button>' +
        '<div class="btn-row" style="margin:.6rem 0 .9rem">' +
        '<button type="button" class="btn btn-outline btn-sm" id="btnBreedInfo">📚 Zot haqida</button>' +
        '<button type="button" class="btn btn-outline btn-sm" id="btnEdit">✏️ Tahrirlash</button>' +
        '<button type="button" class="btn btn-danger btn-sm" id="btnDelete">🗑 O‘chirish</button></div>';

      if (!recs.length) {
        html += '<div class="panel"><h2>📊 Statistika</h2><p class="muted">Hali vazn yozuvi yo‘q. “Oylik rasm yuklash va tahlil qilish” tugmasini bosib, birinchi o‘lchovni kiriting.</p></div>';
      } else {
        var dayUnit = st.weight < 10 ? 3 : 2;
        html += '<div class="panel"><h2>📊 Statistika</h2><div class="stat-grid">' +
          '<div class="stat"><b>' + kgText(st.weight) + "</b><small>Joriy vazn (" + CH.esc(CH.dateText(st.last.date)) + ")</small></div>" +
          '<div class="stat"><b class="' + (st.change >= 0 ? "up" : "down") + '">' + (st.change != null ? CH.signed(st.change, st.weight < 10 ? 2 : 1) + " kg" : "—") +
          "</b><small>Oxirgi o‘zgarish" + (st.changeDays ? " (" + st.changeDays + " kunda)" : "") + "</small></div>" +
          '<div class="stat"><b>' + (st.lastAdg != null ? CH.signed(st.lastAdg, 0) + " g" : "—") + "</b><small>Oxirgi davrdagi kunlik o‘sish</small></div>" +
          '<div class="stat"><b>' + (st.avgAdg != null ? CH.signed(st.avgAdg, 0) + " g" : "—") + "</b><small>O‘rtacha kunlik o‘sish" +
          (st.totalDays ? " (" + st.totalDays + " kun, " + CH.signed(st.changePct, 1) + "%)" : "") + "</small></div>" +
          (st.normWeight != null ? '<div class="stat"><b>' + kgText(st.normWeight) + "</b><small>Shu yoshdagi zot me’yori</small></div>" +
            '<div class="stat"><b>' + CH.fmt(st.normAdg, 0) + " g</b><small>Me’yoriy kunlik o‘sish</small></div>" : "") +
          '<div class="stat"><b>' + CH.fmt(st.ration.min, dayUnit) + "–" + CH.fmt(st.ration.max, dayUnit) + " kg</b><small>Kunlik quruq ozuqa" +
          (a.count > 1 ? " (" + a.count + " bosh uchun)" : "") + "</small></div>" +
          '<div class="stat"><b>' + CH.fmt(st.ration.min * 30, 0) + "–" + CH.fmt(st.ration.max * 30, 0) + " kg</b><small>Oylik ozuqa ehtiyoji</small></div>" +
          "</div>" +
          '<div class="callout ' + st.status.cls + '">' + CH.esc(st.status.text) + "</div>" +
          '<p class="muted small">Ozuqa miqdori tirik vaznning ' + CH.fmt(s.ration_pct[0]) + "–" + CH.fmt(s.ration_pct[1]) + " % i bo‘yicha hisoblangan taxminiy ko‘rsatkich.</p></div>";

        chartHtml = '<div class="panel"><h2>📈 O‘sish grafigi</h2><div class="chart-box"><canvas id="chWeight"></canvas></div>' +
          (recs.length > 1 ? '<h3>Kunlik o‘sish (g/kun)</h3><div class="chart-box short"><canvas id="chAdg"></canvas></div>'
            : '<p class="muted small">Kunlik o‘sish grafigi uchun kamida 2 ta yozuv kerak.</p>') + "</div>";
      }

      if (age != null) {
        html += '<div class="panel"><h2>💉 Yoshiga mos emlashlar</h2><div class="vax">' + s.vaccines.map(function (v) {
          var cls = v.from_d < age - 30 ? "done" : v.from_d <= age + 45 ? "soon" : "";
          var label = cls === "done" ? "✔" : cls === "soon" ? "⏰" : "📅";
          return '<div class="' + cls + '"><span>' + label + "</span><span><b>" + CH.esc(v.name) + "</b> — " + CH.esc(v.age) +
            "<br><small>" + CH.esc(v.note) + "</small></span></div>";
        }).join("") + '</div><p class="muted small">⏰ — yaqin 45 kun ichida; ✔ — yoshi o‘tgan (o‘tkazilganini tekshiring).</p></div>';
      }

      html += '</div><div class="col-b">' + chartHtml;
      html += '<div class="panel"><h2>🗂 Tarix</h2><div class="history">' + (recs.length ? recs.slice().reverse().map(function (x, i, arr) {
        var p = arr[i + 1];
        var diff = p ? x.weight - p.weight : null;
        return '<div class="hist-item">' + (x.photo ? '<img src="' + x.photo + '" alt="">' : '<span class="ph">' + s.emoji + "</span>") +
          '<div class="hist-main"><b>' + kgText(x.weight) + "</b>" +
          (diff != null ? ' <span class="small ' + (diff >= 0 ? "up" : "down") + '">' + CH.signed(diff, x.weight < 10 ? 2 : 1) + " kg</span>" : "") +
          "<small>" + CH.esc(CH.dateText(x.date)) + " · " + (SOURCE_TEXT[x.source] || "") +
          (x.bcs ? " · BCS " + CH.fmt(x.bcs, 1) : "") + "</small>" + (x.note ? "<small>" + CH.esc(x.note) + "</small>" : "") + "</div>" +
          '<button type="button" class="icon-btn" data-del="' + x.id + '" aria-label="Yozuvni o‘chirish">🗑</button></div>';
      }).join("") : '<p class="muted">Yozuvlar yo‘q.</p>') + "</div></div></div></div>";

      page.innerHTML = html;
      CH.$("#btnMonthly", page).addEventListener("click", function () { openRecordForm(a, recs); });
      CH.$("#btnBreedInfo", page).addEventListener("click", function () { CH.catalog.openBreed(a.breed); });
      CH.$("#btnEdit", page).addEventListener("click", function () { openAddForm({ edit: a }); });
      CH.$("#btnDelete", page).addEventListener("click", function () {
        if (!window.confirm("“" + a.name + "” va uning barcha yozuvlari o‘chirilsinmi?")) return;
        CH.db.deleteAnimal(a.id).then(function () { CH.toast("Hayvon o‘chirildi"); location.hash = "#/mening"; });
      });
      CH.$$("[data-del]", page).forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!window.confirm("Bu yozuv o‘chirilsinmi?")) return;
          CH.db.deleteRecord(btn.dataset.del).then(function () { CH.toast("Yozuv o‘chirildi"); renderAnimal(a.id); });
        });
      });
      if (recs.length) drawCharts(a, recs);
    });
  }

  function drawCharts(a, recs) {
    if (typeof Chart === "undefined") return;
    var b = br(a);
    var css = getComputedStyle(document.documentElement);
    Chart.defaults.color = css.getPropertyValue("--mu").trim() || "#5f7166";
    Chart.defaults.borderColor = css.getPropertyValue("--bd").trim() || "#e0e8e1";
    Chart.defaults.font.family = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    Chart.defaults.locale = "uz";
    var labels = recs.map(function (r) { return CH.shortDate(r.date) + (recs.length > 6 ? "" : "." + r.date.slice(2, 4)); });
    var datasets = [{
      label: "Vazn (kg)", data: recs.map(function (r) { return +r.weight.toFixed(3); }),
      borderColor: "#16874a", backgroundColor: "rgba(34,165,92,.18)", fill: true, tension: .3, pointRadius: 5, pointHoverRadius: 7
    }];
    if (a.birth) {
      datasets.push({
        label: "Zot me’yori", data: recs.map(function (r) { return +CH.growth.expectedWeight(b, a.sex, CH.growth.ageDays(a.birth, r.date)).toFixed(3); }),
        borderColor: "#f2a516", borderDash: [6, 5], pointRadius: 0, fill: false, tension: .3
      });
    }
    charts.push(new Chart(CH.$("#chWeight"), {
      type: "line", data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: datasets.length > 1 }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + CH.fmt(c.parsed.y) + " kg"; } } } },
        scales: { y: { title: { display: true, text: "kg" } } }
      }
    }));
    var el = CH.$("#chAdg");
    if (el) {
      var bars = [], bl = [];
      for (var i = 1; i < recs.length; i++) {
        var d = CH.daysBetween(recs[i - 1].date, recs[i].date);
        if (d > 0) { bars.push(Math.round((recs[i].weight - recs[i - 1].weight) * 1000 / d)); bl.push(CH.shortDate(recs[i - 1].date) + "→" + CH.shortDate(recs[i].date)); }
      }
      charts.push(new Chart(el, {
        type: "bar",
        data: { labels: bl, datasets: [{ label: "g/kun", data: bars, borderRadius: 8, backgroundColor: bars.map(function (v) { return v >= 0 ? "#22a55c" : "#d64545"; }) }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      }));
    }
  }

  /* ---------- Hayvon qo‘shish / tahrirlash formasi ---------- */
  function speciesOptions(selected) {
    return ["uy", "parranda"].map(function (g) {
      return '<optgroup label="' + CH.esc(CH.data.groups[g].name) + '">' + Object.keys(CH.data.species).filter(function (k) {
        return CH.data.species[k].group === g;
      }).map(function (k) {
        var s = CH.data.species[k];
        return '<option value="' + k + '"' + (k === selected ? " selected" : "") + ">" + s.emoji + " " + CH.esc(s.name) + "</option>";
      }).join("") + "</optgroup>";
    }).join("");
  }
  function breedOptions(speciesId, selected) {
    return CH.breedsOf(speciesId).map(function (b) {
      return '<option value="' + b.id + '"' + (b.id === selected ? " selected" : "") + ">" + CH.esc(b.name) + "</option>";
    }).join("");
  }

  function animalFormHtml(p) {
    var a = p.edit || {};
    var species = a.species || p.species || "qoramol";
    var breed = a.breed || p.breed || CH.breedsOf(species)[0].id;
    var photo = a.photo || p.photo || "";
    var weight = p.weight != null ? +(+p.weight).toFixed(p.weight < 10 ? 2 : 1) : "";
    return '<form class="form" id="animalForm" novalidate>' +
      '<label class="field"><span>Laqabi yoki raqami *</span><input name="name" maxlength="40" required placeholder="masalan: Oqbosh yoki №125" value="' + CH.esc(a.name || "") + '"></label>' +
      '<div class="grid2"><label class="field"><span>Turi *</span><select name="species">' + speciesOptions(species) + "</select></label>" +
      '<label class="field"><span>Zoti *</span><select name="breed">' + breedOptions(species, breed) + "</select></label></div>" +
      '<div class="field"><span>Jinsi</span><div class="radio-row">' +
      '<label><input type="radio" name="sex" value="urgochi"' + (a.sex !== "erkak" ? " checked" : "") + "> ♀ Urg‘ochi</label>" +
      '<label><input type="radio" name="sex" value="erkak"' + (a.sex === "erkak" ? " checked" : "") + "> ♂ Erkak</label></div></div>" +
      '<div class="grid2"><label class="field"><span>Tug‘ilgan sanasi</span><input type="date" name="birth" max="' + CH.todayISO() + '" value="' + CH.esc(a.birth || "") + '"></label>' +
      '<label class="field"><span>yoki taxminiy yoshi (oy)</span><input name="ageMonths" inputmode="numeric" placeholder="masalan: 8"></label></div>' +
      '<label class="field"><span id="countLabel">Bosh soni</span><input name="count" inputmode="numeric" value="' + (a.count || 1) + '"><span class="hint">Parrandalar yoki bir xil guruh uchun: o‘rtacha bitta bosh vazni kiritiladi, ozuqa butun guruhga hisoblanadi.</span></label>' +
      (p.edit ? "" : '<label class="field"><span>Boshlang‘ich vazni (kg)</span><input name="weight" inputmode="decimal" placeholder="ixtiyoriy" value="' + weight + '">' +
        (p.weight != null ? '<span class="hint">Skanerdan olingan taxminiy qiymat — tarozi yoki lenta bilan aniqlashtirish tavsiya etiladi.</span>' : "") + "</label>") +
      '<label class="photo-pick" id="photoPick">' + (photo ? '<img src="' + photo + '" alt="">' : '<span class="ph">📷</span>') +
      '<span><b>Rasm</b><br><small class="muted">Suratga olish yoki galereyadan tanlash</small></span>' +
      '<input type="file" name="photo" accept="image/*" capture="environment" hidden></label>' +
      '<button type="submit" class="btn btn-primary btn-block">' + (p.edit ? "💾 Saqlash" : "➕ Qo‘shish") + "</button></form>";
  }

  /* Formani jonlantirish; saqlanganda onSaved(animal) chaqiriladi */
  function bindAnimalForm(root, p, onSaved) {
    var form = CH.$("#animalForm", root);
    var photo = (p.edit && p.edit.photo) || p.photo || null;
    var spSel = form.elements.species, brSel = form.elements.breed;
    function updCount() {
      CH.$("#countLabel", form).textContent = CH.data.species[spSel.value].group === "parranda" ? "Bosh soni (to‘da bo‘lsa)" : "Bosh soni";
    }
    spSel.addEventListener("change", function () { brSel.innerHTML = breedOptions(spSel.value); updCount(); });
    updCount();
    var fileInput = form.elements.photo;
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      CH.compress(f, 720, 0.72).then(function (res) {
        photo = res.dataUrl;
        var pick = CH.$("#photoPick", form);
        var old = pick.querySelector("img, .ph");
        var img = document.createElement("img"); img.src = photo; img.alt = "";
        pick.replaceChild(img, old);
      }).catch(function (e) { CH.toast(e.message, "err"); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements;
      var name = f.name.value.trim();
      if (!name) { CH.toast("Laqab yoki raqamni kiriting", "err"); f.name.focus(); return; }
      var birth = f.birth.value || null;
      var months = CH.parseNum(f.ageMonths.value);
      if (!birth && months != null && months >= 0 && months < 400) {
        var d = new Date(Date.now() - months * 30.44 * 86400000);
        birth = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      }
      if (birth && birth > CH.todayISO()) { CH.toast("Tug‘ilgan sana kelajakda bo‘lishi mumkin emas", "err"); return; }
      var count = Math.max(1, Math.min(100000, parseInt(f.count.value, 10) || 1));
      var weight = f.weight ? CH.parseNum(f.weight.value) : null;
      if (weight != null && (weight < 0.005 || weight > 1500)) { CH.toast("Vazn 0,005 dan 1500 kg gacha bo‘lishi kerak", "err"); return; }
      var a = p.edit ? Object.assign({}, p.edit) : {};
      a.name = name; a.species = spSel.value; a.breed = brSel.value;
      a.sex = form.querySelector('input[name="sex"]:checked').value;
      a.birth = birth; a.count = count; a.photo = photo;
      CH.db.saveAnimal(a).then(function (saved) {
        if (weight == null) return saved;
        return CH.db.saveRecord({ animalId: saved.id, date: CH.todayISO(), weight: weight, source: p.source || "boshlangich", photo: p.photo || null })
          .then(function () { return saved; });
      }).then(function (saved) {
        CH.toast(p.edit ? "O‘zgarishlar saqlandi" : "“" + saved.name + "” qo‘shildi ✓");
        onSaved(saved);
      }).catch(function (err) { CH.toast("Saqlab bo‘lmadi: " + err.message, "err"); });
    });
  }

  function openAddForm(p) {
    p = p || {};
    var body = CH.sheet.open('<h2 id="sheetTitle">' + (p.edit ? "✏️ Ma’lumotlarni tahrirlash" : "➕ Yangi hayvon qo‘shish") + "</h2>" + animalFormHtml(p));
    bindAnimalForm(body, p, function (saved) {
      CH.sheet.closeAndGo("#/hayvon/" + encodeURIComponent(saved.id));
    });
  }

  /* ---------- Oylik rasm yuklash va tahlil qilish ---------- */
  function openRecordForm(a, recs) {
    var s = sp(a), girth = s.measure === "girth";
    var html = '<h2 id="sheetTitle">📸 Oylik rasm yuklash va tahlil</h2>' +
      '<p class="muted small">' + CH.esc(a.name) + " · " + CH.esc(br(a).name) + ". Rasm va (bo‘lsa) o‘lchovlarni kiriting — tizim yangi vaznni hisoblab, oldingi oylar bilan solishtiradi.</p>" +
      '<form class="form" id="recForm" novalidate>' +
      '<label class="field"><span>Sana</span><input type="date" name="date" max="' + CH.todayISO() + '" value="' + CH.todayISO() + '" required></label>' +
      '<label class="photo-pick" id="recPick"><span class="ph">📷</span><span><b>Hayvon rasmi</b><br><small class="muted">Yon tomondan, butun gavdasi ko‘rinadigan qilib oling</small></span>' +
      '<input type="file" name="photo" accept="image/*" capture="environment" hidden></label>' +
      (girth ? '<div class="grid2"><label class="field"><span>Ko‘krak aylanasi (sm)</span><input name="girth" inputmode="decimal" placeholder="masalan: 180"></label>' +
        '<label class="field"><span>Tana uzunligi (sm)</span><input name="tlen" inputmode="decimal" placeholder="masalan: 150"></label></div>' +
        '<p class="hint muted small">📏 Metr lenta bilan: ko‘krak aylanasi — kurak orqasidan, old oyoqlar ortidan aylantirib; uzunlik — yelka bo‘g‘imidan dumg‘aza (o‘tirg‘ich) suyagigacha.</p>' +
        '<div class="estimate-box" id="estBox" hidden>Lenta bo‘yicha vazn: <span id="estVal"></span></div>' : "") +
      '<label class="field"><span>Tarozidagi vazn (kg)</span><input name="weight" inputmode="decimal" placeholder="' + (girth ? "agar tarozi bo‘lsa" : "aniq natija uchun tarozida torting") + '"></label>' +
      '<label class="field"><span>Izoh</span><input name="note" maxlength="200" placeholder="masalan: yangi yem boshlandi"></label>' +
      '<div class="callout info small">Vazn tartibi: ⚖️ tarozi → 📏 lenta o‘lchovi → 🤖 rasm bo‘yicha AI tahlil → 📈 zot me’yori bo‘yicha prognoz.</div>' +
      '<button type="submit" class="btn btn-primary btn-block" id="recSubmit">🤖 Tahlil qilish</button></form>';
    var body = CH.sheet.open(html);
    var form = CH.$("#recForm", body);
    var photo = null;
    form.elements.photo.addEventListener("change", function () {
      var f = form.elements.photo.files && form.elements.photo.files[0];
      if (!f) return;
      Promise.all([CH.compress(f, 720, 0.72), CH.compress(f, 1024, 0.85)]).then(function (res) {
        photo = { small: res[0].dataUrl, blob: res[1].blob };
        var pick = CH.$("#recPick", form);
        var img = document.createElement("img"); img.src = photo.small; img.alt = "";
        pick.replaceChild(img, pick.querySelector("img, .ph"));
      }).catch(function (e) { CH.toast(e.message, "err"); });
    });
    if (girth) {
      var upd = function () {
        var w = CH.growth.formulaWeight(s, CH.parseNum(form.elements.girth.value), CH.parseNum(form.elements.tlen.value));
        var box = CH.$("#estBox", form);
        box.hidden = !(w > 1);
        if (w > 1) CH.$("#estVal", form).textContent = kgText(w);
      };
      form.elements.girth.addEventListener("input", upd);
      form.elements.tlen.addEventListener("input", upd);
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements, date = f.date.value;
      if (!date || date > CH.todayISO()) { CH.toast("Sana noto‘g‘ri (kelajak sana bo‘lishi mumkin emas)", "err"); return; }
      var scale = CH.parseNum(f.weight.value);
      var g = girth ? CH.parseNum(f.girth.value) : null, l = girth ? CH.parseNum(f.tlen.value) : null;
      if (scale != null && (scale < 0.005 || scale > 1500)) { CH.toast("Vazn 0,005–1500 kg oralig‘ida bo‘lsin", "err"); return; }
      if (g != null && (g < 20 || g > 320 || l == null || l < 20 || l > 280)) { CH.toast("Ko‘krak aylanasi va uzunlikni to‘g‘ri kiriting (sm)", "err"); return; }
      var prevRecs = recs.filter(function (r) { return r.date <= date; });
      var prev = prevRecs[prevRecs.length - 1];
      var base = { animalId: a.id, date: date, note: f.note.value.trim(), photo: photo ? photo.small : null, girth: g, length: l };
      var btn = CH.$("#recSubmit", form);

      if (scale != null) return showAnalysis(a, recs, Object.assign(base, { weight: scale, source: "tarozi" }), null);
      if (g != null && l != null) return showAnalysis(a, recs, Object.assign(base, { weight: CH.growth.formulaWeight(s, g, l), source: "olcham" }), null);
      if (photo) {
        btn.disabled = true; btn.textContent = "⏳ AI tahlil qilmoqda…";
        var fd = new FormData();
        fd.append("image", photo.blob, "oylik.jpg");
        fd.append("species", a.species); fd.append("breed", a.breed); fd.append("sex", a.sex || "");
        var age = CH.growth.ageDays(a.birth, date);
        if (age != null) fd.append("age_days", age);
        if (prev) { fd.append("prev_weight", prev.weight); fd.append("days_since_prev", Math.max(1, CH.daysBetween(prev.date, date))); }
        return CH.api("/api/scan", { method: "POST", body: fd, timeout: 75000 }).then(function (r) {
          if (!r.animal_found || r.weight_kg == null) {
            btn.disabled = false; btn.textContent = "🤖 Tahlil qilish";
            CH.toast(r.message || "Rasmdan vaznni aniqlab bo‘lmadi. O‘lcham yoki tarozi vaznini kiriting.", "err");
            return;
          }
          showAnalysis(a, recs, Object.assign(base, { weight: r.weight_kg, source: r.weight_method === "ai_foto" ? "ai_foto" : "prognoz", bcs: r.bcs }), r);
        }).catch(function (err) {
          var w = localPrognoz(a, recs, date);
          if (w == null) {
            btn.disabled = false; btn.textContent = "🤖 Tahlil qilish";
            CH.toast(err.message + " Vazn yoki o‘lchamni qo‘lda kiriting.", "err");
            return;
          }
          showAnalysis(a, recs, Object.assign(base, { weight: w, source: "prognoz" }), { note: "Internet yo‘q: vazn zot me’yori bo‘yicha prognoz qilindi. " + err.message });
        });
      }
      var pw = localPrognoz(a, recs, date);
      if (pw == null) { CH.toast("Rasm yuklang yoki vazn/o‘lchamni kiriting", "err"); return; }
      showAnalysis(a, recs, Object.assign(base, { weight: pw, source: "prognoz" }), { note: "O‘lchov kiritilmadi: vazn zot me’yori bo‘yicha prognoz qilindi." });
    });
  }

  function showAnalysis(a, recs, rec, ai) {
    var s = sp(a), b = br(a);
    var all = recs.concat([rec]).sort(function (x, y) { return x.date.localeCompare(y.date); });
    var idx = all.indexOf(rec), prev = all[idx - 1];
    var w = rec.weight;
    var html = '<h2 id="sheetTitle">📊 Tahlil natijasi</h2>' +
      '<div class="result-head"><div class="result-art">' + (rec.photo ? '<img src="' + rec.photo + '" alt="">' : CH.breedArt(b, 330)) + "</div><div>" +
      '<span class="badge ' + (rec.source === "ai_foto" ? "ai" : rec.source === "prognoz" ? "demo" : "src") + '">' + (SOURCE_TEXT[rec.source] || "") + "</span>" +
      "<h2>" + CH.esc(a.name) + "</h2><div class=\"muted small\">" + CH.esc(CH.dateText(rec.date)) + "</div></div></div>" +
      '<form class="form" id="saveForm"><label class="field"><span>Yangi vazn (kg) — kerak bo‘lsa tuzating</span>' +
      '<input name="weight" inputmode="decimal" value="' + CH.fmt(w, w < 10 ? 3 : 1).replace(/ /g, "") + '"></label></form>';
    var metrics = '<div class="metrics">';
    if (prev) {
      var d = CH.daysBetween(prev.date, rec.date), diff = w - prev.weight, adg = d > 0 ? diff * 1000 / d : null;
      metrics += '<div class="metric"><div class="v ' + (diff >= 0 ? "up" : "down") + '">' + CH.signed(diff, w < 10 ? 2 : 1) + ' <small>kg</small></div><div class="l">Oldingi o‘lchovdan (' + d + " kun)</div></div>" +
        '<div class="metric"><div class="v">' + (adg != null ? CH.signed(adg, 0) : "—") + ' <small>g/kun</small></div><div class="l">Kunlik o‘sish</div></div>';
    } else {
      metrics += '<div class="metric"><div class="v">' + kgText(w).replace(" kg", "") + ' <small>kg</small></div><div class="l">Birinchi yozuv</div></div>';
    }
    if (a.birth) {
      var age = CH.growth.ageDays(a.birth, rec.date);
      var norm = CH.growth.expectedWeight(b, a.sex, age);
      metrics += '<div class="metric"><div class="v">' + CH.fmt(norm, norm < 10 ? 2 : 0) + ' <small>kg</small></div><div class="l">Shu yoshdagi me’yor (' + CH.growth.ageText(age) + ")</div></div>" +
        '<div class="metric"><div class="v ' + (w >= norm * 0.9 ? "up" : "down") + '">' + CH.fmt(w / norm * 100, 0) + ' <small>%</small></div><div class="l">Me’yorga nisbatan</div></div>';
    }
    if (ai && ai.bcs != null) metrics += '<div class="metric"><div class="v">' + CH.fmt(ai.bcs, 1) + ' <small>/ 5</small></div><div class="l">Tana holati — ' + CH.esc(ai.bcs_text || "") + "</div></div>";
    var r = CH.growth.ration(s, w, a.count || 1);
    var u = w < 10 ? 3 : 2;
    metrics += '<div class="metric"><div class="v">' + CH.fmt(r.min, u) + "–" + CH.fmt(r.max, u) + ' <small>kg</small></div><div class="l">Kunlik quruq ozuqa' + (a.count > 1 ? " (" + a.count + " bosh)" : "") + "</div></div></div>";
    html += metrics;
    if (ai && ai.advice && ai.advice.length) html += "<h3>⚡ Tavsiyalar</h3><ul class=\"list\">" + ai.advice.map(function (t) { return "<li>" + CH.esc(t) + "</li>"; }).join("") + "</ul>";
    if (ai && ai.note) html += '<div class="callout">' + CH.esc(ai.note) + "</div>";
    if (rec.source === "prognoz") html += '<div class="callout">📈 Bu qiymat o‘lchov emas, zot me’yori bo‘yicha prognoz. Aniq natija uchun lenta yoki tarozi bilan o‘lchang.</div>';
    html += '<div class="btn-row"><button type="button" class="btn btn-primary" id="btnSaveRec">💾 Saqlash</button>' +
      '<button type="button" class="btn btn-outline" id="btnCancelRec">Bekor qilish</button></div>';
    var body = CH.sheet.open(html);
    CH.$("#btnCancelRec", body).addEventListener("click", function () { CH.sheet.close(); });
    CH.$("#btnSaveRec", body).addEventListener("click", function () {
      var nw = CH.parseNum(CH.$("#saveForm", body).elements.weight.value);
      if (nw == null || nw < 0.005 || nw > 1500) { CH.toast("Vaznni to‘g‘ri kiriting", "err"); return; }
      if (Math.abs(nw - rec.weight) > 0.0005 && rec.source !== "tarozi") rec.source = "qolda";
      rec.weight = nw;
      CH.db.saveRecord(rec).then(function () {
        if (rec.photo) { a.photo = rec.photo; return CH.db.saveAnimal(a); }
      }).then(function () {
        CH.toast("Yozuv saqlandi ✓");
        CH.sheet.close();
        renderAnimal(a.id);
      }).catch(function (err) { CH.toast("Saqlab bo‘lmadi: " + err.message, "err"); });
    });
  }

  /* ---------- Birinchi kirish: ro‘yxatdan o‘tish ---------- */
  function onboarding(done) {
    var html = '<div class="steps"><i class="on"></i><i></i></div>' +
      '<div class="welcome-art">🐄 🐑 🐔</div><h2 id="sheetTitle" style="text-align:center">Chorva AI ga xush kelibsiz!</h2>' +
      '<div class="feature-list"><div><b>📷</b>Hayvonni kameraga tuting — AI turini, zotini va taxminiy vaznini aniqlaydi</div>' +
      "<div><b>📚</b>20 dan ortiq zot: ratsion, semirtirish sirlari va emlash jadvali</div>" +
      "<div><b>📈</b>Har oy rasm yuklang — o‘sish grafigi va ozuqa statistikasi tayyor</div></div>" +
      '<form class="form" id="profileForm" novalidate>' +
      '<label class="field"><span>Ismingiz *</span><input name="name" maxlength="40" required placeholder="masalan: Akmal" autofocus></label>' +
      '<label class="field"><span>Xo‘jalik nomi</span><input name="farm" maxlength="60" placeholder="masalan: “Baraka” fermer xo‘jaligi"></label>' +
      '<label class="field"><span>Viloyat</span><select name="region"><option value="">Tanlang…</option>' +
      REGIONS.map(function (r) { return "<option>" + r + "</option>"; }).join("") + "</select></label>" +
      '<button type="submit" class="btn btn-primary btn-block">Davom etish →</button></form>' +
      '<p class="muted small" style="text-align:center">Ma’lumotlaringiz faqat shu qurilmada saqlanadi.</p>';
    var body = CH.sheet.open(html, { locked: true });
    CH.$("#profileForm", body).addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target.elements;
      if (!f.name.value.trim()) { CH.toast("Ismingizni kiriting", "err"); f.name.focus(); return; }
      CH.db.kvSet("profile", { name: f.name.value.trim(), farm: f.farm.value.trim(), region: f.region.value }).then(function () { step2([], done); });
    });
  }

  function step2(added, done) {
    var html = '<div class="steps"><i class="on"></i><i class="on"></i></div>' +
      '<h2 id="sheetTitle">Xo‘jaligingizdagi hayvonlar</h2>' +
      '<p class="muted small">Hayvonlaringizni hozir qo‘shishingiz yoki keyinroq “+ Yangi hayvon qo‘shish” tugmasi orqali kiritishingiz mumkin.</p>' +
      (added.length ? '<div class="added-list">' + added.map(function (n) { return '<span class="tag">✓ ' + CH.esc(n) + "</span>"; }).join("") + "</div>" : "") +
      animalFormHtml({}) +
      '<button type="button" class="btn btn-secondary btn-block" id="btnFinish" style="margin-top:.6rem">' + (added.length ? "Boshlash ✓" : "Keyinroq qo‘shaman →") + "</button>";
    var body = CH.sheet.open(html, { locked: true });
    bindAnimalForm(body, {}, function (saved) { step2(added.concat([saved.name]), done); });
    CH.$("#btnFinish", body).addEventListener("click", function () {
      CH.db.kvSet("onboarded", true).then(function () {
        CH.sheet.open("", {});
        CH.sheet.close();
        if (done) done();
      });
    });
  }

  CH.farm = { renderList: renderList, renderAnimal: renderAnimal, openAddForm: openAddForm, onboarding: onboarding, destroyCharts: destroyCharts };
})();
