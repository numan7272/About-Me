/**
 * YekKasse — Fake-POS-System für das Yek-Building.
 *
 * Reworked (ui-ux-pro-max + impeccable): authentisch utilitarian, kein Slick.
 *   - Cream-Paper-Surface statt Dark-Slick Glas. Echte POS-Systeme sind
 *     funktional, kein modernes Dashboard.
 *   - Yek-Rot als 4px Top-Akzent + Active-States — kein Gradient-Header.
 *   - JetBrains Mono für Preise/Beträge (data role), Inter für Namen/UI.
 *   - Saubere Mobile: Cart slidet zu Modal-Bottom-Sheet auf < 720px.
 *   - alert() → Inline-Bon-Preview (sieht aus wie echter Drucker-Beleg).
 *   - SVG-Icons statt Emoji/✕/×.
 *   - Touch-Targets ≥ 44px, ESC schließt, role=dialog, aria-live für Cart.
 *
 * Story-Frame: "So sah meine Schicht aus. Hab da auch das offene WLAN gefunden."
 */

const ICONS = {
  x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`,
  cart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  info: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  check: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};

const MENU = [
  { cat: "Döner", items: [
    { name: "Döner Klassik",     price: 6.50 },
    { name: "Döner Box",          price: 8.50 },
    { name: "Dürum",              price: 7.50 },
    { name: "Lahmacun",           price: 5.00 },
  ]},
  { cat: "Pizza", items: [
    { name: "Margherita",         price: 8.00 },
    { name: "Salami",             price: 9.50 },
    { name: "Funghi",             price: 9.00 },
    { name: "Quattro Stagioni",  price: 11.50 },
  ]},
  { cat: "Getränke", items: [
    { name: "Cola 0,33 l",        price: 2.50 },
    { name: "Ayran",              price: 2.00 },
    { name: "Wasser 0,5 l",       price: 2.00 },
  ]},
];

const YEK_RED = "#b3263a";
const YEK_RED_DEEP = "#8a1b2c";

export class YekKasse {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this.cart = [];
    this._receiptOpen = false;
  }

  open() {
    if (this.dom) return;
    this._buildDom();
    document.body.appendChild(this.dom.root);
    requestAnimationFrame(() => { this.dom.root.style.opacity = "1"; });
  }

  close() {
    if (!this.dom) return;
    document.removeEventListener("keydown", this._onKey);
    this.dom.root.style.opacity = "0";
    const r = this.dom.root;
    this.dom = null;
    setTimeout(() => r.remove(), 220);
  }

  _buildDom() {
    const root = document.createElement("div");
    root.className = "yk-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Yek POS Kassensystem");
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #ebe6dc;
      color: #1d1815;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      opacity: 0; transition: opacity 220ms ease;
      overflow: hidden;
      display: flex; flex-direction: column;
    `;

    const style = document.createElement("style");
    style.textContent = `
      .yk-root, .yk-root *, .yk-root *::before, .yk-root *::after { box-sizing: border-box; }
      .yk-root :focus-visible {
        outline: 2px solid ${YEK_RED};
        outline-offset: 2px;
        border-radius: 2px;
      }

      .yk-bar {
        height: 52px;
        background: #fff;
        border-bottom: 1px solid #d6cfc0;
        border-top: 4px solid ${YEK_RED};
        display: flex; align-items: center;
        padding: 0 18px;
        gap: 16px;
        flex-shrink: 0;
      }
      .yk-logo {
        font-weight: 700; font-size: 15px;
        color: #1d1815;
        letter-spacing: -0.005em;
        display: flex; align-items: baseline; gap: 10px;
      }
      .yk-logo-tag {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: ${YEK_RED};
        letter-spacing: 0.05em;
      }
      .yk-station {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        color: #6a5f55;
        letter-spacing: 0.04em;
      }
      .yk-close {
        margin-left: auto;
        background: transparent;
        border: 1px solid #d6cfc0;
        color: #4a4038;
        padding: 7px 12px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
        display: flex; align-items: center; gap: 6px;
        min-height: 36px;
        transition: background 150ms, border-color 150ms;
      }
      .yk-close:hover { background: #f7f3eb; border-color: #9c9183; }

      .yk-layout {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 12px;
        padding: 12px;
        flex: 1;
        min-height: 0;
      }

      .yk-menu {
        overflow: auto;
        -webkit-overflow-scrolling: touch;
        padding-right: 4px;
      }
      .yk-cat {
        margin-bottom: 18px;
      }
      .yk-cat-title {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: ${YEK_RED};
        padding-bottom: 6px;
        border-bottom: 1px solid #d6cfc0;
        margin-bottom: 10px;
      }
      .yk-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 8px;
      }
      .yk-item {
        background: #fff;
        border: 1px solid #d6cfc0;
        border-radius: 3px;
        padding: 12px 12px 10px;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        color: inherit;
        min-height: 64px;
        display: flex; flex-direction: column; justify-content: space-between;
        transition: border-color 120ms, background 120ms;
      }
      .yk-item:hover, .yk-item:active {
        border-color: ${YEK_RED};
        background: #fff8f2;
      }
      .yk-item:active { transform: translateY(0.5px); }
      .yk-item-name {
        font-size: 13.5px; font-weight: 600;
        color: #1d1815;
        margin-bottom: 6px;
        line-height: 1.3;
      }
      .yk-item-price {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 12px;
        color: #6a5f55;
        font-variant-numeric: tabular-nums;
      }

      .yk-cart {
        background: #fff;
        border: 1px solid #d6cfc0;
        border-radius: 3px;
        display: flex; flex-direction: column;
        overflow: hidden;
        min-height: 0;
      }
      .yk-cart-head {
        padding: 12px 14px;
        background: #f7f3eb;
        border-bottom: 1px solid #d6cfc0;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6a5f55;
        display: flex; align-items: center; gap: 8px;
      }
      .yk-cart-list {
        flex: 1; overflow: auto;
        padding: 6px 14px;
        -webkit-overflow-scrolling: touch;
      }
      .yk-cart-empty {
        padding: 40px 12px;
        text-align: center;
        color: #9c9183;
        font-size: 12.5px;
        line-height: 1.5;
      }
      .yk-line {
        display: flex; justify-content: space-between; align-items: center;
        padding: 9px 0;
        border-bottom: 1px solid #ebe6dc;
        font-size: 13.5px;
        color: #1d1815;
        gap: 8px;
      }
      .yk-line:last-child { border-bottom: 0; }
      .yk-line-name { flex: 1; min-width: 0; }
      .yk-line-right { display: flex; align-items: center; gap: 8px; }
      .yk-line-price {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 12.5px;
        color: #4a4038;
        font-variant-numeric: tabular-nums;
      }
      .yk-line-del {
        background: none; border: 0;
        color: #9c9183; cursor: pointer;
        padding: 6px; min-width: 30px; min-height: 30px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 3px;
        transition: color 120ms, background 120ms;
      }
      .yk-line-del:hover { color: ${YEK_RED}; background: #f7f3eb; }

      .yk-totals {
        padding: 12px 14px;
        border-top: 1px solid #d6cfc0;
        background: #f7f3eb;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
      }
      .yk-total-row {
        display: flex; justify-content: space-between;
        font-size: 12.5px;
        color: #4a4038;
        font-variant-numeric: tabular-nums;
        padding: 2px 0;
      }
      .yk-total-row.big {
        font-size: 17px;
        font-weight: 700;
        color: #1d1815;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #d6cfc0;
      }
      .yk-actions {
        padding: 12px 14px;
        display: flex; gap: 8px;
        border-top: 1px solid #d6cfc0;
        background: #fff;
      }
      .yk-pay {
        flex: 1;
        background: ${YEK_RED};
        color: #fff;
        border: 0;
        padding: 12px;
        border-radius: 3px;
        font-weight: 700;
        font-size: 14px;
        font-family: inherit;
        cursor: pointer;
        min-height: 44px;
        letter-spacing: 0.02em;
        transition: background 120ms;
      }
      .yk-pay:hover { background: ${YEK_RED_DEEP}; }
      .yk-pay:disabled { background: #c9c1b3; cursor: default; color: #fff; opacity: 0.7; }
      .yk-clear {
        background: transparent;
        color: #4a4038;
        border: 1px solid #d6cfc0;
        padding: 12px 14px;
        border-radius: 3px;
        cursor: pointer;
        min-height: 44px;
        font-family: inherit;
        font-size: 12.5px;
        transition: background 120ms;
      }
      .yk-clear:hover { background: #f7f3eb; }
      .yk-clear:disabled { opacity: 0.4; cursor: default; }

      .yk-hint {
        position: absolute;
        bottom: 12px; left: 12px;
        max-width: 380px;
        padding: 10px 14px;
        background: #fff;
        border-left: 3px solid ${YEK_RED};
        font-size: 12px;
        line-height: 1.5;
        color: #4a4038;
        display: flex; gap: 10px; align-items: flex-start;
      }
      .yk-hint-icon { color: ${YEK_RED}; flex-shrink: 0; margin-top: 1px; }
      .yk-hint strong { color: #1d1815; }

      /* Receipt-Modal (Bon-Preview) */
      .yk-receipt-backdrop {
        position: fixed; inset: 0;
        background: rgba(29, 24, 21, 0.55);
        z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        opacity: 0;
        transition: opacity 200ms ease;
        pointer-events: none;
      }
      .yk-receipt-backdrop.open {
        opacity: 1; pointer-events: auto;
      }
      .yk-receipt {
        width: 320px; max-width: 100%;
        background: #fff;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 12px;
        color: #1d1815;
        padding: 22px 24px 18px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.25);
        transform: translateY(20px);
        transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .yk-receipt-backdrop.open .yk-receipt { transform: translateY(0); }
      .yk-receipt-head {
        text-align: center;
        padding-bottom: 12px;
        border-bottom: 1px dashed #6a5f55;
        margin-bottom: 10px;
      }
      .yk-receipt-head h3 {
        margin: 0 0 2px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .yk-receipt-head small {
        font-size: 10.5px;
        color: #6a5f55;
        letter-spacing: 0.04em;
      }
      .yk-receipt-line {
        display: flex; justify-content: space-between;
        padding: 3px 0;
        font-variant-numeric: tabular-nums;
      }
      .yk-receipt-totals {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px dashed #6a5f55;
      }
      .yk-receipt-totals .big {
        font-size: 14px;
        font-weight: 700;
        padding-top: 6px;
        margin-top: 4px;
        border-top: 1px dashed #6a5f55;
      }
      .yk-receipt-thanks {
        text-align: center;
        margin-top: 16px;
        font-size: 11px;
        color: #6a5f55;
        letter-spacing: 0.06em;
      }
      .yk-receipt-actions {
        display: flex; gap: 8px;
        margin-top: 18px;
      }
      .yk-receipt-actions button {
        flex: 1;
        padding: 10px;
        border-radius: 3px;
        font-family: 'Inter', sans-serif;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        min-height: 40px;
      }
      .yk-receipt-confirm {
        background: ${YEK_RED}; color: #fff; border: 0;
      }
      .yk-receipt-cancel {
        background: #fff; color: #4a4038; border: 1px solid #d6cfc0;
      }

      @media (max-width: 720px) {
        .yk-bar { padding: 0 14px; gap: 10px; height: 48px; }
        .yk-logo { font-size: 14px; }
        .yk-station { display: none; }
        .yk-layout {
          grid-template-columns: 1fr;
          grid-template-rows: 1fr auto;
          padding: 10px;
          gap: 10px;
        }
        /* Warenkorb als Bottom-Sheet: schattiert, Liste wächst mit Inhalt,
           Menü behält den Großteil des Screens */
        .yk-cart {
          position: sticky; bottom: 0;
          max-height: 42vh;
          box-shadow: 0 -10px 30px rgba(0,0,0,0.12);
        }
        .yk-cart-list { min-height: 0; max-height: 18vh; overflow: auto; }
        .yk-cart-empty { padding: 10px 0 !important; }
        .yk-grid { grid-template-columns: repeat(2, 1fr); }
        .yk-item { min-height: 56px; }
        .yk-hint {
          position: static;
          max-width: none;
          margin: 0 10px 10px;
        }
      }
    `;
    root.appendChild(style);

    root.innerHTML += `
      <div class="yk-bar">
        <div class="yk-logo">
          <span>YEK Döner &amp; Pizzeria</span>
          <span class="yk-logo-tag">POS</span>
        </div>
        <span class="yk-station">terminal · heikendorf · ${new Date().toLocaleDateString("de-DE")}</span>
        <button class="yk-close" type="button" aria-label="Kassensystem schließen">
          ${ICONS.x}<span>Schließen</span>
        </button>
      </div>
      <div class="yk-layout">
        <div class="yk-menu" aria-label="Speisekarte"></div>
        <section class="yk-cart" aria-label="Warenkorb">
          <div class="yk-cart-head">${ICONS.cart}<span>Bestellung</span></div>
          <div class="yk-cart-list" aria-live="polite"></div>
          <div class="yk-totals"></div>
          <div class="yk-actions">
            <button class="yk-clear" type="button" disabled>Leeren</button>
            <button class="yk-pay" type="button" disabled>Kassieren</button>
          </div>
        </section>
      </div>
      <aside class="yk-hint" role="note">
        <span class="yk-hint-icon">${ICONS.info}</span>
        <span><strong>Story.</strong> So sah ein Teil meiner Schichten aus. Hier habe ich übrigens das ungehärtete WLAN-Setup entdeckt. Siehe Router-Egg auf der Insel.</span>
      </aside>
    `;

    this.dom = {
      root,
      menu: root.querySelector(".yk-menu"),
      cartList: root.querySelector(".yk-cart-list"),
      totals: root.querySelector(".yk-totals"),
      payBtn: root.querySelector(".yk-pay"),
      clearBtn: root.querySelector(".yk-clear"),
    };

    root.querySelector(".yk-close").addEventListener("click", () => this.close());
    this._onKey = (e) => {
      if (e.key === "Escape") {
        if (this._receiptOpen) this._closeReceipt();
        else this.close();
      }
    };
    document.addEventListener("keydown", this._onKey);

    this._renderMenu();
    this._renderCart();

    this.dom.clearBtn.addEventListener("click", () => {
      this.cart = [];
      this._renderCart();
    });
    this.dom.payBtn.addEventListener("click", () => this._openReceipt());
  }

  _renderMenu() {
    const menu = this.dom.menu;
    menu.innerHTML = "";
    for (const cat of MENU) {
      const sec = document.createElement("div");
      sec.className = "yk-cat";
      sec.innerHTML = `
        <div class="yk-cat-title">${cat.cat}</div>
        <div class="yk-grid"></div>
      `;
      const grid = sec.querySelector(".yk-grid");
      for (const item of cat.items) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "yk-item";
        btn.setAttribute("aria-label", `${item.name}, ${item.price.toFixed(2).replace(".", ",")} Euro`);
        btn.innerHTML = `
          <span class="yk-item-name">${item.name}</span>
          <span class="yk-item-price">${item.price.toFixed(2).replace(".", ",")} €</span>
        `;
        btn.addEventListener("click", () => {
          this.cart.push({ ...item });
          this._renderCart();
        });
        grid.appendChild(btn);
      }
      menu.appendChild(sec);
    }
  }

  _renderCart() {
    const list = this.dom.cartList;
    const totals = this.dom.totals;
    if (this.cart.length === 0) {
      list.innerHTML = `<div class="yk-cart-empty">Noch nichts ausgewählt.<br>Tipp ein Gericht an.</div>`;
      totals.innerHTML = "";
      this.dom.payBtn.disabled = true;
      this.dom.clearBtn.disabled = true;
      return;
    }
    list.innerHTML = "";
    this.cart.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "yk-line";
      row.innerHTML = `
        <span class="yk-line-name">${item.name}</span>
        <span class="yk-line-right">
          <span class="yk-line-price">${item.price.toFixed(2).replace(".", ",")} €</span>
          <button class="yk-line-del" type="button" aria-label="${item.name} entfernen">${ICONS.trash}</button>
        </span>
      `;
      row.querySelector(".yk-line-del").addEventListener("click", () => {
        this.cart.splice(i, 1);
        this._renderCart();
      });
      list.appendChild(row);
    });
    const total = this.cart.reduce((s, i) => s + i.price, 0);
    const tax = total * 0.07;     // simulierte MwSt für Außer-Haus
    const net = total - tax;
    totals.innerHTML = `
      <div class="yk-total-row"><span>Netto</span><span>${net.toFixed(2).replace(".", ",")} €</span></div>
      <div class="yk-total-row"><span>MwSt 7%</span><span>${tax.toFixed(2).replace(".", ",")} €</span></div>
      <div class="yk-total-row big"><span>Gesamt</span><span>${total.toFixed(2).replace(".", ",")} €</span></div>
    `;
    this.dom.payBtn.disabled = false;
    this.dom.clearBtn.disabled = false;
  }

  _openReceipt() {
    if (this._receiptOpen || this.cart.length === 0) return;
    this._receiptOpen = true;

    const total = this.cart.reduce((s, i) => s + i.price, 0);
    const tax = total * 0.07;
    const net = total - tax;
    const time = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const date = new Date().toLocaleDateString("de-DE");

    const backdrop = document.createElement("div");
    backdrop.className = "yk-receipt-backdrop";
    backdrop.innerHTML = `
      <div class="yk-receipt" role="dialog" aria-modal="true" aria-label="Bon-Druck">
        <div class="yk-receipt-head">
          <h3>YEK DÖNER &amp; PIZZERIA</h3>
          <small>HEIKENDORF · ${date} ${time}</small>
        </div>
        ${this.cart.map((item) => `
          <div class="yk-receipt-line">
            <span>${item.name}</span>
            <span>${item.price.toFixed(2).replace(".", ",")} €</span>
          </div>
        `).join("")}
        <div class="yk-receipt-totals">
          <div class="yk-receipt-line"><span>Netto</span><span>${net.toFixed(2).replace(".", ",")} €</span></div>
          <div class="yk-receipt-line"><span>MwSt 7%</span><span>${tax.toFixed(2).replace(".", ",")} €</span></div>
          <div class="yk-receipt-line big"><span>SUMME</span><span>${total.toFixed(2).replace(".", ",")} €</span></div>
        </div>
        <div class="yk-receipt-thanks">VIELEN DANK</div>
        <div class="yk-receipt-actions">
          <button class="yk-receipt-cancel" type="button">Abbrechen</button>
          <button class="yk-receipt-confirm" type="button">Drucken &amp; Schließen</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add("open"));

    const close = () => this._closeReceipt();
    backdrop.querySelector(".yk-receipt-cancel").addEventListener("click", close);
    backdrop.querySelector(".yk-receipt-confirm").addEventListener("click", () => {
      this.cart = [];
      this._renderCart();
      close();
    });
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    this._receiptDom = backdrop;
  }

  _closeReceipt() {
    if (!this._receiptOpen) return;
    this._receiptOpen = false;
    const r = this._receiptDom;
    r.classList.remove("open");
    setTimeout(() => r?.remove?.(), 220);
    this._receiptDom = null;
  }
}
