/* O‘sish modeli va hisob-kitoblar (backenddagi app.py bilan bir xil formulalar) */
(function () {
  "use strict";
  var CH = (window.CH = window.CH || {});

  /* Gompertz egri chizig‘i: W(t) = A·exp(−b·exp(−k·t)) */
  function params(breed, sex) {
    var g = breed.growth;
    var adult = sex === "erkak" ? g.adult_m : g.adult_f;
    var frac = g.curve_frac || 0.9;
    var A = adult / frac;
    var b = Math.log(A / g.birth);
    var k = Math.log(b / -Math.log(frac)) / g.maturity_d;
    return { A: A, b: b, k: k };
  }

  CH.growth = {
    /* Shu yoshdagi kutiladigan (me’yoriy) vazn, kg */
    expectedWeight: function (breed, sex, ageDays) {
      var p = params(breed, sex);
      return p.A * Math.exp(-p.b * Math.exp(-p.k * Math.max(0, ageDays)));
    },
    /* Shu yoshdagi kutiladigan kunlik o‘sish, kg/kun */
    expectedAdg: function (breed, sex, ageDays) {
      var p = params(breed, sex);
      var w = CH.growth.expectedWeight(breed, sex, ageDays);
      return w * p.b * p.k * Math.exp(-p.k * Math.max(0, ageDays));
    },
    /* Ikki sana orasida kutiladigan o‘sish (kg) */
    expectedGain: function (breed, sex, ageStart, days) {
      return CH.growth.expectedWeight(breed, sex, ageStart + days) - CH.growth.expectedWeight(breed, sex, ageStart);
    },
    /* Lenta o‘lchovi bo‘yicha vazn (Shefer formulasi): kg = aylana² × uzunlik / bo‘luvchi */
    formulaWeight: function (species, girthCm, lengthCm) {
      if (!species || species.measure !== "girth" || !girthCm || !lengthCm) return null;
      return girthCm * girthCm * lengthCm / species.divisor;
    },
    ageDays: function (birthISO, onISO) {
      if (!birthISO) return null;
      var d = CH.daysBetween(birthISO, onISO || CH.todayISO());
      return d != null && d >= 0 ? d : null;
    },
    ageText: function (days) {
      if (days == null) return "";
      if (days < 31) return days + " kunlik";
      var months = Math.floor(days / 30.44);
      var y = Math.floor(months / 12), m = months % 12;
      if (y === 0) return m + " oylik";
      return y + " yosh" + (m ? " " + m + " oy" : "");
    },
    /* Kunlik quruq ozuqa ehtiyoji (kg) */
    ration: function (species, weight, count) {
      var pct = species.ration_pct;
      var n = count || 1;
      return { min: weight * pct[0] / 100 * n, max: weight * pct[1] / 100 * n, pct: pct };
    },
    isAdult: function (breed, ageDays) { return ageDays != null && ageDays >= breed.growth.maturity_d; }
  };
})();
