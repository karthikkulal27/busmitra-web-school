/**
 * Shown over a map whose basemap will not load.
 *
 * A grey rectangle with no explanation is the worst outcome: the clerk assumes
 * the product is broken, and nothing tells anyone what to fix. The bus markers
 * and route geometry still render on top of nothing, so the live picture is not
 * lost — only the streets behind it.
 */
export function MapUnavailable(): React.ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] grid place-items-center p-6">
      <div className="pointer-events-auto max-w-[380px] rounded-[12px] border border-line bg-white/95 px-4 py-3 text-center shadow-sm">
        <div className="font-head text-[13px] font-bold">No basemap</div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate">
          The tile archive at <span className="font-mono">VITE_TILES_URL</span> could not be
          read. Positions and routes still work — only the streets behind them are missing.
          Point it at your own PMTiles archive on R2.
        </p>
      </div>
    </div>
  );
}
