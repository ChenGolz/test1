/*
  Bundles page
  - Shows curated bundles that reach Amazon free-delivery threshold for Israel.
  - All prices are shown in ILS (₪).
  Data sources:
    - data/products.json (product catalog, prices already in ₪)
    - data/bundles.json (curated bundle definitions)
*/

(function(){
  "use strict";

  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }

  function fmtILS(n){
    try{ return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 }); }
    catch(e){ return '₪' + Math.round(Number(n)||0); }
  }

  function toNumber(x){
    if (x == null) return NaN;
    if (typeof x === 'number') return x;
    var s = String(x).replace(/[^0-9.\-]/g,'');
    return Number(s);
  }

  // Bundle total target (₪) so it "just fits" the free delivery minimum.
  var TARGET_MIN = 160;
  var TARGET_MAX = 170;

  var state = {
    products: [],
    bundles: [],
    productById: new Map(),
  };

  function loadJson(url){
    return fetch(url, { cache: 'no-store' }).then(function(r){
      if(!r.ok) throw new Error('Failed ' + url);
      return r.json();
    });
  }

  function normalizeProducts(raw){
    var arr = Array.isArray(raw) ? raw : (raw && raw.products ? raw.products : []);
    // Ensure offers[].price is numeric (₪)
    arr.forEach(function(p){
      if (!Array.isArray(p.offers)) p.offers = [];
      p.offers.forEach(function(o){
        if (typeof o.price !== 'number') o.price = toNumber(o.price);
      });
      // Helpful: keep a bestPrice on each product
      var prices = p.offers.map(function(o){ return o.price; }).filter(function(v){ return Number.isFinite(v); });
      p.bestPrice = prices.length ? Math.min.apply(null, prices) : (Number.isFinite(p.priceMin) ? p.priceMin : NaN);
    });
    return arr;
  }

  function normalizeBundles(raw){
    var arr = Array.isArray(raw) ? raw : (raw && raw.bundles ? raw.bundles : []);
    return arr.map(function(b){
      return {
        id: b.id || ('b_' + Math.random().toString(36).slice(2)),
        title: b.title || 'באנדל מומלץ',
        subtitle: b.subtitle || '',
        tags: Array.isArray(b.tags) ? b.tags : [],
        items: Array.isArray(b.items) ? b.items : [],
      };
    });
  }

  function calcBundleTotal(bundle){
    var total = 0;
    bundle.items.forEach(function(it){
      var p = state.productById.get(it.productId);
      if (!p) return;
      var price = Number.isFinite(p.bestPrice) ? p.bestPrice : NaN;
      if (!Number.isFinite(price)) return;
      total += price;
    });
    return total;
  }

  function withinTarget(total){
    return total >= TARGET_MIN && total <= TARGET_MAX;
  }

  function render(){
    var grid = qs('#bundlesGrid');
    if (!grid) return;

    // Filter: only show bundles with valid totals in target range
    var bundles = state.bundles
      .map(function(b){
        var total = calcBundleTotal(b);
        return Object.assign({}, b, { total: total });
      })
      .filter(function(b){ return Number.isFinite(b.total) && withinTarget(b.total); });

    if (!bundles.length){
      grid.innerHTML = '<div class="emptyState">אין כרגע באנדלים בטווח ₪160–₪170. נסו לרענן או לעדכן מוצרים.</div>';
      return;
    }

    grid.innerHTML = bundles.map(function(b){
      return (
        '<article class="bundleCard" data-bundle-id="' + b.id + '">' +
          '<div class="bundleHead">' +
            '<div class="bundleTitle">' + escapeHtml(b.title) + '</div>' +
            (b.subtitle ? '<div class="bundleSub">' + escapeHtml(b.subtitle) + '</div>' : '') +
          '</div>' +
          '<div class="bundleMeta">' +
            '<div class="bundleTotal">סה"כ: <strong>' + fmtILS(b.total) + '</strong></div>' +
            '<div class="bundleHint">מותגים ומוצרים: 100% Vegan + ללא אכזריות</div>' +
          '</div>' +
          '<button class="bundleBtn" type="button">פתחי באנדל</button>' +
        '</article>'
      );
    }).join('');

    // Wire buttons
    qsa('.bundleCard .bundleBtn', grid).forEach(function(btn){
      btn.addEventListener('click', function(){
        var card = btn.closest('.bundleCard');
        var id = card ? card.getAttribute('data-bundle-id') : null;
        openBundleModal(id);
      });
    });
  }

  function escapeHtml(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  // Modal logic: reuse existing markup if present
  function openBundleModal(bundleId){
    var b = state.bundles.find(function(x){ return x.id === bundleId; });
    if (!b) return;

    var modal = qs('#bundleModal');
    if (!modal) return;

    var titleEl = qs('#bundleModalTitle', modal);
    if (titleEl) titleEl.textContent = b.title;

    var list = qs('#bundleModalItems', modal);
    if (list){
      list.innerHTML = b.items.map(function(it){
        var p = state.productById.get(it.productId);
        if (!p) return '';
        var price = Number.isFinite(p.bestPrice) ? p.bestPrice : null;
        var name = p.nameHe || p.name || '';
        var brand = p.brand || '';
        var url = (p.offers && p.offers[0] && p.offers[0].url) ? p.offers[0].url : '#';
        return (
          '<div class="bundleItem">' +
            '<div class="bundleItemMain">' +
              '<div class="bundleItemName">' + escapeHtml(brand) + ' — ' + escapeHtml(name) + '</div>' +
              (price != null ? '<div class="bundleItemPrice">' + fmtILS(price) + '</div>' : '') +
            '</div>' +
            '<a class="bundleItemLink" href="' + escapeHtml(url) + '" target="_blank" rel="noopener nofollow">פתחי באמזון</a>' +
          '</div>'
        );
      }).join('');
    }

    var totalEl = qs('#bundleModalTotal', modal);
    if (totalEl) totalEl.textContent = fmtILS(calcBundleTotal(b));

    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  function closeBundleModal(){
    var modal = qs('#bundleModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function wireModal(){
    var modal = qs('#bundleModal');
    if (!modal) return;
    var closeBtn = qs('[data-close-modal]', modal);
    if (closeBtn) closeBtn.addEventListener('click', closeBundleModal);
    modal.addEventListener('click', function(e){
      if (e.target === modal) closeBundleModal();
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeBundleModal();
    });
  }

  function init(){
    wireModal();

    Promise.all([
      loadJson('data/products.json'),
      loadJson('data/bundles.json')
    ]).then(function(res){
      state.products = normalizeProducts(res[0]);
      state.bundles = normalizeBundles(res[1]);
      state.productById = new Map(state.products.map(function(p){ return [p.id, p]; }));
      render();
    }).catch(function(err){
      console.error(err);
      var grid = qs('#bundlesGrid');
      if (grid) grid.innerHTML = '<div class="emptyState">שגיאה בטעינת באנדלים. נסו לרענן.</div>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
