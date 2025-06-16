
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MapPin, Database, Wrench } from 'lucide-react'; // Added Database, Wrench
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { transformExtent } from 'ol/proj';
import type { Extent } from 'ol/extent';
import { Button } from '@/components/ui/button'; // For minimized icons
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // For tooltips on minimized icons


import MapView, { BASE_LAYER_DEFINITIONS } from '@/components/map-view';
import FeatureAttributesPanel from '@/components/panels/FeatureAttributesPanel';
import LayersPanel from '@/components/panels/LayersPanel';
import ToolsPanel from '@/components/panels/ToolsPanel';
import WfsLoadingIndicator from '@/components/feedback/WfsLoadingIndicator';

import { useOpenLayersMap } from '@/hooks/map-core/useOpenLayersMap';
import { useLayerManager } from '@/hooks/layer-manager/useLayerManager';
import { useFeatureInspection } from '@/hooks/feature-inspection/useFeatureInspection';
import { useDrawingInteractions } from '@/hooks/drawing-tools/useDrawingInteractions';
import { useOSMData } from '@/hooks/osm-integration/useOSMData';
import { useGeoServerLayers } from '@/hooks/geoserver-connection/useGeoServerLayers';
import { useFloatingPanels } from '@/hooks/panels/useFloatingPanels';
import { useMapCapture } from '@/hooks/map-tools/useMapCapture';
import { useToast } from "@/hooks/use-toast";

import type { OSMCategoryConfig, GeoServerDiscoveredLayer, BaseLayerOptionForSelect } from '@/lib/types';

const osmCategoryConfig: OSMCategoryConfig[] = [
  {
    id: 'watercourses', name: 'OSM Cursos de Agua',
    overpassQueryFragment: (bboxStr) => `nwr[waterway~"^(river|stream|canal)$"](${bboxStr});`,
    matcher: (tags) => tags && (tags.waterway === 'river' || tags.waterway === 'stream' || tags.waterway === 'canal'),
    style: new Style({ stroke: new Stroke({ color: '#3a86ff', width: 2 }) })
  },
  {
    id: 'water_bodies', name: 'OSM Cuerpos de Agua',
    overpassQueryFragment: (bboxStr) => `nwr[natural="water"](${bboxStr});\nnwr[landuse="reservoir"](${bboxStr});`,
    matcher: (tags) => tags && (tags.natural === 'water' || tags.landuse === 'reservoir'),
    style: new Style({ fill: new Fill({ color: 'rgba(58,134,255,0.4)' }), stroke: new Stroke({ color: '#3a86ff', width: 1 }) })
  },
  {
    id: 'roads_paths', name: 'OSM Rutas y Caminos',
    overpassQueryFragment: (bboxStr) => `nwr[highway](${bboxStr});`,
    matcher: (tags) => tags && !!tags.highway,
    style: new Style({ stroke: new Stroke({ color: '#adb5bd', width: 3 }) })
  },
  {
    id: 'admin_boundaries', name: 'OSM Límites Admin.',
    overpassQueryFragment: (bboxStr) => `nwr[boundary="administrative"][admin_level](${bboxStr});`,
    matcher: (tags) => tags && tags.boundary === 'administrative' && tags.admin_level,
    style: new Style({ stroke: new Stroke({ color: '#ff006e', width: 2, lineDash: [4, 8] }) })
  },
  {
    id: 'green_areas', name: 'OSM Áreas Verdes',
    overpassQueryFragment: (bboxStr) => `nwr[leisure="park"](${bboxStr});\nnwr[landuse="forest"](${bboxStr});\nnwr[natural="wood"](${bboxStr});`,
    matcher: (tags) => tags && (tags.leisure === 'park' || tags.landuse === 'forest' || tags.natural === 'wood'),
    style: new Style({ fill: new Fill({ color: 'rgba(13,166,75,0.4)' }), stroke: new Stroke({ color: '#0da64b', width: 1 }) })
  },
  {
    id: 'health_centers', name: 'OSM Centros de Salud',
    overpassQueryFragment: (bboxStr) => `nwr[amenity~"^(hospital|clinic|doctors|pharmacy)$"](${bboxStr});`,
    matcher: (tags) => tags && ['hospital', 'clinic', 'doctors', 'pharmacy'].includes(tags.amenity),
    style: new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({color: '#d90429'}), stroke: new Stroke({color: 'white', width: 1.5})})})
  },
  {
    id: 'educational', name: 'OSM Educacionales',
    overpassQueryFragment: (bboxStr) => `nwr[amenity~"^(school|university|college|kindergarten)$"](${bboxStr});`,
    matcher: (tags) => tags && ['school', 'university', 'college', 'kindergarten'].includes(tags.amenity),
    style: new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({color: '#8338ec'}), stroke: new Stroke({color: 'white', width: 1.5})})})
  },
   {
    id: 'social_institutions', name: 'OSM Instituciones Sociales',
    overpassQueryFragment: (bboxStr) => `nwr[amenity~"^(community_centre|social_facility|place_of_worship)$"](${bboxStr}); nwr[office="ngo"](${bboxStr}); nwr[leisure="club"](${bboxStr});`,
    matcher: (tags) => tags && (tags.amenity === 'community_centre' || tags.amenity === 'social_facility' || tags.amenity === 'place_of_worship' || tags.office === 'ngo' || tags.leisure === 'club'),
    style: new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({color: '#ff6b6b'}), stroke: new Stroke({color: 'white', width: 1.5})})})
  },
  {
    id: 'cultural_heritage', name: 'OSM Patrimonio Cultural',
    overpassQueryFragment: (bboxStr) => `nwr[historic](${bboxStr}); nwr[tourism="museum"](${bboxStr}); nwr[tourism="artwork"](${bboxStr}); nwr[amenity="place_of_worship"][historic](${bboxStr}); nwr[amenity="place_of_worship"][heritage](${bboxStr});`,
    matcher: (tags) => tags && (tags.historic || tags.tourism === 'museum' || tags.tourism === 'artwork' || (tags.amenity === 'place_of_worship' && (tags.historic || tags.heritage))),
    style: new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({color: '#8d6e63'}), stroke: new Stroke({color: 'white', width: 1.5})})})
  },
];
const osmCategoriesForSelection = osmCategoryConfig.map(({ id, name }) => ({ id, name }));
const availableBaseLayersForSelect: BaseLayerOptionForSelect[] = BASE_LAYER_DEFINITIONS.map(def => ({ id: def.id, name: def.name }));

const PANEL_WIDTH = 350;
const PANEL_PADDING = 8; 
const ESTIMATED_COLLAPSED_HEADER_HEIGHT = 32; 


export default function GeoMapperClient() {
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const layersPanelRef = useRef<HTMLDivElement>(null);
  const toolsPanelRef = useRef<HTMLDivElement>(null);
  const featureAttributesPanelRef = useRef<HTMLDivElement>(null);

  const { mapRef, mapElementRef, drawingSourceRef, drawingLayerRef, setMapInstanceAndElement, isMapReady } = useOpenLayersMap();
  const { toast } = useToast();

  const [activeBaseLayerId, setActiveBaseLayerId] = useState<string>(BASE_LAYER_DEFINITIONS[0].id);
  const handleChangeBaseLayer = useCallback((newBaseLayerId: string) => {
    setActiveBaseLayerId(newBaseLayerId);
  }, []);

  const featureInspectionHook = useFeatureInspection({
    mapRef, mapElementRef, isMapReady, drawingSourceRef, drawingLayerRef,
    activeDrawTool: null, 
    stopDrawingTool: () => {}, 
  });

  const [geoServerDiscoveredLayers, setGeoServerDiscoveredLayers] = useState<GeoServerDiscoveredLayer[]>([]);
  const [isWfsLoading, setIsWfsLoading] = useState(false); 

  const {
    layers, addLayer, removeLayer, toggleLayerVisibility, zoomToLayerExtent, handleShowLayerTable,
    handleExtractFeaturesByPolygon, isDrawingSourceEmptyOrNotPolygon,
  } = useLayerManager({ 
    mapRef, 
    isMapReady, 
    drawingLayerRef, 
    drawingSourceRef,
    onShowTableRequest: featureInspectionHook.processAndDisplayFeatures,
    updateGeoServerDiscoveredLayerState: (layerName, added, type) => {
        setGeoServerDiscoveredLayers(prev => prev.map(l => {
            if (l.name === layerName) {
                if (type === 'wms') return { ...l, wmsAddedToMap: added };
                if (type === 'wfs') return { ...l, wfsAddedToMap: added };
            }
            return l;
        }));
    }
  });
  
  const drawingInteractions = useDrawingInteractions({
    mapRef, isMapReady, drawingSourceRef,
    isInspectModeActive: featureInspectionHook.isInspectModeActive,
    toggleInspectMode: featureInspectionHook.toggleInspectMode,
  });


  const {
    isFetchingOSM, selectedOSMCategoryIds, setSelectedOSMCategoryIds, fetchOSMData,
    downloadFormat, setDownloadFormat, isDownloading, handleDownloadOSMLayers,
  } = useOSMData({ drawingSourceRef, addLayer, osmCategoryConfigs: osmCategoryConfig });

  const {
    geoServerUrlInput, setGeoServerUrlInput, isLoadingGeoServerLayers,
    handleFetchGeoServerLayers, handleAddGeoServerLayerToMap, handleAddGeoServerLayerAsWFS
  } = useGeoServerLayers({ 
      mapRef, 
      isMapReady, 
      addLayer,
      onLayerStateUpdate: (layerName, added, type) => { 
        setGeoServerDiscoveredLayers(prev => prev.map(l => {
            if (l.name === layerName) {
                if (type === 'wms') return { ...l, wmsAddedToMap: added };
                if (type === 'wfs') return { ...l, wfsAddedToMap: added };
            }
            return l;
        }));
      },
      setIsWfsLoading 
  });

  const { panels, handlePanelMouseDown, togglePanelCollapse, togglePanelMinimize } = useFloatingPanels({
    layersPanelRef, toolsPanelRef, 
    mapAreaRef, 
    panelWidth: PANEL_WIDTH, 
    panelPadding: PANEL_PADDING,
    estimatedCollapsedHeaderHeight: ESTIMATED_COLLAPSED_HEADER_HEIGHT,
  });

  const { captureMap, isCapturing: isMapCapturing } = useMapCapture({ mapRef });

  const [attrPanelPosition, setAttrPanelPosition] = useState({ x: 50, y: 50 });
  const handleAttrPanelMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const panel = featureAttributesPanelRef.current;
      if (!panel) return;
      const targetElement = e.target as HTMLElement;
      if (targetElement.closest('button') || targetElement.closest('input') || targetElement.closest('[role="combobox"]')) {
          return;
      }
      const startX = e.clientX - panel.offsetLeft;
      const startY = e.clientY - panel.offsetTop;
      const handleMouseMove = (moveEvent: MouseEvent) => {
          setAttrPanelPosition({ x: moveEvent.clientX - startX, y: moveEvent.clientY - startY });
      };
      const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
      };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
  }, []);
  const [isAttrPanelCollapsed, setIsAttrPanelCollapsed] = useState(false);

  const zoomToBoundingBox = useCallback((bbox: [number, number, number, number]) => {
    if (!mapRef.current) return;
    const extent4326: Extent = [bbox[0], bbox[1], bbox[2], bbox[3]];
    try {
        const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');

        if (extent3857 && extent3857.every(isFinite) && (extent3857[2] - extent3857[0] > 0.000001) && (extent3857[3] - extent3857[1] > 0.000001)) {
            mapRef.current.getView().fit(extent3857, {
            padding: [50, 50, 50, 50],
            duration: 1000,
            maxZoom: 17,
            });
            setTimeout(() => {
              toast({ description: "Ubicación encontrada y centrada en el mapa." });
            }, 0);
        } else {
            setTimeout(() => {
              toast({ description: "No se pudo determinar una extensión válida para la ubicación." });
            }, 0);
        }
    } catch (error) {
        console.error("Error transforming extent or fitting view:", error);
        setTimeout(() => {
          toast({ description: "Error al procesar la ubicación seleccionada." });
        }, 0);
    }
  }, [mapRef, toast]);

  useEffect(() => {
    featureInspectionHook.updateLayers(layers);
  }, [layers, featureInspectionHook]);

   useEffect(() => {
    featureInspectionHook.activeDrawTool = drawingInteractions.activeDrawTool;
    featureInspectionHook.stopDrawingTool = drawingInteractions.stopDrawingTool;
  }, [drawingInteractions.activeDrawTool, drawingInteractions.stopDrawingTool, featureInspectionHook ]);


  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <header className="bg-gray-800/60 backdrop-blur-md text-white p-2 shadow-md flex items-center">
        <MapPin className="mr-2 h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">Departamento de Estudios Ambientales y Sociales</h1>
      </header>
      <div ref={mapAreaRef} className="relative flex-1 overflow-hidden">
        <MapView
          setMapInstanceAndElement={setMapInstanceAndElement}
          activeBaseLayerId={activeBaseLayerId}
        />

        <WfsLoadingIndicator isVisible={isWfsLoading} />

        <FeatureAttributesPanel
          featuresAttributes={featureInspectionHook.selectedFeatureAttributes}
          isVisible={featureInspectionHook.isFeatureAttributesPanelVisible}
          layerName={featureInspectionHook.currentInspectedLayerName}
          onClose={featureInspectionHook.closeFeatureAttributesPanel}
          panelRef={featureAttributesPanelRef}
          initialPosition={attrPanelPosition}
          onMouseDownHeader={handleAttrPanelMouseDown}
          isPanelCollapsed={isAttrPanelCollapsed}
          onTogglePanelCollapse={() => setIsAttrPanelCollapsed(!isAttrPanelCollapsed)}
        />
        
        {/* Minimized Panel Icons Area */}
        <div className="absolute top-2 right-2 z-20 flex flex-col space-y-1">
          <TooltipProvider delayDuration={200}>
            {Object.entries(panels).map(([panelId, panelState]) => {
              if (panelState.isMinimized) {
                let IconComponent;
                let tooltipText = "";
                if (panelId === 'layers') { IconComponent = Database; tooltipText = "Restaurar Panel de Datos"; }
                else if (panelId === 'tools') { IconComponent = Wrench; tooltipText = "Restaurar Panel de Herramientas"; }
                else { return null; }

                return (
                  <Tooltip key={panelId}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-gray-700/80 text-white hover:bg-gray-600/90 border-gray-600/70"
                        onClick={() => togglePanelMinimize(panelId)}
                      >
                        <IconComponent className="h-4 w-4" />
                        <span className="sr-only">{tooltipText}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="bg-gray-700 text-white border-gray-600">
                      <p>{tooltipText}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return null;
            })}
          </TooltipProvider>
        </div>

        {!panels.layers.isMinimized && (
          <LayersPanel
            panelRef={layersPanelRef}
            position={panels.layers.position}
            isCollapsed={panels.layers.isCollapsed}
            onToggleCollapse={() => togglePanelCollapse('layers')}
            onClosePanel={() => togglePanelMinimize('layers')}
            onMouseDownHeader={(e) => handlePanelMouseDown(e, 'layers')}
            layers={layers}
            onAddLayer={addLayer}
            onToggleLayerVisibility={toggleLayerVisibility}
            onRemoveLayer={removeLayer}
            onZoomToLayerExtent={zoomToLayerExtent}
            onShowLayerTable={handleShowLayerTable}
            onExtractByPolygon={handleExtractFeaturesByPolygon}
            isDrawingSourceEmptyOrNotPolygon={isDrawingSourceEmptyOrNotPolygon}
            availableBaseLayers={availableBaseLayersForSelect}
            activeBaseLayerId={activeBaseLayerId}
            onChangeBaseLayer={handleChangeBaseLayer}
            isInspectModeActive={featureInspectionHook.isInspectModeActive}
            onToggleInspectMode={featureInspectionHook.toggleInspectMode}
            onZoomToBoundingBox={zoomToBoundingBox}
            captureMap={captureMap}
            isCapturingMap={isMapCapturing}
            geoServerUrlInput={geoServerUrlInput}
            onGeoServerUrlChange={setGeoServerUrlInput}
            onFetchGeoServerLayers={handleFetchGeoServerLayers}
            geoServerDiscoveredLayers={geoServerDiscoveredLayers}
            setGeoServerDiscoveredLayers={setGeoServerDiscoveredLayers}
            isLoadingGeoServerLayers={isLoadingGeoServerLayers}
            onAddGeoServerLayerToMap={handleAddGeoServerLayerToMap}
            onAddGeoServerLayerAsWFS={handleAddGeoServerLayerAsWFS}
          />
        )}

        {!panels.tools.isMinimized && (
          <ToolsPanel
            panelRef={toolsPanelRef}
            position={panels.tools.position}
            isCollapsed={panels.tools.isCollapsed}
            onToggleCollapse={() => togglePanelCollapse('tools')}
            onClosePanel={() => togglePanelMinimize('tools')}
            onMouseDownHeader={(e) => handlePanelMouseDown(e, 'tools')}
            activeDrawTool={drawingInteractions.activeDrawTool}
            onToggleDrawingTool={drawingInteractions.toggleDrawingTool}
            onClearDrawnFeatures={drawingInteractions.clearDrawnFeatures}
            onSaveDrawnFeaturesAsKML={drawingInteractions.saveDrawnFeaturesAsKML}
            isFetchingOSM={isFetchingOSM}
            onFetchOSMDataTrigger={fetchOSMData}
            osmCategoriesForSelection={osmCategoriesForSelection}
            selectedOSMCategoryIds={selectedOSMCategoryIds}
            onSelectedOSMCategoriesChange={setSelectedOSMCategoryIds}
            downloadFormat={downloadFormat}
            onDownloadFormatChange={setDownloadFormat}
            isDownloading={isDownloading}
            onDownloadOSMLayers={() => handleDownloadOSMLayers(layers)}
          />
        )}
      </div>
    </div>
  );
}
