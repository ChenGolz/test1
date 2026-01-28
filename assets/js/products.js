// מוצרים page logic (RTL-friendly, data-normalized, performant)
(function () {
  const qs = (s) => document.querySelector(s);

  const q = qs("#q");
  const grid = qs("#grid");
  const liveCount = qs("#liveCount");

  const brandSelect = qs("#brandSelect");
  const storeSelect = qs("#storeSelect");
  

  // Card title layout: Brand -> short title (big) -> details (small, clamped)
  (function injectCardTitleStyles() {
    const STYLE_ID = "productCardTitleStyles";
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pNameSub{
        font-size: 0.88em;
        line-height: 1.25;
        margin-top: 4px;
        opacity: 0.9;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .tag--sale{
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  })();

const typeSelect = qs("#typeSelect"); // ✅ סוג מוצר (קבוצות + תתי-קטגוריות)
  const sortSel = qs("#sort");
  const clearBtn = qs("#clearFilters");
  const priceMinInput = qs("#priceMin");
  const priceMaxInput = qs("#priceMax");
  const priceApplyBtn = qs("#priceApplyBtn");

  const onlyLB = qs("#onlyLB");
  const onlyPeta = qs("#onlyPeta");
  const onlyVegan = null;
const onlyIsrael = qs("#onlyIsrael");
  const onlyMen = qs("#onlyMen");
  const onlyFreeShip = qs("#onlyFreeShip");

  const chips = Array.from(document.querySelectorAll(".chip"));
  let currentCat = "all";

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  
  function cleanupProductName(name, brand) {
    if (!name) return "";
    let result = String(name);

    // הסרה של שם המותג מתוך שם המוצר (אם מופיע)
    if (brand) {
      const brandEsc = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const brandRe = new RegExp("\\s*" + brandEsc + "\\s*", "gi");
      result = result.replace(brandRe, " ");
    }

    // מילים באנגלית שנוטות לחזור יחד עם המונח העברי (כמו Conditioner + מרכך)
    const duplicateEnglishWords = [
      "Conditioner",
      "Shampoo",
      "Mask",
      "Cream",
      "Serum",
      "Moisturizer",
      "Lotion",
      "Toner",
      "Cleanser",
      "Wash",
      "Scrub",
      "Peeling",
      "Gel",
      "Spray",
      "Mist",
      "Foam",
      "Mousse",
      "Oil",
      "Balm",
      "Exfoliant",
      "Pads",
      "Lipstick",
      "Lip Gloss",
      "Gloss",
      "Lip Color",
      "Foundation",
      "Primer",
      "Highlighter",
      "Blush",
      "Bronzer",
      "Concealer",
      "Palette",
      "Kit",
      "Set",
      "BB Cream",
      "CC Cream"
    ];

    duplicateEnglishWords.forEach((word) => {
      const re = new RegExp("\\s*" + word.replace(" ", "\\s+") + "\\s*", "gi");
      result = result.replace(re, " ");
    });

    // ניקוי רווחים כפולים
    result = result.replace(/\s+/g, " ").trim();
    return result;
  }

  // ✅ חלוקת שם המוצר ל"כותרת קצרה" + תיאור
  // הכותרת הקצרה מיועדת להציג סוג מוצר ברור (למשל: "סרום לשיער", "צללית נוזלית", "תוחם שפתיים")
  // והתיאור מציג את שאר המידע בטקסט קטן יותר.
  function getCardTitleParts(p) {
    const full = cleanupProductName(p.name || "", p.brand || "");
    const shortTitle = deriveShortTitle(p, full);
    const details = deriveDetails(p, full, shortTitle);
    return {
      shortTitle: shortTitle || full,
      details: details || ""
    };
  }

  function deriveShortTitle(p, fullName) {
    const text = String(fullName || "").trim();
    if (!text) return "";

    const lower = text.toLowerCase();
    const cats = Array.isArray(p.categories)
      ? p.categories.map((c) => String(c).toLowerCase())
      : [];

    const hasCat = (k) => cats.includes(k);
    const hasHeb = (re) => re.test(text);
    const hasEng = (re) => re.test(lower);

    // --- helper: area for titles like "סרום לשיער" ---
    const areaKey = (() => {
      if (hasCat("lips") || hasHeb(/שפת/i) || lower.includes("lip")) return "lips";
      if (hasCat("eyes") || hasHeb(/עינ|ריס|גבה/i) || lower.includes("eye") || lower.includes("brow")) return "eyes";
      if (hasCat("scalp") || hasHeb(/קרקפת/i) || lower.includes("scalp")) return "scalp";
      if (hasCat("hair") || hasHeb(/שיער/i) || lower.includes("hair")) return "hair";
      if (hasCat("teeth") || hasHeb(/שינ/i) || lower.includes("tooth")) return "teeth";
      if (hasCat("face") || hasHeb(/פנים/i) || lower.includes("face")) return "face";
      if (hasCat("body") || hasHeb(/גוף/i) || lower.includes("body")) return "body";
      return "";
    })();

    // --- MAKEUP: prioritize lips before eyes (fix lip liner -> not eyeliner) ---
    if (hasCat("makeup") || hasCat("eyes") || hasCat("face")) {
      // Lip liner / תוחם שפתיים
      if (/(lip\s*liner|lipliner)/i.test(lower) || /תוחם\s*שפת|עיפרון\s*שפת/i.test(text)) {
        return "תוחם שפתיים";
      }
      // Lip products
      if (
        /(lipstick|lip\s*balm|lip\s*gloss|lip\s*oil)/i.test(lower) ||
        /שפתון|באלם\s*שפתיים|שמן\s*שפתיים|גלוס|שפתיים/i.test(text)
      ) {
        if (/(lip\s*balm)/i.test(lower) || /באלם/i.test(text)) return "באלם לשפתיים";
        if (/(lip\s*gloss|gloss)/i.test(lower) || /גלוס/i.test(text)) return "גלוס";
        if (/(lip\s*oil)/i.test(lower) || /שמן\s*שפתיים/i.test(text)) return "שמן לשפתיים";
        return "שפתון";
      }

      // Eyeshadow / eye paint
      if (/(eyeshadow|eye\s*paint|shadow)/i.test(lower) || /צללית/i.test(text)) {
        if (/(liquid)/i.test(lower) || /נוזל|נוזלי|נוזלית/i.test(text)) return "צללית נוזלית";
        if (/(stick)/i.test(lower) || /סטיק/i.test(text)) return "צללית סטיק";
        if (/(cream)/i.test(lower) || /קרם/i.test(text)) return "צללית קרם";
        return "צללית";
      }

      // Eyeliner (only if NOT lips)
      if (/(eyeliner)/i.test(lower) || /אייליינר|תוחם\s*עינ/i.test(text)) {
        return "אייליינר";
      }

      // Mascara / lashes
      if (/(mascara)/i.test(lower) || /מסקרה/i.test(text)) {
        return "מסקרה";
      }

      // Brows
      if (/(brow)/i.test(lower) || /גבות|גבה/i.test(text)) {
        return "מוצר לגבות";
      }

      // Base
      if (/(foundation)/i.test(lower) || /מייקאפ/i.test(text)) return "מייקאפ";
      if (/(concealer)/i.test(lower) || /קונסילר/i.test(text)) return "קונסילר";
      if (/(blush)/i.test(lower) || /סומק/i.test(text)) return "סומק";
      if (/(bronzer)/i.test(lower) || /ברונזר/i.test(text)) return "ברונזר";
      if (/(palette)/i.test(lower) || /פלטה/i.test(text)) return "פלטה";

      // Tools
      if (/(brush|sponge|applicator)/i.test(lower) || /מברש|ספוג|אביזר/i.test(text)) return "אביזרי איפור";
    }

    // Sunscreen
    if (/קרם\s*הגנה|sunscreen|\bspf\b/i.test(lower) || /קרם\s*הגנה|SPF/i.test(text)) {
      if (areaKey === "lips") return "שפתון SPF";
      return "קרם הגנה";
    }

    // Tooth / oral
    if (/משחת\s*שיניים|toothpaste/i.test(lower) || /משחת\s*שיניים/i.test(text)) return "משחת שיניים";
    if (/whitening/i.test(lower) || /הלבנת\s*שיניים/i.test(text)) return "הלבנת שיניים";

    // Hair
    if (/שמפו|shampoo/i.test(lower) || /שמפו/i.test(text)) return "שמפו";
    if (/מרכך|conditioner/i.test(lower) || /מרכך/i.test(text)) return "מרכך";
    if (/מסכה/i.test(text) || /mask/i.test(lower)) {
      if (areaKey === "hair") return "מסכה לשיער";
      return "מסכה";
    }
    if (/שמן/i.test(text) || /\boil\b/i.test(lower)) {
      if (areaKey === "hair") return "שמן לשיער";
      if (areaKey === "lips") return "שמן לשפתיים";
      return "שמן";
    }

    // Serum
    if (/\bserum\b/i.test(lower) || /סרום/i.test(text) || /אמפול/i.test(text)) {
      if (areaKey === "hair") return "סרום לשיער";
      if (areaKey === "scalp") return "סרום לקרקפת";
      if (areaKey === "eyes") return "סרום לעיניים";
      if (areaKey === "lips") return "סרום לשפתיים";
      if (areaKey === "face") return "סרום לפנים";
      if (areaKey === "body") return "סרום לגוף";
      return "סרום";
    }

    // Cream / moisturizer
    if (/קרם|moisturizer|cream|lotion/i.test(lower) || /קרם|לחות/i.test(text)) {
      if (areaKey === "face") return "קרם פנים";
      if (areaKey === "body") return "קרם גוף";
      if (/לילה|night/i.test(lower) || /לילה/i.test(text)) return "קרם לילה";
      return "קרם";
    }

    // Cleanser / soap / wash
    if (/cleanser|wash|soap/i.test(lower) || /סבון|ניקוי|קצף/i.test(text)) {
      if (areaKey === "face") return "ניקוי פנים";
      return "ניקוי";
    }

    // Scrub / exfoliation
    if (/scrub|exfoli|peel/i.test(lower) || /פילינג|סקראב|קילוף/i.test(text)) {
      if (areaKey === "face") return "פילינג לפנים";
      return "פילינג";
    }

    // Fallback: first 2-3 words (Hebrew-friendly)
    const firstSeg = text.split(/[\|–—-]/)[0].split(",")[0].trim();
    const words = firstSeg.split(/\s+/).filter(Boolean);
    return words.slice(0, Math.min(3, words.length)).join(" ");
  }

  function deriveDetails(p, fullName, shortTitle) {
    let details = String(fullName || "").trim();
    if (!details) return "";
    const title = String(shortTitle || "").trim();
    if (!title) return details;

    // remove exact shortTitle if it appears in the string
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleRe = new RegExp("\\s*" + esc + "\\s*", "g");
    if (titleRe.test(details)) {
      details = details.replace(titleRe, " ");
    } else {
      // if title is synthetic (e.g., "סרום לשיער") remove the core type word
      if (title.includes("סרום")) details = details.replace(/\bסרום\b/g, " ").replace(/\bserum\b/gi, " ");
      if (title === "שמפו") details = details.replace(/\bשמפו\b/g, " ").replace(/\bshampoo\b/gi, " ");
      if (title === "מרכך") details = details.replace(/\bמרכך\b/g, " ").replace(/\bconditioner\b/gi, " ");
      if (title.includes("קרם הגנה")) details = details.replace(/קרם\s*הגנה/g, " ").replace(/\bsunscreen\b/gi, " ").replace(/\bspf\b/gi, " ");
      if (title.startsWith("קרם")) details = details.replace(/\bקרם\b/g, " ").replace(/\bcream\b/gi, " ");
      if (title.includes("צללית")) details = details.replace(/צללית/g, " ").replace(/\bshadow\b/gi, " ").replace(/\beyeshadow\b/gi, " ");
      if (title.includes("אייליינר")) details = details.replace(/אייליינר/g, " ").replace(/\beyeliner\b/gi, " ");
      if (title.includes("תוחם שפתיים")) details = details.replace(/תוחם\s*שפתיים/g, " ").replace(/lip\s*liner/gi, " ");
    }

    details = details
      .replace(/\s{2,}/g, " ")
      .replace(/^[\-–—:|]+\s*/g, "")
      .trim();

    return details;
  }


  // ---------------------------------------------------------------------------
  // Certifications / labels:
  // - If the product explicitly defines isVegan / isPeta / isLB (true/false), we use that.
  // - Otherwise, we auto-fill from data/intl-brands.json by matching the brand name.
  // - If the brand does not exist in intl-brands, labels are hidden by default.
  // - Missing params are OK (undefined) — we only show labels when value === true.
  // ---------------------------------------------------------------------------

  function pickBool() {
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] === "boolean") return arguments[i];
    }
    return undefined;
  }

  function normalizeBrandKey(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/\+/g, " ")
      .replace(/['’`]/g, "")
      .replace(/[^a-z0-9\u0590-\u05FF ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function flagsFromIntlBrand(b) {
    var badges = Array.isArray(b && b.badges) ? b.badges : [];
    var badgeStr = badges.map(function (x) { return String(x || "").toLowerCase(); }).join(" | ");

    var isLB = /leaping\s*bunny/.test(badgeStr);
    var isPeta = /\bpeta\b/.test(badgeStr);

    // "vegan" is also a direct boolean in intl-brands.json
    var isVegan = (typeof (b && b.vegan) === "boolean")
      ? b.vegan
      : /\bvegan\b/.test(badgeStr);

    return { isVegan: isVegan, isPeta: isPeta, isLB: isLB };
  }

  var __KBWG_BRAND_FLAGS = (function () {
    var arr = Array.isArray(window.INTL_BRANDS) ? window.INTL_BRANDS : [];
    var map = new Map();
    for (var i = 0; i < arr.length; i++) {
      var b = arr[i] || {};
      var name = b.name || b.brand || b.title || "";
      var key = normalizeBrandKey(name);
      if (!key || map.has(key)) continue;
      map.set(key, flagsFromIntlBrand(b));
    }
    return map;
  })();

  function resolveProductLabels(p) {
    var brandKey = normalizeBrandKey(p && p.brand ? p.brand : "");
    var fromBrand = __KBWG_BRAND_FLAGS.get(brandKey);

    return {
      isVegan: (typeof p.isVegan === "boolean") ? p.isVegan : (fromBrand ? fromBrand.isVegan : undefined),
      isPeta: (typeof p.isPeta === "boolean") ? p.isPeta : (fromBrand ? fromBrand.isPeta : undefined),
      isLB: (typeof p.isLB === "boolean") ? p.isLB : (fromBrand ? fromBrand.isLB : undefined)
    };
  }

  function enrichProductWithBrandLabels(p) {
    var labels = resolveProductLabels(p || {});
    return Object.assign({}, p, { __labels: labels });
  }



function normalizeProduct(p) {
    const offers = Array.isArray(p?.offers) ? p.offers : [];
    const storeRegion = String(p?.storeRegion ?? "").toLowerCase();

    return {
      ...p,
      // דגלים לוגיים אחידים
      isLB: pickBool(p?.isLB, p?.lb, p?.isLeapingBunny),
      isPeta: pickBool(p?.isPeta, p?.peta),
      isVegan: pickBool(p?.isVegan, p?.vegan),
      isIsrael: Boolean(p?.isIsrael ?? p?.israel ?? (storeRegion === "il")),
      // offers אחיד (meta, region, freeShipOver)
      offers: offers.map((o) => {
        const rawUrl = String(o?.url || "");
        const domain = rawUrl.split("/")[2] || "";
        let region = String(o?.region || "").toLowerCase();

        if (!region) {
          if (domain.includes("amazon.co.uk")) region = "uk";
          else if (domain.includes("amazon.com")) region = "us";
          else if (domain.includes("amazon.de")) region = "de";
          else if (domain.includes("amazon.fr")) region = "fr";
          else if (storeRegion && storeRegion !== "intl") region = storeRegion;
        }

        const rawFree = o?.freeShipOver ?? p?.freeShipOver;
        const freeNum =
          rawFree != null && rawFree !== "" ? Number(rawFree) : NaN;

        return {
          ...o,
          meta: o?.meta ?? o?.note ?? "",
          region,
          freeShipOver: Number.isFinite(freeNum) ? freeNum : null
        };
      })
    };
  }

  
  // --- Remove duplicate products (keeps first occurrence) ---
  // Dedup key priority: first offer URL -> affiliateLink -> brand+name+size+type
  function dedupeProducts(list) {
    const debug = /(?:\?|&)debug=1(?:&|$)/.test(location.search);
    const seen = new Set();
    const removed = [];
    const out = [];

    for (const p of list) {
      const offerUrl = (p.offers && p.offers[0] && p.offers[0].url) ? String(p.offers[0].url) : "";
      const affiliate = p.affiliateLink ? String(p.affiliateLink) : "";
      const fallback = [
        (p.brand || "").toLowerCase().trim(),
        (p.name || "").toLowerCase().trim(),
        (p.size || "").toLowerCase().trim(),
        (p.productTypeLabel || "").toLowerCase().trim()
      ].join("|");

      const key = (offerUrl || affiliate || fallback).trim();
      if (!key) {
        out.push(p);
        continue;
      }
      if (seen.has(key)) {
        removed.push({ key, name: p.name, brand: p.brand });
        continue;
      }
      seen.add(key);
      out.push(p);
    }

    if (debug && removed.length) {
      console.warn("[products] Removed duplicates:", removed);
    }
    return out;
  }


  // Source of truth: data/products.json (loaded by products-json-loader.js)
  // Policy: show only Vegan-labeled products.
  const data = dedupeProducts((window.PRODUCTS || []).map(normalizeProduct))
    .map(enrichProductWithBrandLabels)
    .filter((p) => Boolean(p && p.__labels && p.__labels.isVegan === true));

  function unique(arr) {
    return Array.from(new Set(arr))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "he"));
  }

  // --- קטגוריות לוגיות בסיסיות (JS) ---
  const CAT_ALIASES = {
    fragrances: "fragrance",
    perfume: "fragrance",
    perfumes: "fragrance",
    frag: "fragrance"
  };
  function normCat(v) {
    const s = String(v ?? "").trim().toLowerCase();
    return CAT_ALIASES[s] || s;
  }
  function getCatsRaw(p) {
    if (Array.isArray(p?.categories)) return p.categories.map(normCat).filter(Boolean);
    if (p?.category != null) return [normCat(p.category)].filter(Boolean);
    if (p?.cat != null) return [normCat(p.cat)].filter(Boolean);
    return [];
  }

  const CATEGORY_LABELS = {
    face: "פנים",
    hair: "שיער",
    body: "גוף",
    makeup: "איפור",
    fragrance: "בישום",
    sun: "שמש",
    teeth: "שיניים",
    baby: "ילדים",
    "mens-care": "גברים"
  };

  // סדר עדיפות לקטגוריה ראשית (כדי להימנע מ"אחר" כשיש רמזים ברורים)
  const CATEGORY_PRIORITY = [
    "makeup",
    "hair",
    "body",
    "sun",
    "teeth",
    "fragrance",
    "baby",
    "mens-care",
    "face"
  ];

  // מיפוי קטגוריות "טכניות" למשהו שמציגים באתר
  const CATEGORY_SYNONYMS = {
    skincare: "face",
    cleanser: "face",
    clean: "face",
    facewash: "face",
    face_wash: "face",
    soap: "body",
    suncare: "sun",
    spf: "sun",
    oral: "teeth",
    dental: "teeth"
  };

  function getPrimaryCategoryKey(p) {
    const cats = getCatsRaw(p);
    if (!cats.length) return "";

    // 1) קודם כל ננרמל מילים נפוצות (skincare/soap/spf וכו')
    const normed = cats.map((c) => CATEGORY_SYNONYMS[c] || c).filter(Boolean);

    // 2) אם יש קטגוריה מועדפת — ניקח אותה
    for (const key of CATEGORY_PRIORITY) {
      if (normed.includes(key)) return key;
    }

    // 3) אם יש גם body וגם skincare — נעדיף body (למשל סבון)
    if (normed.includes("body")) return "body";
    if (normed.includes("face")) return "face";

    // 4) אין התאמה — לא נחזיר "אחר" (פשוט אין קטגוריה)
    return "";
  }

  function getCategoryLabelFromProduct(p) {
    if (p.categoryLabel && p.categoryLabel !== "אחר") return p.categoryLabel;
    const key = getPrimaryCategoryKey(p);
    // ❌ לא מציגים "אחר" בכלל
    return key ? (CATEGORY_LABELS[key] || "") : "";
  }

  // Helper לבדיקת מילים בשם/תיאור
  function containsAny(haystackLower, words) {
    return words.some((w) => haystackLower.includes(w.toLowerCase()));
  }

  // ✅ קביעת "קבוצת סוג" לפי קטגוריה + מילים בשם
  // קבוצות: מוצרי איפור, טיפוח לפנים, טיפוח לגוף, עיצוב שיער, הגנה מהשמש,
  // בשמים, הלבנה וטיפוח השיניים, טיפוח לגבר, אחר.

  // Helper: האם המוצר ממוקד/מותאם לגברים (לפי שם ומילות מפתח)
  function isMenTargetedProduct(p) {
    if (!p) return false;
    // אפשרות לסמן מפורשות בדאטה בעתיד
    if (p.isMen) return true;

    // 1) קטגוריות/טייפים שמסומנים לגבר
    const cat = String(p.category || "").toLowerCase();
    const typeKey = String(p.productTypeKey || "").toLowerCase();
    if (cat === "mens-care" || typeKey.startsWith("men-") || typeKey.includes("mens")) return true;

    // 2) שם מוצר
    const name = p.name || "";
    const lower = name.toLowerCase();
    const hebMenRegex = /גבר|גברים|לגבר|לגברים/;
    const enMenRegex = /(men's|for men|for him|mens|pour homme|groom)/i;
    if (hebMenRegex.test(name) || enMenRegex.test(lower)) return true;

    // 3) שם מותג (למשל Every Man Jack)
    const brand = String(p.brand || "").toLowerCase();
    const brandMenRegex = /(\bmen\b|\bman\b|mens|groom|shave|beard)/i;
    return brandMenRegex.test(brand);
  }

  function getTypeGroupLabel(p) {
    const catKey = getPrimaryCategoryKey(p); // face / hair / body / makeup / fragrance / ...
    const nameLower = (p.productTypeLabel || p.name || "").toLowerCase();

    const isTeeth = containsAny(nameLower, [
      "tooth",
      "teeth",
      "שן",
      "שיניים",
      "toothpaste",
      "whitening"
    ]);

    if (isTeeth) {
      return "הלבנה וטיפוח השיניים";
    }

    const isMen =
      /גבר|גברים|men's|for men|for him|pour homme/i.test(nameLower);

    if (catKey === "makeup") return "מוצרי איפור";

    if (catKey === "face") {
      if (isMen) return "טיפוח לגבר";
      return "טיפוח לפנים";
    }

    if (catKey === "body") {
      if (isMen) return "טיפוח לגבר";
      return "טיפוח לגוף";
    }

    if (catKey === "hair") {
      if (isMen) return "טיפוח לגבר";
      return "עיצוב שיער";
    }

    if (catKey === "fragrance") {
      return "בשמים";
    }

    if (catKey === "sun" || catKey === "suncare" || catKey === "spf") {
      return "הגנה מהשמש";
    }

    if (isMen) return "טיפוח לגבר";

    // ברירת מחדל (לא מציגים "אחר")
    return "טיפוח לפנים";
  }

  // ✅ קביעת "תת-סוג" לפי הקבוצה + מילים בשם
  // (למשל "קרם פנים", "סרום", "מסכה לשיער", "שפתיים", "עיניים" וכו׳)
  function getTypeDisplayLabel(p) {
    const group = getTypeGroupLabel(p);
    const name = (p.name || p.productTypeLabel || "").trim();
    if (!name) return "";
    const lower = name.toLowerCase();

    // מוצרי איפור
    if (group === "מוצרי איפור") {
      if (containsAny(lower, ["lip", "שפתיים", "שפתון", "gloss"])) {
        return "שפתיים";
      }
      if (
        containsAny(lower, [
          "eye",
          "eyes",
          "עיניים",
          "ריסים",
          "מסקרה",
          "eyeliner",
          "brow"
        ])
      ) {
        return "עיניים";
      }
      if (containsAny(lower, ["nail", "ציפורניים", "לק"])) {
        return "ציפורניים";
      }
      if (
        containsAny(lower, [
          "brush",
          "מברשת",
          "sponge",
          "applicator",
          "tools",
          "אביזר"
        ])
      ) {
        return "אביזרי איפור";
      }
      // סטים אמיתיים – קיטים/סטים/מארזים, אבל לא פלטות
      if (
        containsAny(lower, [
          "kit",
          "מארז",
          "ערכת"
        ])
      ) {
        return "סטים ומארזים";
      }
      // פלטות – ברירת מחדל כפנים
      if (containsAny(lower, ["palette", "פלטה"])) {
        return "פנים";
      }
      // כל השאר – סומק/פודרה/מייקאפ וכו׳
      return "פנים";
    }

    // טיפוח לפנים
    if (group === "טיפוח לפנים") {
      if (
        containsAny(lower, [
          "eye",
          "eyes",
          "עיניים",
          "אזור העיניים",
          "שפתיים",
          "lip"
        ])
      ) {
        return "עיניים ושפתיים";
      }
      if (
        containsAny(lower, [
          "mask",
          "מסכה",
          "peel",
          "פילינג",
          "exfoli",
          "scrub"
        ])
      ) {
        return "פילינג ומסכות";
      }
      if (containsAny(lower, ["serum", "סרום", "אמפול"])) {
        return "סרום";
      }
      if (
        containsAny(lower, [
          "cream",
          "קרם",
          "moisturizer",
          "לחות",
          "ג'ל לחות",
          "gel-cream"
        ])
      ) {
        return "קרם פנים";
      }
      if (
        containsAny(lower, [
          "cleanser",
          "ניקוי",
          "wash",
          "face wash",
          "מי פנים",
          "טונר",
          "toner",
          "micellar",
          "מים מיסלריים",
          "balance",
          "איזון"
        ])
      ) {
        return "ניקוי ואיזון";
      }
      if (
        containsAny(lower, [
          "palette",
          "kit",
          "מארז",
          "ערכת",
          "collection"
        ])
      ) {
        return "סטים ומארזים";
      }
      return "ניקוי ואיזון";
    }

    // טיפוח לגוף
    if (group === "טיפוח לגוף") {
      if (containsAny(lower, ["יד", "ידיים", "hands", "hand"])) {
        return "קרמי ידיים";
      }
      if (
        containsAny(lower, ["רגל", "רגליים", "feet", "foot", "heels", "heel"])
      ) {
        return "קרמי רגליים";
      }
      if (containsAny(lower, ["פילינג", "scrub", "exfoli"])) {
        return "פילינגים";
      }
      if (
        containsAny(lower, [
          "deo",
          "deodorant",
          "דאודורנט",
          "soap",
          "סבון",
          "wash",
          "shower",
          "gel douche",
          "body wash"
        ])
      ) {
        return "סבונים ודאודורנטים";
      }
      if (
        containsAny(lower, [
          "palette",
          "kit",
          "מארז",
          "ערכת",
          "collection"
        ])
      ) {
        return "סטים ומארזים";
      }
      // כל השאר: קרמי גוף למיניהם
      return "קרמי גוף";
    }

    // עיצוב שיער
    if (group === "עיצוב שיער") {
      if (containsAny(lower, ["shampoo", "שמפו"])) {
        return "שמפו";
      }
      if (containsAny(lower, ["conditioner", "מרכך"])) {
        return "מרכך";
      }
      if (containsAny(lower, ["mask", "מסכה"])) {
        return "מסכה לשיער";
      }
      // מוס, ספריי, קרם תלתלים וכו׳
      return "טיפוח ועיצוב שיער";
    }

    // הגנה מהשמש
    if (group === "הגנה מהשמש") {
      if (
        containsAny(lower, ["self tan", "self-tan", "שיזוף עצמי", "bronzing"])
      ) {
        return "שיזוף עצמי";
      }
      if (containsAny(lower, ["face", "פנים"])) {
        return "הגנה לפנים";
      }
      if (containsAny(lower, ["body", "גוף", "ידיים", "רגליים"])) {
        return "הגנה לגוף";
      }
      return "הגנה לפנים";
    }

    // בשמים
    if (group === "בשמים") {
      const isMen =
        /גבר|גברים|men's|for men|for him|pour homme/i.test(lower);
      if (isMen) return "בושם לגבר";
      return "בשמים לנשים";
    }

    // הלבנה וטיפוח השיניים
    if (group === "הלבנה וטיפוח השיניים") {
      return "הלבנה וטיפוח השיניים";
    }

    // טיפוח לגבר
    if (group === "טיפוח לגבר") {
      return "טיפוח לגבר";
    }

    // לא מחזירים "אחר" כדי שלא יוצג כטקסט מיותר
    return "";
  }

  function getCats(p) {
    return getCatsRaw(p);
  }

  // Free shipping helpers
  function getOfferWithMinFreeShip(p) {
    if (!Array.isArray(p?.offers)) return null;
    let bestOffer = null;
    p.offers.forEach((o) => {
      const v = typeof o.freeShipOver === "number" ? o.freeShipOver : null;
      if (v != null && !Number.isNaN(v)) {
        if (!bestOffer || v < bestOffer.freeShipOver) {
          bestOffer = o;
        }
      }
    });
    return bestOffer;
  }

  function getProductMinFreeShip(p) {
    const bestOffer = getOfferWithMinFreeShip(p);
    return bestOffer ? bestOffer.freeShipOver : null;
  }

  function formatFreeShipText(o) {
    if (!o || o.freeShipOver == null || Number.isNaN(o.freeShipOver)) return "";
    // This project stores Amazon free-shipping thresholds in USD.
    // Display: "משלוח חינם לישראל מעל $X (Y ש\"ח )"
    const usd = o.freeShipOver;
    // Approximate conversion (kept simple + stable for UI copy).
    // Chosen so $49 ≈ ₪160 (as used across the site copy).
    const ILS_PER_USD = 3.27;
    const ilsApprox = Math.round((usd * ILS_PER_USD) / 5) * 5;
    return `משלוח חינם לישראל מעל ${ilsApprox} ש"ח`;
  }

  function formatSizeForIsrael(rawSize) {
    const original = String(rawSize || "").trim();
    if (!original) return "";

    const lower = original.toLowerCase();

    if (
      lower.includes("ml") ||
      lower.includes('מ"ל') ||
      lower.includes("מ״ל") ||
      lower.includes("גרם") ||
      lower.includes("g")
    ) {
      return original;
    }

    const ozMatch = lower.match(/(\d+(?:\.\d+)?)\s*(fl\.?\s*)?oz/);
    if (ozMatch) {
      const qty = parseFloat(ozMatch[1]);
      if (!Number.isNaN(qty)) {
        const ml = qty * 29.5735;
        const rounded = Math.round(ml / 5) * 5;
        return `${rounded} מ״ל`;
      }
    }

    return original;
  }

  function getProductPriceRange(p) {
    // Return the *real* min/max range (no bucketing).
    // Priority:
    // 1) explicit priceMin/priceMax on product
    // 2) min/max of offer prices
    // 3) null if unknown

    const minExplicit = (typeof p?.priceMin === "number" && Number.isFinite(p.priceMin)) ? p.priceMin : null;
    const maxExplicit = (typeof p?.priceMax === "number" && Number.isFinite(p.priceMax)) ? p.priceMax : null;

    // If explicit range exists, use it (and normalize if only one side exists)
    if (minExplicit != null || maxExplicit != null) {
      const min = minExplicit != null ? minExplicit : maxExplicit;
      const max = maxExplicit != null ? maxExplicit : minExplicit;
      const a = Math.round(Math.min(min, max));
      const b = Math.round(Math.max(min, max));
      return [a, b];
    }

    // Otherwise, compute from offer prices
    const offerPrices = [];
    if (Array.isArray(p?.offers)) {
      p.offers.forEach((o) => {
        const v = typeof o?.price === "number" ? o.price : null;
        if (v != null && Number.isFinite(v)) offerPrices.push(v);
      });
    }

    if (!offerPrices.length) return null;
    const min = Math.round(Math.min.apply(null, offerPrices));
    const max = Math.round(Math.max.apply(null, offerPrices));
    return [min, max];
  }

  function getStoreDisplayName(p, o) {
    const rawStore = String(o?.store || p?.storeName || "").trim();
    const region = String(o?.region || "").toLowerCase();
    const isAmazon = rawStore.toLowerCase().includes("amazon");

    if (!isAmazon) {
      return rawStore || "חנות";
    }

    switch (region) {
      case "uk":
        return "אמזון אנגליה (Amazon UK)";
      case "us":
        return "אמזון ארה״ב (Amazon US)";
      case "de":
        return "אמזון גרמניה (Amazon DE)";
      case "fr":
        return "אמזון צרפת (Amazon FR)";
      case "il":
        return "אמזון ישראל";
      default:
        return "אמזון בינלאומי (Amazon)";
    }
  }

  function buildSelects() {
    // מותג dropdown
    if (brandSelect) {
      unique(data.map((p) => p.brand)).forEach((b) => {
        const o = document.createElement("option");
        o.value = b;
        o.textContent = b;
        brandSelect.appendChild(o);
      });
    }

    // Store dropdown (separate Amazon US / Amazon UK וכו׳)
    if (storeSelect) {
      unique(
        data.flatMap((p) =>
          (p.offers || [])
            .map((o) => getStoreDisplayName(p, o))
            .filter(Boolean)
        )
      ).forEach((label) => {
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        storeSelect.appendChild(opt);
      });
    }

    // ✅ Type dropdown – optgroups לפי הקבוצות, ו-options לפי תתי-הקטגוריה
    if (typeSelect) {
      typeSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "כל סוגי המוצרים";
      typeSelect.appendChild(placeholder);

      const groupsByType = new Map(); // groupLabel -> Set(subTypeLabel)

      data.forEach((p) => {
        const groupLabel = getTypeGroupLabel(p);
        const typeLabel = getTypeDisplayLabel(p);
        if (!groupLabel || !typeLabel) return;
        if (!groupsByType.has(groupLabel)) {
          groupsByType.set(groupLabel, new Set());
        }
        groupsByType.get(groupLabel).add(typeLabel);
      });

      const groupOrder = [
        "מוצרי איפור",
        "טיפוח לפנים",
        "הלבנה וטיפוח השיניים",
        "טיפוח לגוף",
        "עיצוב שיער",
        "הגנה מהשמש",
        "בשמים",
        "טיפוח לגבר"
      ];

      groupOrder.forEach((groupLabel) => {
        const set = groupsByType.get(groupLabel);
        if (!set || set.size === 0) return;

        const optGroup = document.createElement("optgroup");
        optGroup.label = groupLabel;

        Array.from(set)
          .sort((a, b) => a.localeCompare(b, "he"))
          .forEach((typeLabel) => {
            const o = document.createElement("option");
            o.value = `${groupLabel}::${typeLabel}`;
            o.textContent = typeLabel;
            optGroup.appendChild(o);
          });

        typeSelect.appendChild(optGroup);
      });
    }
  }

  function matches(p) {
    const text = (q?.value || "").trim().toLowerCase();
    const brand = brandSelect?.value || "";
    const store = storeSelect?.value || "";
    const typeVal = typeSelect?.value || ""; // "קבוצה::תת-קטגוריה"

    const predicates = [
      // פילטר קטגוריות עליונות (chips)
      () => currentCat === "all" || getCats(p).includes(normCat(currentCat)),

      // מותג
      () => !brand || p.brand === brand,

      // Store
      () => !store || (p.offers || []).some((o) => getStoreDisplayName(p, o) === store),

      // ✅ Type לפי קבוצה + תת-קטגוריה
      () => {
        if (!typeVal) return true;
        const [groupSel, typeSel] = typeVal.split("::");
        const group = getTypeGroupLabel(p);
        if (group !== groupSel) return false;
        const typeLabel = getTypeDisplayLabel(p);
        return typeLabel === typeSel;
      },

      // Approvals
      () => !onlyLB?.checked || (p.__labels && p.__labels.isLB === true),
      () => !onlyPeta?.checked || (p.__labels && p.__labels.isPeta === true),
      () => !onlyIsrael?.checked || p.isIsrael,
      // מוצרים המיועדים לגברים (לא תקף בקטגוריית איפור)
      () => {
        if (!onlyMen?.checked) return true;
        return isMenTargetedProduct(p);
      },

      // Only products with "free shipping over"
      () => {
        if (!onlyFreeShip?.checked) return true;
        const best = getProductMinFreeShip(p);
        return best != null;
      },

      // מחיר range
      () => {
        if (!priceMinInput && !priceMaxInput) return true;

        const range = getProductPriceRange(p);
        if (!range) return true; // אם אין מידע על מחיר – לא מסננים לפי מחיר

        const [pMin, pMaxRaw] = range;
        const pMax = pMaxRaw ?? pMin ?? 0;

        const minVal = priceMinInput && priceMinInput.value !== "" ? Number(priceMinInput.value) : null;
        const maxVal = priceMaxInput && priceMaxInput.value !== "" ? Number(priceMaxInput.value) : null;

        // אם לא הוגדר מינימום ולא מקסימום – אין סינון מחיר
        if (minVal == null && maxVal == null) return true;

        // רק מינימום הוגדר – דורשים שכל הטווח של המוצר יהיה מעל / שווה למינימום
        if (minVal != null && maxVal == null) {
          return pMin >= minVal;
        }

        // רק מקסימום הוגדר – דורשים שהגבול התחתון של המוצר יהיה קטן מהמקסימום
        // כך, אם המקסימום הוא 50, טווח 50–100 *לא* יופיע; אם המקסימום הוא 51 – כן יופיע.
        if (minVal == null && maxVal != null) {
          return pMin < maxVal;
        }

        // שני הערכים הוגדרו – עובדים לפי חיתוך טווחים (overlap)
        if (pMax < minVal) return false; // טווח המוצר נגמר לפני המינימום
        if (pMin >= maxVal) return false; // טווח המוצר מתחיל אחרי / בדיוק בגבול המקסימום

        // אחרת – יש חיתוך בין הטווחים, ולכן המוצר רלוונטי
        return true;
      },


      // חיפוש טקסט חופשי

      () => {
        if (!text) return true;
        const hay = `${p.brand || ""} ${p.name || ""} ${getCats(p).join(" ")}`.toLowerCase();
        return hay.includes(text);
      }
    ];

    return predicates.every((fn) => fn());
  }

  function updatedTs(v) {
    if (typeof v === "number") return v;
    const t = Date.parse(String(v || ""));
    return Number.isFinite(t) ? t : 0;
  }

  function sortList(list) {
    const v = sortSel?.value || "updated";

    if (v === "price-low") {
      list.sort((a, b) => {
        const pa = Number(a.priceMin ?? a.priceRangeMin ?? Infinity);
        const pb = Number(b.priceMin ?? b.priceRangeMin ?? Infinity);
        if (pa !== pb) return pa - pb;
        const bd = String(a.brand || "").localeCompare(String(b.brand || ""), "he") ||
                   String(a.name || "").localeCompare(String(b.name || ""), "he");
        return bd;
      });
      return;
    }

    if (v === "brand-az") {
      list.sort((a, b) =>
        String(a.brand || "").localeCompare(String(b.brand || ""), "he") ||
        String(a.name || "").localeCompare(String(b.name || ""), "he")
      );
      return;
    }

    if (v === "name-az") {
      list.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "he") ||
        String(a.brand || "").localeCompare(String(b.brand || ""), "he")
      );
      return;
    }

    list.sort((a, b) => {
      const diff = updatedTs(b.updated) - updatedTs(a.updated);
      if (diff) return diff;
      return (
        String(a.brand || "").localeCompare(String(b.brand || ""), "he") ||
        String(a.name || "").localeCompare(String(b.name || ""), "he")
      );
    });
  }

  function tag(label, extraClass) {
    const s = document.createElement("span");
    s.className = "tag" + (extraClass ? " " + extraClass : "");
    s.textContent = label;
    // Don’t translate certification tags/badges (Weglot)
    if (/(Leaping Bunny|PETA|Vegan|INTL|טבעוני)/i.test(String(label))) {
      s.setAttribute("data-wg-notranslate", "true");
      s.classList.add("wg-notranslate");
    }
    return s;
  }

  let renderRaf = 0;
  function scheduleRender() {
    cancelAnimationFrame(renderRaf);
    renderRaf = requestAnimationFrame(render);
  }

  function render() {
    if (!grid) return;

    const list = data.filter(matches);
    sortList(list);

    const frag = document.createDocumentFragment();

    list.forEach((p) => {
      const card = document.createElement("article");
      card.className = "productCard";

      const media = document.createElement("div");
      media.className = "pMedia";
      if (p.image) {
        const img = document.createElement("img");
        img.src = p.image;
        img.alt = p.name || "";
        img.loading = "lazy";
        img.decoding = "async";
        img.width = 640;
        img.height = 640;
        media.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "pPlaceholder";
        ph.textContent = "🧴";
        ph.setAttribute("aria-hidden", "true");
        media.appendChild(ph);
      }

      const content = document.createElement("div");
      content.className = "pContent";

      const header = document.createElement("div");
      header.className = "pHeader";

      const titleWrap = document.createElement("div");
      titleWrap.className = "pTitleWrap";
      const brand = document.createElement("div");
      brand.className = "pBrand";
      brand.textContent = p.brand || "";

      const parts = getCardTitleParts(p);

      const shortTitle = document.createElement("div");
      shortTitle.className = "pName";
      shortTitle.textContent = parts.shortTitle || cleanupProductName(p.name || "", p.brand || "");

      const details = document.createElement("div");
      details.className = "pNameSub";
      details.textContent = parts.details || "";

      titleWrap.appendChild(brand);
      titleWrap.appendChild(shortTitle);
      if (parts.details) titleWrap.appendChild(details);

      const meta = document.createElement("div");
      meta.className = "pMeta";

      const categoryLabel = getCategoryLabelFromProduct(p);
      if (categoryLabel) {
        const c = document.createElement("span");
        c.className = "pMetaPill";
        c.textContent = categoryLabel;
        meta.appendChild(c);
      }

      if (p.size) {
        const s = document.createElement("span");
        s.className = "pMetaPill";
        s.textContent = formatSizeForIsrael(p.size);
        meta.appendChild(s);
      }

      const approvals = [];
      const lbl = (p && p.__labels) ? p.__labels : {};
      if (lbl.isPeta === true) approvals.push("PETA");
      if (lbl.isVegan === true) approvals.push("Vegan");
      if (lbl.isLB === true) approvals.push("Leaping Bunny");

      const bestOffer = getOfferWithMinFreeShip(p);
      if (bestOffer) {
        const fs = document.createElement("span");
        fs.className = "pMetaPill pMetaPill--freeShip";
        fs.textContent = formatFreeShipText(bestOffer);
        meta.appendChild(fs);
      }

      header.appendChild(titleWrap);
      header.appendChild(meta);

      const tags = document.createElement("div");
      tags.className = "tags";
      const lbl2 = (p && p.__labels) ? p.__labels : {};
      if (lbl2.isLB === true) tags.appendChild(tag("Leaping Bunny"));
      if (lbl2.isPeta === true) tags.appendChild(tag("PETA"));
      if (lbl2.isVegan === true) tags.appendChild(tag("טבעוני"));
      if (p.isDiscounted === true) tags.appendChild(tag("מבצע", "tag--sale"));
      if (p.isIsrael) tags.appendChild(tag("אתר ישראלי"));

      const offerList = document.createElement("div");
      offerList.className = "offerList";

      const offers = Array.isArray(p.offers) ? p.offers : [];
      offers.forEach((o) => {
        const row = document.createElement("div");
        row.className = "offer";

        const metaBox = document.createElement("div");
        const storeLabel = getStoreDisplayName(p, o);
        const safeStoreLabel = storeLabel ? escapeHtml(storeLabel) : "";
        // מציגים רק את שם החנות (כולל אזור, למשל Amazon ארה"ב / Amazon אנגליה)
        // כדי להימנע מכפל טקסט כמו "אמזון ארה"ב" פעמיים
        metaBox.innerHTML = `<div class="offerStore">${safeStoreLabel}</div>`;

        const a = document.createElement("a");
        a.className = "btn primary";
        a.href = o.url || "#";
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "לצפייה";

        row.appendChild(metaBox);
        row.appendChild(a);
        offerList.appendChild(row);
      });

      content.appendChild(header);
      content.appendChild(tags);

      const priceRange = getProductPriceRange(p);
      if (priceRange) {
        const [minPrice, maxPrice] = priceRange;
        const pr = document.createElement("div");
        pr.className = "pPriceRange";
        if (minPrice === maxPrice) {
          pr.textContent = `מחיר: ₪${minPrice}`;
        } else {
          pr.textContent = `טווח מחירים: ₪${minPrice} - ₪${maxPrice}`;
        }
        content.appendChild(pr);
      }

      content.appendChild(offerList);

      card.appendChild(media);
      card.appendChild(content);

      frag.appendChild(card);
    });

    grid.replaceChildren(frag);
    // Refresh Weglot after dynamic content is rendered
    if (window.Weglot && typeof window.Weglot.refresh === "function") {
      window.Weglot.refresh();
    }

    if (liveCount) liveCount.textContent = `${list.length} מוצרים`;

    const empty = qs("#emptyState");
    if (empty) empty.hidden = list.length !== 0;
  }

  
function bind() {
  const toolbar = document.querySelector(".toolbar-container");

  // Generic live filters: search, brand, store, sort, type, toggles, free-shipping
  toolbar?.addEventListener("input", (e) => {
    if (
      e.target &&
      e.target.matches(
        "#q, #brandSelect, #storeSelect, #typeSelect, #sort, #onlyLB, #onlyPeta, #onlyIsrael, #onlyFreeShip, #onlyMen"
      )
    ) {
      scheduleRender();
    }
  });

  toolbar?.addEventListener("change", (e) => {
    if (
      e.target &&
      e.target.matches(
        "#q, #brandSelect, #storeSelect, #typeSelect, #sort, #onlyLB, #onlyPeta, #onlyIsrael, #onlyFreeShip, #onlyMen"
      )
    ) {
      scheduleRender();
    }
  });

  // מחיר inputs: change min/max, then click "עדכון טווח" or just blur to refresh
  if (priceMinInput) {
    ["change"].forEach((evt) => {
      priceMinInput.addEventListener(evt, () => {
        // do not schedule immediately on every keystroke to avoid flicker;
        // we will let the change event or the button trigger
        scheduleRender();
      });
    });
  }
  if (priceMaxInput) {
    ["change"].forEach((evt) => {
      priceMaxInput.addEventListener(evt, () => {
        scheduleRender();
      });
    });
  }
  if (priceApplyBtn) {
    priceApplyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      scheduleRender();
    });
  }

  // Top category chips
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn || !btn.dataset.cat) return;
    const cat = btn.dataset.cat;
    if (!cat) return;
    currentCat = cat;
    const chips = Array.from(document.querySelectorAll(".chip"));
    chips.forEach((c) => c.classList.toggle("active", c === btn));
    scheduleRender();
  });

  // Clear-all filters
  clearBtn?.addEventListener("click", () => {
    const chips = Array.from(document.querySelectorAll(".chip"));
    q.value = "";
    brandSelect.value = "";
    storeSelect.value = "";
    sortSel.value = "price-low";
    typeSelect.value = "";
    onlyLB.checked = false;
    onlyPeta.checked = false;
onlyIsrael.checked = false;
    onlyFreeShip.checked = false;
    if (priceMinInput) priceMinInput.value = "";
    if (priceMaxInput) priceMaxInput.value = "";
    chips.forEach((c) => c.classList.remove("active"));
    const all = chips.find((c) => c.dataset.cat === "all");
    all && all.classList.add("active");
    currentCat = "all";
    scheduleRender();
  });
}
buildSelects();
  bind();
  render();
})();
