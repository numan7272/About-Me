/**
 * Tiny mutable input store used to merge keyboard + touch input.
 *
 * Keyboard input is provided by drei's <KeyboardControls> + useKeyboardControls.
 * Touch input is written here directly by <MobileControls>. The Player reads
 * both each frame inside useFrame, so no React re-renders are needed.
 */
export const touchInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  brake: false,
};

export function setTouchInput(key, value) {
  if (key in touchInput) {
    touchInput[key] = value;
  }
}

export function resetTouchInput() {
  Object.keys(touchInput).forEach((k) => {
    touchInput[k] = false;
  });
}
