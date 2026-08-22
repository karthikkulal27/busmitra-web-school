import maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Protocol } from 'pmtiles';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MANGALORE } from '../config';
import { api } from '../lib/api';
import { buildMapStyle, styleHasVectorLayers } from '../lib/mapStyle';
import { MapUnavailable } from './MapUnavailable';
import { useFleet } from '../lib/fleet';
import type { LiveFix, Stop } from '../lib/types';

let protocolRegistered = false;
function registerPmtiles(): void {
  if (protocolRegistered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolRegistered = true;
}

interface Glide {
  fromLng: number;
  fromLat: number;
  toLng: number;
  toLat: number;
  startedAt: number;
  durationMs: number;
}

interface BusMarker {
  marker: maplibregl.Marker;
  nose: HTMLElement;
  glide: Glide | null;
  lastFixAt: number;
  heading: number;
}

const MIN_GLIDE_MS = 800;
const MAX_GLIDE_MS = 15_000;

function interpolate(g: Glide, now: number): { lng: number; lat: number } {
  const t = Math.min(1, (now - g.startedAt) / g.durationMs);
  return {
    lng: g.fromLng + (g.toLng - g.fromLng) * t,
    lat: g.fromLat + (g.toLat - g.fromLat) * t,
  };
}

function makeElement(plate: string): { wrapper: HTMLElement; nose: HTMLElement } {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.display = 'grid';
  wrapper.style.placeItems = 'center';
  // Pinned: MapLibre replaces this element's positioning with its own, and an
  // auto-width marker lets the halo inside it grow to the width of the map.
  wrapper.style.width = '30px';
  wrapper.style.height = '30px';
  wrapper.title = plate;

  const halo = document.createElement('div');
  halo.className = 'bus-halo';

  const body = document.createElement('div');
  body.className = 'bus-marker';

  const nose = document.createElement('div');
  nose.className = 'nose';
  body.appendChild(nose);
  wrapper.append(halo, body);

  return { wrapper, nose };
}

export interface FleetMapProps {
  /** Which buses to draw. Plates are used for the marker tooltip. */
  buses: { busId: string; plate: string }[];
  /**
   * Only draw a bus when its newest fix belongs to this trip. SA-04 passes it
   * so a finished trip does not borrow the marker of the bus's current one.
   */
  onlyTripId?: string | null;
  /** Draw this route's stops and connect them. SA-04 only. */
  stops?: Stop[];
  /** Breadcrumb trail of where the bus has actually been. SA-04 only. */
  track?: [number, number][];
  /** Recentre when this bus moves off screen. */
  followBusId?: string | null;
  onBusClick?: (busId: string) => void;
}

/**
 * One MapLibre map, N buses, each gliding between fixes.
 *
 * Markers are managed imperatively rather than as React children: at one fix
 * per bus per ten seconds a re-render per update would be wasteful, and the
 * interpolation has to run on requestAnimationFrame regardless.
 */
export function FleetMap({
  buses,
  stops,
  track,
  followBusId,
  onBusClick,
  onlyTripId,
}: FleetMapProps): React.ReactElement {
  // The school, not a hardcoded Mangalore centre — this map is looked at every
  // morning, and it should already be showing the right town.
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.settings() });
  const centre: [number, number] =
    settings?.school.lat != null && settings.school.lng != null
      ? [settings.school.lng, settings.school.lat]
      : MANGALORE;
  const centreRef = useRef<[number, number]>(centre);
  centreRef.current = centre;

  const containerRef = useRef<HTMLDivElement>(null);
  const [tilesBroken, setTilesBroken] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, BusMarker>>(new Map());
  const placedRef = useRef(false);
  const onBusClickRef = useRef(onBusClick);
  onBusClickRef.current = onBusClick;

  // --- map, once ------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    registerPmtiles();

    markersRef.current = new Map();
    placedRef.current = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(),
      center: centreRef.current,
      zoom: 11.5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    // A missing or unreachable archive must say so rather than showing a grey
    // rectangle the office will read as "the product is broken".
    map.on('error', (e) => {
      const message = String((e as { error?: Error }).error?.message ?? '');
      if (/pmtiles|Bad response|40\d|Failed to fetch/i.test(message)) setTilesBroken(true);
    });

    let frame = 0;
    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      const now = performance.now();
      for (const entry of markersRef.current.values()) {
        if (!entry.glide) continue;
        const p = interpolate(entry.glide, now);
        entry.marker.setLngLat([p.lng, p.lat]);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      for (const entry of markersRef.current.values()) entry.marker.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- route stops and trail (SA-04) ---------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = (): void => {
      if (stops && stops.length > 0) {
        const line: [number, number][] = stops.map((s) => [s.lng, s.lat]);
        setGeoJson(map, 'route-line', {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: line },
        });
        if (!map.getLayer('route-line')) {
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-line',
            paint: {
              'line-color': '#63748C',
              'line-width': 3,
              'line-dasharray': [2, 2],
            },
          });
        }

        setGeoJson(map, 'route-stops', {
          type: 'FeatureCollection',
          features: stops.map((s) => ({
            type: 'Feature',
            properties: { name: s.name, seq: s.seq },
            geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
          })),
        });
        if (!map.getLayer('route-stops')) {
          map.addLayer({
            id: 'route-stops',
            type: 'circle',
            source: 'route-stops',
            paint: {
              'circle-radius': 5,
              'circle-color': '#FFFFFF',
              'circle-stroke-color': '#16202E',
              'circle-stroke-width': 2.5,
            },
          });
          if (styleHasVectorLayers()) map.addLayer({
            id: 'route-stop-labels',
            type: 'symbol',
            source: 'route-stops',
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 11,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': '#243347',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1.5,
            },
          });
        }
      }

      if (track && track.length > 1) {
        setGeoJson(map, 'trip-track', {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: track },
        });
        if (!map.getLayer('trip-track')) {
          map.addLayer({
            id: 'trip-track',
            type: 'line',
            source: 'trip-track',
            paint: { 'line-color': '#1E9E6A', 'line-width': 4, 'line-opacity': 0.85 },
          });
        }
      }
    };

    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
  }, [stops, track]);

  // --- markers follow the fleet store --------------------------------------
  useEffect(() => {
    const applyState = (state: { fixes: Record<string, LiveFix> }): void => {
      const map = mapRef.current;
      if (!map) return;

      for (const bus of buses) {
        const fix: LiveFix | undefined = state.fixes[bus.busId];
        if (!fix) continue;
        if (onlyTripId && fix.tripId !== onlyTripId) continue;

        let entry = markersRef.current.get(bus.busId);
        if (!entry) {
          const { wrapper, nose } = makeElement(bus.plate);
          wrapper.style.cursor = onBusClickRef.current ? 'pointer' : 'default';
          wrapper.addEventListener('click', () => onBusClickRef.current?.(bus.busId));
          const marker = new maplibregl.Marker({ element: wrapper })
            .setLngLat([fix.lng, fix.lat])
            .addTo(map);
          entry = { marker, nose, glide: null, lastFixAt: 0, heading: 0 };
          markersRef.current.set(bus.busId, entry);
        }

        const now = performance.now();
        const gap = entry.lastFixAt ? now - entry.lastFixAt : MIN_GLIDE_MS;
        entry.lastFixAt = now;

        const current = entry.glide
          ? interpolate(entry.glide, now)
          : { lng: fix.lng, lat: fix.lat };

        entry.glide = {
          fromLng: current.lng,
          fromLat: current.lat,
          toLng: fix.lng,
          toLat: fix.lat,
          startedAt: now,
          // Glide over the gap we just observed, so a 10s reporting interval
          // produces 10s of movement. Clamped so a reconnect after a dead zone
          // snaps instead of crawling across the city for five minutes.
          durationMs: Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, gap)),
        };

        if (fix.heading !== null) {
          const delta = ((fix.heading - entry.heading + 540) % 360) - 180;
          entry.heading += delta;
          entry.nose.style.transform = `rotate(${entry.heading}deg)`;
        }

        const shouldFollow = followBusId ? bus.busId === followBusId : buses.length === 1;
        if (!placedRef.current && shouldFollow) {
          placedRef.current = true;
          map.easeTo({ center: [fix.lng, fix.lat], zoom: 14.5, duration: 900 });
        } else if (shouldFollow && !map.getBounds().contains([fix.lng, fix.lat])) {
          map.easeTo({ center: [fix.lng, fix.lat], duration: 900 });
        }
      }

      // Drop markers for buses no longer being shown.
      const wanted = new Set(buses.map((b) => b.busId));
      for (const [busId, entry] of markersRef.current) {
        if (!wanted.has(busId)) {
          entry.marker.remove();
          markersRef.current.delete(busId);
        }
      }
    };

    // Positions already in the store when this screen mounts would otherwise
    // never draw — the subscription only fires on change.
    applyState(useFleet.getState());
    return useFleet.subscribe(applyState);
  }, [buses, followBusId, onlyTripId]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {tilesBroken ? <MapUnavailable /> : null}
    </div>
  );
}

/** addSource the first time, setData afterwards. */
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
