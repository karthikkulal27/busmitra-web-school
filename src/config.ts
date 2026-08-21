/** The school console. Everything else it needs, it learns from the session. */
export const config = {
  apiUrl: import.meta.env['VITE_API_URL'] ?? 'http://localhost:4000',

  /**
   * Your own PMTiles archive on R2. Defaults to the Protomaps demo archive
   * behind the dev-server proxy — hitting that bucket directly from a browser
   * fails CORS, so the bare URL renders an empty map.
   */
  tilesUrl: import.meta.env['VITE_TILES_URL'] ?? '/pmtiles-demo/v4.pmtiles',

  /**
   * Base URL of the tiles Worker (/infra/tiles-worker), no trailing slash.
   *
   * Preferred over tilesUrl when set. The Worker serves z/x/y, which is the
   * only thing that works when the archive is hosted somewhere without Range
   * support — and it is the exact same endpoint the mobile apps use, so there
   * is one tile path to keep working rather than two.
   */
  tilesWorkerUrl: import.meta.env['VITE_TILES_WORKER_URL'] ?? '',

  /**
   * Dev-only raster fallback, off unless set. See lib/mapStyle.ts for why it
   * exists and why it must not be the production setting.
   */
  rasterTiles: import.meta.env['VITE_RASTER_TILES'] ?? '',
} as const;

/** Mangalore. Only used until the first position arrives. */
export const MANGALORE: [number, number] = [74.842, 12.914];
