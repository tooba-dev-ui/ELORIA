/* ==========================================================================
   ELORIA Watches — single shared script (loaded on every page)
   Handles: mobile menu, visitor counter, product cards, search & sort,
   product details popup, favourites, cart, gallery viewer, contact form.
   Product data lives in js/catalog.js (window.ELORIA_CATALOG).
   ========================================================================== */
(function () {
  "use strict";

  var CART_KEY = "eloria_cart";
  var FAV_KEY = "eloria_favorites";
  var VISIT_KEY = "eloriaTotalSiteVisits";
  var CATALOG = window.ELORIA_CATALOG || {};
  var LABELS = { classic: "Classic", vintage: "Vintage", smart: "Smart", luxury: "Luxury", kids: "Kids" };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- helpers ---------- */
  var ALL = [];
  Object.keys(CATALOG).forEach(function (cat) { ALL = ALL.concat(CATALOG[cat]); });
  function findById(id) { return ALL.filter(function (p) { return p.id === id; })[0] || null; }
  function findByName(name) { return ALL.filter(function (p) { return p.name === name; })[0] || null; }
  function money(n) { return "Rs. " + Number(n || 0).toLocaleString("en-PK"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function imgSrc(path) { return encodeURI(path); }
  function categoryLabel(p) { return (LABELS[p.category] || "ELORIA") + " collection"; }

  function read(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast("Your browser could not save this change. Please check your storage settings."); return false; }
  }
  function snapshot(p) { return { id: p.id, name: p.name, price: p.price, image: p.image, category: p.category }; }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    // force reflow so the transition restarts when called twice quickly
    void t.offsetWidth;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  /* ---------- visitor counter (browser-local demo) ---------- */
  function initVisitors() {
    var el = $("#visitorCount");
    if (!el) return;
    try {
      var n = (Number(localStorage.getItem(VISIT_KEY)) || 0) + 1;
      localStorage.setItem(VISIT_KEY, n);
      el.textContent = n.toLocaleString("en-US");
    } catch (e) { el.textContent = "—"; }
  }

  /* ---------- mobile menu ---------- */
  function initMenu() {
    var btn = $(".menu-btn"), inner = $(".header-inner");
    if (!btn || !inner) return;
    btn.addEventListener("click", function () {
      var open = inner.classList.toggle("mobile-nav-open");
      btn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && inner.classList.contains("mobile-nav-open")) {
        inner.classList.remove("mobile-nav-open"); btn.setAttribute("aria-expanded", "false"); btn.focus();
      }
    });
  }

  /* ---------- counts & favourite state ---------- */
  function cartQty() { return read(CART_KEY).reduce(function (s, i) { return s + Math.max(0, Number(i.quantity) || 0); }, 0); }
  function refreshState() {
    $$("[data-count='cart']").forEach(function (n) { n.textContent = String(cartQty()); });
    var favs = read(FAV_KEY), favIds = favs.map(function (f) { return f.id; });
    $$("[data-count='fav']").forEach(function (n) { n.textContent = String(favs.length); });
    $$(".fav-btn, [data-action='fav'][data-id]").forEach(function (b) {
      var on = favIds.indexOf(b.getAttribute("data-id")) !== -1;
      b.setAttribute("aria-pressed", String(on));
      if (b.classList.contains("fav-btn")) {
        b.textContent = on ? "♥" : "♡";
        b.setAttribute("aria-label", (on ? "Remove " : "Add ") + (b.getAttribute("data-name") || "this watch") + (on ? " from favourites" : " to favourites"));
      } else if (b.id === "modalFav") {
        b.textContent = on ? "♥ SAVED TO FAVOURITES" : "♡ SAVE TO FAVOURITES";
      }
    });
  }

  /* ---------- cart / favourite actions ---------- */
  function addToCart(p) {
    var cart = read(CART_KEY), line = cart.filter(function (i) { return i.id === p.id; })[0];
    if (line) line.quantity = Math.min(99, (Number(line.quantity) || 0) + 1);
    else { var s = snapshot(p); s.quantity = 1; cart.push(s); }
    if (write(CART_KEY, cart)) { refreshState(); toast(p.name + " added to your cart"); return true; }
    return false;
  }
  function toggleFav(p) {
    var favs = read(FAV_KEY), idx = -1;
    favs.forEach(function (f, i) { if (f.id === p.id) idx = i; });
    if (idx === -1) { favs.push(snapshot(p)); toast(p.name + " saved to favourites"); }
    else { favs.splice(idx, 1); toast(p.name + " removed from favourites"); }
    if (write(FAV_KEY, favs)) { refreshState(); renderFavouritesPage(); }
  }

  /* ---------- product card (the one and only card design) ---------- */
  function cardHTML(p) {
    return '<article class="product-card" data-id="' + esc(p.id) + '">' +
      '<div class="product-image">' +
        '<img src="' + esc(imgSrc(p.image)) + '" alt="' + esc(p.name) + ' watch" loading="lazy">' +
        (p.tag ? '<span class="product-tag">' + esc(p.tag) + '</span>' : '') +
        '<button class="fav-btn" type="button" data-action="fav" data-id="' + esc(p.id) + '" data-name="' + esc(p.name) + '" aria-pressed="false" aria-label="Add ' + esc(p.name) + ' to favourites">♡</button>' +
      '</div>' +
      '<div class="product-info">' +
        '<small>' + esc(categoryLabel(p)) + '</small>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p>' + esc(p.description) + '</p>' +
        '<div class="product-bottom">' +
          '<span class="price">' + money(p.price) + '</span>' +
          '<button class="details-btn" type="button" data-action="details" data-id="' + esc(p.id) + '">VIEW DETAILS ↗</button>' +
        '</div>' +
        '<button class="btn add-btn" type="button" data-action="cart" data-id="' + esc(p.id) + '">ADD TO CART</button>' +
      '</div>' +
    '</article>';
  }

  /* ---------- home page: best sellers ---------- */
  function renderFeatured() {
    var grid = $("[data-featured]");
    if (!grid) return;
    var picks = [];
    Object.keys(CATALOG).forEach(function (cat) {
      CATALOG[cat].filter(function (p) { return p.tag === "BESTSELLER"; }).forEach(function (p) { picks.push(p); });
    });
    grid.innerHTML = picks.map(cardHTML).join("");
  }

  /* ---------- collection pages: search + sort ---------- */
  function renderCollection() {
    var grid = $("#productGrid");
    if (!grid) return;
    var cat = document.body.getAttribute("data-category");
    var all = CATALOG[cat] || [];
    var q = ($("#productSearch") ? $("#productSearch").value : "").toLowerCase().trim();
    var sort = $("#sortProducts") ? $("#sortProducts").value : "featured";
    var items = all.filter(function (p) { return (p.name + " " + p.description).toLowerCase().indexOf(q) !== -1; });
    if (sort === "price-low") items.sort(function (a, b) { return a.price - b.price; });
    else if (sort === "price-high") items.sort(function (a, b) { return b.price - a.price; });
    else items.sort(function (a, b) { return a.order - b.order; });
    grid.innerHTML = items.map(cardHTML).join("");
    var count = $("#productCount");
    if (count) count.textContent = "Showing " + items.length + " of " + all.length + " watches";
    var empty = $("#emptyState");
    if (empty) empty.classList.toggle("show", items.length === 0);
    refreshState();
  }
  function initCollection() {
    if (!$("#productGrid")) return;
    var search = $("#productSearch"), sort = $("#sortProducts"), form = $(".search");
    if (search) search.addEventListener("input", renderCollection);
    if (sort) sort.addEventListener("change", renderCollection);
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); renderCollection(); });
    renderCollection();
  }

  /* ---------- product details popup ---------- */
  var lastFocus = null, currentId = null;
  function openDetails(id, trigger) {
    var p = findById(id), modal = $("#productModal");
    if (!p || !modal) return;
    currentId = id; lastFocus = trigger || document.activeElement;
    $("#modalImage").src = imgSrc(p.image);
    $("#modalImage").alt = p.name + " watch";
    $("#modalCategory").textContent = categoryLabel(p);
    $("#modalName").textContent = p.name;
    $("#modalDescription").textContent = p.description;
    $("#modalPrice").textContent = money(p.price);
    var ul = $("#modalSpecs"); ul.innerHTML = "";
    (p.specs || []).forEach(function (s) { var li = document.createElement("li"); li.textContent = s; ul.appendChild(li); });
    $("#modalCart").setAttribute("data-id", id);
    $("#modalFav").setAttribute("data-id", id);
    $("#modalFav").setAttribute("data-name", p.name);
    refreshState();
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $(".close-modal", modal).focus();
  }
  function closeDetails() {
    var modal = $("#productModal");
    if (!modal || !modal.classList.contains("open")) return;
    modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentId = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function trapFocus(e, container) {
    if (e.key !== "Tab") return;
    var f = $$("a[href], button:not([disabled]), input, select, textarea", container).filter(function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- cart & favourites pages ---------- */
  function resolve(item) { return findById(item.id) || findByName(item.name) || item; }
  function lineHTML(item, kind) {
    var p = resolve(item), q = Math.max(1, Number(item.quantity) || 1);
    var controls = kind === "cart"
      ? '<div class="line-controls">' +
          '<div class="qty" role="group" aria-label="Quantity for ' + esc(p.name) + '">' +
            '<button type="button" data-line="dec" data-id="' + esc(item.id) + '" aria-label="Decrease quantity">−</button>' +
            '<output>' + q + '</output>' +
            '<button type="button" data-line="inc" data-id="' + esc(item.id) + '" aria-label="Increase quantity">+</button>' +
          '</div>' +
          '<strong class="price">' + money(p.price * q) + '</strong>' +
          '<button class="link-btn" type="button" data-line="remove-cart" data-id="' + esc(item.id) + '">Remove</button>' +
        '</div>'
      : '<div class="line-actions">' +
          '<button class="btn btn-sm" type="button" data-line="fav-to-cart" data-id="' + esc(item.id) + '">ADD TO CART</button>' +
          '<button class="link-btn" type="button" data-line="remove-fav" data-id="' + esc(item.id) + '">Remove</button>' +
        '</div>';
    return '<article class="line-item">' +
      '<img src="' + esc(imgSrc(p.image)) + '" alt="' + esc(p.name) + ' watch" loading="lazy">' +
      '<div><small>' + esc(categoryLabel(p)) + '</small><h3>' + esc(p.name) + '</h3><span class="price">' + money(p.price) + '</span></div>' +
      controls + '</article>';
  }
  function renderCartPage() {
    var box = $("#cartItems");
    if (!box) return;
    var cart = read(CART_KEY).filter(function (i) { return Number(i.quantity) > 0; });
    var total = cart.reduce(function (s, i) { return s + resolve(i).price * i.quantity; }, 0);
    box.innerHTML = cart.length
      ? cart.map(function (i) { return lineHTML(i, "cart"); }).join("")
      : '<div class="ecom-empty"><p>Your cart is empty.</p><a class="btn" href="index.html#collections">EXPLORE COLLECTIONS</a></div>';
    $("#cartSubtotal").textContent = money(total);
    $("#cartTotal").textContent = money(total);
    var summary = $("#cartSummary"); if (summary) summary.hidden = cart.length === 0;
  }
  function renderFavouritesPage() {
    var box = $("#favouriteItems");
    if (!box) return;
    var favs = read(FAV_KEY);
    box.innerHTML = favs.length
      ? favs.map(function (i) { return lineHTML(i, "fav"); }).join("")
      : '<div class="ecom-empty"><p>You haven’t saved any favourites yet.</p><a class="btn" href="index.html#collections">EXPLORE COLLECTIONS</a></div>';
  }
  function changeQty(id, delta) {
    var cart = read(CART_KEY);
    cart.forEach(function (i) { if (i.id === id) i.quantity = Math.min(99, (Number(i.quantity) || 0) + delta); });
    write(CART_KEY, cart.filter(function (i) { return i.quantity > 0; }));
    refreshState(); renderCartPage();
  }

  /* ---------- gallery viewer ---------- */
  function initGallery() {
    var cards = $$(".gallery-card");
    if (!cards.length) return;
    var box = document.createElement("div");
    box.className = "modal lightbox"; box.setAttribute("aria-hidden", "true");
    box.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="Enlarged image" style="display:block;background:transparent;box-shadow:none;width:auto;overflow:visible"><button class="close-modal" type="button" aria-label="Close image">×</button><img alt=""></div>';
    document.body.appendChild(box);
    var img = $("img", box), prev = null;
    function close() { box.classList.remove("open"); box.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; if (prev) prev.focus(); }
    cards.forEach(function (c) {
      c.addEventListener("click", function (e) {
        e.preventDefault(); prev = c;
        img.src = $("img", c).getAttribute("src"); img.alt = $("img", c).alt;
        box.classList.add("open"); box.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
        $(".close-modal", box).focus();
      });
    });
    box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("close-modal")) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("open")) close(); trapFocus(e, box); });
  }

  /* ---------- contact form ---------- */
  function initContact() {
    var form = $("#contactForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var body = "Name: " + d.get("name") + "\nEmail: " + d.get("email") + "\nTopic: " + d.get("topic") + "\n\n" + d.get("message");
      var to = form.getAttribute("data-mailto") || "";
      var ok = $("#formSuccess");
      if (ok) ok.classList.add("show");
      window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent("ELORIA enquiry: " + d.get("topic")) + "&body=" + encodeURIComponent(body);
      form.reset();
    });
  }

  /* ---------- global event delegation ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-action], [data-line]");
    if (t && t.hasAttribute("data-action")) {
      var id = t.getAttribute("data-id"), p = findById(id), action = t.getAttribute("data-action");
      if (!p) return;
      if (action === "details") openDetails(id, t);
      else if (action === "cart") {
        if (addToCart(p) && t.classList.contains("add-btn")) {
          t.classList.add("added"); t.textContent = "ADDED ✓";
          setTimeout(function () { t.classList.remove("added"); t.textContent = "ADD TO CART"; }, 1400);
        }
      } else if (action === "fav") toggleFav(p);
      return;
    }
    if (t && t.hasAttribute("data-line")) {
      var lid = t.getAttribute("data-id"), what = t.getAttribute("data-line");
      if (what === "inc") changeQty(lid, 1);
      else if (what === "dec") changeQty(lid, -1);
      else if (what === "remove-cart") { write(CART_KEY, read(CART_KEY).filter(function (i) { return i.id !== lid; })); refreshState(); renderCartPage(); }
      else if (what === "remove-fav") { write(FAV_KEY, read(FAV_KEY).filter(function (i) { return i.id !== lid; })); refreshState(); renderFavouritesPage(); }
      else if (what === "fav-to-cart") { var fp = findById(lid); if (fp) addToCart(fp); }
      return;
    }
    var modal = $("#productModal");
    if (modal && (e.target === modal || e.target.closest(".close-modal") && modal.contains(e.target))) closeDetails();
  });
  document.addEventListener("keydown", function (e) {
    var modal = $("#productModal");
    if (!modal || !modal.classList.contains("open")) return;
    if (e.key === "Escape") closeDetails(); else trapFocus(e, modal);
  });
  window.addEventListener("storage", function () { refreshState(); renderCartPage(); renderFavouritesPage(); });

  /* ---------- start ---------- */
  function init() {
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
    initVisitors(); initMenu(); renderFeatured(); initCollection();
    renderCartPage(); renderFavouritesPage(); initGallery(); initContact(); refreshState();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
