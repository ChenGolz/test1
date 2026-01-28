// Build: 2026-01-28-v3
// Renders "Today's Top Deals" from data/products.json by selecting products where isDiscounted === true.
// Also enriches with brand badges (PETA / Leaping Bunny / Vegan) + price tier from data/intl-brands.json when available.
(function () {
  'use strict';

  // --- Config ---
  var AMAZON_TAG = 'nocrueltyil-20'; // used only if a link is missing a tag=
  var MAX_DEALS = 60;

  // Ensure the image area renders nicely even if your global CSS doesn't style it yet.
  (function injectDealMediaStyles() {
    var STYLE_ID = 'todaysDealsMediaStyles';
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.dealMedia{display:block;overflow:hidden;border-radius:14px;}',
      '.dealImg{display:block;width:100%;height:auto;aspect-ratio:1/1;object-fit:cover;}',
      '.dealPlaceholder{display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;font-size:34px;}',
      '.dealCard .dealTop{margin-top:10px;}'
    ].join('');
    document.head.appendChild(style);
  })();

  // --- Helpers ---
  function hasOwn(obj, k) {
    return Object.prototype.hasOwnProperty.call(obj || {}, k);
  }

  function safeText(v) {
    return (v == null) ? '' : String(v);
  }

  function esc(s) {
    return safeText(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isFileProtocol() {
    try { return location && location.protocol === 'file:'; } catch (e) { return false; }
  }

  // Resolve correctly when Weglot serves pages under /en/... (or when hosted under a subpath).
  function siteBaseFromScript() {
    // Prefer global helper from site.js if it exists.
    try {
      if (typeof window.__kbwgSiteBase === 'string' && window.__kbwgSiteBase) return window.__kbwgSiteBase;
      if (typeof window.__kbwgResolveFromSiteBase === 'function') {
        // We'll still compute base here for our own resolveFromBase; helper resolves directly.
        // fall through.
      }
    } catch (e) {}

    try {
      var src = '';
      try { src = (document.currentScript && document.currentScript.src) ? document.currentScript.src : ''; } catch (e) { src = ''; }
      if (!src) {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
          var ssrc = scripts[i] && scripts[i].src ? String(scripts[i].src) : '';
          if (ssrc.indexOf('todays-deals.js') !== -1) { src = ssrc; break; }
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
    } catch (e) {
      return '/';
    }
  }

  function resolveFromBase(rel) {
    try {
      if (!rel) return rel;
      // If site.js exposes a resolver, prefer it.
      if (typeof window.__kbwgResolveFromSiteBase === 'function') return window.__kbwgResolveFromSiteBase(rel);
      var p = String(rel).replace(/^\.\//, '');
      if (/^https?:\/\//i.test(p)) return p;
      var base = siteBaseFromScript() || '/';
      if (base === '/') return '/' + p.replace(/^\//, '');
      return base + '/' + p.replace(/^\//, '');
    } catch (e) {
      return rel;
    }
  }

  function brandKey(name) {
    return safeText(name)
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '');
  }

  function makeBrandLogo(name) {
    var n = safeText(name).trim();
    if (!n) return '';
    // Split to words (keep letters/numbers only)
    var words = n.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    // Single word: first 2 chars
    return n.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
  }

  function formatMoney(amount, currency) {
    if (typeof amount !== 'number' || !isFinite(amount)) return '';
    var cur = safeText(currency).toUpperCase();
    var symbol = '$';
    if (cur === 'GBP') symbol = '£';
    else if (cur === 'EUR') symbol = '€';
    else if (cur && cur !== 'USD') symbol = cur + ' ';
    return symbol + amount.toFixed(2).replace(/\.00$/, '');
  }

  function ensureAmazonTag(url) {
    try {
      var u = new URL(url, location.href);
      // Only for Amazon domains
      if (!/amazon\./i.test(u.hostname)) return url;
      if (u.searchParams.get('tag')) return url;
      u.searchParams.set('tag', AMAZON_TAG);
      return u.toString();
    } catch (e) {
      // fallback string operations
      if (!url || url.indexOf('amazon.') === -1) return url;
      if (url.indexOf('tag=') !== -1) return url;
      return url + (url.indexOf('?') === -1 ? '?' : '&') + 'tag=' + encodeURIComponent(AMAZON_TAG);
    }
  }

  function pickBestOffer(p) {
    var offers = Array.isArray(p && p.offers) ? p.offers : [];
    if (!offers.length) return null;
    // Prefer Amazon US if exists
    for (var i = 0; i < offers.length; i++) {
      var store = safeText(offers[i] && offers[i].store).toLowerCase();
      var region = safeText(offers[i] && offers[i].region).toLowerCase();
      if (store.indexOf('amazon-us') !== -1 || region === 'us') return offers[i];
    }
    return offers[0];
  }

  function resolveProductImage(p, offer) {
    // Prefer explicit product image (used in products.json)
    var img = safeText(p && p.image);
    if (img) return resolveFromBase(img);

    // Fallback: convention used across the site assets/img/products/<ASIN>.jpg
    var asin = safeText(offer && offer.asin);
    if (asin) return resolveFromBase('assets/img/products/' + asin + '.jpg');

    return '';
  }

  function resolveLabels(p, brand) {
    // Product-level overrides win (including explicit false)
    function getFlag(key, brandDefault) {
      if (hasOwn(p, key)) return !!p[key];
      return !!brandDefault;
    }

    var badges = (brand && Array.isArray(brand.badges)) ? brand.badges : [];
    var badgeSet = {};
    for (var i = 0; i < badges.length; i++) badgeSet[safeText(badges[i]).toLowerCase()] = true;

    var brandIsVegan = !!(brand && (brand.vegan === true || badgeSet['vegan']));
    var brandIsLB = !!(brand && (badgeSet['leaping bunny'] || badgeSet['leapingbunny']));
    var brandIsPeta = !!(brand && badgeSet['peta']);

    return {
      isVegan: getFlag('isVegan', brandIsVegan),
      isLB: getFlag('isLB', brandIsLB),
      isPeta: getFlag('isPeta', brandIsPeta)
    };
  }

  function resolvePriceTier(p, brand) {
    // Prefer brand tier; else a light heuristic from price range
    var tier = (brand && typeof brand.priceTier === 'number') ? brand.priceTier : null;
    if (tier != null && isFinite(tier)) {
      tier = Math.max(1, Math.min(5, Math.round(tier)));
      return tier;
    }

    var min = (typeof p.priceMin === 'number' && isFinite(p.priceMin)) ? p.priceMin : null;
    var max = (typeof p.priceMax === 'number' && isFinite(p.priceMax)) ? p.priceMax : null;
    var base = (min != null) ? min : max;

    if (base == null) return null;
    // Price tiers tuned for Amazon beauty ranges; adjust any time.
    if (base <= 12) return 1;
    if (base <= 25) return 2;
    if (base <= 45) return 3;
    if (base <= 80) return 4;
    return 5;
  }

  function renderPriceTier(tier) {
    if (!tier) return '';
    var t = Math.max(1, Math.min(5, Math.round(tier)));
    var dollars = '';
    for (var i = 1; i <= 5; i++) {
      dollars += '<span class="dollar' + (i <= t ? '' : ' inactive') + '">$</span>';
    }
    return (
      '<span aria-label="רמת מחיר: ' + t + ' מתוך 5" class="price-tier price-tier--t' + t + ' price-tier--sm">' +
        dollars +
      '</span>'
    );
  }

  function buildTags(labels) {
    var out = [];
    if (labels.isPeta) out.push('<span class="tag wg-notranslate" data-wg-notranslate="true">PETA</span>');
    if (labels.isLB) out.push('<span class="tag wg-notranslate" data-wg-notranslate="true">Leaping Bunny</span>');
    if (labels.isVegan) out.push('<span class="tag">טבעוני</span>');
    return out.join('');
  }

  function dealCardHTML(p, brand) {
    var brandName = safeText(p.brand);
    var brandDisplay = brandName ? brandName.toUpperCase() : '';

    var offer = pickBestOffer(p) || {};
    var url = ensureAmazonTag(safeText(offer.url || ''));
    var imgSrc = resolveProductImage(p, offer);
    var price = null;
    var currency = offer.currency || 'USD';
    // Prefer explicit offer priceUSD (site convention)
    if (typeof offer.priceUSD === 'number' && isFinite(offer.priceUSD)) price = offer.priceUSD;
    else if (typeof offer.price === 'number' && isFinite(offer.price)) price = offer.price;

    var labels = resolveLabels(p, brand);

    return (
      '<article class="dealCard">' +
        // Image (clickable)
        '<a class="dealMedia" href="' + esc(url || '#') + '" rel="noopener" target="_blank">' +
          (imgSrc
            ? '<img class="dealImg" src="' + esc(imgSrc) + '" alt="' + esc(safeText(p.name)) + '" loading="lazy" decoding="async" width="640" height="640" />'
            : '<div class="dealPlaceholder" aria-hidden="true">🧴</div>'
          ) +
        '</a>' +
        '<div class="dealTop">' +
        '<div class="dealBrandRow">' +
          '<div>' +
            '<div class="dealBrand">' + esc(brandDisplay) + '</div>' +
            '<div class="dealName">' + esc(safeText(p.name)) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="dealMeta">' + buildTags(labels) + '</div>' +
        '<div class="dealCta">' +
          '<div class="dealPrice">' + esc(formatMoney(price, currency) || '') + '</div>' +
          (url
            ? '<a class="dealBtn" href="' + esc(url) + '" rel="noopener" target="_blank">קנו באמזון</a>'
            : ''
          ) +
        '</div>' +
      '</article>'
    );
  }

  function setLoading(on) {
    var el = document.getElementById('dealsLoading');
    if (!el) return;
    el.style.display = on ? '' : 'none';
  }

  function showEmpty(on, msgHtml) {
    var el = document.getElementById('dealsEmpty');
    if (!el) return;
    if (msgHtml) el.innerHTML = msgHtml;
    el.style.display = on ? '' : 'none';
  }

  function main() {
    var grid = document.getElementById('dealsGrid');
    if (!grid) return;

    setLoading(true);
    showEmpty(false);

    var productsPath = resolveFromBase('data/products.json');
    var brandsPath = resolveFromBase('data/intl-brands.json');

    var productsReq = fetch(productsPath, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });

    var brandsReq = fetch(brandsPath, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function () {
      // intl-brands is optional for the deals page
      return [];
    });

    Promise.all([productsReq, brandsReq])
      .then(function (res) {
        var products = Array.isArray(res[0]) ? res[0] : [];
        var brands = Array.isArray(res[1]) ? res[1] : [];

        var brandsByKey = {};
        for (var i = 0; i < brands.length; i++) {
          var b = brands[i];
          var k = brandKey(b && b.name);
          if (k) brandsByKey[k] = b;
        }

        // Auto-detect isDiscounted param: only show true, absent/false -> hidden.
        var deals = products.filter(function (p) { return p && p.isDiscounted === true; });

        // Keep the list stable (in JSON order), but cap size.
        deals = deals.slice(0, MAX_DEALS);

        if (!deals.length) {
          grid.innerHTML = '';
          setLoading(false);

          if (isFileProtocol()) {
            showEmpty(true, [
              '<strong>הדף פתוח מקובץ מקומי (file://)</strong> ולכן הדפדפן חוסם טעינת JSON (CORS).',
              '<br>כדי שזה יעבוד מקומית, תריצי שרת קטן ואז תפתחי דרך <code>http://localhost</code>.',
              '<br><br><strong>Windows:</strong> בתיקייה של הפרויקט הריצי:',
              '<br><code>py -m http.server 8000</code>',
              '<br>ואז פתחי: <code>http://localhost:8000/todays-top-deals.html</code>',
              '<br><br>ב־GitHub Pages / אתר אמיתי (https) זה יעבוד בלי בעיה.'
            ].join(''));
          } else {
            showEmpty(true);
          }

          // Let Weglot refresh (optional)
          try { window.dispatchEvent(new Event('kbwg:content-rendered')); } catch (e) {}
          return;
        }

        var htmlOut = '';
        for (var j = 0; j < deals.length; j++) {
          var p = deals[j];
          var b = brandsByKey[brandKey(p.brand)] || null;
          htmlOut += dealCardHTML(p, b);
        }

        grid.innerHTML = htmlOut;
        setLoading(false);
        showEmpty(false);

        // Let Weglot refresh (optional)
        try { window.dispatchEvent(new Event('kbwg:content-rendered')); } catch (e) {}
      })
      .catch(function (err) {
        console.warn('[todays-deals] Could not render deals', err);
        setLoading(false);

        if (isFileProtocol()) {
          showEmpty(true, [
            '<strong>הדף פתוח מקובץ מקומי (file://)</strong> ולכן הדפדפן חוסם טעינת JSON (CORS).',
            '<br>כדי שזה יעבוד מקומית, תריצי שרת קטן ואז תפתחי דרך <code>http://localhost</code>.',
            '<br><br><strong>Windows:</strong> בתיקייה של הפרויקט הריצי:',
            '<br><code>py -m http.server 8000</code>',
            '<br>ואז פתחי: <code>http://localhost:8000/todays-top-deals.html</code>'
          ].join(''));
        } else {
          showEmpty(true, 'שגיאה בטעינת המבצעים. נסי לרענן את הדף.');
        }
      });
  }

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
