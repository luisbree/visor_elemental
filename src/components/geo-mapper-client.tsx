
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { type Map as OLMap, Feature as OLFeature } from 'ol';
import type VectorLayerType from 'ol/layer/Vector';
import type VectorSourceType from 'ol/source/Vector';
import type { Extent } from 'ol/extent';
import { ChevronDown, ChevronUp, MapPin, Loader2, Server as ServerIcon } from 'lucide-react'; // Added ServerIcon
import Draw from 'ol/interaction/Draw';
import DragBox from 'ol/interaction/DragBox';
import DragZoom from 'ol/interaction/DragZoom';
import { platformModifierKeyOnly } from 'ol/events/condition';
import { KML, GeoJSON } from 'ol/format';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { transformExtent } from 'ol/proj';
import osmtogeojson from 'osmtogeojson';
import shpwrite from 'shp-write';

import MapView, { BASE_LAYER_DEFINITIONS } from '@/components/map-view';
import MapControls from '@/components/map-controls';
import FeatureAttributesPanel from '@/components/feature-attributes-panel';
import { toast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';

export interface MapLayer {
  id: string;
  name: string;
  olLayer: VectorLayerType<VectorSourceType<OLFeature<any>>> | TileLayer<TileWMS>;
  visible: boolean;
  isGeoServerLayer?: boolean;
}

interface GeoServerDiscoveredLayer {
  name: string;
  title: string;
  addedToMap: boolean;
}

interface OSMCategoryConfig {
  id: string;
  name: string;
  overpassQueryFragment: (bboxStr: string) => string;
  matcher: (tags: any) => boolean;
  style: Style;
}

const osmCategoryConfig: OSMCategoryConfig[] = [
  {
    id: 'watercourses',
    name: 'OSM Cursos de Agua',
    overpassQueryFragment: (bboxStr) => `nwr[waterway~"^(river|stream)$"](${bboxStr});`,
    matcher: (tags) => tags && (tags.waterway === 'river' || tags.waterway === 'stream'),
    style: new Style({ stroke: new Stroke({ color: '#3a86ff', width: 2 }) })
  },
  {
    id: 'water_bodies',
    name: 'OSM Cuerpos de Agua',
    overpassQueryFragment: (bboxStr) => `nwr[natural="water"](${bboxStr});\nnwr[landuse="reservoir"](${bboxStr});`,
    matcher: (tags) => tags && (tags.natural === 'water' || tags.landuse === 'reservoir'),
    style: new Style({ fill: new Fill({ color: 'rgba(58,134,255,0.4)' }), stroke: new Stroke({ color: '#3a86ff', width: 1 }) })
  },
  {
    id: 'roads_paths',
    name: 'OSM Rutas y Caminos',
    overpassQueryFragment: (bboxStr) => `nwr[highway](${bboxStr});`,
    matcher: (tags) => tags && !!tags.highway,
    style: new Style({ stroke: new Stroke({ color: '#adb5bd', width: 3 }) })
  },
  {
    id: 'admin_boundaries',
    name: 'OSM Límites Admin.',
    overpassQueryFragment: (bboxStr) => `nwr[boundary="administrative"][admin_level](${bboxStr});`,
    matcher: (tags) => tags && tags.boundary === 'administrative' && tags.admin_level,
    style: new Style({ stroke: new Stroke({ color: '#ff006e', width: 2, lineDash: [4, 8] }) })
  },
  {
    id: 'green_areas',
    name: 'OSM Áreas Verdes',
    overpassQueryFragment: (bboxStr) => `nwr[leisure="park"](${bboxStr});\nnwr[landuse="forest"](${bboxStr});\nnwr[natural="wood"](${bboxStr});`,
    matcher: (tags) => tags && (tags.leisure === 'park' || tags.landuse === 'forest' || tags.natural === 'wood'),
    style: new Style({ fill: new Fill({ color: 'rgba(13,166,75,0.4)' }), stroke: new Stroke({ color: '#0da64b', width: 1 }) })
  },
  {
    id: 'health_centers',
    name: 'OSM Centros de Salud',
    overpassQueryFragment: (bboxStr) => `nwr[amenity~"^(hospital|clinic|doctors|pharmacy)$"](${bboxStr});`,
    matcher: (tags) => tags && ['hospital', 'clinic', 'doctors', 'pharmacy'].includes(tags.amenity),
    style: new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({color: '#d90429'}), stroke: new Stroke({color: 'white', width: 1.5})})})
  },
  {
    id: 'educational',
    name: 'OSM Educacionales',
    overpassQueryFragment: (bboxStr) => `nwr[amenity~"^(school|university|college|kindergarten)$"](${bboxStr});`,
    matcher: (tags) => tags && ['school', 'university', 'college', 'kindergarten'].includes(tags.amenity),
    style: new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({color: '#8338ec'}), stroke: new Stroke({color: 'white', width: 1.5})})})
  },
  {
    id: 'social_institutions',
    name: 'OSM Instituciones Sociales',
    overpassQueryFragment: (bboxStr) => `
      nwr[amenity~"^(community_centre|social_facility|place_of_worship)$"](${bboxStr});
      nwr[office="ngo"](${bboxStr});
      nwr[leisure="club"](${bboxStr});
    `,
    matcher: (tags) => tags && (
      tags.amenity === 'community_centre' ||
      tags.amenity === 'social_facility' ||
      tags.amenity === 'place_of_worship' ||
      tags.office === 'ngo' ||
      tags.leisure === 'club'
    ),
    style: new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({color: '#ff6b6b'}), stroke: new Stroke({color: 'white', width: 1.5})})})
  },
  {
    id: 'cultural_heritage',
    name: 'OSM Patrimonio Cultural',
    overpassQueryFragment: (bboxStr) => `
      nwr[historic](${bboxStr});
      nwr[tourism="museum"](${bboxStr});
      nwr[tourism="artwork"](${bboxStr});
      nwr[amenity="place_of_worship"][historic](${bboxStr});
      nwr[amenity="place_of_worship"][heritage](${bboxStr});
    `,
    matcher: (tags) => tags && (
      tags.historic ||
      tags.tourism === 'museum' ||
      tags.tourism === 'artwork' ||
      (tags.amenity === 'place_of_worship' && (tags.historic || tags.heritage))
    ),
    style: new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({color: '#8d6e63'}), stroke: new Stroke({color: 'white', width: 1.5})})})
  },
];

const osmCategoriesForSelection = osmCategoryConfig.map(({ id, name }) => ({ id, name }));

const availableBaseLayersForSelect = BASE_LAYER_DEFINITIONS.map(def => ({
  id: def.id,
  name: def.name,
}));


const PANEL_WIDTH = 350;
const PANEL_PADDING = 16;

function triggerDownload(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function triggerDownloadArrayBuffer(content: ArrayBuffer, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export default function GeoMapperClient() {
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const mapRef = useRef<OLMap | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);

  const toolsPanelRef = useRef<HTMLDivElement>(null);
  const [isToolsPanelCollapsed, setIsToolsPanelCollapsed] = useState(false);
  const [toolsPanelPosition, setToolsPanelPosition] = useState({ x: PANEL_PADDING, y: PANEL_PADDING });
  const [isToolsPanelDragging, setIsToolsPanelDragging] = useState(false);
  const toolsPanelDragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  const layersPanelRef = useRef<HTMLDivElement>(null);
  const [isLayersPanelCollapsed, setIsLayersPanelCollapsed] = useState(false);
  const [layersPanelPosition, setLayersPanelPosition] = useState({ x: PANEL_PADDING, y: PANEL_PADDING });
  const [isLayersPanelDragging, setIsLayersPanelDragging] = useState(false);
  const layersPanelDragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  const geoServerPanelRef = useRef<HTMLDivElement>(null); // New GeoServer Panel Ref
  const [isGeoServerPanelCollapsed, setIsGeoServerPanelCollapsed] = useState(false);
  const [geoServerPanelPosition, setGeoServerPanelPosition] = useState({ x: PANEL_PADDING, y: PANEL_PADDING });
  const [isGeoServerPanelDragging, setIsGeoServerPanelDragging] = useState(false);
  const geoServerPanelDragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });


  const [isInspectModeActive, setIsInspectModeActive] = useState(false);
  const [selectedFeatureAttributes, setSelectedFeatureAttributes] = useState<Record<string, any>[] | null>(null);
  const [isFeatureAttributesPanelVisible, setIsFeatureAttributesPanelVisible] = useState(false);
  const [currentInspectedLayerName, setCurrentInspectedLayerName] = useState<string | null>(null);


  const drawingSourceRef = useRef<VectorSourceType<OLFeature<any>> | null>(null);
  const drawingLayerRef = useRef<VectorLayerType<VectorSourceType<OLFeature<any>>> | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);

  const dragBoxInteractionRef = useRef<DragBox | null>(null);
  const defaultDragZoomInteractionRef = useRef<DragZoom | null>(null);
  const wasDragZoomActiveRef = useRef<boolean>(false);


  const [activeDrawTool, setActiveDrawTool] = useState<string | null>(null);
  const [isFetchingOSM, setIsFetchingOSM] = useState(false);
  const [selectedOSMCategoryIds, setSelectedOSMCategoryIds] = useState<string[]>([]);

  const selectedOSMCategoryIdsRef = useRef(selectedOSMCategoryIds);
  useEffect(() => {
    selectedOSMCategoryIdsRef.current = selectedOSMCategoryIds;
  }, [selectedOSMCategoryIds]);

  const [downloadFormat, setDownloadFormat] = useState<string>('geojson');
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeBaseLayerId, setActiveBaseLayerId] = useState<string>(BASE_LAYER_DEFINITIONS[0].id);

  // GeoServer related state
  const [geoServerUrlInput, setGeoServerUrlInput] = useState<string>('');
  const [geoServerDiscoveredLayers, setGeoServerDiscoveredLayers] = useState<GeoServerDiscoveredLayer[]>([]);
  const [isLoadingGeoServerLayers, setIsLoadingGeoServerLayers] = useState<boolean>(false);

  useEffect(() => {
    if (mapAreaRef.current) {
      const mapRect = mapAreaRef.current.getBoundingClientRect();
      if (toolsPanelRef.current) {
        const panelWidth = toolsPanelRef.current.offsetWidth || PANEL_WIDTH;
        setToolsPanelPosition({
          x: mapRect.width - panelWidth - PANEL_PADDING,
          y: PANEL_PADDING,
        });
      }
      if (layersPanelRef.current) {
          setLayersPanelPosition({
              x: PANEL_PADDING,
              y: PANEL_PADDING,
          });
      }
      if (geoServerPanelRef.current) { // Initial position for GeoServer panel
        const panelWidth = geoServerPanelRef.current.offsetWidth || PANEL_WIDTH;
        const toolsPanelHeight = toolsPanelRef.current?.offsetHeight || 200; // Approx height or actual if available
        setGeoServerPanelPosition({
          x: mapRect.width - panelWidth - PANEL_PADDING, // Same X as tools
          y: PANEL_PADDING + toolsPanelHeight + PANEL_PADDING * 2, // Below tools panel with extra padding
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed toolsPanelRef and layersPanelRef from deps to avoid re-running on resize of panels

  const addLayer = useCallback((newLayer: MapLayer) => {
    setLayers(prevLayers => {
      if (prevLayers.some(l => l.id === newLayer.id)) {
        toast(`La capa "${newLayer.name}" ya está en el mapa.`);
        return prevLayers;
      }
      return [...prevLayers, newLayer];
    });
  }, []);

  const removeLayer = useCallback((layerId: string) => {
    setLayers(prevLayers => prevLayers.filter(layer => {
        if (layer.id === layerId) {
            if (layer.isGeoServerLayer) {
                setGeoServerDiscoveredLayers(prevGsLayers =>
                    prevGsLayers.map(gsLayer =>
                        gsLayer.name === layer.name ? { ...gsLayer, addedToMap: false } : gsLayer
                    )
                );
            }
            toast(`Capa "${layer.name}" eliminada del mapa.`);
            return false;
        }
        return true;
    }));
  }, []);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers(prevLayers =>
      prevLayers.map(layer => {
        if (layer.id === layerId) {
          const newVisibility = !layer.visible;
          return { ...layer, visible: newVisibility };
        }
        return layer;
      })
    );
  }, []);

  const setMapInstanceAndElement = useCallback((mapInstance: OLMap, element: HTMLDivElement) => {
    mapRef.current = mapInstance;
    mapElementRef.current = element;

    if (!mapRef.current) {
      console.error("setMapInstanceAndElement called but mapRef.current is null.");
      return;
    }

    if (typeof drawingSourceRef !== 'object' || drawingSourceRef === null || !('current' in drawingSourceRef)) {
        console.error("CRITICAL: drawingSourceRef is not a valid React ref object. Value:", drawingSourceRef, "Type:", typeof drawingSourceRef);
        toast("Error Crítico: Referencia de capa de dibujo (source) corrupta.");
        return;
    }
    if (typeof drawingLayerRef !== 'object' || drawingLayerRef === null || !('current' in drawingLayerRef)) {
        console.error("CRITICAL: drawingLayerRef is not a valid React ref object. Value:", drawingLayerRef, "Type:", typeof drawingLayerRef);
        toast("Error Crítico: Referencia de capa de dibujo (layer) corrupta.");
        return;
    }

    if (!drawingLayerRef.current) {
      try {
        if (!drawingSourceRef.current) {
             drawingSourceRef.current = new VectorSource({ wrapX: false });
        }

        if (!drawingSourceRef.current) {
            console.error("CRITICAL: drawingSourceRef.current is null after attempting initialization. Cannot create drawing layer.");
            toast("Error Crítico: No se pudo inicializar la fuente de la capa de dibujo.");
            return;
        }

        drawingLayerRef.current = new VectorLayer({
            source: drawingSourceRef.current,
            style: new Style({
            fill: new Fill({ color: 'rgba(0, 150, 255, 0.2)' }),
            stroke: new Stroke({ color: '#007bff', width: 2 }),
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({ color: '#007bff' }),
                stroke: new Stroke({ color: '#ffffff', width: 1.5 })
            }),
            }),
            zIndex: 1000
        });
        mapRef.current.addLayer(drawingLayerRef.current);

      } catch (e: any) {
        console.error("Error during drawing layer/source INSTANTIATION or map ADDITION:", e.message, {
          drawingSourceRef_current_value_exists: !!drawingSourceRef.current,
          drawingLayerRef_current_value_exists: !!drawingLayerRef.current,
        });
        toast("Error Crítico: No se pudo inicializar la capa de dibujo (instantiation).");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


 useEffect(() => {
    if (!mapRef.current) return;
    const currentMap = mapRef.current;

    const olMapVectorLayers = currentMap.getLayers().getArray()
      .filter(l => !l.get('isBaseLayer') && l !== drawingLayerRef.current) as (VectorLayerType<VectorSourceType<OLFeature<any>>> | TileLayer<TileWMS>)[];

    olMapVectorLayers.forEach(olMapLayer => {
        currentMap.removeLayer(olMapLayer);
    });

    layers.forEach(appLayer => {
      if (!currentMap.getLayers().getArray().includes(appLayer.olLayer)) {
        currentMap.addLayer(appLayer.olLayer);
      }
      appLayer.olLayer.setVisible(appLayer.visible);
      appLayer.olLayer.setZIndex(100 + layers.indexOf(appLayer));
    });

    if (drawingLayerRef.current) {
      if (!currentMap.getLayers().getArray().includes(drawingLayerRef.current)) {
         currentMap.addLayer(drawingLayerRef.current);
      }
      drawingLayerRef.current.setZIndex(100 + layers.length + 100);
    }

  }, [layers]);

  const processAndDisplayFeatures = useCallback((foundFeatures: OLFeature<any>[]) => {
    if (foundFeatures.length > 0) {
        const allAttributes = foundFeatures
          .map(feature => {
            if (!(feature instanceof OLFeature)) return null;
            const properties = feature.getProperties();
            const attributesToShow: Record<string, any> = {};
            for (const key in properties) {
              if (key !== 'geometry' && key !== feature.getGeometryName()) {
                attributesToShow[key] = properties[key];
              }
            }
            return Object.keys(attributesToShow).length > 0 ? attributesToShow : null;
          })
          .filter(attrs => attrs !== null) as Record<string, any>[];

        if (allAttributes.length > 0) {
          setSelectedFeatureAttributes(allAttributes);
          setIsFeatureAttributesPanelVisible(true);
        } else {
          setSelectedFeatureAttributes(null);
          setIsFeatureAttributesPanelVisible(false);
          setCurrentInspectedLayerName(null);
          toast("La(s) entidad(es) seleccionada(s) no tienen atributos visibles.");
        }
      } else {
        setSelectedFeatureAttributes(null);
        setIsFeatureAttributesPanelVisible(false);
        setCurrentInspectedLayerName(null);
        toast("Ninguna entidad encontrada para inspeccionar.");
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleMapClick = useCallback((event: any) => {
    if (!isInspectModeActive || !mapRef.current || activeDrawTool) return;

    const clickedPixel = mapRef.current.getEventPixel(event.originalEvent);
    if (dragBoxInteractionRef.current && (event.originalEvent.type === 'pointermove' || event.originalEvent.type === 'mousemove')) {
        return;
    }

    const featuresAtPixel: OLFeature<any>[] = [];
    mapRef.current.forEachFeatureAtPixel(clickedPixel, (featureOrLayer) => {
        if (featureOrLayer instanceof OLFeature) {
            featuresAtPixel.push(featureOrLayer);
        }
        return false;
    }, { hitTolerance: 5, layerFilter: (layer) => !(layer instanceof TileLayer) });

    setCurrentInspectedLayerName(null);
    processAndDisplayFeatures(featuresAtPixel);

  }, [isInspectModeActive, activeDrawTool, processAndDisplayFeatures]);

  const handleDragBoxEnd = useCallback((event: any) => {
    if (!mapRef.current || !isInspectModeActive) return;
    const extent = event.target.getGeometry().getExtent();
    const foundFeatures: OLFeature<any>[] = [];

    layers.forEach(layer => {
      if (layer.visible && layer.olLayer && layer.olLayer instanceof VectorLayer) {
        const source = layer.olLayer.getSource();
        if (source) {
          source.forEachFeatureIntersectingExtent(extent, (feature) => {
             if (feature instanceof OLFeature) foundFeatures.push(feature);
          });
        }
      }
    });

    if (drawingLayerRef.current && drawingSourceRef.current) {
      drawingSourceRef.current.forEachFeatureIntersectingExtent(extent, (feature) => {
        if (feature instanceof OLFeature) foundFeatures.push(feature);
      });
    }

    setCurrentInspectedLayerName(null);
    processAndDisplayFeatures(foundFeatures);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, processAndDisplayFeatures, isInspectModeActive]);


  useEffect(() => {
    const currentMap = mapRef.current;
    const mapDiv = mapElementRef.current;

    const cleanupInspectionInteractions = () => {
        if (mapDiv) mapDiv.classList.remove('cursor-crosshair');
        if (!currentMap) return;

        currentMap.un('singleclick', handleMapClick);

        if (dragBoxInteractionRef.current) {
            dragBoxInteractionRef.current.un('boxend', handleDragBoxEnd);
            const interactionsArray = currentMap.getInteractions().getArray();
            if (interactionsArray.includes(dragBoxInteractionRef.current)) {
                currentMap.removeInteraction(dragBoxInteractionRef.current);
            }
            dragBoxInteractionRef.current.dispose();
            dragBoxInteractionRef.current = null;
        }

        if (defaultDragZoomInteractionRef.current) {
             const dragZoomInteraction = currentMap.getInteractions().getArray().find(
                (interaction) => interaction === defaultDragZoomInteractionRef.current
             );
             if (dragZoomInteraction) {
                dragZoomInteraction.setActive(wasDragZoomActiveRef.current);
             }
            defaultDragZoomInteractionRef.current = null;
        }
    };

    if (isInspectModeActive && !activeDrawTool) {
        if (mapDiv) mapDiv.classList.add('cursor-crosshair');
        if (!currentMap) return cleanupInspectionInteractions;

        currentMap.on('singleclick', handleMapClick);

        if (!defaultDragZoomInteractionRef.current) {
            currentMap.getInteractions().forEach(interaction => {
                if (interaction instanceof DragZoom) {
                    defaultDragZoomInteractionRef.current = interaction;
                    wasDragZoomActiveRef.current = interaction.getActive();
                    interaction.setActive(false);
                }
            });
        }

        if (!dragBoxInteractionRef.current) {
            dragBoxInteractionRef.current = new DragBox({
                condition: platformModifierKeyOnly,
            });
            currentMap.addInteraction(dragBoxInteractionRef.current);
        }

        dragBoxInteractionRef.current.un('boxend', handleDragBoxEnd);
        dragBoxInteractionRef.current.on('boxend', handleDragBoxEnd);

    } else {
        cleanupInspectionInteractions();
        if (!isInspectModeActive) {
             setSelectedFeatureAttributes(null);
             setIsFeatureAttributesPanelVisible(false);
             setCurrentInspectedLayerName(null);
        }
    }

    return cleanupInspectionInteractions;

  }, [isInspectModeActive, activeDrawTool, handleMapClick, handleDragBoxEnd]);


  const zoomToLayerExtent = useCallback((layerId: string) => {
    if (!mapRef.current) return;
    const layer = layers.find(l => l.id === layerId);
    if (layer && layer.olLayer) {
      if (layer.olLayer instanceof VectorLayer) {
        const source = layer.olLayer.getSource();
        if (source && source.getFeatures().length > 0) {
          const extent: Extent = source.getExtent();
          if (extent && extent.every(isFinite) && (extent[2] - extent[0] > 0) && (extent[3] - extent[1] > 0)) {
            mapRef.current.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000, maxZoom: 18 });
            toast(`Mostrando extensión de ${layer.name}.`);
          } else {
            toast(`Capa "${layer.name}" podría estar vacía o tener una extensión inválida.`);
          }
        } else {
          toast(`Capa "${layer.name}" no contiene entidades.`);
        }
      } else if (layer.olLayer instanceof TileLayer && layer.olLayer.getSource() instanceof TileWMS) {
        toast(`Zoom a extensión no implementado para capa WMS "${layer.name}".`);
      } else {
         toast(`Capa "${layer.name}" no es una capa vectorial con entidades para hacer zoom.`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  const toggleToolsPanelCollapse = useCallback(() => setIsToolsPanelCollapsed(prev => !prev), []);
  const toggleLayersPanelCollapse = useCallback(() => setIsLayersPanelCollapsed(prev => !prev), []);
  const toggleGeoServerPanelCollapse = useCallback(() => setIsGeoServerPanelCollapsed(prev => !prev), []);


  const handlePanelMouseDown = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    panelType: 'tools' | 'layers' | 'geoserver'
  ) => {
    let panelRef: React.RefObject<HTMLDivElement> | null = null;
    let setDragging: React.Dispatch<React.SetStateAction<boolean>> | null = null;
    let dragStartRefToUpdate: React.MutableRefObject<{ x: number; y: number; panelX: number; panelY: number; }> | null = null;
    let currentPosition: { x: number; y: number; } | null = null;

    switch (panelType) {
      case 'tools':
        panelRef = toolsPanelRef;
        setDragging = setIsToolsPanelDragging;
        dragStartRefToUpdate = toolsPanelDragStartRef;
        currentPosition = toolsPanelPosition;
        break;
      case 'layers':
        panelRef = layersPanelRef;
        setDragging = setIsLayersPanelDragging;
        dragStartRefToUpdate = layersPanelDragStartRef;
        currentPosition = layersPanelPosition;
        break;
      case 'geoserver':
        panelRef = geoServerPanelRef;
        setDragging = setIsGeoServerPanelDragging;
        dragStartRefToUpdate = geoServerPanelDragStartRef;
        currentPosition = geoServerPanelPosition;
        break;
    }

    if (!panelRef?.current || !setDragging || !dragStartRefToUpdate || !currentPosition) return;

    const targetElement = e.target as HTMLElement;
    if (targetElement.closest('button')) { // Ignore clicks on buttons within the header
        return;
    }

    setDragging(true);
    dragStartRefToUpdate.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: currentPosition.x,
      panelY: currentPosition.y,
    };
    e.preventDefault();
  }, [toolsPanelPosition, layersPanelPosition, geoServerPanelPosition]);


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!mapAreaRef.current) return;
      const mapRect = mapAreaRef.current.getBoundingClientRect();

      const movePanel = (
        panelRef: React.RefObject<HTMLDivElement>,
        dragStartRef: React.MutableRefObject<{ x: number; y: number; panelX: number; panelY: number; }>,
        setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; }>>
      ) => {
        if (!panelRef.current) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        let newX = dragStartRef.current.panelX + dx;
        let newY = dragStartRef.current.panelY + dy;
        const panelRect = panelRef.current.getBoundingClientRect();
        if (panelRect.width > 0 && panelRect.height > 0 && mapRect.width > 0 && mapRect.height > 0) {
            newX = Math.max(0, Math.min(newX, mapRect.width - panelRect.width));
            newY = Math.max(0, Math.min(newY, mapRect.height - panelRect.height));
            if (!isNaN(newX) && !isNaN(newY)) setPosition({ x: newX, y: newY });
        }
      };

      if (isToolsPanelDragging) movePanel(toolsPanelRef, toolsPanelDragStartRef, setToolsPanelPosition);
      if (isLayersPanelDragging) movePanel(layersPanelRef, layersPanelDragStartRef, setLayersPanelPosition);
      if (isGeoServerPanelDragging) movePanel(geoServerPanelRef, geoServerPanelDragStartRef, setGeoServerPanelPosition);
    };

    const handleMouseUp = () => {
        setIsToolsPanelDragging(false);
        setIsLayersPanelDragging(false);
        setIsGeoServerPanelDragging(false);
    };

    if (isToolsPanelDragging || isLayersPanelDragging || isGeoServerPanelDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isToolsPanelDragging, isLayersPanelDragging, isGeoServerPanelDragging, 
      toolsPanelDragStartRef, layersPanelDragStartRef, geoServerPanelDragStartRef]);

  const fetchOSMData = useCallback(async () => {
    if (!drawingSourceRef.current) {
        toast("La capa de dibujo no está inicializada.");
        return;
    }
    const drawnFeatures = drawingSourceRef.current.getFeatures();
    if (drawnFeatures.length === 0) {
        toast("Por favor, dibuje una entidad en el mapa primero.");
        return;
    }
    const lastDrawnFeature = drawnFeatures[drawnFeatures.length - 1];

    if (selectedOSMCategoryIdsRef.current.length === 0) {
        toast("Por favor, seleccione al menos una categoría OSM para descargar.");
        return;
    }

    const geometry = lastDrawnFeature.getGeometry();
    if (!geometry || geometry.getType() !== 'Polygon') {
        toast("La descarga de datos OSM requiere un polígono dibujado. Por favor, dibuje un polígono.");
        return;
    }

    setIsFetchingOSM(true);
    toast("Descargando datos de OpenStreetMap...");

    try {
      const extent3857 = geometry.getExtent();
      if (!extent3857 || extent3857.some(val => !isFinite(val)) || (extent3857[2] - extent3857[0] <= 0 && extent3857[2] !== extent3857[0]) || (extent3857[3] - extent3857[1] <= 0 && extent3857[3] !== extent3857[1])) {
          throw new Error(`Área dibujada tiene una extensión inválida (inválida o puntos/líneas). Extent: ${extent3857.join(', ')}`);
      }

      const extent4326_transformed = transformExtent(extent3857, 'EPSG:3857', 'EPSG:4326');
      if (!extent4326_transformed || extent4326_transformed.some(val => !isFinite(val))) {
          throw new Error("Fallo al transformar área dibujada a coordenadas geográficas válidas.");
      }

      const s_coord = parseFloat(extent4326_transformed[1].toFixed(6));
      const w_coord = parseFloat(extent4326_transformed[0].toFixed(6));
      const n_coord = parseFloat(extent4326_transformed[3].toFixed(6));
      const e_coord = parseFloat(extent4326_transformed[2].toFixed(6));

      if (n_coord < s_coord) {
          throw new Error(`Error de Bounding Box (N < S): Norte ${n_coord} es menor que Sur ${s_coord}. BBox original: ${extent4326_transformed.join(', ')}`);
      }
      if (e_coord < w_coord && Math.abs(e_coord - w_coord) < 180) {
          throw new Error(`Error de Bounding Box (E < W): Este ${e_coord} es menor que Oeste ${w_coord} (sin cruzar anti-meridiano). BBox original: ${extent4326_transformed.join(', ')}`);
      }

      const bboxStr = `${s_coord},${w_coord},${n_coord},${e_coord}`;

      let queryParts: string[] = [];
      const categoriesToFetch = osmCategoryConfig.filter(cat => selectedOSMCategoryIdsRef.current.includes(cat.id));

      categoriesToFetch.forEach(cat => {
        queryParts.push(cat.overpassQueryFragment(bboxStr));
      });

      const overpassQuery = `
        [out:json][timeout:90];
        (
          ${queryParts.join('\n          ')}
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Overpass API error details:", errorBody);
        throw new Error(`Error Overpass API: ${response.status} ${response.statusText}`);
      }

      const osmData = await response.json();
      const geojsonData = osmtogeojson(osmData) as any;

      let featuresAddedCount = 0;
      categoriesToFetch.forEach(category => {
        const categoryFeaturesGeoJSON = {
          type: "FeatureCollection",
          features: geojsonData.features.filter((feature: any) => category.matcher(feature.properties))
        };

        if (categoryFeaturesGeoJSON.features.length > 0) {
          const olFeatures = new GeoJSON().readFeatures(categoryFeaturesGeoJSON, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });

          if (olFeatures && olFeatures.length > 0) {
            const vectorSource = new VectorSource({ features: olFeatures });
            const vectorLayer = new VectorLayer({
              source: vectorSource,
              style: category.style
            });
            const layerId = `osm-${category.id}-${Date.now()}`;
            addLayer({ id: layerId, name: `${category.name} (${olFeatures.length})`, olLayer: vectorLayer, visible: true });
            featuresAddedCount += olFeatures.length;
          }
        }
      });

      if (featuresAddedCount > 0) {
        toast(`${featuresAddedCount} entidades OSM añadidas al mapa.`);
      } else {
        toast("Ninguna entidad OSM coincidió con sus criterios en el área seleccionada.");
      }

    } catch (error: any) {
      console.error("Error en fetchOSMData (procesamiento o API):", error);
      toast(error.message || "Ocurrió un error desconocido obteniendo datos OSM.");
    } finally {
      setIsFetchingOSM(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLayer]);


  const toggleDrawingTool = useCallback((toolType: 'Polygon' | 'LineString' | 'Point') => {
    if (!mapRef.current || !drawingSourceRef.current) return;

    if (activeDrawTool === toolType) {
      if (drawInteractionRef.current) {
        mapRef.current.removeInteraction(drawInteractionRef.current);
        drawInteractionRef.current.dispose();
        drawInteractionRef.current = null;
      }
      setActiveDrawTool(null);
      return;
    }

    if (drawInteractionRef.current) {
      mapRef.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current.dispose();
      drawInteractionRef.current = null;
    }

    const newDrawInteraction = new Draw({
      source: drawingSourceRef.current,
      type: toolType,
    });
    mapRef.current.addInteraction(newDrawInteraction);
    drawInteractionRef.current = newDrawInteraction;
    setActiveDrawTool(toolType);
    if (isInspectModeActive) setIsInspectModeActive(false);
  }, [activeDrawTool, isInspectModeActive]);

  const stopDrawingTool = useCallback(() => {
    if (mapRef.current && drawInteractionRef.current) {
      mapRef.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current.dispose();
      drawInteractionRef.current = null;
    }
    setActiveDrawTool(null);
  }, []);

  const clearDrawnFeatures = useCallback(() => {
    if (drawingSourceRef.current) {
      drawingSourceRef.current.clear();
      toast("Todos los dibujos han sido eliminados.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDrawnFeaturesAsKML = useCallback(() => {
    if (!drawingSourceRef.current || drawingSourceRef.current.getFeatures().length === 0) {
      toast("Nada dibujado para guardar.");
      return;
    }
    const features = drawingSourceRef.current.getFeatures();
    const kmlFormat = new KML();
    try {
      const kmlString = kmlFormat.writeFeatures(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });
      triggerDownload(kmlString, 'drawings.kml', 'application/vnd.google-earth.kml+xml;charset=utf-8');
      toast("Dibujos guardados como drawings.kml.");
    } catch (error) {
      console.error("Error guardando KML:", error);
      toast("No se pudieron guardar los dibujos KML.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadOSMLayers = useCallback(async () => {
    setIsDownloading(true);
    toast(`Procesando descarga: ${downloadFormat.toUpperCase()}...`);

    const osmLayers = layers.filter(layer => layer.id.startsWith('osm-'));
    if (osmLayers.length === 0) {
      toast("No hay capas OSM para descargar.");
      setIsDownloading(false);
      return;
    }

    const geoJsonFormatter = new GeoJSON();

    try {
      if (downloadFormat === 'geojson') {
        const allFeatures: OLFeature<any>[] = [];
        osmLayers.forEach(layer => {
          const olLayer = layer.olLayer;
          if (olLayer instanceof VectorLayer) {
            const source = olLayer.getSource();
            if (source) {
                allFeatures.push(...source.getFeatures());
            }
          }
        });
        if (allFeatures.length === 0) throw new Error("No hay entidades en las capas OSM seleccionadas.");
        const geojsonString = geoJsonFormatter.writeFeatures(allFeatures, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
          featureProperties: (feature: OLFeature<any>) => {
            const props = { ...feature.getProperties() };
            delete props[feature.getGeometryName() as string];
            return props;
          }
        });
        triggerDownload(geojsonString, 'osm_data.geojson', 'application/geo+json;charset=utf-8');
        toast("Entidades OSM descargadas como GeoJSON.");

      } else if (downloadFormat === 'kml') {
        const allFeatures: OLFeature<any>[] = [];
        osmLayers.forEach(layer => {
          const olLayer = layer.olLayer;
          if (olLayer instanceof VectorLayer) {
            const source = olLayer.getSource();
            if (source) {
              allFeatures.push(...source.getFeatures());
            }
          }
        });
        if (allFeatures.length === 0) throw new Error("No hay entidades en las capas OSM seleccionadas.");
        const kmlString = new KML().writeFeatures(allFeatures, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857'
        });
        triggerDownload(kmlString, 'osm_data.kml', 'application/vnd.google-earth.kml+xml;charset=utf-8');
        toast("Entidades OSM descargadas como KML.");

      } else if (downloadFormat === 'shp') {
        const geoJsonDataForShpWrite: { [key: string]: any } = {};
        const customTypesForShpWrite: {
            [key: string]: {
                points: any[],
                lines: any[],
                polygons: any[]
            }
        } = {};

        let featuresFoundForShp = false;

        const sanitizeProperties = (olFeature: OLFeature<any>) => {
          const props = { ...olFeature.getProperties() };
          delete props[olFeature.getGeometryName() as string];
          const sanitizedProps: Record<string, any> = {};
          for (const key in props) {
            let sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 10);
            if(sanitizedKey.length === 0) sanitizedKey = `prop${Object.keys(sanitizedProps).length}`;
            let counter = 0;
            let finalKey = sanitizedKey;
            while(finalKey in sanitizedProps) {
                counter++;
                finalKey = `${sanitizedKey.substring(0, 10 - String(counter).length)}${counter}`;
            }
            sanitizedProps[finalKey] = props[key];
          }
          return sanitizedProps;
        };

        osmLayers.forEach(layer => {
            const olLayer = layer.olLayer;
            if (olLayer instanceof VectorLayer) {
                const source = olLayer.getSource();
                const olFeatures = source ? source.getFeatures() : [];

                if (olFeatures.length > 0) {
                    featuresFoundForShp = true;
                    const layerFileName = layer.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/\s+/g, '_');

                    const layerGeoJsonFeatures = olFeatures.map(olFeature => {
                        const geoJsonFeature = geoJsonFormatter.writeFeatureObject(olFeature, {
                            dataProjection: 'EPSG:4326',
                            featureProjection: 'EPSG:3857',
                        });
                        geoJsonFeature.properties = sanitizeProperties(olFeature);
                        return geoJsonFeature;
                    });
                    geoJsonDataForShpWrite[layerFileName] = {
                        type: "FeatureCollection",
                        features: layerGeoJsonFeatures
                    };


                    customTypesForShpWrite[layerFileName] = { points: [], lines: [], polygons: [] };

                    layerGeoJsonFeatures.forEach(geoJsonFeature => {
                        const geomType = geoJsonFeature.geometry?.type;
                        if (geomType === 'Point' || geomType === 'MultiPoint') {
                            customTypesForShpWrite[layerFileName].points.push(geoJsonFeature);
                        } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                            customTypesForShpWrite[layerFileName].lines.push(geoJsonFeature);
                        } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                            customTypesForShpWrite[layerFileName].polygons.push(geoJsonFeature);
                        }
                    });
                }
            }
        });

        if (!featuresFoundForShp) throw new Error("No hay entidades en las capas OSM para exportar como Shapefile.");

        const shpWriteOptions = {
          folder: 'shapefiles_osm',
          types: customTypesForShpWrite
        };

        const zipContentBase64 = await shpwrite.zip(geoJsonDataForShpWrite, shpWriteOptions);

        const byteString = atob(zipContentBase64);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }
        triggerDownloadArrayBuffer(arrayBuffer, 'osm_shapefiles.zip', 'application/zip');
        toast("Entidades OSM descargadas como Shapefile (ZIP).");
      }

    } catch (error: any) {
      console.error("Error descargando capas OSM:", error);
      toast(error.message || "No se pudieron descargar las capas.");
    } finally {
      setIsDownloading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, downloadFormat]);

  const handleChangeBaseLayer = useCallback((newBaseLayerId: string) => {
    if (mapRef.current) {
      mapRef.current.getLayers().forEach(layer => {
        if (layer.get('isBaseLayer')) {
          layer.setVisible(layer.get('baseLayerId') === newBaseLayerId);
        }
      });
      setActiveBaseLayerId(newBaseLayerId);
    }
  }, []);

  const handleShowLayerTable = useCallback((layerId: string) => {
    const layerToShow = layers.find(l => l.id === layerId);
    if (!layerToShow || !layerToShow.olLayer) {
      toast("Error: Capa no encontrada o inválida.");
      setCurrentInspectedLayerName(null);
      return;
    }

    if (layerToShow.olLayer instanceof VectorLayer) {
        const source = layerToShow.olLayer.getSource();
        if (!source) {
          toast(`La capa "${layerToShow.name}" no tiene fuente de datos.`);
          setCurrentInspectedLayerName(null);
          return;
        }
        const features = source.getFeatures();
        if (features.length === 0) {
          toast(`La capa "${layerToShow.name}" no contiene entidades.`);
          setCurrentInspectedLayerName(null);
          return;
        }
        setCurrentInspectedLayerName(layerToShow.name);
        processAndDisplayFeatures(features);
    } else {
        toast(`La capa "${layerToShow.name}" no es una capa vectorial. La visualización de tabla solo está disponible para capas vectoriales.`);
        setCurrentInspectedLayerName(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, processAndDisplayFeatures]);

  const handleFetchGeoServerLayers = useCallback(async () => {
    if (!geoServerUrlInput.trim()) {
      toast("Por favor, ingrese la URL de GeoServer.");
      return;
    }
    setIsLoadingGeoServerLayers(true);
    setGeoServerDiscoveredLayers([]);
    toast("Conectando a GeoServer...");

    try {
      let url = geoServerUrlInput.trim();
      if (!url.toLowerCase().startsWith('http://') && !url.toLowerCase().startsWith('https://')) {
        url = 'http://' + url;
      }
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }
      if (url.toLowerCase().endsWith('/web')) {
        url = url.substring(0, url.length - '/web'.length);
      } else if (url.toLowerCase().endsWith('/web/')) {
         url = url.substring(0, url.length - '/web/'.length);
      }

      const capabilitiesUrl = `${url}/wms?service=WMS&version=1.3.0&request=GetCapabilities`;
      const proxyApiUrl = `/api/geoserver-proxy?url=${encodeURIComponent(capabilitiesUrl)}`;

      const response = await fetch(proxyApiUrl);

      if (!response.ok) {
         const errorData = await response.json().catch(() => ({
           error: "Error desconocido del proxy o respuesta no JSON",
           details: `Proxy status: ${response.status} ${response.statusText}`
         }));
         console.error("Error desde el proxy de GeoServer:", errorData, "Status:", response.status, response.statusText);
         throw new Error(errorData.error || `Error al obtener capacidades vía proxy: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      const errorNode = xmlDoc.querySelector("ServiceExceptionReport ServiceException, ServiceExceptionReport > ServiceException");
      if (errorNode) {
        console.error("GeoServer ServiceException:", errorNode.textContent);
        throw new Error(`Error de GeoServer: ${errorNode.textContent || 'Error desconocido en la respuesta XML de GeoServer.'}`);
      }

      const exceptionTextNode = xmlDoc.querySelector("ExceptionText");
      if(exceptionTextNode && exceptionTextNode.textContent?.trim()) {
        console.error("GeoServer ExceptionText:", exceptionTextNode.textContent);
        throw new Error(`Error de GeoServer: ${exceptionTextNode.textContent.trim()}`);
      }

      const discovered: GeoServerDiscoveredLayer[] = [];
      const layerNodes = xmlDoc.querySelectorAll("Capability > Layer > Layer, WMS_Capabilities > Capability > Layer > Layer");

      if (layerNodes.length === 0) {
           const topLayerNodes = xmlDoc.querySelectorAll("Capability > Layer");
            topLayerNodes.forEach(node => {
                 const nameElement = node.querySelector("Name");
                const titleElement = node.querySelector("Title");
                if (nameElement && nameElement.textContent) {
                    discovered.push({
                        name: nameElement.textContent,
                        title: titleElement?.textContent || nameElement.textContent,
                        addedToMap: false,
                    });
                }
            });
      } else {
          layerNodes.forEach(node => {
            const nameElement = node.querySelector("Name");
            const titleElement = node.querySelector("Title");
            if (nameElement && nameElement.textContent) {
              discovered.push({
                name: nameElement.textContent,
                title: titleElement?.textContent || nameElement.textContent,
                addedToMap: false,
              });
            }
          });
      }

      if (discovered.length === 0 && !errorNode && !exceptionTextNode) {
        const ogcExceptionNode = xmlDoc.querySelector("ows\\:ExceptionText");
        if (ogcExceptionNode && ogcExceptionNode.textContent) {
             console.error("GeoServer OGC Exception:", ogcExceptionNode.textContent);
             throw new Error(`Error de GeoServer (OGC): ${ogcExceptionNode.textContent}`);
        }
        const rawXmlForDebugging = xmlDoc.documentElement.outerHTML;
        if (rawXmlForDebugging.length < 5000) {
            console.warn("GeoServer GetCapabilities XML structure might be unexpected or empty. Response snippet:", rawXmlForDebugging.substring(0, 1000));
        } else {
            console.warn("GeoServer GetCapabilities XML structure might be unexpected or empty. Response is large, check network tab for full XML.");
        }
        toast("No se encontraron capas publicadas en GeoServer o la estructura XML no es la esperada.");
      } else if (discovered.length > 0) {
        setGeoServerDiscoveredLayers(discovered);
        toast(`${discovered.length} capas encontradas en GeoServer.`);
      }

    } catch (error: any) {
      console.error("Error conectando a GeoServer:", error);
      toast(error.message || "Ocurrió un error desconocido al conectar con GeoServer.");
      setGeoServerDiscoveredLayers([]);
    } finally {
      setIsLoadingGeoServerLayers(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoServerUrlInput]);

  const handleAddGeoServerLayerToMap = useCallback((layerName: string, layerTitle: string) => {
    if (!mapRef.current || !geoServerUrlInput.trim()) {
        toast("El mapa o la URL de GeoServer no están disponibles.");
        return;
    }

    let geoserverBaseWmsUrl = geoServerUrlInput.trim();
     if (!geoserverBaseWmsUrl.toLowerCase().startsWith('http://') && !geoserverBaseWmsUrl.toLowerCase().startsWith('https://')) {
        geoserverBaseWmsUrl = 'http://' + geoserverBaseWmsUrl;
    }
    if (geoserverBaseWmsUrl.endsWith('/')) {
        geoserverBaseWmsUrl = geoserverBaseWmsUrl.slice(0, -1);
    }
    if (geoserverBaseWmsUrl.toLowerCase().endsWith('/web')) {
        geoserverBaseWmsUrl = geoserverBaseWmsUrl.substring(0, geoserverBaseWmsUrl.length - '/web'.length);
    } else if (geoserverBaseWmsUrl.toLowerCase().endsWith('/web/')) {
         geoserverBaseWmsUrl = geoserverBaseWmsUrl.substring(0, geoserverBaseWmsUrl.length - '/web/'.length);
    }

    if (!geoserverBaseWmsUrl.toLowerCase().endsWith('/wms')) {
        if (geoserverBaseWmsUrl.toLowerCase().includes('/geoserver')) {
             geoserverBaseWmsUrl = geoserverBaseWmsUrl + '/wms';
        } else {
             geoserverBaseWmsUrl = geoserverBaseWmsUrl + '/wms';
        }
    }

    const wmsSource = new TileWMS({
        url: geoserverBaseWmsUrl,
        params: { 'LAYERS': layerName, 'TILED': true },
        serverType: 'geoserver',
        transition: 0,
    });

    const newOlLayer = new TileLayer({
        source: wmsSource,
        properties: { 'title': layerTitle }
    });

    const mapLayerId = `geoserver-${layerName}-${Date.now()}`;
    const newMapLayer: MapLayer = {
      id: mapLayerId,
      name: layerTitle || layerName,
      olLayer: newOlLayer,
      visible: true,
      isGeoServerLayer: true,
    };

    addLayer(newMapLayer);
    setGeoServerDiscoveredLayers(prev =>
        prev.map(l => l.name === layerName ? { ...l, addedToMap: true } : l)
    );
    toast(`Capa "${layerTitle || layerName}" añadida al mapa.`);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoServerUrlInput, addLayer]);


  const layersPanelRenderConfig = {
    baseLayers: true,
    layers: true,
    geoServer: false, // GeoServer section moved to its own panel
    inspector: true,
  };
  const toolsPanelRenderConfig = {
    inspector: false,
    osmCapabilities: true,
    drawing: true,
    geoServer: false,
  };
  const geoServerPanelRenderConfig = { // New render config for GeoServer panel
    baseLayers: false,
    layers: false,
    geoServer: true,
    inspector: false,
    osmCapabilities: false,
    drawing: false,
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <header className="bg-gray-800/60 backdrop-blur-md text-white p-4 shadow-md flex items-center">
        <MapPin className="mr-3 h-7 w-7 text-primary" />
        <h1 className="text-2xl font-semibold">Visor DEAS</h1>
      </header>
      <div ref={mapAreaRef} className="relative flex-1 overflow-hidden">
        <MapView mapRef={mapRef} setMapInstanceAndElement={setMapInstanceAndElement} />

        <FeatureAttributesPanel
          featuresAttributes={selectedFeatureAttributes}
          isVisible={isFeatureAttributesPanelVisible}
          layerName={currentInspectedLayerName}
          onClose={() => {
            setIsFeatureAttributesPanelVisible(false);
            setSelectedFeatureAttributes(null);
            setCurrentInspectedLayerName(null);
          }}
        />

        {/* Layers Panel (Left) */}
        <div
          ref={layersPanelRef}
          className="absolute bg-gray-800/60 backdrop-blur-md rounded-lg shadow-xl flex flex-col text-white overflow-hidden z-30"
          style={{
             width: `${PANEL_WIDTH}px`,
             top: `${layersPanelPosition.y}px`,
             left: `${layersPanelPosition.x}px`,
             maxHeight: 'calc(100vh - 2 * var(--panel-padding, 16px) - 64px)' // 64px for header
          }}
        >
          <div
            className="p-2 bg-gray-700/80 flex items-center justify-between cursor-grab rounded-t-lg"
            onMouseDown={(e) => handlePanelMouseDown(e, 'layers')}
          >
            <h2 className="text-sm font-semibold">Capas y Utilitarios</h2>
            <Button variant="ghost" size="icon" onClick={toggleLayersPanelCollapse} className="h-6 w-6 text-white hover:bg-gray-600/80">
              {isLayersPanelCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              <span className="sr-only">{isLayersPanelCollapsed ? 'Expandir' : 'Colapsar'}</span>
            </Button>
          </div>

          {!isLayersPanelCollapsed && (
            <div className="flex-1 min-h-0 bg-transparent" style={{ overflowY: 'auto' }}>
              <MapControls
                  renderConfig={layersPanelRenderConfig}
                  availableBaseLayers={availableBaseLayersForSelect}
                  activeBaseLayerId={activeBaseLayerId}
                  onChangeBaseLayer={handleChangeBaseLayer}
                  layers={layers}
                  onToggleLayerVisibility={toggleLayerVisibility}
                  onRemoveLayer={removeLayer}
                  onZoomToLayerExtent={zoomToLayerExtent}
                  onShowLayerTable={handleShowLayerTable}
                  onAddLayer={addLayer} // For file uploads
                  isInspectModeActive={isInspectModeActive}
                  onToggleInspectMode={() => {
                    const newInspectModeState = !isInspectModeActive;
                    setIsInspectModeActive(newInspectModeState);
                    if (activeDrawTool && newInspectModeState) stopDrawingTool();
                    if (!newInspectModeState) {
                      setIsFeatureAttributesPanelVisible(false);
                      setSelectedFeatureAttributes(null);
                      setCurrentInspectedLayerName(null);
                    }
                  }}
                  // Pass empty/default for props not used by this panel's config
                  activeDrawTool={null} onToggleDrawingTool={() => {}} onStopDrawingTool={() => {}}
                  onClearDrawnFeatures={() => {}} onSaveDrawnFeaturesAsKML={() => {}}
                  isFetchingOSM={false} onFetchOSMDataTrigger={() => {}}
                  osmCategoriesForSelection={[]} selectedOSMCategoryIds={[]} onSelectedOSMCategoriesChange={() => {}}
                  downloadFormat="" onDownloadFormatChange={() => {}} onDownloadOSMLayers={() => {}} isDownloading={false}
                  geoServerUrlInput="" onGeoServerUrlChange={() => {}} onFetchGeoServerLayers={() => {}}
                  geoServerDiscoveredLayers={[]} isLoadingGeoServerLayers={false} onAddGeoServerLayerToMap={() => {}}
              />
            </div>
          )}
        </div>

        {/* Tools Panel (Right) */}
        <div
          ref={toolsPanelRef}
          className="absolute bg-gray-800/60 backdrop-blur-md rounded-lg shadow-xl flex flex-col text-white overflow-hidden z-30"
          style={{
             width: `${PANEL_WIDTH}px`,
             top: `${toolsPanelPosition.y}px`,
             left: `${toolsPanelPosition.x}px`,
             maxHeight: 'calc(100vh - 2 * var(--panel-padding, 16px) - 64px)'
          }}
        >
          <div
            className="p-2 bg-gray-700/80 flex items-center justify-between cursor-grab rounded-t-lg"
            onMouseDown={(e) => handlePanelMouseDown(e, 'tools')}
          >
            <h2 className="text-sm font-semibold">Herramientas</h2>
            <Button variant="ghost" size="icon" onClick={toggleToolsPanelCollapse} className="h-6 w-6 text-white hover:bg-gray-600/80">
              {isToolsPanelCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
          {!isToolsPanelCollapsed && (
            <div className="flex-1 min-h-0 bg-transparent" style={{ overflowY: 'auto' }}>
              <MapControls
                  renderConfig={toolsPanelRenderConfig}
                  onAddLayer={() => {}} // Not used for file uploads here
                  activeDrawTool={activeDrawTool}
                  onToggleDrawingTool={toggleDrawingTool}
                  onStopDrawingTool={stopDrawingTool}
                  onClearDrawnFeatures={clearDrawnFeatures}
                  onSaveDrawnFeaturesAsKML={saveDrawnFeaturesAsKML}
                  isFetchingOSM={isFetchingOSM}
                  onFetchOSMDataTrigger={fetchOSMData}
                  osmCategoriesForSelection={osmCategoriesForSelection}
                  selectedOSMCategoryIds={selectedOSMCategoryIds}
                  onSelectedOSMCategoriesChange={setSelectedOSMCategoryIds}
                  downloadFormat={downloadFormat}
                  onDownloadFormatChange={setDownloadFormat}
                  onDownloadOSMLayers={handleDownloadOSMLayers}
                  isDownloading={isDownloading}
                  // Pass empty/default for props not used by this panel's config
                  availableBaseLayers={[]} activeBaseLayerId="" onChangeBaseLayer={() => {}}
                  layers={[]} onToggleLayerVisibility={() => {}} onRemoveLayer={() => {}}
                  onZoomToLayerExtent={() => {}} onShowLayerTable={() => {}}
                  isInspectModeActive={false} onToggleInspectMode={() => {}}
                  geoServerUrlInput="" onGeoServerUrlChange={() => {}} onFetchGeoServerLayers={() => {}}
                  geoServerDiscoveredLayers={[]} isLoadingGeoServerLayers={false} onAddGeoServerLayerToMap={() => {}}
              />
            </div>
          )}
        </div>
        
        {/* GeoServer Panel (New - Right, below Tools) */}
        <div
          ref={geoServerPanelRef}
          className="absolute bg-gray-800/60 backdrop-blur-md rounded-lg shadow-xl flex flex-col text-white overflow-hidden z-30"
          style={{
             width: `${PANEL_WIDTH}px`,
             top: `${geoServerPanelPosition.y}px`,
             left: `${geoServerPanelPosition.x}px`,
             maxHeight: 'calc(100vh - 2 * var(--panel-padding, 16px) - 64px)'
          }}
        >
          <div
            className="p-2 bg-gray-700/80 flex items-center justify-between cursor-grab rounded-t-lg"
            onMouseDown={(e) => handlePanelMouseDown(e, 'geoserver')}
          >
             <div className="flex items-center">
                <ServerIcon className="mr-2 h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Conexión GeoServer</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleGeoServerPanelCollapse} className="h-6 w-6 text-white hover:bg-gray-600/80">
              {isGeoServerPanelCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
          {!isGeoServerPanelCollapsed && (
            <div className="flex-1 min-h-0 bg-transparent" style={{ overflowY: 'auto' }}>
              <MapControls
                  renderConfig={geoServerPanelRenderConfig}
                  geoServerUrlInput={geoServerUrlInput}
                  onGeoServerUrlChange={setGeoServerUrlInput}
                  onFetchGeoServerLayers={handleFetchGeoServerLayers}
                  geoServerDiscoveredLayers={geoServerDiscoveredLayers}
                  isLoadingGeoServerLayers={isLoadingGeoServerLayers}
                  onAddGeoServerLayerToMap={handleAddGeoServerLayerToMap}
                  // Pass empty/default for props not used by this panel's config
                  onAddLayer={() => {}}
                  availableBaseLayers={[]} activeBaseLayerId="" onChangeBaseLayer={() => {}}
                  layers={[]} onToggleLayerVisibility={() => {}} onRemoveLayer={() => {}}
                  onZoomToLayerExtent={() => {}} onShowLayerTable={() => {}}
                  isInspectModeActive={false} onToggleInspectMode={() => {}}
                  activeDrawTool={null} onToggleDrawingTool={() => {}} onStopDrawingTool={() => {}}
                  onClearDrawnFeatures={() => {}} onSaveDrawnFeaturesAsKML={() => {}}
                  isFetchingOSM={false} onFetchOSMDataTrigger={() => {}}
                  osmCategoriesForSelection={[]} selectedOSMCategoryIds={[]} onSelectedOSMCategoriesChange={() => {}}
                  downloadFormat="" onDownloadFormatChange={() => {}} onDownloadOSMLayers={() => {}} isDownloading={false}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
    
    