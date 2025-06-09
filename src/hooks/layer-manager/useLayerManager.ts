
"use client";

import { useState, useCallback, useEffect } from 'react';
import type { Map as OLMap, Feature as OLFeature } from 'ol';
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
    let alreadyExists = false;
    setLayers(prevLayers => {
      if (prevLayers.some(l => l.id === newLayer.id)) {
        alreadyExists = true;
        return prevLayers;
      }
      return [...prevLayers, newLayer];
    });

    if (alreadyExists) {
      setTimeout(() => {
        toast(`La capa "${newLayer.name}" ya está en el mapa.`);
      }, 0);
    }
  }, [toast]);

  const removeLayer = useCallback((layerId: string) => {
    let layerNameForToast: string | undefined;

    setLayers(prevLayers =>
      prevLayers.filter(layer => {
        if (layer.id === layerId) {
          layerNameForToast = layer.name;
          if (mapRef.current && layer.olLayer) {
            mapRef.current.removeLayer(layer.olLayer);
          }
          if (layer.isGeoServerLayer && updateGeoServerDiscoveredLayerState) {
            const originalLayerName = layer.olLayer.getSource()?.getParams().LAYERS || layer.name;
            updateGeoServerDiscoveredLayerState(originalLayerName, false);
          }
          return false;
        }
        return true;
      })
    );

    if (layerNameForToast) {
      setTimeout(() => {
        toast(`Capa "${layerNameForToast}" eliminada del mapa.`);
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
              toast(`Mostrando extensión de ${layer.name}.`);
            }, 0);
          } else {
            setTimeout(() => {
              toast(`Capa "${layer.name}" podría estar vacía o tener una extensión inválida.`);
            }, 0);
          }
        } else {
          setTimeout(() => {
            toast(`Capa "${layer.name}" no contiene entidades.`);
          }, 0);
        }
      } else if (layer.olLayer instanceof TileLayer && layer.olLayer.getSource() instanceof TileWMS) {
        setTimeout(() => {
          toast(`Zoom a extensión no implementado para capa WMS "${layer.name}".`);
        }, 0);
      } else {
         setTimeout(() => {
           toast(`Capa "${layer.name}" no es una capa vectorial con entidades para hacer zoom.`);
         }, 0);
      }
    }
  }, [layers, mapRef, toast]);

  const handleShowLayerTable = useCallback((layerId: string) => {
    const layerToShow = layers.find(l => l.id === layerId);
    if (!layerToShow || !layerToShow.olLayer) {
      setTimeout(() => {
        toast("Error: Capa no encontrada o inválida.");
      }, 0);
      return;
    }
    if (layerToShow.olLayer instanceof VectorLayer) {
        const source = layerToShow.olLayer.getSource();
        if (!source) {
          setTimeout(() => {
            toast(`La capa "${layerToShow.name}" no tiene fuente de datos.`);
          }, 0);
          return;
        }
        const features = source.getFeatures();
        if (features.length === 0) {
          setTimeout(() => {
            toast(`La capa "${layerToShow.name}" no contiene entidades.`);
          }, 0);
          return;
        }
        onShowTableRequest(features, layerToShow.name);
    } else {
      setTimeout(() => {
        toast(`La capa "${layerToShow.name}" no es una capa vectorial. La visualización de tabla solo está disponible para capas vectoriales.`);
      }, 0);
    }
  }, [layers, onShowTableRequest, toast]);

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
