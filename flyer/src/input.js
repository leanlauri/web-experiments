export class InputState {
  constructor(target = window) {
    this.pitch = 0;
    this.bank = 0;
    this.flap = false;
    this.dive = false;
    this.keys = new Set();

    target.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      this.updateAxes();
    });
    target.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      this.updateAxes();
    });
    target.addEventListener('blur', () => {
      this.keys.clear();
      this.updateAxes();
    });
  }

  updateAxes() {
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');

    this.pitch = (up ? 1 : 0) - (down ? 1 : 0);
    this.bank = (right ? 1 : 0) - (left ? 1 : 0);
    this.flap = this.keys.has('Space');
    this.dive = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }
}
