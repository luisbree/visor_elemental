
"use client";

import { useState, useCallback, useEffect } from 'react';
import type { Map as OLMap, Feature as OLFeature } from 'ol';
// Changed: Removed 'type' keyword for VectorLayer, TileLayer, TileWMS to make them available for instanceof
import VectorLayer from 'ol/layer/Vector';
import type VectorSourceType from 'ol/source/Vector';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import type { Extent } from 'ol/extent';
import { toast } from "@/hooks/use-toast";
import type { MapLayer } from '@/lib/types';

interface UseLayerManagerProps {
  mapRef: React.RefObject<OLMap | null>;
  isMapReady: boolean;
  drawingLayerRef: React.RefObject<VectorLayer<VectorSourceType<OLFeature<any>>> | null>;
  onShowTableRequest: (features: OLFeature<any>[], layerName?: string) => void;
  updateGeoServerDiscoveredLayerState?: (layerName: string, added: boolean) => void;
}

export function useLayerManager({ mapRef, isMapReady, drawingLayerRef, onShowTableRequest, updateGeoServerDiscoveredLayerState }: UseLayerManagerProps) {
  const [layers, setLayers] = useState<MapLayer[]>([]);

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
            if (mapRef.current && layer.olLayer) {
                mapRef.current.removeLayer(layer.olLayer);
            }
            if (layer.isGeoServerLayer && updateGeoServerDiscoveredLayerState) {
                // Assuming layer.name here is the original GeoServer layer name
                const originalLayerName = layer.olLayer.getSource()?.getParams().LAYERS || layer.name;
                updateGeoServerDiscoveredLayerState(originalLayerName, false);
            }
            toast(`Capa "${layer.name}" eliminada del mapa.`);
            return false;
        }
        return true;
    }));
  }, [mapRef, updateGeoServerDiscoveredLayerState]);

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

  const zoomToLayerExtent = useCallback((layerId: string) => {
    if (!mapRef.current) return;
    const layer = layers.find(l => l.id === layerId);
    if (layer && layer.olLayer) {
      // Changed: Use VectorLayer class directly
      if (layer.olLayer instanceof VectorLayer) {
        const source = layer.olLayer.getSource();
        if (source && source.getFeatures().length > 0) {
          const extent: Extent = source.getExtent();
          if (extent && extent.every(isFinite) && (extent[2] - extent[0] > 0.000001 || extent[2] === extent[0]) && (extent[3] - extent[1] > 0.000001 || extent[3] === extent[1])) {
            mapRef.current.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000, maxZoom: 18 });
            toast(`Mostrando extensión de ${layer.name}.`);
          } else {
            toast(`Capa "${layer.name}" podría estar vacía o tener una extensión inválida.`);
          }
        } else {
          toast(`Capa "${layer.name}" no contiene entidades.`);
        }
      // Changed: Use TileLayer and TileWMS classes directly
      } else if (layer.olLayer instanceof TileLayer && layer.olLayer.getSource() instanceof TileWMS) {
        toast(`Zoom a extensión no implementado para capa WMS "${layer.name}".`);
      } else {
         toast(`Capa "${layer.name}" no es una capa vectorial con entidades para hacer zoom.`);
      }
    }
  }, [layers, mapRef]);

  const handleShowLayerTable = useCallback((layerId: string) => {
    const layerToShow = layers.find(l => l.id === layerId);
    if (!layerToShow || !layerToShow.olLayer) {
      toast("Error: Capa no encontrada o inválida.");
      return;
    }
    // Changed: Use VectorLayer class directly
    if (layerToShow.olLayer instanceof VectorLayer) {
        const source = layerToShow.olLayer.getSource();
        if (!source) {
          toast(`La capa "${layerToShow.name}" no tiene fuente de datos.`);
          return;
        }
        const features = source.getFeatures();
        if (features.length === 0) {
          toast(`La capa "${layerToShow.name}" no contiene entidades.`);
          return;
        }
        onShowTableRequest(features, layerToShow.name);
    } else {
        toast(`La capa "${layerToShow.name}" no es una capa vectorial. La visualización de tabla solo está disponible para capas vectoriales.`);
    }
  }, [layers, onShowTableRequest]);

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

    layers.forEach((appLayer, index) => {
      if (!currentMap.getLayers().getArray().includes(appLayer.olLayer)) {
        currentMap.addLayer(appLayer.olLayer);
      }
      appLayer.olLayer.setVisible(appLayer.visible);
      appLayer.olLayer.setZIndex(index); 
    });

  }, [layers, isMapReady, mapRef, drawingLayerRef]);


  return {
    layers,
    setLayers,
    addLayer,
    removeLayer,
    toggleLayerVisibility,
    zoomToLayerExtent,
    handleShowLayerTable,
  };
}
