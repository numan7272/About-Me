/**
 * Tiny mutable input store used to merge keyboard + touch input.
 *
 * Keyboard input is provided by drei's <KeyboardControls> + useKeyboardControls.
 * Touch input is written here directly by <MobileControls>. The Player reads
 * both each frame inside useFrame, so no React re-renders are needed.
 *
 * The mobile UI is now a Bruno-Simon-style virtual joystick instead of a
 * D-pad: `joystickActive` flips on while a finger is down, and `joystickX`/Y
 * carry an analog −1..1 vector. Y > 0 = pulled "up" (forward in screen
 * space), X > 0 = pulled "right".
 */
export const touchInput = {
  // Digital fallbacks (still respected by the controller)
  forward: false,
  backward: false,
  left: false,
  right: false,
  brake: false,

  // Analog joystick (mobile)
  joystickActive: false,
  joystickX: 0,   // −1..1 — right is positive
  joystickY: 0,   // −1..1 — up   is positive
};

export function setTouchInput(key, value) {
  if (key in touchInput) {
    touchInput[key] = value;
  }
}

export function resetTouchInput() {
  touchInput.forward        = false;
  touchInput.backward       = false;
  touchInput.left           = false;
  touchInput.right          = false;
  touchInput.brake          = false;
  touchInput.joystickActive = false;
  touchInput.joystickX      = 0;
  touchInput.joystickY      = 0;
}
