// Pladsholder for pixelkontoret (320×180 canvas). Erstattes af src/render/office.ts-integration.
export default function OfficeCanvas() {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-line bg-bg2" data-testid="kontor">
      <div className="absolute inset-0 flex items-center justify-center text-muted">Pixelkontoret</div>
    </div>
  );
}
