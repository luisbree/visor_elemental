
"use client";

import { useState, useCallback, useEffect } from 'react';
import type { Map as OLMap, Feature as OLFeature } from 'ol';
import type VectorLayerType from 'ol/layer/Vector';
import type VectorSourceType from 'ol/source/Vector';
import type TileLayer from 'ol/layer/Tile';
import type TileWMS from 'ol/source/TileWMS';
import type { Extent } from 'ol/extent';
import { toast } from "@/hooks/use-toast";
import type { MapLayer } from '@/lib/types';

interface UseLayerManagerProps {
  mapRef: React.RefObject<OLMap | null>;
  isMapReady: boolean;
  drawingLayerRef: React.RefObject<VectorLayerType<VectorSourceType<OLFeature<any>>> | null>;
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
                updateGeoServerDiscoveredLayerState(layer.name, false);
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
      if (layer.olLayer instanceof VectorLayerType) {
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
  }, [layers, mapRef]);

  const handleShowLayerTable = useCallback((layerId: string) => {
    const layerToShow = layers.find(l => l.id === layerId);
    if (!layerToShow || !layerToShow.olLayer) {
      toast("Error: Capa no encontrada o inválida.");
      return;
    }

    if (layerToShow.olLayer instanceof VectorLayerType) {
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

    // Sync OpenLayers map with the 'layers' state
    const olMapVectorAndTileLayers = currentMap.getLayers().getArray()
      .filter(l => !l.get('isBaseLayer') && l !== drawingLayerRef.current) as (VectorLayerType<VectorSourceType<OLFeature<any>>> | TileLayer<TileWMS>)[];

    // Remove layers from map that are not in our state anymore
    olMapVectorAndTileLayers.forEach(olMapLayer => {
        const appLayerExists = layers.some(appLyr => appLyr.olLayer === olMapLayer);
        if (!appLayerExists) {
            currentMap.removeLayer(olMapLayer);
        }
    });

    // Add/update layers in map based on our state
    layers.forEach((appLayer, index) => {
      if (!currentMap.getLayers().getArray().includes(appLayer.olLayer)) {
        currentMap.addLayer(appLayer.olLayer);
      }
      appLayer.olLayer.setVisible(appLayer.visible);
      // Ensure drawing layer is on top of these other vector/tile layers.
      // Base layers usually have zIndex < 0 or undefined.
      // Vector layers for data can be 0-999. Drawing layer is 1000.
      appLayer.olLayer.setZIndex(index); // Simple stacking order
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
