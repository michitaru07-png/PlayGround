const KEY_MAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  punch: ['KeyJ', 'KeyZ'],
  kick: ['KeyK', 'KeyX'],
  special: ['KeyL', 'KeyC'],
  jump: ['Space'],
  block: ['ShiftLeft', 'ShiftRight', 'KeyB'],
  dodge: ['KeyQ', 'ControlLeft', 'ControlRight'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  start: ['Enter', 'NumpadEnter'],
};

const PREVENT = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
]);

export class Input {
  constructor(target = window) {
    this.downCodes = new Set();
    this.pressedCodes = new Set();
    this.virtualDown = new Set();
    this.virtualPressed = new Set();
    this.axisX = 0;
    this.axisY = 0;
    this.usingTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;
    this.joyPointer = null;
    this.gamepadPrev = [];
    this.enabled = true;

    target.addEventListener('keydown', (event) => {
      if (PREVENT.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.downCodes.add(event.code);
      this.pressedCodes.add(event.code);
    });
    target.addEventListener('keyup', (event) => {
      if (PREVENT.has(event.code)) event.preventDefault();
      this.downCodes.delete(event.code);
    });
    target.addEventListener('blur', () => {
      this.downCodes.clear();
      this.virtualDown.clear();
      this.axisX = 0;
      this.axisY = 0;
    });
    window.addEventListener('pointerdown', (event) => {
      this.usingTouch = event.pointerType === 'touch' || this.usingTouch;
    }, { passive: true });
  }

  isDown(action) {
    const codes = KEY_MAP[action];
    if (codes) {
      for (const code of codes) if (this.downCodes.has(code)) return true;
    }
    if (this.virtualDown.has(action)) return true;
    if (action === 'left' && this.axisX < -0.28) return true;
    if (action === 'right' && this.axisX > 0.28) return true;
    if (action === 'up' && this.axisY < -0.28) return true;
    if (action === 'down' && this.axisY > 0.28) return true;
    if (action === 'block') {
      if (this.virtualDown.has('block')) return true;
      if (this.gamepadBlock) return true;
    }
    return false;
  }

  pressed(action) {
    const codes = KEY_MAP[action];
    if (codes) {
      for (const code of codes) if (this.pressedCodes.has(code)) return true;
    }
    return this.virtualPressed.has(action);
  }

  /** Call after a simulation frame. */
  endFrame() {
    this.pressedCodes.clear();
    this.virtualPressed.clear();
  }

  setVirtual(action, value) {
    if (value) {
      if (!this.virtualDown.has(action)) this.virtualPressed.add(action);
      this.virtualDown.add(action);
    } else {
      this.virtualDown.delete(action);
    }
  }

  tapVirtual(action) {
    this.virtualPressed.add(action);
  }

  clearVirtual() {
    this.virtualDown.clear();
    this.virtualPressed.clear();
    this.axisX = 0;
    this.axisY = 0;
    if (this.joyPointer !== null && this.joy) {
      this.joy.classList.remove('active');
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.joyPointer = null;
    }
  }

  bindTouch(joystick, knob) {
    this.joy = joystick;
    this.knob = knob;
    if (!joystick || !knob) return;

    const update = (event) => {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const max = rect.width * 0.34;
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(len, max);
      const nx = (dx / len) * clamped;
      const ny = (dy / len) * clamped;
      this.axisX = nx / max;
      this.axisY = ny / max;
      // A generous dead-zone so the stick rests naturally.
      if (Math.abs(this.axisX) < 0.12) this.axisX = 0;
      if (Math.abs(this.axisY) < 0.12) this.axisY = 0;
      knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
      if (Math.hypot(this.axisX, this.axisY) > 0.4) this.usingTouch = true;
    };

    const start = (event) => {
      if (this.joyPointer !== null) return;
      this.joyPointer = event.pointerId;
      joystick.classList.add('active');
      try { joystick.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointers */ }
      update(event);
      event.preventDefault();
    };

    const move = (event) => {
      if (this.joyPointer !== event.pointerId) return;
      update(event);
      event.preventDefault();
    };

    const end = (event) => {
      if (this.joyPointer !== event.pointerId) return;
      this.joyPointer = null;
      joystick.classList.remove('active');
      this.axisX = 0;
      this.axisY = 0;
      knob.style.transform = 'translate(-50%, -50%)';
      event.preventDefault();
    };

    joystick.addEventListener('pointerdown', start);
    joystick.addEventListener('pointermove', move);
    joystick.addEventListener('pointerup', end);
    joystick.addEventListener('pointercancel', end);
    joystick.addEventListener('lostpointercapture', end);
  }

  pollGamepad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) { pad = p; break; }
    }
    if (!pad) {
      this.gamepadBlock = false;
      return;
    }
    if (pad.axes && (Math.abs(pad.axes[0]) > 0.18 || Math.abs(pad.axes[1]) > 0.18)) {
      this.axisX = Math.abs(pad.axes[0]) > 0.18 ? pad.axes[0] : this.axisX;
      this.axisY = Math.abs(pad.axes[1]) > 0.18 ? pad.axes[1] : this.axisY;
      this.usingTouch = false;
    }
    const map = { 0: 'jump', 1: 'kick', 2: 'punch', 3: 'special', 5: 'dodge' };
    for (const [index, action] of Object.entries(map)) {
      const pressed = pad.buttons[index]?.pressed;
      if (pressed && !this.gamepadPrev[index]) this.virtualPressed.add(action);
      if (pressed) this.virtualDown.add(action);
      else this.virtualDown.delete(action);
      this.gamepadPrev[index] = pressed;
    }
    this.gamepadBlock = Boolean(pad.buttons[4]?.pressed || pad.buttons[6]?.pressed);
  }
}
