import maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Protocol } from 'pmtiles';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MANGALORE } from '../config';
import { api } from '../lib/api';
import { buildMapStyle, styleHasVectorLayers } from '../lib/mapStyle';
import { MapUnavailable } from './MapUnavailable';
import type { EditorStop } from '../lib/types';

let registered = false;
function registerPmtiles(): void {
  if (registered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  registered = true;
}

export interface RouteMapProps {
  stops: EditorStop[];
  selectedStopId: string | null;
  /** Clicking the map moves the selected stop. Set-up work, done once in June. */
  onPick: (lat: number, lng: number) => void;
  /**
   * Where the search box last landed. Flying there rather than re-centring on
   * every render keeps the clerk's own panning from being yanked away.
   */
  flyTo?: { lat: number; lng: number; at: number } | null;
}

/**
 * The routes editor's map.
 *
 * Draws the route line, every stop, and the selected stop's geofence circle at
 * its true radius. SA-05's note is that the radius matters more than you would
 * think — a 50 m default false-fires on Surathkal service roads — so it has to
 * be visible on the map while you edit it, not just a number in a box.
 */
export function RouteMap({
  stops,
  selectedStopId,
  onPick,
  flyTo,
}: RouteMapProps): React.ReactElement {
  // Opening over the school rather than a hardcoded Mangalore centre. A clerk
  // placing stops on the Hennur road should not start 350 km out to sea.
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.settings() });
  const centre: [number, number] =
    settings?.school.lat != null && settings.school.lng != null
      ? [settings.school.lng, settings.school.lat]
      : MANGALORE;
  const centreRef = useRef<[number, number]>(centre);
  centreRef.current = centre;

  // The map is constructed once, on mount, and the settings query has not
  // resolved by then — so reading the centre at construction gets the Mangalore
  // fallback every time and the ref update never reaches the map. The position
  // has to be applied when it arrives.
  //
  // Depending on the two numbers rather than the tuple, because the tuple is a
  // new array every render and would re-centre the map continuously, fighting
  // the clerk for control of it.
  const schoolLat = settings?.school.lat ?? null;
  const schoolLng = settings?.school.lng ?? null;
  useEffect(() => {
    // Not once it has fitted to real stops — that view is better than the
    // school centre, and yanking it back would undo the fit.
    if (!mapRef.current || fittedRef.current) return;
    if (schoolLat == null || schoolLng == null) return;
    mapRef.current.jumpTo({ center: [schoolLng, schoolLat], zoom: 13 });
  }, [schoolLat, schoolLng]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [tilesBroken, setTilesBroken] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: 15, duration: 900 });
  }, [flyTo]);

  useEffect(() => {
    if (!containerRef.current) return;
    registerPmtiles();
    fittedRef.current = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(),
      center: centreRef.current,
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('click', (e) => onPickRef.current(e.lngLat.lat, e.lngLat.lng));
    map.getCanvas().style.cursor = 'crosshair';
    mapRef.current = map;

    // A missing or unreachable archive must say so rather than showing a grey
    // rectangle the office will read as "the product is broken".
    map.on('error', (e) => {
      const message = String((e as { error?: Error }).error?.message ?? '');
      if (/pmtiles|Bad response|40\d|Failed to fetch/i.test(message)) setTilesBroken(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = (): void => {
      const placed = stops.filter((s) => s.lat !== null && s.lng !== null);

      setGeoJson(map, 'edit-line', {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: placed.map((s) => [s.lng, s.lat] as [number, number]),
        },
      });
      if (!map.getLayer('edit-line')) {
        map.addLayer({
          id: 'edit-line',
          type: 'line',
          source: 'edit-line',
          paint: { 'line-color': '#63748C', 'line-width': 3, 'line-dasharray': [2, 2] },
        });
      }

      // The geofence, in metres, as a real circle on the ground.
      // An empty FeatureCollection, not a polygon with an empty ring: the
      // latter is invalid GeoJSON, and MapLibre throws on it, which aborts the
      // rest of this function and leaves the map blank.
      const selected = placed.find((s) => s.id === selectedStopId);
      setGeoJson(
        map,
        'edit-fence',
        selected
          ? {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: circle(selected.lng, selected.lat, selected.geofenceM),
                },
              ],
            }
          : { type: 'FeatureCollection', features: [] },
      );
      if (!map.getLayer('edit-fence')) {
        map.addLayer({
          id: 'edit-fence',
          type: 'fill',
          source: 'edit-fence',
          paint: { 'fill-color': '#FFC53D', 'fill-opacity': 0.28 },
        });
      }

      setGeoJson(map, 'edit-stops', {
        type: 'FeatureCollection',
        features: placed.map((s) => ({
          type: 'Feature',
          properties: { name: `${s.seq}. ${s.name}`, selected: s.id === selectedStopId ? 1 : 0 },
          geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        })),
      });
      if (!map.getLayer('edit-stops')) {
        map.addLayer({
          id: 'edit-stops',
          type: 'circle',
          source: 'edit-stops',
          paint: {
            'circle-radius': ['case', ['==', ['get', 'selected'], 1], 8, 5],
            'circle-color': ['case', ['==', ['get', 'selected'], 1], '#FFC53D', '#FFFFFF'],
            'circle-stroke-color': '#16202E',
            'circle-stroke-width': 2.5,
          },
        });
        if (styleHasVectorLayers()) map.addLayer({
          id: 'edit-stop-labels',
          type: 'symbol',
          source: 'edit-stops',
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 11,
            'text-offset': [0, 1.3],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#243347',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 1.5,
          },
        });
      }

      if (!fittedRef.current && placed.length > 0) {
        fittedRef.current = true;
        const bounds = new maplibregl.LngLatBounds();
        for (const s of placed) bounds.extend([s.lng, s.lat]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
      }
    };

    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
  }, [stops, selectedStopId]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {tilesBroken ? <MapUnavailable /> : null}
    </div>
  );
}

/** A circle of `radiusM` metres as a polygon, corrected for latitude. */
function circle(lng: number, lat: number, radiusM: number): Geometry {
  const points = 48;
  const latOffset = radiusM / 111_320;
  const lngOffset = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * 2 * Math.PI;
    ring.push([lng + lngOffset * Math.cos(angle), lat + latOffset * Math.sin(angle)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

function setGeoJson(
  map: maplibregl.Map,
  id: string,
  data: Feature<Geometry> | FeatureCollection<Geometry>,
): void {
  const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }
  map.addSource(id, { type: 'geojson', data });
}
