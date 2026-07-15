(function () {
  "use strict";

  var CONFIG_URL = "config.json";
  var config = null;
  var seriesList = [];
  var seriesById = {};
  var seriesColors = {};

  var mapEl = document.getElementById("map");
  if (!mapEl) return;

  var titleEl = document.getElementById("video-panel-title");
  var metaEl = document.getElementById("video-panel-meta");
  var placeholderEl = document.getElementById("video-placeholder");
  var placeholderTextEl = document.getElementById("video-placeholder-text");
  var iframeEl = document.getElementById("yt-embed");
  var openExternalEl = document.getElementById("video-open-external");
  var externalActionsEl = document.getElementById("video-panel-actions");
  var filterSeriesEl = document.getElementById("filter-series");
  var filterLocationEl = document.getElementById("filter-location");
  var filterVideoEl = document.getElementById("filter-video");
  var resetFiltersEl = document.getElementById("filter-reset");

  var map = null;
  var selectedMarker = null;
  var allMarkers = [];
  var emptyPanelTitle = "";
  var emptyPanelMeta = "";
  var seriesPrefix = "Temporada";
  var tooltipPrefix = "";
  var numberEpisodes = false;
  var episodePrefix = "Ep.";
  var showEpisodeInPanel = false;

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("No se pudo cargar " + url);
      return r.json();
    });
  }

  function setMeta(name, value, isProperty) {
    if (!value) return;
    var attr = isProperty ? "property" : "name";
    var sel = 'meta[' + attr + '="' + name + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", value);
  }

  function applySiteMeta(cfg) {
    var site = cfg.site || {};
    document.documentElement.lang = site.lang || "es";
    document.title = site.title || "Geo Video Map";
    setMeta("description", site.description);
    setMeta("robots", site.robots || "index, follow");
    setMeta("theme-color", site.themeColor || cfg.theme && cfg.theme.surface);
    if (site.canonicalUrl) {
      var canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.href = site.canonicalUrl;
    }
    setMeta("og:site_name", site.title, true);
    setMeta("og:locale", site.locale || "es_ES", true);
    setMeta("og:url", site.canonicalUrl, true);
    setMeta("og:title", site.title, true);
    setMeta("og:description", site.description, true);
    setMeta("twitter:title", site.title);
    setMeta("twitter:description", site.description);
    var brand = cfg.brand || {};
    if (brand.headerImage && site.canonicalUrl) {
      var ogImg = site.canonicalUrl.replace(/\/?$/, "/") + brand.headerImage.replace(/^\//, "");
      setMeta("og:image", ogImg, true);
      setMeta("twitter:image", ogImg);
    }
  }

  function applyTheme(cfg) {
    var theme = cfg.theme || {};
    var root = document.documentElement;
    var mapTheme = {
      "--bg": theme.background,
      "--surface": theme.surface,
      "--surface-2": theme.surfaceAlt,
      "--text": theme.text,
      "--muted": theme.muted,
      "--accent": theme.accent,
      "--accent-dim": theme.accentDim,
      "--accent-secondary": theme.accentSecondary,
      "--accent-glow": theme.accentGlow,
      "--header-overlay": theme.headerOverlay != null ? String(theme.headerOverlay) : "0.85",
    };
    Object.keys(mapTheme).forEach(function (key) {
      if (mapTheme[key] != null) root.style.setProperty(key, mapTheme[key]);
    });
    (cfg.series || []).forEach(function (s, i) {
      root.style.setProperty("--series-" + i, s.color || "#6eb2e8");
    });
    if (theme.fontBody) {
      root.style.fontFamily = '"' + theme.fontBody + '", system-ui, -apple-system, sans-serif';
    }
  }

  function applyBrand(cfg) {
    var site = cfg.site || {};
    var brand = cfg.brand || {};
    var filters = cfg.filters || {};
    var panel = cfg.panel || {};
    var credit = cfg.credit || {};
    var legal = cfg.legal || {};
    var features = cfg.features || {};

    emptyPanelTitle = panel.emptyTitle || "Selecciona un punto en el mapa";
    emptyPanelMeta = panel.emptyMeta || "";
    seriesPrefix = panel.seriesPrefix || filters.series || "Temporada";
    tooltipPrefix = features.tooltipPrefix !== false ? (brand.externalLabel || site.subtitle || "") : "";
    numberEpisodes = features.numberEpisodes === true;
    episodePrefix = panel.episodePrefix || "Ep.";
    showEpisodeInPanel = panel.showEpisodeInPanel === true;

    var wordmark = document.getElementById("gvm-wordmark");
    var wordmarkMain = document.getElementById("gvm-wordmark-main");
    var wordmarkSub = document.getElementById("gvm-wordmark-sub");
    var tagline = document.getElementById("gvm-tagline");
    if (wordmarkMain) wordmarkMain.textContent = site.title || "Geo Video Map";
    if (wordmarkSub) {
      wordmarkSub.textContent = site.subtitle || "";
      wordmarkSub.hidden = !site.subtitle;
    }
    if (tagline) tagline.textContent = site.tagline || "";
    if (wordmark && brand.wordmarkUrl) wordmark.href = brand.wordmarkUrl;

    var headerDecor = document.getElementById("gvm-header-decor");
    var headerImg = document.getElementById("gvm-header-img");
    if (brand.headerImage && headerDecor && headerImg) {
      headerImg.src = brand.headerImage;
      headerImg.alt = site.title || "";
      headerDecor.hidden = false;
    }

    var headerRight = document.getElementById("gvm-header-right");
    var externalCta = document.getElementById("gvm-external-cta");
    var ctaHandle = document.getElementById("gvm-cta-handle");
    if (features.showExternalCta === false) {
      if (headerRight) headerRight.hidden = true;
    } else if (externalCta && brand.externalUrl) {
      externalCta.href = brand.externalUrl;
      if (ctaHandle) ctaHandle.textContent = brand.externalLabel || brand.externalUrl;
      externalCta.hidden = false;
      if (brand.externalType !== "youtube") {
        externalCta.classList.remove("gvm-cta--youtube");
      }
    }

    var labelSeries = document.getElementById("label-filter-series");
    var labelLocation = document.getElementById("label-filter-location");
    var labelVideo = document.getElementById("label-filter-video");
    if (labelSeries) labelSeries.textContent = filters.series || "Serie";
    if (labelLocation) labelLocation.textContent = filters.location || "Ubicación";
    if (labelVideo) labelVideo.textContent = filters.video || "Episodio";
    if (resetFiltersEl) resetFiltersEl.textContent = filters.reset || "Limpiar";

    var panelLabel = document.getElementById("video-panel-label");
    if (panelLabel) panelLabel.textContent = panel.label || "";
    if (placeholderTextEl) placeholderTextEl.textContent = panel.placeholderText || "";
    if (openExternalEl) openExternalEl.textContent = panel.openExternal || "Abrir vídeo";

    var legendTitle = document.getElementById("gvm-legend-title");
    var legendWrap = document.getElementById("gvm-legend");
    if (legendTitle) legendTitle.textContent = (cfg.legend && cfg.legend.title) || "Leyenda";
    if (legendWrap) legendWrap.hidden = features.showLegend === false;

    var creditWrap = document.getElementById("gvm-credit");
    if (creditWrap) {
      if (features.showCredit === false) {
        creditWrap.hidden = true;
      } else {
        creditWrap.hidden = false;
        var creditAuthor = document.getElementById("gvm-credit-author");
        var creditLine = document.getElementById("gvm-credit-line");
        var creditYear = document.getElementById("gvm-credit-year");
        var creditIg = document.getElementById("gvm-credit-ig");
        var creditIgHandle = document.getElementById("gvm-credit-ig-handle");
        if (creditLine) {
          creditLine.textContent = (credit.line || "Concepto, desarrollo y diseño") + ":";
        }
        if (creditAuthor) {
          creditAuthor.textContent = credit.author || "";
          creditAuthor.href = credit.authorUrl || "#";
        }
        if (creditYear) {
          creditYear.textContent = credit.year ? " © " + credit.year : "";
        }
        if (credit.instagram && credit.instagram.url) {
          if (creditIg) creditIg.href = credit.instagram.url;
          if (creditIgHandle) creditIgHandle.textContent = credit.instagram.handle || "";
        } else if (creditIg) {
          creditIg.hidden = true;
        }
      }
    }

    var footerNote = document.getElementById("gvm-footer-note");
    var infoTip = document.getElementById("gvm-info-tip");
    if (footerNote) footerNote.textContent = legal.footerNote || "";
    if (infoTip && legal.tooltip) {
      infoTip.title = legal.tooltip;
      infoTip.setAttribute("data-tooltip", legal.tooltip);
    }

    if (brand.placeholderImage && placeholderEl) {
      placeholderEl.style.backgroundImage =
        'linear-gradient(to bottom, rgba(10, 11, 14, 0.45) 0%, rgba(10, 11, 14, 0.72) 100%), url("' +
        brand.placeholderImage +
        '")';
    }
  }

  function buildSeriesIndex(cfg) {
    seriesList = cfg.series || [];
    seriesById = {};
    seriesColors = {};
    seriesList.forEach(function (s) {
      seriesById[s.id] = s;
      seriesColors[s.id] = s.color || "#6eb2e8";
    });
  }

  function buildSeriesFilter(cfg) {
    if (!filterSeriesEl) return;
    var filters = cfg.filters || {};
    filterSeriesEl.innerHTML = "";
    var allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = filters.allSeries || "Todas";
    filterSeriesEl.appendChild(allOpt);
    seriesList.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = String(s.number);
      opt.textContent = s.label || ("Serie " + s.number);
      filterSeriesEl.appendChild(opt);
    });
  }

  function buildLegend(cfg) {
    var list = document.getElementById("gvm-legend-list");
    if (!list) return;
    list.innerHTML = "";
    seriesList.forEach(function (s, i) {
      var li = document.createElement("li");
      var dot = document.createElement("span");
      dot.className = "legend-dot";
      dot.style.background = s.color || "var(--series-" + i + ")";
      dot.style.boxShadow = "0 0 10px " + (s.color || "#6eb2e8") + "88";
      dot.setAttribute("aria-hidden", "true");
      li.appendChild(dot);
      li.appendChild(document.createTextNode(" " + (s.label || s.id)));
      list.appendChild(li);
    });
  }

  function initMap(cfg) {
    var mapCfg = cfg.map || {};
    var center = mapCfg.center || [20, 0];
    var zoom = mapCfg.zoom != null ? mapCfg.zoom : 2;
    var tile = (cfg.theme && cfg.theme.mapTile) === "light"
      ? "light_all"
      : "dark_all";

    map = L.map(mapEl, {
      worldCopyJump: true,
      minZoom: 2,
      maxBounds: [
        [-85, -200],
        [85, 200],
      ],
    }).setView(center, zoom);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/" + tile + "/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    window.addEventListener("resize", invalidateMapSoon);
    var mapColumnEl = mapEl.parentElement;
    if (mapColumnEl && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(invalidateMapSoon).observe(mapColumnEl);
    }
  }

  function invalidateMapSoon() {
    if (!map) return;
    setTimeout(function () {
      map.invalidateSize();
    }, 50);
    setTimeout(function () {
      map.invalidateSize();
    }, 320);
  }

  function itemLocation(item) {
    if (item.ubicacion != null) return String(item.ubicacion);
    if (item.pais != null) return String(item.pais);
    return "Punto";
  }

  function splitEtiquetaPaises(cell) {
    cell = String(cell || "").trim();
    if (!cell) return [];
    var depth = 0;
    var parts = [];
    var buf = [];
    for (var i = 0; i < cell.length; i++) {
      var ch = cell[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(buf.join("").trim());
        buf = [];
      } else {
        buf.push(ch);
      }
    }
    if (buf.length) parts.push(buf.join("").trim());
    return parts.filter(Boolean);
  }

  function locationForFilter(etiqueta) {
    var s = String(etiqueta || "").trim();
    if (!s) return "";
    s = s.replace(/^Trailer\s*·\s*/i, "").trim();
    var parts = splitEtiquetaPaises(s);
    if (parts.length) return parts[parts.length - 1].trim();
    return s;
  }

  function youtubeIdFromUrl(url) {
    if (!url || typeof url !== "string") return null;
    var m = url.match(/[?&]v=([^&]+)/);
    if (m) return m[1];
    m = url.match(/youtu\.be\/([^?]+)/);
    if (m) return m[1];
    m = url.match(/youtube\.com\/embed\/([^?]+)/);
    if (m) return m[1];
    return null;
  }

  function resetPanel() {
    if (selectedMarker) {
      setMarkerSelected(selectedMarker.m, selectedMarker.c, false);
      selectedMarker = null;
    }
    if (titleEl) titleEl.textContent = emptyPanelTitle;
    if (metaEl) metaEl.textContent = emptyPanelMeta;
    if (iframeEl) {
      iframeEl.removeAttribute("src");
      iframeEl.classList.add("is-hidden");
    }
    if (placeholderEl) placeholderEl.classList.remove("is-hidden");
    if (externalActionsEl) externalActionsEl.hidden = true;
  }

  function formatEpisodeTitle(item) {
    var tit = item.titulo != null ? String(item.titulo) : "Vídeo";
    if (!numberEpisodes || item.episodio == null) return tit;
    if (/^Ep\.\s*\d+/i.test(tit)) return tit;
    return episodePrefix + " " + String(item.episodio) + " · " + tit;
  }

  function showVideoInPanel(item, serieNum) {
    var loc = itemLocation(item);
    var serie = item.serie != null ? item.serie : serieNum != null ? serieNum : "—";
    var url = item.url != null ? String(item.url) : "";

    if (titleEl) {
      titleEl.textContent = showEpisodeInPanel ? formatEpisodeTitle(item) : loc;
    }
    if (metaEl) {
      metaEl.textContent = showEpisodeInPanel
        ? loc
        : seriesPrefix + " " + String(serie);
    }

    var vid = youtubeIdFromUrl(url);
    if (vid && iframeEl) {
      iframeEl.src = "https://www.youtube.com/embed/" + vid + "?rel=0";
      iframeEl.classList.remove("is-hidden");
      if (placeholderEl) placeholderEl.classList.add("is-hidden");
    } else if (iframeEl) {
      iframeEl.removeAttribute("src");
      iframeEl.classList.add("is-hidden");
      if (placeholderEl) placeholderEl.classList.remove("is-hidden");
    }

    if (openExternalEl && externalActionsEl) {
      if (url && url !== "#") {
        openExternalEl.href = url;
        externalActionsEl.hidden = false;
      } else {
        externalActionsEl.hidden = true;
      }
    }
  }

  function setMarkerSelected(marker, color, selected) {
    marker.setStyle({
      radius: selected ? 8 : 5,
      weight: selected ? 2.5 : 1.5,
      color: color,
      fillColor: color,
      fillOpacity: selected ? 0.92 : 0.62,
    });
  }

  function applyFilters() {
    var v = filterSeriesEl ? filterSeriesEl.value : "";
    var p = filterLocationEl ? filterLocationEl.value : "";
    allMarkers.forEach(function (rec) {
      var okV = !v || String(rec.serie) === v;
      var okP = !p || rec.locationFilter === p;
      var show = okV && okP;
      var wasSel = selectedMarker && selectedMarker.m === rec.marker;
      if (!show && wasSel) resetPanel();
      var isSelectedNow = selectedMarker && selectedMarker.m === rec.marker;
      rec.marker.setStyle({
        opacity: show ? 1 : 0,
        fillOpacity: !show ? 0 : isSelectedNow ? 0.92 : 0.62,
        color: rec.color,
        fillColor: rec.color,
        weight: !show ? 1.5 : isSelectedNow ? 2.5 : 1.5,
        radius: !show ? 5 : isSelectedNow ? 8 : 5,
      });
      rec.marker.options.interactive = show;
    });
    fillVideoOptionsAfterFilters();
  }

  function fillVideoOptionsAfterFilters() {
    if (!filterVideoEl) return;
    var v = filterSeriesEl ? filterSeriesEl.value : "";
    var p = filterLocationEl ? filterLocationEl.value : "";
    var placeholder = (config.filters && config.filters.videoPlaceholder) || "Episodio…";
    var cur = filterVideoEl.value;
    filterVideoEl.innerHTML = '<option value="">' + placeholder + "</option>";
    allMarkers.forEach(function (rec, idx) {
      var okV = !v || String(rec.serie) === v;
      var okP = !p || rec.locationFilter === p;
      if (!okV || !okP) return;
      var tit = formatEpisodeTitle(rec.item);
      var opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = tit.length > 90 ? tit.slice(0, 87) + "…" : tit;
      filterVideoEl.appendChild(opt);
    });
    if (
      cur &&
      Array.prototype.some.call(filterVideoEl.options, function (o) {
        return o.value === cur;
      })
    ) {
      filterVideoEl.value = cur;
    } else {
      if (cur) resetPanel();
      filterVideoEl.value = "";
    }
  }

  function syncVideoSelectToRec(rec) {
    if (!filterVideoEl || !rec) return;
    var v = filterSeriesEl ? filterSeriesEl.value : "";
    var p = filterLocationEl ? filterLocationEl.value : "";
    if ((!v || String(rec.serie) === v) && (!p || rec.locationFilter === p)) {
      var idx = allMarkers.indexOf(rec);
      if (idx >= 0) filterVideoEl.value = String(idx);
    }
  }

  function fillLocationOptions(data) {
    if (!filterLocationEl) return;
    var set = {};
    seriesList.forEach(function (s) {
      (data[s.id] || []).forEach(function (item) {
        var solo = locationForFilter(itemLocation(item));
        if (solo) set[solo] = true;
      });
    });
    var list = Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, "es", { sensitivity: "base" });
    });
    var allLabel = (config.filters && config.filters.allLocations) || "Todas";
    var cur = filterLocationEl.value;
    filterLocationEl.innerHTML = '<option value="">' + allLabel + "</option>";
    list.forEach(function (pa) {
      var opt = document.createElement("option");
      opt.value = pa;
      opt.textContent = pa;
      filterLocationEl.appendChild(opt);
    });
    if (cur && list.indexOf(cur) !== -1) filterLocationEl.value = cur;
  }

  function addMarkersForSeries(items, seriesId, color, serieNum) {
    if (!Array.isArray(items)) return;
    items.forEach(function (item) {
      var lat = Number(item.lat);
      var lng = Number(item.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;

      var locStr = itemLocation(item);
      var locFilter = locationForFilter(locStr);
      var serie = item.serie != null ? item.serie : serieNum;

      var marker = L.circleMarker([lat, lng], {
        radius: 5,
        color: color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.62,
      }).addTo(map);

      var rec = {
        marker: marker,
        serie: serie,
        location: locStr,
        locationFilter: locFilter,
        item: item,
        color: color,
        seriesId: seriesId,
      };
      allMarkers.push(rec);

      marker.on("click", function () {
        if (selectedMarker) {
          setMarkerSelected(selectedMarker.m, selectedMarker.c, false);
        }
        selectedMarker = { m: marker, c: color };
        setMarkerSelected(marker, color, true);
        showVideoInPanel(item, serie);
        syncVideoSelectToRec(rec);
      });

      var tipText = formatEpisodeTitle(item);
      var tip = tooltipPrefix ? tooltipPrefix + " · " + tipText : tipText;
      marker.bindTooltip(tip, {
        sticky: true,
        direction: "top",
        opacity: 0.95,
        className: "gvm-map-tooltip",
      });
    });
  }

  function loadMapData(cfg) {
    var dataUrl = (cfg.map && cfg.map.dataUrl) || "data.json";
    return fetchJson(dataUrl).then(function (data) {
      allMarkers = [];
      fillLocationOptions(data);
      seriesList.forEach(function (s) {
        addMarkersForSeries(data[s.id] || [], s.id, seriesColors[s.id], s.number);
      });
      applyFilters();
      invalidateMapSoon();
    });
  }

  function bindEvents() {
    if (filterSeriesEl) filterSeriesEl.addEventListener("change", applyFilters);
    if (filterLocationEl) filterLocationEl.addEventListener("change", applyFilters);
    if (filterVideoEl) {
      filterVideoEl.addEventListener("change", function () {
        var raw = filterVideoEl.value;
        if (!raw) {
          resetPanel();
          applyFilters();
          return;
        }
        var idx = parseInt(raw, 10);
        if (Number.isNaN(idx) || idx < 0 || idx >= allMarkers.length) return;
        var rec = allMarkers[idx];
        var v = filterSeriesEl ? filterSeriesEl.value : "";
        var p = filterLocationEl ? filterLocationEl.value : "";
        if ((!v || String(rec.serie) === v) && (!p || rec.locationFilter === p)) {
          if (selectedMarker) {
            setMarkerSelected(selectedMarker.m, selectedMarker.c, false);
          }
          selectedMarker = { m: rec.marker, c: rec.color };
          setMarkerSelected(rec.marker, rec.color, true);
          showVideoInPanel(rec.item, rec.serie);
          var ll = rec.marker.getLatLng();
          map.setView(ll, Math.max(map.getZoom(), 4));
          invalidateMapSoon();
        }
      });
    }
    if (resetFiltersEl) {
      resetFiltersEl.addEventListener("click", function () {
        if (filterSeriesEl) filterSeriesEl.value = "";
        if (filterLocationEl) filterLocationEl.value = "";
        if (filterVideoEl) filterVideoEl.value = "";
        resetPanel();
        applyFilters();
      });
    }
  }

  fetchJson(CONFIG_URL)
    .then(function (cfg) {
      config = cfg;
      applySiteMeta(cfg);
      applyTheme(cfg);
      applyBrand(cfg);
      buildSeriesIndex(cfg);
      buildSeriesFilter(cfg);
      buildLegend(cfg);
      initMap(cfg);
      bindEvents();
      resetPanel();
      return loadMapData(cfg);
    })
    .catch(function (err) {
      console.error(err);
      if (metaEl) metaEl.textContent = "Error al cargar la configuración o los datos del mapa.";
    });
})();
