import HeatmapLayer from 'ol/layer/Heatmap.js'

export function createHeatmapLayer(source) {
  const layer = new HeatmapLayer({ source })
  source.on('change:umapConfig', () => {
    const config = source.get('umapConfig')?.heat || {}
    layer.setBlur(config.blur)
    // Clamp out legacy garbage (prod has negatives and values like 3000). OL's absolute-density
    // heatmap needs ~1/3 of Leaflet's radius to match visually.
    layer.setRadius(Math.min(100, Math.max(1, config.radius)) / 3)
    // Heat.compute normalizes the intensity to [0,1] and bakes it as the `weight` attribute;
    // without an intensity property, every point weighs the same (density).
    layer.setWeight(config.intensityProperty ? 'weight' : 0.1)
  })
  return layer
}
