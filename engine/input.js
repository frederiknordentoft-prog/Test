export class Input {
  constructor() {
    this.keys = new Set();
    this._pressed = new Set();
    this._released = new Set();
    this.pointer = { x: 0, y: 0, dx: 0, dy: 0, down: false, justDown: false, justUp: false };
    this._gamepadPrev = [];
  }

  bindKeyboard(target = window) {
    target.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this._pressed.add(e.code);
      this.keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this._released.add(e.code);
    });
  }

  bindPointer(canvas) {
    let lastX = 0;
    let lastY = 0;
    const update = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.pointer.dx = x - lastX;
      this.pointer.dy = y - lastY;
      this.pointer.x = x;
      this.pointer.y = y;
      lastX = x;
      lastY = y;
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      this.pointer.down = true;
      this.pointer.justDown = true;
      update(e);
    });
    canvas.addEventListener('pointermove', update);
    canvas.addEventListener('pointerup', (e) => {
      this.pointer.down = false;
      this.pointer.justUp = true;
      update(e);
    });
    canvas.addEventListener('pointercancel', () => {
      this.pointer.down = false;
    });
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this._pressed.has(code); }
  wasReleased(code) { return this._released.has(code); }

  // Polled gamepad state. Returns null if no pad connected.
  gamepad(index = 0) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    return pads[index] ?? null;
  }

  axis(index, padIndex = 0, deadzone = 0.15) {
    const pad = this.gamepad(padIndex);
    if (!pad) return 0;
    const v = pad.axes[index] ?? 0;
    return Math.abs(v) < deadzone ? 0 : v;
  }

  button(index, padIndex = 0) {
    const pad = this.gamepad(padIndex);
    return pad ? !!pad.buttons[index]?.pressed : false;
  }

  buttonPressed(index, padIndex = 0) {
    const pad = this.gamepad(padIndex);
    if (!pad) return false;
    const wasDown = this._gamepadPrev[index] ?? false;
    const isDown = !!pad.buttons[index]?.pressed;
    return isDown && !wasDown;
  }

  // Call once per frame, after handling input, before next frame's events.
  endFrame() {
    this._pressed.clear();
    this._released.clear();
    this.pointer.justDown = false;
    this.pointer.justUp = false;
    this.pointer.dx = 0;
    this.pointer.dy = 0;
    const pad = this.gamepad();
    if (pad) {
      this._gamepadPrev = pad.buttons.map(b => !!b.pressed);
    }
  }
}
