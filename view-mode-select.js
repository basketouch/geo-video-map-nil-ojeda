(function () {
  "use strict";

  var sel = document.getElementById("gvm-view-mode");
  var field = document.getElementById("gvm-view-mode-field");
  if (!sel) return;

  function currentPageValue(page2d, page3d) {
    var path = window.location.pathname || "";
    if (/index-cesium\.html$/i.test(path)) return page3d;
    return page2d;
  }

  function bindSelector(page2d, page3d) {
    var cur = currentPageValue(page2d, page3d);
    sel.value = cur;
    sel.addEventListener("change", function () {
      var v = sel.value;
      if (v && v !== cur) {
        window.location.href = v;
      }
    });
  }

  fetch("config.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (cfg) {
      var views = cfg.views || {};
      var features = cfg.features || {};
      if (features.enable3d === false) {
        if (field) field.hidden = true;
        return;
      }
      if (field) field.hidden = false;
      var label = document.getElementById("label-filter-view");
      if (label) label.textContent = views.label || "Vista";
      var page2d = views.page2d || "index.html";
      var page3d = views.page3d || "index-cesium.html";
      sel.innerHTML = "";
      var o2 = document.createElement("option");
      o2.value = page2d;
      o2.textContent = views.mode2d || "2D";
      sel.appendChild(o2);
      var o3 = document.createElement("option");
      o3.value = page3d;
      o3.textContent = views.mode3d || "3D";
      sel.appendChild(o3);
      bindSelector(page2d, page3d);
    })
    .catch(function () {
      if (field) field.hidden = false;
      bindSelector("index.html", "index-cesium.html");
    });
})();
