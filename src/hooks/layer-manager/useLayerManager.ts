
"use client";

import { useState, useCallback, useEffect } from 'react';
import type { Map as OLMap, Feature as OLFeature, geom } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import type VectorSourceType from 'ol/source/Vector';
import VectorSource from 'ol/source/Vector';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import type { Extent } from 'ol/extent';
import { Style, Fill, Stroke } from 'ol/style';
import { fromExtent as polygonFromExtent } from 'ol/geom/Polygon';
import { toast } from "@/hooks/use-toast";
import type { MapLayer } from '@/lib/types';

const SENTINEL_FOOTPRINTS_LAYER_ID = "sentinel-footprints-layer";
const SENTINEL_FOOTPRINTS_LAYER_NAME = "Footprints Sentinel-2 (Sim.)";

interface UseLayerManagerProps {
  mapRef: React.RefObject<OLMap | null>;
  isMapReady: boolean;
  drawingLayerRef: React.RefObject<VectorLayer<VectorSourceType<OLFeature<any>>> | null>;
  drawingSourceRef: React.RefObject<VectorSourceType<OLFeature<any>> | null>;
  onShowTableRequest: (features: OLFeature<any>[], layerName?: string) => void;
  updateGeoServerDiscoveredLayerState?: (layerName: string, added: boolean, type: 'wms' | 'wfs') => void;
}

export function useLayerManager({ 
  mapRef, 
  isMapReady, 
  drawingLayerRef, 
  drawingSourceRef,
  onShowTableRequest, 
  updateGeoServerDiscoveredLayerState 
}: UseLayerManagerProps) {
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [isDrawingSourceEmptyOrNotPolygon, setIsDrawingSourceEmptyOrNotPolygon] = useState(true);
  const [isFindingSentinelFootprints, setIsFindingSentinelFootprints] = useState(false);


  useEffect(() => {
    if (drawingSourceRef?.current) {
      const checkDrawingSource = () => {
        const features = drawingSourceRef.current?.getFeatures() || [];
        if (features.length === 0) {
          setIsDrawingSourceEmptyOrNotPolygon(true);
          return;
        }
        const lastFeature = features[features.length - 1];
        const geometry = lastFeature.getGeometry();
        setIsDrawingSourceEmptyOrNotPolygon(!geometry || geometry.getType() !== 'Polygon');
      };

      checkDrawingSource(); 
      drawingSourceRef.current.on('addfeature', checkDrawingSource);
      drawingSourceRef.current.on('removefeature', checkDrawingSource);
      drawingSourceRef.current.on('clear', checkDrawingSource);

      return () => {
        if (drawingSourceRef.current) {
          drawingSourceRef.current.un('addfeature', checkDrawingSource);
          drawingSourceRef.current.un('removefeature', checkDrawingSource);
          drawingSourceRef.current.un('clear', checkDrawingSource);
        }
      };
    }
  }, [drawingSourceRef]);


  const addLayer = useCallback((newLayerData: Omit<MapLayer, 'opacity'> & { opacity?: number }) => {
    let alreadyExists = false;
    const layerWithOpacity: MapLayer = {
      ...newLayerData,
      opacity: newLayerData.opacity ?? 1, 
    };

    setLayers(prevLayers => {
      if (prevLayers.some(l => l.id === layerWithOpacity.id)) {
        alreadyExists = true;
        return prevLayers;
      }
      const maxZIndex = prevLayers.reduce((max, l) => Math.max(max, l.olLayer.getZIndex() || 0), 0);
      layerWithOpacity.olLayer.setZIndex(maxZIndex + 1);
      layerWithOpacity.olLayer.setOpacity(layerWithOpacity.opacity); 
      return [...prevLayers, layerWithOpacity];
    });

    if (alreadyExists) {
      setTimeout(() => {
        toast({ description: `La capa "${layerWithOpacity.name}" ya está en el mapa.` });
      }, 0);
    }
  }, [toast]);

  const removeLayer = useCallback((layerId: string) => {
    let layerNameForToast: string | undefined;
    let layerToRemove: MapLayer | undefined;

    setLayers(prevLayers =>
      prevLayers.filter(layer => {
        if (layer.id === layerId) {
          layerToRemove = layer;
          layerNameForToast = layer.name;
          if (mapRef.current && layer.olLayer) {
            mapRef.current.removeLayer(layer.olLayer);
          }
          return false;
        }
        return true;
      })
    );
    
    if (layerToRemove && layerToRemove.isGeoServerLayer && layerToRemove.originType && updateGeoServerDiscoveredLayerState) {
        let originalLayerName = layerToRemove.name.replace(/\s\((WMS|WFS)\)$/, ''); 
        if (layerToRemove.originType === 'wms' && layerToRemove.olLayer.getSource() instanceof TileWMS) {
             originalLayerName = (layerToRemove.olLayer.getSource() as TileWMS).getParams().LAYERS;
        } else if (layerToRemove.originType === 'wfs' && layerToRemove.olLayer.get('originalGeoServerName')) {
            originalLayerName = layerToRemove.olLayer.get('originalGeoServerName');
        }
        if (originalLayerName.includes(' (WMS)') || originalLayerName.includes(' (WFS)')) {
            originalLayerName = originalLayerName.substring(0, originalLayerName.lastIndexOf(' ('));
        }
        updateGeoServerDiscoveredLayerState(originalLayerName, false, layerToRemove.originType as ('wms' | 'wfs'));
    }

    if (layerNameForToast) {
      setTimeout(() => {
        toast({ description: `Capa "${layerNameForToast}" eliminada del mapa.` });
      }, 0);
    }
  }, [mapRef, updateGeoServerDiscoveredLayerState, toast]);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers(prevLayers =>
      prevLayers.map(layer => {
        if (layer.id === layerId) {
          const newVisibility = !layer.visible;
          if (layer.olLayer) {
            layer.olLayer.setVisible(newVisibility);
          }
          return { ...layer, visible: newVisibility };
        }
        return layer;
      })
    );
  }, []);

  const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayers(prevLayers =>
      prevLayers.map(layer => {
        if (layer.id === layerId) {
          if (layer.olLayer) {
            layer.olLayer.setOpacity(opacity);
          }
          return { ...layer, opacity };
        }
        return layer;
      })
    );
  }, []);


  const zoomToLayerExtent = useCallback((layerId: string) => {
    if (!mapRef.current) return;
    const layer = layers.find(l => l.id === layerId);
    if (layer && layer.olLayer) {
      if (layer.olLayer instanceof VectorLayer) {
        const source = layer.olLayer.getSource();
        if (source && source.getFeatures().length > 0) {
          const extent: Extent = source.getExtent();
          if (extent && extent.every(isFinite) && (extent[2] - extent[0] > 0.000001 || extent[2] === extent[0]) && (extent[3] - extent[1] > 0.000001 || extent[3] === extent[1])) {
            mapRef.current.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000, maxZoom: 18 });
            setTimeout(() => {
              toast({ description: `Mostrando extensión de ${layer.name}.` });
            }, 0);
          } else {
            setTimeout(() => {
              toast({ description: `Capa "${layer.name}" podría estar vacía o tener una extensión inválida.` });
            }, 0);
          }
        } else {
          setTimeout(() => {
            toast({ description: `Capa "${layer.name}" no contiene entidades.` });
          }, 0);
        }
      } else if (layer.olLayer instanceof TileLayer && layer.olLayer.getSource() instanceof TileWMS) {
        setTimeout(() => {
          toast({ description: `Zoom a extensión no implementado para capa WMS "${layer.name}".` });
        }, 0);
      } else {
         setTimeout(() => {
           toast({ description: `Capa "${layer.name}" no es una capa vectorial con entidades para hacer zoom.` });
         }, 0);
      }
    }
  }, [layers, mapRef, toast]);

  const handleShowLayerTable = useCallback((layerId: string) => {
    const layerToShow = layers.find(l => l.id === layerId);
    if (!layerToShow || !layerToShow.olLayer) {
      setTimeout(() => {
        toast({ description: "Error: Capa no encontrada o inválida." });
      }, 0);
      return;
    }
    if (layerToShow.olLayer instanceof VectorLayer) {
        const source = layerToShow.olLayer.getSource();
        if (!source) {
          setTimeout(() => {
            toast({ description: `La capa "${layerToShow.name}" no tiene fuente de datos.` });
          }, 0);
          return;
        }
        const features = source.getFeatures();
        if (features.length === 0) {
          setTimeout(() => {
            toast({ description: `La capa "${layerToShow.name}" no contiene entidades.` });
          }, 0);
          return;
        }
        onShowTableRequest(features, layerToShow.name);
    } else {
      setTimeout(() => {
        toast({ description: `La capa "${layerToShow.name}" no es una capa vectorial. La visualización de tabla solo está disponible para capas vectoriales.` });
      }, 0);
    }
  }, [layers, onShowTableRequest, toast]);

  const handleExtractFeaturesByPolygon = useCallback((targetLayerId: string) => {
    if (!mapRef.current || !drawingSourceRef?.current) {
      setTimeout(() => toast({ description: "Mapa o capa de dibujo no disponibles." }), 0);
      return;
    }

    const targetMapLayer = layers.find(l => l.id === targetLayerId);
    if (!targetMapLayer || !(targetMapLayer.olLayer instanceof VectorLayer)) {
      setTimeout(() => toast({ description: "La capa objetivo no es una capa vectorial válida." }), 0);
      return;
    }

    const targetSource = targetMapLayer.olLayer.getSource();
    if (!targetSource) {
      setTimeout(() => toast({ description: "La capa objetivo no tiene fuente de datos." }), 0);
      return;
    }

    const drawnFeatures = drawingSourceRef.current.getFeatures();
    if (drawnFeatures.length === 0) {
      setTimeout(() => toast({ description: "No hay polígonos dibujados para la extracción." }), 0);
      return;
    }

    const lastDrawnFeature = drawnFeatures[drawnFeatures.length - 1];
    const selectionPolygonGeom = lastDrawnFeature.getGeometry();

    if (!selectionPolygonGeom || selectionPolygonGeom.getType() !== 'Polygon') {
      setTimeout(() => toast({ description: "La última entidad dibujada no es un polígono." }), 0);
      return;
    }

    const selectionExtent = selectionPolygonGeom.getExtent();
    const extractedFeatures: OLFeature<any>[] = [];

    targetSource.forEachFeatureIntersectingExtent(selectionExtent, (feature) => {
      const targetGeom = feature.getGeometry();
      if (targetGeom) {
        if (targetGeom.getType() === 'Point') {
          if ((selectionPolygonGeom as geom.Polygon).intersectsCoordinate(targetGeom.getCoordinates() as any)) { // Cast to any to satisfy OL type
            extractedFeatures.push(feature.clone());
          }
        } else { 
           extractedFeatures.push(feature.clone());
        }
      }
    });

    if (extractedFeatures.length > 0) {
      const newSource = new VectorSource({ features: extractedFeatures });
      const newLayer = new VectorLayer({
        source: newSource,
        style: targetMapLayer.olLayer.getStyle(), 
        opacity: targetMapLayer.opacity, 
      });
      const newLayerId = `extraction-${targetMapLayer.id}-${Date.now()}`;
      const newLayerName = `Extracción de ${targetMapLayer.name.substring(0,25)}${targetMapLayer.name.length > 25 ? "..." : ""}`;
      
      addLayer({
        id: newLayerId,
        name: newLayerName,
        olLayer: newLayer,
        visible: true,
        originType: 'file', 
        opacity: targetMapLayer.opacity,
      });
      setTimeout(() => toast({ description: `${extractedFeatures.length} entidades extraídas a la capa "${newLayerName}".` }), 0);
    } else {
      setTimeout(() => toast({ description: "No se encontraron entidades dentro del polígono dibujado." }), 0);
    }
  }, [layers, drawingSourceRef, addLayer, mapRef, toast]);

  const findSentinel2FootprintsInCurrentView = useCallback(async () => {
    if (!mapRef.current || !isMapReady) {
      toast({ description: "El mapa no está listo para buscar escenas.", variant: "destructive" });
      return;
    }
    setIsFindingSentinelFootprints(true);
    toast({ description: "Simulando búsqueda de footprints Sentinel-2..." });

    // Remove existing footprints layer first
    const existingFootprintsLayer = layers.find(l => l.id === SENTINEL_FOOTPRINTS_LAYER_ID);
    if (existingFootprintsLayer) {
      removeLayer(SENTINEL_FOOTPRINTS_LAYER_ID);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call delay

    try {
      const view = mapRef.current.getView();
      const extent = view.calculateExtent(mapRef.current.getSize());
      const simulatedFootprints: OLFeature[] = [];
      const numFootprints = Math.floor(Math.random() * 3) + 3; // 3 to 5 footprints

      const extentWidth = extent[2] - extent[0];
      const extentHeight = extent[3] - extent[1];

      for (let i = 0; i < numFootprints; i++) {
        // Make footprints slightly smaller than full view and somewhat overlapping
        const fpWidth = extentWidth * (Math.random() * 0.2 + 0.4); // 40-60% of view width
        const fpHeight = extentHeight * (Math.random() * 0.2 + 0.4); // 40-60% of view height

        const fpX = extent[0] + Math.random() * (extentWidth - fpWidth);
        const fpY = extent[1] + Math.random() * (extentHeight - fpHeight);
        
        const footprintExtent: Extent = [fpX, fpY, fpX + fpWidth, fpY + fpHeight];
        const footprintGeom = polygonFromExtent(footprintExtent);
        const footprintFeature = new OLFeature({
          geometry: footprintGeom,
          name: `Sentinel-2 Escena Simulada ${i + 1}`,
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Random date in last 30 days
          cloud_cover: Math.round(Math.random() * 30), // Random cloud cover 0-30%
        });
        simulatedFootprints.push(footprintFeature);
      }

      if (simulatedFootprints.length > 0) {
        const vectorSource = new VectorSource({ features: simulatedFootprints });
        const vectorLayer = new VectorLayer({
          source: vectorSource,
          style: new Style({
            stroke: new Stroke({ color: 'rgba(255, 0, 255, 0.8)', width: 2 }),
            fill: new Fill({ color: 'rgba(255, 0, 255, 0.1)' }),
          }),
          properties: { 'title': SENTINEL_FOOTPRINTS_LAYER_NAME }
        });
        addLayer({
          id: SENTINEL_FOOTPRINTS_LAYER_ID,
          name: `${SENTINEL_FOOTPRINTS_LAYER_NAME} (${simulatedFootprints.length})`,
          olLayer: vectorLayer,
          visible: true,
          opacity: 0.8,
          originType: 'file', // Treat as a dynamic/generated layer for now
        });
        toast({ description: `${simulatedFootprints.length} footprints Sentinel-2 simulados encontrados.` });
      } else {
        toast({ description: "No se generaron footprints simulados." });
      }
    } catch (error: any) {
      console.error("Error generando footprints Sentinel-2 simulados:", error);
      toast({ description: "Error al simular búsqueda de footprints.", variant: "destructive" });
    } finally {
      setIsFindingSentinelFootprints(false);
    }
  }, [mapRef, isMapReady, addLayer, removeLayer, layers, toast]);

  const clearSentinel2FootprintsLayer = useCallback(() => {
    const existingLayer = layers.find(l => l.id === SENTINEL_FOOTPRINTS_LAYER_ID);
    if (existingLayer) {
      removeLayer(SENTINEL_FOOTPRINTS_LAYER_ID);
      toast({ description: "Footprints Sentinel-2 limpiados." });
    } else {
      toast({ description: "No hay footprints Sentinel-2 para limpiar." });
    }
  }, [layers, removeLayer, toast]);


  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const currentMap = mapRef.current;

    const olMapLayersPresent = currentMap.getLayers().getArray()
      .filter(l => !l.get('isBaseLayer') && l !== drawingLayerRef.current);

    olMapLayersPresent.forEach(olMapLayer => {
        const appLayerExists = layers.some(appLyr => appLyr.olLayer === olMapLayer);
        if (!appLayerExists) {
            currentMap.removeLayer(olMapLayer);
        }
    });

    layers.forEach((appLayer) => {
      if (!currentMap.getLayers().getArray().includes(appLayer.olLayer)) {
        currentMap.addLayer(appLayer.olLayer); 
      }
      appLayer.olLayer.setVisible(appLayer.visible);
      appLayer.olLayer.setOpacity(appLayer.opacity); 
    });

  }, [layers, isMapReady, mapRef, drawingLayerRef]);


  return {
    layers,
    setLayers,
    addLayer,
    removeLayer,
    toggleLayerVisibility,
    setLayerOpacity, 
    zoomToLayerExtent,
    handleShowLayerTable,
    handleExtractFeaturesByPolygon,
    isDrawingSourceEmptyOrNotPolygon,
    findSentinel2FootprintsInCurrentView,
    clearSentinel2FootprintsLayer,
    isFindingSentinelFootprints,
  };
}
