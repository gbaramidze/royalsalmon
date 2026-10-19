import type * as LType from 'leaflet';

const CARTO_BASEMAPS_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_KEY;

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** CARTO Voyager tiles when a basemaps key is set, otherwise keyless OpenStreetMap tiles */
export function addBaseTileLayer(L: typeof LType, map: LType.Map) {
  map.attributionControl?.setPrefix(false);

  if (CARTO_BASEMAPS_KEY) {
    return L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_BASEMAPS_KEY}`,
      {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: `${OSM_ATTRIBUTION}, &copy; <a href="https://carto.com/attributions">CARTO</a>`,
      }
    ).addTo(map);
  }

  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: OSM_ATTRIBUTION,
  }).addTo(map);
}
