export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();

    window.addEventListener("keydown", (event) => {
      const key = this.normalize(event.key);
      if (!this.keys.has(key)) {
        this.justPressed.add(key);
      }
      this.keys.add(key);

      if (["space", "arrowup", "arrowleft", "arrowright", "arrowdown"].includes(key)) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(this.normalize(event.key));
    });
  }

  normalize(key) {
    return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
  }

  consume(key) {
    const normalized = this.normalize(key);
    const pressed = this.justPressed.has(normalized);
    this.justPressed.delete(normalized);
    return pressed;
  }

  get axisX() {
    let axis = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) axis -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) axis += 1;
    return axis;
  }

  get axisY() {
    let axis = 0;
    if (this.keys.has("s") || this.keys.has("arrowdown")) axis -= 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) axis += 1;
    return axis;
  }

  get sprinting() {
    return this.keys.has("shift");
  }

  get jumpPressed() {
    return this.consume("space") || this.consume("arrowup") || this.consume("w");
  }

  get jumpHeld() {
    return this.keys.has("space") || this.keys.has("arrowup") || this.keys.has("w");
  }

  get parkourPressed() {
    return this.consume("e") || this.consume("enter");
  }

  get trickPressed() {
    return this.consume("q") || this.consume("f");
  }

  get resetPressed() {
    return this.consume("r");
  }

  get zoomInPressed() {
    return this.consume("1");
  }

  get zoomOutPressed() {
    return this.consume("2");
  }

  endFrame() {
    this.justPressed.clear();
  }
}
