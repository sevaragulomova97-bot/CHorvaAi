/* Hayvon va parrandalarning SVG illyustratsiyalari.
   Ranglar zot palitrasidan olinadi (data.json → breeds[].palette), shuning uchun
   har bir zot o‘z rangida chiziladi va internetsiz ham ko‘rinadi. */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});

  function shade(hex, pct) {
    var n = parseInt(hex.slice(1), 16);
    var r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  var uidN = 0;
  function eye(x, y, r, color) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (color || "#1b1410") + '"/>' +
      '<circle cx="' + (x - r * 0.35) + '" cy="' + (y - r * 0.35) + '" r="' + (r * 0.35) + '" fill="#fff"/>';
  }
  function shadow(cx, w) { return '<ellipse cx="' + cx + '" cy="163" rx="' + w + '" ry="9" fill="#000" opacity=".13"/>'; }
  function legs(xs, y, h, w, fill, hoof) {
    return xs.map(function (x) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (w / 2.2) + '" fill="' + fill + '"/>' +
        (hoof ? '<rect x="' + (x - 0.5) + '" y="' + (y + h - 7) + '" width="' + (w + 1) + '" height="8" rx="3" fill="' + hoof + '"/>' : "");
    }).join("");
  }
  function spots(id, list, color) {
    return '<g clip-path="url(#' + id + ')">' + list.map(function (s) {
      return '<ellipse cx="' + s[0] + '" cy="' + s[1] + '" rx="' + s[2] + '" ry="' + s[3] + '" fill="' + color + '"/>';
    }).join("") + "</g>";
  }

  var draw = {
    cow: function (p, id, opts) {
      var body = p.body, dark = shade(body, -18), spot = p.pattern === "spots";
      var head = spot && p.body !== "#f4f4f2" ? p.patch : body;
      var s = shadow(125, 78);
      s += legs([72, 94], 108, 50, 15, dark, "#2a2420") + legs([152, 174], 108, 50, 15, dark, "#2a2420");
      s += '<path d="M192 74 C206 86 206 112 202 128" stroke="' + body + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="202" cy="132" rx="5" ry="9" fill="' + (spot ? p.patch : dark) + '"/>';
      s += '<clipPath id="' + id + '"><rect x="58" y="58" width="140" height="66" rx="31"/></clipPath>';
      s += '<rect x="58" y="58" width="140" height="66" rx="31" fill="' + body + '"/>';
      if (spot) s += spots(id, [[98, 74, 24, 15], [152, 96, 27, 19], [128, 62, 13, 9], [186, 74, 12, 16], [80, 112, 15, 9], [118, 118, 12, 7]], p.patch);
      if (opts.udder) s += '<ellipse cx="160" cy="126" rx="15" ry="9" fill="' + p.accent + '"/><rect x="152" y="130" width="4" height="7" rx="2" fill="' + p.accent + '"/><rect x="163" y="130" width="4" height="7" rx="2" fill="' + p.accent + '"/>';
      s += '<path d="M52 60 Q62 52 80 58 L84 98 Q66 100 56 92 Z" fill="' + body + '"/>';
      s += '<path d="M46 46 C40 38 34 36 30 40" stroke="#e9dcc0" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M58 44 C62 36 68 34 72 37" stroke="#e9dcc0" stroke-width="5" fill="none" stroke-linecap="round"/>';
      s += '<ellipse cx="70" cy="54" rx="12" ry="6" fill="' + shade(head, -10) + '" transform="rotate(-18 70 54)"/>';
      s += '<rect x="22" y="44" width="46" height="44" rx="18" fill="' + head + '"/>';
      if (spot && head === body) s += '<ellipse cx="50" cy="52" rx="12" ry="9" fill="' + p.patch + '"/>';
      s += '<rect x="16" y="70" width="32" height="24" rx="11" fill="' + p.accent + '"/>' +
        '<circle cx="25" cy="81" r="2.6" fill="#5a3b36"/><circle cx="37" cy="81" r="2.6" fill="#5a3b36"/>';
      s += eye(40, 60, 3.6);
      return s;
    },

    sheep: function (p, id) {
      var body = p.body, head = p.patch, wool = shade(body, -10);
      var s = shadow(125, 70);
      s += legs([88, 106], 116, 42, 10, head, shade(head, -30)) + legs([148, 166], 116, 42, 10, head, shade(head, -30));
      if (p.tail === "fat") s += '<ellipse cx="184" cy="110" rx="17" ry="22" fill="' + shade(body, 8) + '" stroke="' + wool + '" stroke-width="2"/>';
      var puffs = [[82, 92], [98, 74], [122, 68], [148, 72], [170, 86], [172, 106], [150, 120], [122, 122], [96, 118], [80, 108]];
      s += '<ellipse cx="126" cy="96" rx="52" ry="30" fill="' + body + '"/>';
      s += puffs.map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="17" fill="' + body + '" stroke="' + wool + '" stroke-width="2"/>'; }).join("");
      s += '<ellipse cx="126" cy="96" rx="46" ry="25" fill="' + body + '"/>';
      s += '<ellipse cx="68" cy="80" rx="13" ry="6" fill="' + shade(head, -12) + '" transform="rotate(28 68 80)"/>';
      s += '<ellipse cx="56" cy="90" rx="22" ry="17" fill="' + head + '" transform="rotate(-18 56 90)"/>';
      s += '<circle cx="62" cy="78" r="10" fill="' + body + '" stroke="' + wool + '" stroke-width="2"/>';
      s += '<ellipse cx="38" cy="98" rx="3" ry="2" fill="' + shade(head, -40) + '"/>';
      s += eye(52, 86, 3.2);
      return s;
    },

    goat: function (p, id) {
      var body = p.body, dark = shade(body, -14), horn = "#cbb894";
      var s = shadow(128, 66);
      s += legs([86, 102], 108, 50, 10, dark, "#2a2420") + legs([152, 168], 108, 50, 10, dark, "#2a2420");
      s += '<path d="M178 68 L194 52 L186 72 Z" fill="' + body + '"/>';
      s += '<clipPath id="' + id + '"><rect x="74" y="64" width="114" height="52" rx="24"/></clipPath>';
      s += '<rect x="74" y="64" width="114" height="52" rx="24" fill="' + body + '"/>';
      if (p.pattern === "spots") s += spots(id, [[108, 82, 18, 12], [160, 98, 20, 13], [136, 70, 10, 8]], p.patch);
      s += '<path d="M80 74 L60 42 L84 36 L100 70 Z" fill="' + body + '"/>';
      s += '<path d="M66 32 C70 18 84 12 94 18" stroke="' + horn + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
      s += '<ellipse cx="80" cy="42" rx="12" ry="5" fill="' + dark + '" transform="rotate(24 80 42)"/>';
      s += '<ellipse cx="58" cy="44" rx="18" ry="13" fill="' + body + '" transform="rotate(-24 58 44)"/>';
      s += '<ellipse cx="44" cy="54" rx="10" ry="8" fill="' + shade(body, -6) + '"/>';
      s += '<path d="M46 58 L42 78 L54 62 Z" fill="' + shade(body, -28) + '"/>';
      s += '<ellipse cx="38" cy="54" rx="2.4" ry="1.6" fill="#3a2a25"/>';
      s += eye(56, 40, 3.2);
      return s;
    },

    horse: function (p, id) {
      var body = p.body, mane = p.patch, dark = shade(body, -12);
      var s = shadow(130, 76);
      s += legs([80, 98], 98, 60, 12, dark, "#231a14") + legs([158, 176], 98, 60, 12, dark, "#231a14");
      s += '<path d="M186 80 C206 92 206 124 196 146 C190 124 186 104 180 90 Z" fill="' + mane + '"/>';
      s += '<ellipse cx="130" cy="88" rx="62" ry="30" fill="' + body + '"/>';
      s += '<path d="M84 84 C74 60 72 42 80 26 L106 34 C104 52 106 66 116 78 Z" fill="' + body + '"/>';
      s += '<path d="M82 26 C70 24 52 40 42 58 C40 66 48 70 56 66 C64 58 76 52 94 44 Z" fill="' + body + '"/>';
      s += '<ellipse cx="48" cy="62" rx="9" ry="7" fill="' + shade(body, -22) + '"/>';
      s += '<path d="M84 26 L88 10 L94 26 Z" fill="' + dark + '"/>';
      s += '<path d="M80 24 C98 26 108 48 116 74 L106 78 C100 58 92 40 78 32 Z" fill="' + mane + '"/>';
      s += '<ellipse cx="44" cy="62" rx="2.2" ry="1.6" fill="#1a120c"/>';
      s += eye(70, 40, 3.4);
      return s;
    },

    rabbit: function (p, id) {
      var body = p.body, pts = p.pattern === "points", earFill = pts ? p.patch : body;
      var white = parseInt(body.slice(1, 3), 16) > 230;
      var s = shadow(126, 66);
      s += '<ellipse cx="132" cy="118" rx="54" ry="40" fill="' + body + '"/>';
      s += '<ellipse cx="154" cy="128" rx="30" ry="26" fill="' + shade(body, -5) + '"/>';
      s += '<circle cx="186" cy="108" r="10" fill="#fff"/>';
      s += '<ellipse cx="160" cy="154" rx="20" ry="7" fill="' + (pts ? p.patch : shade(body, -10)) + '"/>';
      s += '<ellipse cx="94" cy="56" rx="10" ry="30" fill="' + earFill + '" transform="rotate(14 94 56)"/>';
      s += '<ellipse cx="76" cy="58" rx="9" ry="28" fill="' + earFill + '" transform="rotate(-12 76 58)"/>';
      if (!pts) s += '<ellipse cx="94" cy="58" rx="5" ry="22" fill="' + p.accent + '" transform="rotate(14 94 58)"/>' +
        '<ellipse cx="76" cy="60" rx="4.5" ry="20" fill="' + p.accent + '" transform="rotate(-12 76 60)"/>';
      s += '<circle cx="82" cy="98" r="27" fill="' + body + '"/>';
      s += '<ellipse cx="58" cy="104" rx="6" ry="5" fill="' + (pts ? p.patch : p.accent) + '"/>';
      s += '<ellipse cx="94" cy="154" rx="13" ry="6" fill="' + (pts ? p.patch : shade(body, -8)) + '"/>';
      s += eye(74, 94, 4, white && !pts ? "#c0394b" : "#1b1410");
      return s;
    },

    chicken: function (p, id, opts) {
      var body = p.body, comb = p.accent, beak = "#e8aa35";
      var s = shadow(122, 50);
      s += '<path d="M112 130 L108 156 M128 130 L130 156" stroke="' + beak + '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M100 157 L116 157 M122 157 L138 157" stroke="' + beak + '" stroke-width="4" stroke-linecap="round"/>';
      s += '<path d="M148 92 C164 58 184 52 192 64 C186 74 176 90 160 110 Z" fill="' + (p.pattern === "spots" ? "#1d2a22" : shade(body, -10)) + '"/>';
      s += '<clipPath id="' + id + '"><ellipse cx="122" cy="104" rx="46" ry="34"/></clipPath>';
      s += '<ellipse cx="122" cy="104" rx="46" ry="34" fill="' + body + '"/>';
      if (p.pattern === "spots") s += spots(id, [[110, 90, 9, 6], [138, 112, 11, 7], [124, 126, 8, 5], [150, 94, 7, 5], [100, 116, 7, 5]], p.patch);
      s += '<ellipse cx="130" cy="102" rx="25" ry="16" fill="' + shade(body, -14) + '" transform="rotate(-10 130 102)"/>';
      s += '<circle cx="84" cy="72" r="21" fill="' + body + '"/>';
      s += '<path d="M70 56 q3 -14 9 -3 q4 -14 9 -3 q5 -12 9 1 Z" fill="' + comb + '"/>';
      s += '<path d="M64 70 L52 76 L65 80 Z" fill="' + beak + '"/>';
      s += '<ellipse cx="68" cy="88" rx="5" ry="8" fill="' + comb + '"/>';
      s += eye(78, 68, 3.2);
      if (opts.chick) s += "";
      return s;
    },

    turkey: function (p, id) {
      var body = p.body, f2 = shade(body, -12), red = p.accent;
      var s = shadow(128, 58);
      var fan = "";
      for (var i = -4; i <= 4; i++) {
        fan += '<ellipse cx="146" cy="66" rx="11" ry="40" fill="' + (i % 2 ? f2 : body) + '" stroke="' + shade(body, -22) + '" stroke-width="1.5" transform="rotate(' + (i * 15) + ' 146 106)"/>';
      }
      s += fan;
      s += '<path d="M116 136 L112 158 M134 136 L136 158" stroke="#d99a8a" stroke-width="5" stroke-linecap="round"/>';
      s += '<ellipse cx="128" cy="110" rx="46" ry="36" fill="' + body + '"/>';
      s += '<ellipse cx="136" cy="108" rx="26" ry="18" fill="' + f2 + '" transform="rotate(-12 136 108)"/>';
      s += '<path d="M98 100 C88 82 86 66 86 56 L98 56 C100 72 106 86 112 96 Z" fill="#efd4cc"/>';
      s += '<circle cx="90" cy="50" r="12" fill="#d8e6f2"/>';
      s += '<path d="M80 50 L70 54 L80 57 Z" fill="#e0b25a"/>';
      s += '<path d="M82 44 C76 46 74 56 76 66" stroke="' + red + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
      s += '<ellipse cx="88" cy="66" rx="5" ry="9" fill="' + red + '"/>';
      s += eye(90, 47, 2.8);
      return s;
    },

    duck: function (p, id) {
      var body = p.body, bill = p.accent;
      var s = shadow(128, 62);
      s += '<path d="M110 132 L108 152 M132 132 L134 152" stroke="' + bill + '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M98 154 L116 154 M124 154 L142 154" stroke="' + bill + '" stroke-width="5" stroke-linecap="round"/>';
      s += '<path d="M70 106 C70 86 100 80 130 84 C160 86 182 80 196 68 C198 94 188 122 150 130 C110 136 72 128 70 106 Z" fill="' + body + '"/>';
      s += '<ellipse cx="140" cy="102" rx="34" ry="14" fill="' + shade(body, -9) + '" transform="rotate(-8 140 102)"/>';
      s += '<path d="M86 98 C80 80 78 64 82 52 L108 50 C110 62 104 74 106 94 Z" fill="' + body + '"/>';
      s += '<circle cx="96" cy="48" r="18" fill="' + body + '"/>';
      s += '<path d="M82 50 C70 50 58 54 56 60 C66 64 78 62 86 58 Z" fill="' + bill + '"/>';
      s += eye(94, 43, 3);
      return s;
    },

    goose: function (p, id) {
      var body = p.body, belly = p.patch, bill = p.accent;
      var s = shadow(130, 62);
      s += '<path d="M116 136 L114 156 M140 136 L142 156" stroke="' + bill + '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M104 158 L122 158 M132 158 L150 158" stroke="' + bill + '" stroke-width="5" stroke-linecap="round"/>';
      s += '<path d="M178 96 L198 88 L186 108 Z" fill="' + shade(body, -10) + '"/>';
      s += '<clipPath id="' + id + '"><ellipse cx="134" cy="110" rx="54" ry="32"/></clipPath>';
      s += '<ellipse cx="134" cy="110" rx="54" ry="32" fill="' + body + '"/>';
      s += '<g clip-path="url(#' + id + ')"><ellipse cx="128" cy="134" rx="56" ry="18" fill="' + belly + '"/></g>';
      s += '<ellipse cx="146" cy="104" rx="32" ry="15" fill="' + shade(body, -12) + '" transform="rotate(-6 146 104)"/>';
      s += '<path d="M92 104 C84 82 80 54 84 34 L102 34 C100 54 102 80 112 98 Z" fill="' + body + '"/>';
      s += '<path d="M92 104 C86 86 84 70 86 56 L94 56 C94 72 98 88 106 100 Z" fill="' + belly + '" opacity=".75"/>';
      s += '<ellipse cx="92" cy="32" rx="16" ry="13" fill="' + body + '"/>';
      s += '<path d="M78 30 L56 38 L78 42 Z" fill="' + bill + '"/><circle cx="78" cy="29" r="4.5" fill="' + bill + '"/>';
      s += eye(92, 28, 3);
      return s;
    },

    quail: function (p, id) {
      var body = p.body, sp = p.patch;
      var s = shadow(122, 46);
      s += '<path d="M112 136 L110 154 M128 136 L130 154" stroke="#d6a07a" stroke-width="4" stroke-linecap="round"/>';
      s += '<path d="M156 100 L176 94 L162 112 Z" fill="' + shade(body, -15) + '"/>';
      s += '<clipPath id="' + id + '"><ellipse cx="122" cy="112" rx="44" ry="32"/></clipPath>';
      s += '<ellipse cx="122" cy="112" rx="44" ry="32" fill="' + body + '"/>';
      var dots = [];
      for (var i = 0; i < 26; i++) dots.push([84 + (i * 37) % 80, 86 + (i * 23) % 52, 3 + (i % 3), 1.6 + (i % 2)]);
      s += spots(id, dots, sp);
      s += '<path d="M90 104 C110 98 132 98 156 106" stroke="#e8d3b4" stroke-width="3" fill="none" opacity=".8"/>';
      s += '<circle cx="84" cy="92" r="17" fill="' + body + '"/>';
      s += '<path d="M72 86 C80 80 92 80 98 86" stroke="#efe1c8" stroke-width="3" fill="none"/>';
      s += '<path d="M68 94 L60 97 L69 100 Z" fill="#4a3628"/>';
      s += eye(78, 90, 2.8);
      return s;
    }
  };

  /* Zot uchun SVG satrini qaytaradi */
  CH.illus = function (breedOrId, extra) {
    var breed = typeof breedOrId === "string" ? CH.breedById[breedOrId] : breedOrId;
    if (!breed) return "";
    var sp = CH.data.species[breed.species];
    var id = "cl" + (++uidN);
    var opts = { udder: breed.species === "qoramol" && breed.direction.indexOf("sut") >= 0 };
    var inner = (draw[sp.illus] || draw.cow)(breed.palette, id, opts);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" role="img" aria-label="' +
      CH.esc(breed.name) + '"' + (extra || "") + ">" + inner + "</svg>";
  };

  /* ---- Real fotosuratlar (Wikimedia Commons, erkin litsenziya) ----
     Rasm internet orqali yuklanadi; yuklanmasa (oflayn) ostidagi SVG ko‘rinib qoladi. */
  CH.photosOn = function () {
    try { return localStorage.getItem("chorva-photos") !== "off"; } catch (e) { return true; }
  };
  CH.photoUrl = function (breed, width) {
    if (!breed || !breed.photo || !breed.photo.file) return "";
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" +
      encodeURIComponent(breed.photo.file.replace(/ /g, "_")) + "?width=" + (width || 500);
  };
  CH.photoPage = function (breed) {
    return "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(breed.photo.file.replace(/ /g, "_"));
  };
  CH.photoCredit = function (breed) {
    if (!breed || !breed.photo) return "";
    var p = breed.photo;
    return '<a class="credit" href="' + CH.photoPage(breed) + '" target="_blank" rel="noopener">📷 ' +
      (p.caption ? CH.esc(p.caption) + " · " : "") + (p.author ? CH.esc(p.author) + " · " : "") +
      (p.license ? CH.esc(p.license) + " · " : "") + "Wikimedia Commons</a>";
  };
  /* Kartochka/sarlavha uchun: SVG + ustida real foto */
  CH.breedArt = function (breedOrId, width) {
    var breed = typeof breedOrId === "string" ? CH.breedById[breedOrId] : breedOrId;
    if (!breed) return "";
    var img = CH.photosOn() && breed.photo
      ? '<img class="photo" src="' + CH.photoUrl(breed, width) + '" alt="' + CH.esc(breed.name) +
        '" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
      : "";
    return '<div class="art-wrap">' + CH.illus(breed) + img + "</div>";
  };
  /* Rasm yuklanmasa — olib tashlanadi, SVG ko‘rinadi */
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.classList.contains("photo")) t.remove();
  }, true);
  document.addEventListener("load", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.classList.contains("photo")) t.classList.add("loaded");
  }, true);

  /* Demo rejim uchun: illyustratsiyani dala fonida canvasga chizadi */
  CH.illusToCanvas = function (breedId, width, height) {
    width = width || 960; height = height || 720;
    var svg = CH.illus(breedId);
    var c = document.createElement("canvas");
    c.width = width; c.height = height;
    var ctx = c.getContext("2d");
    var sky = ctx.createLinearGradient(0, 0, 0, height * 0.62);
    sky.addColorStop(0, "#8fc6f2"); sky.addColorStop(1, "#d6ecfb");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    var grass = ctx.createLinearGradient(0, height * 0.55, 0, height);
    grass.addColorStop(0, "#7cbf5a"); grass.addColorStop(1, "#4d9a3c");
    ctx.fillStyle = grass; ctx.fillRect(0, height * 0.58, width, height * 0.42);
    var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    return CH.loadImage(url).then(function (img) {
      var w = width * 0.8, h = w * 0.75;
      ctx.drawImage(img, (width - w) / 2, height * 0.62 - h * 0.6, w, h);
      URL.revokeObjectURL(url);
      return c;
    });
  };
})();
