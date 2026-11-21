export function createQuality(mode = "auto", weak = false) {
  if (!["auto", "low", "high"].includes(mode)) mode = "auto";
  const state = { mode, weak, ratio: 1, samples: 0, total: 0, stable: 0 };
  const apply = () => {
    state.low = state.mode === "low" || (state.mode === "auto" && weak);
    state.ratio = state.mode === "high" ? 1.6 : 1;
    state.samples = state.total = state.stable = 0;
  };
  apply();
  return {
    get mode() {
      return state.mode;
    },
    get low() {
      return state.low;
    },
    get ratio() {
      return state.ratio;
    },
    get interval() {
      return state.low ? 1 / 30 : 1 / 60;
    },
    setMode(mode) {
      state.mode = ["auto", "low", "high"].includes(mode) ? mode : "auto";
      apply();
    },
    sample(seconds) {
      if (state.mode !== "auto" || seconds <= 0 || seconds > 0.2) return false;
      state.total += seconds;
      state.samples++;
      if (state.samples < 90) return false;
      const average = state.total / state.samples,
        target = state.low ? 1 / 30 : 1 / 60;
      const before = state.ratio,
        wasLow = state.low;
      if (average > target * 1.18) {
        if (state.ratio <= 0.7) state.low = true;
        state.ratio = Math.max(0.65, state.ratio - 0.1);
        state.stable = 0;
      } else if (average < target * 1.08 && ++state.stable >= 3) {
        state.ratio = Math.min(weak ? 1 : 1.6, state.ratio + 0.05);
        state.stable = 0;
      }
      state.samples = state.total = 0;
      return before !== state.ratio || wasLow !== state.low;
    },
  };
}
// Discard excess wall-clock time rather than trying to replay a long stall.
export function frameSteps(accumulator, elapsed) {
  const total = accumulator + Math.min(0.066666667, Math.max(0, elapsed));
  const steps = Math.min(4, Math.floor((total + 1e-9) * 60));
  return {
    steps,
    remainder: Math.min(1 / 60, Math.max(0, total - steps / 60)),
  };
}
