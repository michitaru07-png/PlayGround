const KEY_BINDINGS = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  KeyJ: 'light',
  KeyZ: 'light',
  KeyK: 'heavy',
  KeyX: 'heavy',
  KeyL: 'grab',
  KeyC: 'grab',
  KeyU: 'special',
  KeyV: 'special',
  KeyE: 'special',
};

const GAME_KEYS = new Set(Object.keys(KEY_BINDINGS));

export class Input {
  constructor() {
    this.sources = new Map();
    this.pressed = new Set();
    this.visualButtons = new Map();
    this.pauseListeners = new Set();
    this.enabled = true;
    this.bindKeyboard();
    this.bindTouch();
  }

  onPause(callback) {
    this.pauseListeners.add(callback);
  }

  bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyP' || event.code === 'Escape') {
        if (!event.repeat) {
          event.preventDefault();
          for (const callback of this.pauseListeners) callback();
        }
        return;
      }
      const action = KEY_BINDINGS[event.code];
      if (!action) return;
      event.preventDefault();
      if (event.repeat) return;
      const source = `key:${event.code}`;
      this.sources.set(source, action);
      this.pressed.add(action);
      this.flash(action);
    });

    window.addEventListener('keyup', (event) => {
      const action = KEY_BINDINGS[event.code];
      if (!action) return;
      this.sources.delete(`key:${event.code}`);
    });

    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
  }

  bindTouch() {
    const controls = document.getElementById('controls');
    if (!controls) return;

    controls.querySelectorAll('[data-hold], [data-press]').forEach((button) => {
      const hold = button.dataset.hold;
      const press = button.dataset.press;
      const action = hold || press;
      if (!action) return;
      this.visualButtons.set(action, button);

      const pointerDown = (event) => {
        if (!this.enabled) return;
        event.preventDefault();
        event.stopPropagation();
        const source = `ptr:${event.pointerId}`;
        this.sources.set(source, action);
        if (press) {
          this.pressed.add(press);
          this.flash(press);
        }
        button.classList.add('active');
        try { button.setPointerCapture(event.pointerId); } catch { /* ignore */ }
      };

      const pointerUp = (event) => {
        event.preventDefault();
        const source = `ptr:${event.pointerId}`;
        this.sources.delete(source);
        button.classList.remove('active');
      };

      button.addEventListener('pointerdown', pointerDown, { passive: false });
      button.addEventListener('pointerup', pointerUp, { passive: false });
      button.addEventListener('pointercancel', pointerUp, { passive: false });
      button.addEventListener('lostpointercapture', pointerUp, { passive: false });
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    });

    controls.addEventListener('contextmenu', (event) => event.preventDefault());
    controls.addEventListener('pointerdown', (event) => event.preventDefault(), { passive: false });
  }

  flash(action) {
    const button = this.visualButtons.get(action);
    if (!button) return;
    button.classList.add('active');
    window.clearTimeout(button._flashTimer);
    button._flashTimer = window.setTimeout(() => {
      if (!this.isDown(action)) button.classList.remove('active');
    }, 110);
  }

  isDown(action) {
    for (const value of this.sources.values()) {
      if (value === action) return true;
    }
    return false;
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  get move() {
    return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
  }

  endFrame() {
    this.pressed.clear();
    for (const [action, button] of this.visualButtons) {
      if (!this.isDown(action)) button.classList.remove('active');
    }
  }

  clear() {
    this.sources.clear();
    this.pressed.clear();
    for (const button of this.visualButtons.values()) button.classList.remove('active');
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }
}
