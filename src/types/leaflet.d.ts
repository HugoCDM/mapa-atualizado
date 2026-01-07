import 'leaflet';

declare module 'leaflet' {
  function heatLayer(
    latlngs: [number, number, number][],
    options?: any
  ): any;
}

declare global {
  interface Window {
    L: typeof import('leaflet');
  }
}
