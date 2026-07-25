import { createIcons, icons } from "lucide";
import "./style.css";
import { loadFrameSets } from "./game/assets";
import { RobotGame, type MovementDirection } from "./game/game";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const loader = document.querySelector<HTMLElement>("#loader");
const progress = document.querySelector<HTMLElement>("#progress");
const screenChip = document.querySelector<HTMLElement>("#screenChip");
const jumpButton = document.querySelector<HTMLButtonElement>("#jumpButton");
const pauseButton = document.querySelector<HTMLButtonElement>("#pauseButton");
const restartButton = document.querySelector<HTMLButtonElement>("#restartButton");

if (!canvas || !loader || !progress || !screenChip || !jumpButton || !pauseButton || !restartButton) {
  throw new Error("Game shell is missing required elements");
}

createIcons({ icons });

const frames = await loadFrameSets();
const game = new RobotGame(canvas, frames, { progress, screenChip });
loader.classList.add("is-hidden");
game.start();

const heldDirections = new Set<MovementDirection>();
let lastHorizontalDirection: MovementDirection = 0;
let jumpKeyHeld = false;

const updateMovement = () => {
  if (heldDirections.has(lastHorizontalDirection)) {
    game.setMovementDirection(lastHorizontalDirection);
    return;
  }

  if (heldDirections.has(-1)) {
    lastHorizontalDirection = -1;
    game.setMovementDirection(-1);
    return;
  }

  if (heldDirections.has(1)) {
    lastHorizontalDirection = 1;
    game.setMovementDirection(1);
    return;
  }

  game.setMovementDirection(0);
};

const beginJumpCharge = () => {
  jumpButton.classList.add("is-charging");
  game.beginJumpCharge();
};

const releaseJumpCharge = () => {
  jumpButton.classList.remove("is-charging");
  game.releaseJumpCharge();
};

const isJumpKey = (code: string) => code === "Space" || code === "ArrowUp" || code === "KeyW";

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    event.preventDefault();
    heldDirections.add(-1);
    lastHorizontalDirection = -1;
    updateMovement();
  }

  if (event.code === "ArrowRight" || event.code === "KeyD") {
    event.preventDefault();
    heldDirections.add(1);
    lastHorizontalDirection = 1;
    updateMovement();
  }

  if (isJumpKey(event.code) && !jumpKeyHeld) {
    event.preventDefault();
    jumpKeyHeld = true;
    beginJumpCharge();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    event.preventDefault();
    heldDirections.delete(-1);
    updateMovement();
  }

  if (event.code === "ArrowRight" || event.code === "KeyD") {
    event.preventDefault();
    heldDirections.delete(1);
    updateMovement();
  }

  if (isJumpKey(event.code)) {
    event.preventDefault();
    jumpKeyHeld = false;
    releaseJumpCharge();
  }
});

jumpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  jumpButton.setPointerCapture(event.pointerId);
  beginJumpCharge();
});
jumpButton.addEventListener("pointerup", (event) => {
  event.preventDefault();
  if (jumpButton.hasPointerCapture(event.pointerId)) {
    jumpButton.releasePointerCapture(event.pointerId);
  }
  releaseJumpCharge();
});
jumpButton.addEventListener("pointercancel", releaseJumpCharge);
restartButton.addEventListener("click", () => {
  heldDirections.clear();
  lastHorizontalDirection = 0;
  jumpKeyHeld = false;
  jumpButton.classList.remove("is-charging");
  game.restart();
});
pauseButton.addEventListener("click", () => {
  const paused = game.togglePause();
  pauseButton.innerHTML = `<i data-lucide="${paused ? "play" : "pause"}"></i>`;
  createIcons({ icons });
});

window.addEventListener("beforeunload", () => game.destroy());
