import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import { config } from '../config';

/**
 * The basemap, in one place so the fleet map and the routes editor cannot
 * drift apart.
 *
 * Three sources are possible, in preference order:
 *
 * 1. The tiles Worker (VITE_TILES_WORKER_URL). Same z/x/y endpoint the mobile
 *    apps use, reading the same self-hosted PMTiles archive. This is what
 *    production uses.
 *
 *    It exists because the archive is hosted on Cloudflare Pages, which does
 *    **not** support Range requests — it answers a Range header with 200 and
 *    the whole 8.9 MB body. pmtiles.js Range-reads, so pointing it straight at
 *    Pages produces a grey rectangle and no error worth reading. Measured, not
 *    assumed. Move the archive to R2 and option 2 works again; this one keeps
 *    working either way.
 *
 * 2. PMTiles read directly (VITE_TILES_URL). Correct when the archive is on
 *    R2, which does support Range.
 *
 * 3. A raster fallback, off unless VITE_RASTER_TILES is set.
 *
 * The fallback is a deliberate, flagged deviation from the stack table. It is
 * there because the Protomaps demo archive was deleted upstream in August 2026
 * and there is no public PMTiles archive to point a laptop at, which makes a
 * "walk around and watch the dot" test unreadable — a marker sliding over a
 * grey rectangle tells you nothing about whether it is following the road.
 *
 * It is not a metered API and needs no key, so it does not break the "no
 * Google, no Mapbox, no metered tile API" rule. It does break "self-hosted
 * PMTiles", so it stays off by default and must never be the production
 * setting: OpenStreetMap's tile policy is for light use, not a fleet of school
 * consoles refreshing all morning.
 */
export function buildMapStyle(): StyleSpecification {
  if (config.rasterTiles) {
    return {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: [config.rasterTiles],
          tileSize: 256,
          maxzoom: 19,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
    };
  }

  const source: StyleSpecification['sources'][string] = config.tilesWorkerUrl
    ? {
        type: 'vector',
        tiles: [`${config.tilesWorkerUrl}/{z}/{x}/{y}.mvt`],
        // The extract is cut to zoom 15. Without this MapLibre asks for zoom 16
        // tiles that do not exist instead of overzooming the ones that do, and
        // the map goes blank exactly when someone zooms in to check a stop.
        maxzoom: 15,
        attribution: '<a href="https://protomaps.com">Protomaps</a> © OpenStreetMap',
      }
    : {
        type: 'vector',
        url: `pmtiles://${config.tilesUrl}`,
        attribution: '<a href="https://protomaps.com">Protomaps</a> © OpenStreetMap',
      };

  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: { protomaps: source },
    layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }),
  };
}

/** Labels are part of the vector style; the raster fallback has them baked in. */
export const styleHasVectorLayers = (): boolean => !config.rasterTiles;
