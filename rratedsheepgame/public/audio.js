import { vehicleProfile } from "./vehicles.js?v=home-police-1";
export function createAudio() {
  let context,
    voices = [],
    enabled = true,
    available = true,
    lastAttack = null,
    lastBlast = null;
  try {
    enabled = localStorage.getItem("little-pastures-sound") !== "off";
  } catch {}
  function unlock() {
    if (!available) return;
    try {
      if (!context) {
        const C = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!C) {
          available = false;
          return;
        }
        context = new C();
        for (let i = 0; i < 3; i++) {
          const gain = context.createGain(),
            filter = context.createBiquadFilter(),
            osc = context.createOscillator(),
            harmonic = context.createOscillator();
          gain.gain.value = 0;
          filter.type = "lowpass";
          filter.frequency.value = 900;
          osc.connect(filter);
          harmonic.connect(filter);
          filter.connect(gain);
          gain.connect(context.destination);
          osc.start();
          harmonic.start();
          voices.push({ gain, filter, osc, harmonic });
        }
      }
      context.resume().catch(() => {});
    } catch {
      available = false;
    }
  }
  function silence() {
    if (context)
      for (const v of voices)
        v.gain.gain.setTargetAtTime(0, context.currentTime, 0.03);
  }
  function toggle() {
    enabled = !enabled;
    try {
      localStorage.setItem("little-pastures-sound", enabled ? "on" : "off");
    } catch {}
    if (enabled) unlock();
    else silence();
    return enabled;
  }
  function update(game, paused) {
    if (!context || context.state !== "running") return;
    if (
      !enabled ||
      paused ||
      document.hidden ||
      game.phase === "credits" ||
      game.phase === "launch"
    ) {
      silence();
      return;
    }
    const nearest = game.vehicles
      .filter(
        (v) =>
          (v.id === game.vehicle || !v.stolen) &&
          Math.hypot(v.x - game.player.x, v.z - game.player.z) < 45,
      )
      .sort((a, b) =>
        a.id === game.vehicle
          ? -1
          : b.id === game.vehicle
            ? 1
            : Math.hypot(a.x - game.player.x, a.z - game.player.z) -
              Math.hypot(b.x - game.player.x, b.z - game.player.z),
      )
      .slice(0, 3);
    voices.forEach((voice, i) => {
      const v = nearest[i];
      if (!v) {
        voice.gain.gain.setTargetAtTime(0, context.currentTime, 0.08);
        return;
      }
      const p = vehicleProfile(v),
        speed = v.currentSpeed || 0,
        load = Math.min(1, speed / p.top),
        distance = Math.hypot(v.x - game.player.x, v.z - game.player.z),
        frequency = p.pitch * (1 + load * 2.8);
      voice.osc.type = p.wave;
      voice.harmonic.type = p.wave === "sine" ? "sine" : "triangle";
      voice.osc.frequency.setTargetAtTime(frequency, context.currentTime, 0.08);
      voice.harmonic.frequency.setTargetAtTime(
        frequency * 2.02,
        context.currentTime,
        0.08,
      );
      voice.filter.frequency.setTargetAtTime(
        p.wave === "sine" ? 1800 : 550 + load * 1000,
        context.currentTime,
        0.1,
      );
      voice.gain.gain.setTargetAtTime(
        (v.id === game.vehicle ? 0.018 : 0.008) *
          Math.max(0, 1 - distance / 45),
        context.currentTime,
        0.1,
      );
    });
    const blast = game.explosions.at(-1);
    if (blast && blast !== lastBlast && game.time - blast.started < 0.4) {
      lastBlast = blast;
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(95, context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        24,
        context.currentTime + 0.45,
      );
      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.6);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
    const attack = game.player.attack;
    if (attack && attack !== lastAttack) {
      lastAttack = attack;
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.type = attack.kind === "shoot" ? "sine" : "triangle";
      osc.frequency.setValueAtTime(
        attack.kind === "shoot" ? 600 : 160,
        context.currentTime,
      );
      osc.frequency.exponentialRampToValueAtTime(
        80,
        context.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.04, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.15);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }
  return {
    unlock,
    update,
    silence,
    toggle,
    get enabled() {
      return enabled;
    },
    stats: () => ({
      available,
      enabled,
      state: context?.state || "locked",
      voices: voices.length,
    }),
  };
}
