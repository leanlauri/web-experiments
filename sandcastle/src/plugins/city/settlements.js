export const settlementsCityPlugin = {
  id: 'settlements',
  type: 'city',
  create({ createSettlements }) {
    if (typeof createSettlements !== 'function') throw new Error('The settlements plugin requires createSettlements()');
    const api = createSettlements();
    return { api, dispose: () => api.dispose() };
  },
};
