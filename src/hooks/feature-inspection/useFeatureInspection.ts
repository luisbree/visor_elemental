
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Map as OLMap, Feature as OLFeature } from 'ol';
import type VectorLayerType from 'ol/layer/Vector';
import type VectorSourceType from 'ol/source/Vector';
import TileLayer from 'ol/layer/Tile';
import DragBox from 'ol/interaction/DragBox';
import DragZoom from 'ol/interaction/DragZoom';
import { platformModifierKeyOnly } from 'ol/events/condition';
import { toast } from "@/hooks/use-toast";
import type { MapLayer } from '@/lib/types';

interface UseFeatureInspectionProps {
  mapRef: React.RefObject<OLMap | null>;
  mapElementRef: React.RefObject<HTMLDivElement | null>;
  isMapReady: boolean;
  layers: MapLayer[]; // From useLayerManager
  drawingSourceRef: React.RefObject<VectorSourceType<OLFeature<any>> | null>;
  activeDrawTool: string | null; // From useDrawingInteractions
  stopDrawingTool: () => void; // From useDrawingInteractions
}

export function useFeatureInspection({
  mapRef,
  mapElementRef,
  isMapReady,
  layers,
  drawingSourceRef,
  activeDrawTool,
  stopDrawingTool,
}: UseFeatureInspectionProps) {
  const [isInspectModeActive, setIsInspectModeActive] = useState(false);
  const [selectedFeatureAttributes, setSelectedFeatureAttributes] = useState<Record<string, any>[] | null>(null);
  const [isFeatureAttributesPanelVisible, setIsFeatureAttributesPanelVisible] = useState(false);
  const [currentInspectedLayerName, setCurrentInspectedLayerName] = useState<string | null>(null);

  const dragBoxInteractionRef = useRef<DragBox | null>(null);
  const defaultDragZoomInteractionRef = useRef<DragZoom | null>(null);
  const wasDragZoomActiveRef = useRef<boolean>(false);

  const processAndDisplayFeatures = useCallback((foundFeatures: OLFeature<any>[], layerName?: string) => {
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
          if (layerName) setCurrentInspectedLayerName(layerName);
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
  }, []);

  const handleMapClick = useCallback((event: any) => {
    if (!isInspectModeActive || !mapRef.current || activeDrawTool) return;

    const clickedPixel = mapRef.current.getEventPixel(event.originalEvent);
    if (dragBoxInteractionRef.current && (event.originalEvent.type === 'pointermove' || event.originalEvent.type === 'mousemove')) {
        return;
    }

    const featuresAtPixel: OLFeature<any>[] = [];
    let clickedLayerName: string | undefined;

    mapRef.current.forEachFeatureAtPixel(clickedPixel, (featureOrLayer, layer) => {
        if (featureOrLayer instanceof OLFeature) {
            featuresAtPixel.push(featureOrLayer);
            if (layer && typeof layer.get === 'function' && layer.get('title')) { // ol/layer/Layer has get method
                clickedLayerName = layer.get('title');
            } else {
                 const appLayer = layers.find(l => l.olLayer === layer);
                 if (appLayer) clickedLayerName = appLayer.name;
            }
        }
        return false; // Continue checking
    }, { hitTolerance: 5, layerFilter: (layer) => !(layer instanceof TileLayer) });

    setCurrentInspectedLayerName(clickedLayerName || null);
    processAndDisplayFeatures(featuresAtPixel, clickedLayerName);

  }, [isInspectModeActive, activeDrawTool, mapRef, processAndDisplayFeatures, layers]);

  const handleDragBoxEnd = useCallback((event: any) => {
    if (!mapRef.current || !isInspectModeActive) return;
    const extent = event.target.getGeometry().getExtent();
    const foundFeatures: OLFeature<any>[] = [];

    layers.forEach(layer => {
      if (layer.visible && layer.olLayer && layer.olLayer instanceof VectorLayerType) {
        const source = layer.olLayer.getSource();
        if (source) {
          source.forEachFeatureIntersectingExtent(extent, (feature) => {
             if (feature instanceof OLFeature) foundFeatures.push(feature);
          });
        }
      }
    });

    if (drawingSourceRef.current) {
      drawingSourceRef.current.forEachFeatureIntersectingExtent(extent, (feature) => {
        if (feature instanceof OLFeature) foundFeatures.push(feature);
      });
    }
    
    // For drag box, it's hard to determine a single layer name if features are from multiple.
    setCurrentInspectedLayerName(null); 
    processAndDisplayFeatures(foundFeatures);
  }, [mapRef, layers, drawingSourceRef, isInspectModeActive, processAndDisplayFeatures]);

  const toggleInspectMode = useCallback(() => {
    const newInspectModeState = !isInspectModeActive;
    setIsInspectModeActive(newInspectModeState);
    if (activeDrawTool && newInspectModeState) {
      stopDrawingTool();
    }
    if (!newInspectModeState) { // When turning off
      setIsFeatureAttributesPanelVisible(false);
      setSelectedFeatureAttributes(null);
      setCurrentInspectedLayerName(null);
    }
  }, [isInspectModeActive, activeDrawTool, stopDrawingTool]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
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
            // dragBoxInteractionRef.current.dispose(); // dispose might not be needed if removed
            dragBoxInteractionRef.current = null;
        }

        if (defaultDragZoomInteractionRef.current) {
             const dragZoomInteraction = currentMap.getInteractions().getArray().find(
                (interaction) => interaction === defaultDragZoomInteractionRef.current
             ) as DragZoom | undefined;
             if (dragZoomInteraction) {
                dragZoomInteraction.setActive(wasDragZoomActiveRef.current);
             }
            defaultDragZoomInteractionRef.current = null;
        }
    };

    if (isInspectModeActive && !activeDrawTool) {
        if (mapDiv) mapDiv.classList.add('cursor-crosshair');
        
        currentMap.on('singleclick', handleMapClick);

        if (!defaultDragZoomInteractionRef.current) {
            currentMap.getInteractions().forEach(interaction => {
                if (interaction instanceof DragZoom) {
                    defaultDragZoomInteractionRef.current = interaction;
                    wasDragZoomActiveRef.current = interaction.getActive();
                    interaction.setActive(false); // Disable default drag zoom
                }
            });
        }

        if (!dragBoxInteractionRef.current) {
            dragBoxInteractionRef.current = new DragBox({
                condition: platformModifierKeyOnly,
            });
            currentMap.addInteraction(dragBoxInteractionRef.current);
        }
        dragBoxInteractionRef.current.un('boxend', handleDragBoxEnd); // Remove previous if any
        dragBoxInteractionRef.current.on('boxend', handleDragBoxEnd);

    } else {
        cleanupInspectionInteractions();
    }

    return cleanupInspectionInteractions;

  }, [isInspectModeActive, activeDrawTool, handleMapClick, handleDragBoxEnd, mapRef, mapElementRef, isMapReady]);

  const closeFeatureAttributesPanel = useCallback(() => {
    setIsFeatureAttributesPanelVisible(false);
    setSelectedFeatureAttributes(null);
    setCurrentInspectedLayerName(null);
  }, []);

  return {
    isInspectModeActive,
    toggleInspectMode,
    selectedFeatureAttributes,
    isFeatureAttributesPanelVisible,
    currentInspectedLayerName,
    closeFeatureAttributesPanel,
    processAndDisplayFeatures // Exporting this for handleShowLayerTable
  };
}
