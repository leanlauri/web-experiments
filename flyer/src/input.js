export class InputState {
  constructor(target = window) {
    this.leftWingFlap = false;
    this.rightWingFlap = false;
    this.headInput = 0;
    this.keys = new Set();

    target.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      this.keys.add(event.code);
      this.updateAxes();
    });
    target.addEventListener('keyup', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      this.keys.delete(event.code);
      this.updateAxes();
    });
    target.addEventListener('blur', () => {
      this.keys.clear();
      this.updateAxes();
    });
  }

  updateAxes() {
    this.leftWingFlap = this.keys.has('ArrowRight');
    this.rightWingFlap = this.keys.has('ArrowLeft');
    this.headInput = (this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('ArrowUp') ? 1 : 0);
  }
}
