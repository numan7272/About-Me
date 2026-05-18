/**
 * Inputs — Keyboard + (später) Touch-Joystick.
 *
 *   inputs.keys.forward  — true wenn W / ArrowUp gedrückt
 *   inputs.keys.backward — true wenn S / ArrowDown
 *   inputs.keys.left     — true wenn A / ArrowLeft / Q
 *   inputs.keys.right    — true wenn D / ArrowRight
 *   inputs.keys.brake    — true wenn Space
 *
 * Plus optionaler Touch-Joystick (Vector2 0..1):
 *   inputs.touch.x, inputs.touch.y, inputs.touch.active
 */

export class Inputs {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false,
    };
    this.touch = {
      x: 0,
      y: 0,
      active: false,
    };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    // Tab-Wechsel / Fenster-Wechsel: alle Keys releasen damit nicht
    // eine Taste "hängenbleibt" wenn man Alt-Tab macht
    window.addEventListener("blur", this._onBlur);
  }

  _onBlur() {
    this.keys.forward = false;
    this.keys.backward = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.brake = false;
  }

  _onKeyDown(e) {
    // Wenn der User in ein Eingabefeld tippt (z.B. SQLi-Lab, Settings),
    // NICHT die Bike-Steuerung triggern UND NICHT preventDefault feuern.
    // Sonst kann er kein Space, keine Pfeiltasten in <input>/<textarea>
    // benutzen.
    if (this._isEditingTarget(e.target)) return;
    // K7-Fix: Space/Pfeiltasten scrollen die Page sonst.
    // Wir fangen alle Bewegungs-Keys ab, sobald sie unsere Steuerung treffen.
    if (this._isGameKey(e.code)) {
      e.preventDefault();
    }
    this._setKey(e.code, true);
  }
  _onKeyUp(e) {
    if (this._isEditingTarget(e.target)) return;
    if (this._isGameKey(e.code)) {
      e.preventDefault();
    }
    this._setKey(e.code, false);
  }

  _isEditingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (target.isContentEditable) return true;
    return false;
  }

  _isGameKey(code) {
    switch (code) {
      case "Space":
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        return true;
      default:
        return false;
    }
  }

  _setKey(code, down) {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
      case "KeyZ":      // QWERTZ/AZERTY layout
        this.keys.forward = down;
        break;
      case "KeyS":
      case "ArrowDown":
        this.keys.backward = down;
        break;
      case "KeyA":
      case "ArrowLeft":
      case "KeyQ":
        this.keys.left = down;
        break;
      case "KeyD":
      case "ArrowRight":
        this.keys.right = down;
        break;
      case "Space":
        this.keys.brake = down;
        break;
    }
  }

  setTouch(x, y, active) {
    this.touch.x = x;
    this.touch.y = y;
    this.touch.active = active;
  }

  destroy() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
  }
}
