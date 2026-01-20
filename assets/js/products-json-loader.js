// Build: 2026-01-12-v6
try { window.KBWG_PRODUCTS_BUILD = '2026-01-12-v6'; console.info('[KBWG] KBWG_PRODUCTS_BUILD ' + window.KBWG_PRODUCTS_BUILD); } catch(e) {}

/*
  Loads products from data/products.json, then bootstraps assets/js/products.js.
  Works on GitHub Pages (no build step).
*/
(function () {
  'use strict';

  // USD -> ILS conversion used for display across the site.
  // (Amazon charges in USD; this is to help Israeli users estimate totals.)
  var USD_TO_ILS = 3.65;

  function toILS(usd) {
    var n = Number(usd);
    if (!isFinite(n)) return null;
    return Math.round(n * USD_TO_ILS);
  }

  // Bucket into ₪50 ranges (e.g., 50 -> 50-100, 149 -> 100-150)
  function priceRangeFromILS(priceIls) {
    var p = Number(priceIls);
    if (!isFinite(p) || p <= 0) return null;
    var low = Math.floor(p / 50) * 50;
    if (low < 50) low = 50;
    return { min: low, max: low + 50 };
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function normalizeProducts(data) {
    var arr = Array.isArray(data) ? data : [];

    // Ensure each product has an ILS price on offers (when provided as USD)
    // and has priceMin/priceMax populated as a range in ILS.
    return arr.map(function (p) {
      var out = p && typeof p === 'object' ? p : {};

      // Normalize offers
      if (Array.isArray(out.offers)) {
        out.offers = out.offers.map(function (o) {
          var oo = o && typeof o === 'object' ? o : {};
          if (oo.price == null && oo.priceUSD != null) {
            var ils = toILS(oo.priceUSD);
            if (ils != null) oo.price = ils;
          }
          if (oo.listPrice == null && oo.listPriceUSD != null) {
            var ils2 = toILS(oo.listPriceUSD);
            if (ils2 != null) oo.listPrice = ils2;
          }
          return oo;
        });
      }

      // Determine a representative ILS price for range bucketing
      var rep = null;
      if (Array.isArray(out.offers)) {
        for (var i = 0; i < out.offers.length; i++) {
          var o = out.offers[i];
          if (o && o.price != null && isFinite(Number(o.price))) {
            rep = Number(o.price);
            break;
          }
        }
      }
      if (rep == null) {
        // If the JSON already has a range, use its midpoint for rep
        if (typeof out.priceMin === 'number' && typeof out.priceMax === 'number') {
          rep = (out.priceMin + out.priceMax) / 2;
        }
      }

      // If we have a representative price, ensure priceMin/priceMax exist
      if (rep != null) {
        var r = priceRangeFromILS(rep);
        if (r) {
          out.priceMin = r.min;
          out.priceMax = r.max;
        }
      }

      return out;
    });
  }

  // Resolve correctly when Weglot serves pages under /en/... (or when hosted under a subpath)
  function siteBaseFromScript() {
    try {
      var src = '';
      try { src = (document.currentScript && document.currentScript.src) ? document.currentScript.src : ''; } catch (e) { src = ''; }
      if (!src) {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
          var ssrc = scripts[i] && scripts[i].src ? String(scripts[i].src) : '';
          if (ssrc.indexOf('products-json-loader.js') !== -1) { src = ssrc; break; }
        }
      }
      if (!src) return '/';
      var u = new URL(src, location.href);
      var p = u.pathname || '/';
      var idx = p.indexOf('/assets/js/');
      var base = idx >= 0 ? p.slice(0, idx) : p.replace(/\/[^\/]+$/, '');
      base = base.replace(/\/+$/, '');
      var parts = base.split('/').filter(Boolean);
      var langs = { en: 1, he: 1, iw: 1, ar: 1, fr: 1, es: 1, de: 1, ru: 1 };
      if (parts.length && langs[parts[parts.length - 1]]) parts.pop();
      return '/' + parts.join('/');
    } catch (e) { return '/'; }
  }

  function resolveFromBase(rel) {
    try {
      if (!rel) return rel;
      var p = String(rel).replace(/^\.\//, '');
      if (/^https?:\/\//i.test(p)) return p;
      var base = siteBaseFromScript() || '/';
      if (base === '/') return '/' + p.replace(/^\//, '');
      return base + '/' + p.replace(/^\//, '');
    } catch (e) { return rel; }
  }

  var jsonPath = resolveFromBase('data/products.json');

  function isFileProtocol() {
    try { return location && location.protocol === 'file:'; } catch (e) { return false; }
  }

  function setHelpfulEmptyStateMessage() {
    // מוצרים page uses #emptyState for "no results".
    var el = document.getElementById('emptyState');
    if (!el) return;

    // Hebrew + short English keyword for searchability.
    el.innerHTML = [
      '<strong>האתר רץ כרגע מקובץ מקומי (file://),</strong> ולכן הדפדפן חוסם טעינת JSON (CORS).',
      '<br>כדי שזה יעבוד מקומית, תריצי שרת קטן (Local Server) ואז תפתחי את האתר דרך <code>http://localhost</code>.',
      '<br><br><strong>Windows:</strong> בתיקייה של הפרויקט הריצי:',
      '<br><code>py -m http.server 8000</code>',
      '<br>ואז פתחי: <code>http://localhost:8000/products.html</code>',
      '<br><br>ב־GitHub Pages / אתר אמיתי (https) זה יעבוד בלי בעיה.'
    ].join('');
  }

  fetch(jsonPath, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      window.PRODUCTS = normalizeProducts(data);
    })
    .catch(function (err) {
      console.warn('[products-json-loader] Could not load ' + jsonPath, err);
      window.PRODUCTS = [];

      // When opened via file://, browsers block fetch() due to CORS.
      if (isFileProtocol()) {
        window.__KBWG_FILE_FETCH_BLOCKED = true;
        setHelpfulEmptyStateMessage();
      }
    })
    .finally(function () {
      // The main page logic expects window.PRODUCTS to exist.
      loadScript('assets/js/products.js').catch(function (e) {
        console.error('[products-json-loader] Could not start products.js', e);
      });
    });
})();
