# Linus Game

A canvas platform adventure starring a baby axolotl in Mosswood Meadow. Collect 12 bones, jump over floor cracks and fallen logs, and spin to defeat four red poisonous snakes. Each defeated snake releases a friend’s soul. The rescued axolotls replay your path, jumps, turns, and spins with a short delay. Defeated snakes ride in your basket; lead your friends to Mum in the cave and stay for a five-second snake supper. All four friends’ mums wait in the cave. After everyone arrives and shares supper, a play date begins with bouncing friends, a ball, toys, and confetti. You can keep jumping and spinning with them; collecting all bones completes the adventure. Falling or respawning safely brings followers with you. Bites briefly poison and slow you. Three hearts and safe-ground respawns keep the adventure forgiving.

Keyboard: A/D or left/right arrows to move, Space/W/up arrow to jump, X/J to spin. Touch: hold the arrow buttons and tap Jump or Spin. Restart begins a new adventure.

Game code lives in `public/game.js`, page layout in `public/index.html`, and styles in `public/style.css`. No build step is required.

Deploy after every game change:

```sh
bash ./deploy.sh
```

The script uses passwordless sudo and rsync to synchronize public files to this host's nginx directory and checks the served page against the source.

Open http://localhost/web-experiments/linusgame/ on this host, or `http://<host-address>/web-experiments/linusgame/` from another device.

Run gameplay checks with `node tests/gameplay.cjs`. These check soul rescue, delayed follower movement, supper, win conditions, reset and touch input in a simulated canvas environment.
