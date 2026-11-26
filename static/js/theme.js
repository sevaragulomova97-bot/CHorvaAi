/* Mavzuni (yorug‘/qorong‘i) sahifa chizilishidan oldin qo‘llaydi — “miltillash” bo‘lmasligi uchun */
(function () {
  try {
    var t = localStorage.getItem("chorva-theme") || "auto";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* localStorage yopiq bo‘lishi mumkin */ }
})();
