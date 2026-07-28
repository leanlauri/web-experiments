import { CityRuntime } from '../../city/city.js';

export const proceduralCityPlugin = {
  id: 'procedural',
  type: 'city',
  create(context) {
    const city = new CityRuntime(context);
    return { api: city, dispose: () => city.dispose() };
  },
};
