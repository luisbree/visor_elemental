
import type { Feature as OLFeature, Map as OLMap } from 'ol';
import type VectorLayerType from 'ol/layer/Vector';
import type VectorSourceType from 'ol/source/Vector';
import type TileLayer from 'ol/layer/Tile';
import type TileWMS from 'ol/source/TileWMS';
import type { Style } from 'ol/style';

export interface MapLayer {
  id: string;
  name: string;
  olLayer: VectorLayerType<VectorSourceType<OLFeature<any>>> | TileLayer<TileWMS>;
  visible: boolean;
  isGeoServerLayer?: boolean;
  originType?: 'wms' | 'wfs' | 'file'; // Added to distinguish layer origin
}

export interface GeoServerDiscoveredLayer {
  name: string;
  title: string;
  wmsAddedToMap: boolean; // Changed from addedToMap
  wfsAddedToMap: boolean; // New property
}

export interface OSMCategoryConfig {
  id: string;
  name: string;
  overpassQueryFragment: (bboxStr: string) => string;
  matcher: (tags: any) => boolean;
  style: Style;
}

// Types previously in map-controls.tsx
export interface BaseLayerOptionForSelect {
  id: string;
  name: string;
}

export interface PanelRenderConfig {
  baseLayers?: boolean;
  layerFileUpload?: boolean;
  layerList?: boolean;
  inspectorTool?: boolean;
  drawingTools?: boolean;
  osmIntegration?: boolean;
  geoServerConnection?: boolean;
}

export interface PanelProps {
  mapRef: React.RefObject<OLMap | null>;
  // Add other common props if needed, or specific panels will define their own
}
