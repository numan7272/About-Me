/**
 * YekKasse — Fake Kassen-System für das Yek-Building.
 *
 * Recruiter klickt aufs Restaurant → sieht das (fake) POS-System aus meiner Zeit dort.
 * Standalone-Overlay, kein FakeOS — soll nach billiger Restaurant-Software aussehen,
 * nicht nach modernem Betriebssystem.
 *
 * Story-Frame: "So sah meine Schicht aus. Hab da auch das offene WLAN gefunden."
 */

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

export class YekKasse {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this.cart = [];
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
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #1a1f24;
      color: #e8eef4;
      font-family: 'Segoe UI', system-ui, sans-serif;
      opacity: 0; transition: opacity 220ms;
      overflow: hidden;
    `;

    const style = document.createElement("style");
    style.textContent = `
      .yk-root *, .yk-root *::before, .yk-root *::after { box-sizing: border-box; }

      .yk-bar {
        height: 50px;
        background: linear-gradient(90deg, #b3263a 0%, #802030 100%);
        display: flex; align-items: center;
        padding: 0 18px;
        gap: 16px;
        color: #fff;
      }
      .yk-logo { font-weight: 800; font-size: 16px; }
      .yk-tag { font-size: 11px; opacity: 0.8; letter-spacing: 0.06em; }
      .yk-close {
        margin-left: auto;
        background: rgba(0,0,0,0.20);
        border: 0; color: #fff;
        padding: 6px 12px; border-radius: 4px;
        cursor: pointer; font-size: 12px;
      }
      .yk-close:hover { background: rgba(0,0,0,0.4); }

      .yk-layout {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 14px;
        padding: 14px;
        height: calc(100vh - 50px);
      }

      .yk-menu { overflow: auto; }
      .yk-cat {
        margin-bottom: 18px;
      }
      .yk-cat-title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #b3263a;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        margin-bottom: 10px;
      }
      .yk-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 8px;
      }
      .yk-item {
        background: #232a32;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 6px;
        padding: 12px;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        color: inherit;
        transition: all 100ms;
        min-height: 64px;
      }
      .yk-item:hover {
        border-color: rgba(179, 38, 58, 0.55);
        background: #2a323a;
      }
      .yk-item-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
      .yk-item-price { font-size: 11px; opacity: 0.7; font-family: 'JetBrains Mono', monospace; }

      .yk-cart {
        background: #232a32;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 6px;
        display: flex; flex-direction: column;
        overflow: hidden;
      }
      .yk-cart-head {
        padding: 12px 16px;
        background: rgba(0,0,0,0.20);
        font-size: 13px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .yk-cart-list {
        flex: 1; overflow: auto;
        padding: 10px 14px;
      }
      .yk-cart-empty {
        padding: 30px 0;
        text-align: center;
        opacity: 0.4;
        font-size: 12px;
      }
      .yk-line {
        display: flex; justify-content: space-between; align-items: center;
        padding: 7px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        font-size: 13px;
      }
      .yk-line button {
        background: none; border: 0; color: #ffb0b0;
        cursor: pointer; font-size: 16px;
      }
      .yk-totals {
        padding: 14px 16px;
        border-top: 1px solid rgba(255,255,255,0.08);
        font-family: 'JetBrains Mono', monospace;
      }
      .yk-total-row {
        display: flex; justify-content: space-between;
        font-size: 13px; margin: 3px 0;
      }
      .yk-total-row.big {
        font-size: 17px; font-weight: 700;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255,255,255,0.10);
      }
      .yk-actions {
        padding: 12px 16px;
        display: flex; gap: 8px;
      }
      .yk-pay {
        flex: 1;
        background: #2d9d3d;
        color: #fff;
        border: 0;
        padding: 12px;
        border-radius: 5px;
        font-weight: 700;
        cursor: pointer;
        min-height: 44px;
      }
      .yk-pay:hover { background: #36b647; }
      .yk-pay:disabled { opacity: 0.4; cursor: default; }
      .yk-clear {
        background: #3a4350;
        color: #fff;
        border: 0;
        padding: 12px 18px;
        border-radius: 5px;
        cursor: pointer;
        min-height: 44px;
      }

      .yk-hint {
        position: absolute;
        bottom: 14px;
        left: 14px;
        max-width: 360px;
        padding: 10px 14px;
        background: rgba(255, 200, 100, 0.10);
        border: 1px solid rgba(255, 200, 100, 0.25);
        border-radius: 6px;
        font-size: 12px;
        opacity: 0.9;
      }

      @media (max-width: 640px) {
        .yk-layout { grid-template-columns: 1fr; height: auto; }
        .yk-cart { max-height: 50vh; }
      }
    `;
    root.appendChild(style);

    root.innerHTML += `
      <div class="yk-bar">
        <div class="yk-logo">YEK Döner & Pizzeria</div>
        <div class="yk-tag">POS · Heikendorf</div>
        <button class="yk-close">✕ Schließen</button>
      </div>
      <div class="yk-layout">
        <div class="yk-menu"></div>
        <div class="yk-cart">
          <div class="yk-cart-head">Bestellung</div>
          <div class="yk-cart-list"></div>
          <div class="yk-totals"></div>
          <div class="yk-actions">
            <button class="yk-clear">Leeren</button>
            <button class="yk-pay">Kassieren</button>
          </div>
        </div>
      </div>
      <div class="yk-hint">💡 <strong>Story:</strong> So sah ein Teil meiner Schichten aus. Hier habe ich übrigens das ungehärtete WLAN-Setup entdeckt — siehe Router-Egg auf der Insel.</div>
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
    this._onKey = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this._onKey);

    this._renderMenu();
    this._renderCart();

    this.dom.clearBtn.addEventListener("click", () => {
      this.cart = [];
      this._renderCart();
    });
    this.dom.payBtn.addEventListener("click", () => {
      if (this.cart.length === 0) return;
      const total = this.cart.reduce((s, i) => s + i.price, 0);
      alert(`Bon-Druck simuliert.\nTotal: ${total.toFixed(2)} €\n\n(Real System druckt jetzt einen Beleg. Plus die Sonderzeichen würden funktionieren weil 2022 hab ich nur Numbers + ASCII genutzt.)`);
      this.cart = [];
      this._renderCart();
    });
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
        btn.className = "yk-item";
        btn.innerHTML = `
          <div class="yk-item-name">${item.name}</div>
          <div class="yk-item-price">${item.price.toFixed(2)} €</div>
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
      list.innerHTML = `<div class="yk-cart-empty">Noch nichts ausgewählt</div>`;
      totals.innerHTML = "";
      this.dom.payBtn.disabled = true;
      return;
    }
    list.innerHTML = "";
    this.cart.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "yk-line";
      row.innerHTML = `
        <span>${item.name}</span>
        <span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;opacity:0.85;">${item.price.toFixed(2)} €</span>
          <button title="Entfernen">×</button>
        </span>
      `;
      row.querySelector("button").addEventListener("click", () => {
        this.cart.splice(i, 1);
        this._renderCart();
      });
      list.appendChild(row);
    });
    const total = this.cart.reduce((s, i) => s + i.price, 0);
    const tax = total * 0.07;     // simulierte MwSt
    const net = total - tax;
    totals.innerHTML = `
      <div class="yk-total-row"><span>Netto</span><span>${net.toFixed(2)} €</span></div>
      <div class="yk-total-row"><span>MwSt 7%</span><span>${tax.toFixed(2)} €</span></div>
      <div class="yk-total-row big"><span>Gesamt</span><span>${total.toFixed(2)} €</span></div>
    `;
    this.dom.payBtn.disabled = false;
  }
}
