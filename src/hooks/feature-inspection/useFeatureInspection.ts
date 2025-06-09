
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { Map as OLMap, Feature as OLFeature } from 'ol'; // Value imports
import VectorLayer from 'ol/layer/Vector';
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
  layers: MapLayer[];
  drawingSourceRef: React.RefObject<VectorSourceType<OLFeature<any>> | null>;
  activeDrawTool: string | null;
  stopDrawingTool: () => void;
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
  const olMapDragZoomInteractionRef = useRef<DragZoom | null>(null);
  const wasDragZoomOriginallyActive = useRef<boolean>(false);

  const processAndDisplayFeatures = useCallback((foundFeatures: OLFeature[], layerName?: string) => {
    if (foundFeatures.length > 0) {
        const allAttributes = foundFeatures
          .map(feature => {
            if (!(feature instanceof OLFeature)) return null; // Ensure it's an OLFeature instance
            const properties = feature.getProperties();
            const attributesToShow: Record<string, any> = {};
            // Iterate over all properties and exclude only the one named 'geometry'
            // or the one returned by feature.getGeometryName()
            const geometryName = feature.getGeometryName();
            for (const key in properties) {
              if (key !== 'geometry' && key !== geometryName) {
                attributesToShow[key] = properties[key];
              }
            }
            return Object.keys(attributesToShow).length > 0 ? attributesToShow : null;
          })
          .filter(attrs => attrs !== null) as Record<string, any>[];

        if (allAttributes.length > 0) {
          setSelectedFeatureAttributes(allAttributes);
          setIsFeatureAttributesPanelVisible(true);
          setCurrentInspectedLayerName(layerName || "Entidad Seleccionada");
        } else {
          setSelectedFeatureAttributes(null);
          setIsFeatureAttributesPanelVisible(false);
          setCurrentInspectedLayerName(null);
          setTimeout(() => {
            toast({ description: "La(s) entidad(es) seleccionada(s) no tienen atributos visibles o solo contienen geometría." });
          }, 0);
        }
      } else {
        setSelectedFeatureAttributes(null);
        setIsFeatureAttributesPanelVisible(false);
        setCurrentInspectedLayerName(null);
        // No toast here if no features found by click/drag, as it can be intentional
      }
  }, [toast]);


  const handleMapClick = useCallback((event: any) => {
    if (!isInspectModeActive || !mapRef.current || activeDrawTool) return;
    
    // Basic check to prevent click processing if it's likely part of a drag
    if (dragBoxInteractionRef.current && (event.type === 'pointerdrag' || event.dragging || event.originalEvent.metaKey || event.originalEvent.ctrlKey || event.originalEvent.shiftKey) ) {
      return;
    }
    
    const clickedPixel = mapRef.current.getEventPixel(event.originalEvent);
    const featuresAtPixel: OLFeature[] = [];
    let clickedLayerName: string | undefined;

    mapRef.current.forEachFeatureAtPixel(clickedPixel, (featureOrLayer, layer) => {
        if (featureOrLayer instanceof OLFeature) { // Ensure it's a feature
            featuresAtPixel.push(featureOrLayer);
            if (layer && typeof layer.get === 'function' && layer.get('title')) { 
                clickedLayerName = layer.get('title');
            } else {
                 // Attempt to find the layer name from the application's layer list
                 const appLayer = layers.find(l => l.olLayer === layer);
                 if (appLayer) clickedLayerName = appLayer.name;
            }
        }
        // Continue iterating if it's a layer, stop if it's a feature (default OpenLayers behavior often means we want the top-most feature)
        // However, forEachFeatureAtPixel's callback should return a truthy value to stop iteration.
        // For now, we collect all features at the pixel from different layers, if any.
        return false; // Explicitly continue iterating to catch features from multiple layers if overlapping
    }, { hitTolerance: 5, layerFilter: (layer) => !(layer instanceof TileLayer) });

    setCurrentInspectedLayerName(clickedLayerName || null);
    processAndDisplayFeatures(featuresAtPixel, clickedLayerName);

  }, [isInspectModeActive, activeDrawTool, mapRef, processAndDisplayFeatures, layers]);

  const handleDragBoxEnd = useCallback(
    (event: any) => { 
      // DragBoxEvent is not exported from 'ol/interaction/DragBox', using 'any' for event type
      if (!mapRef.current || !isInspectModeActive) return;
    
      const dragBoxInteractionInstance = event.target as DragBox; // Cast target to DragBox
      const extent = dragBoxInteractionInstance.getGeometry().getExtent();
      const foundFeatures: OLFeature[] = [];
      let firstLayerNameWithFeatures: string | undefined;

      layers.forEach(layer => {
        if (layer.visible && layer.olLayer instanceof VectorLayer && typeof (layer.olLayer as VectorLayer<any>).getSource === 'function') { 
          const source = (layer.olLayer as VectorLayer<any>).getSource();
          if (source && typeof source.forEachFeatureIntersectingExtent === 'function') {
            source.forEachFeatureIntersectingExtent(extent, (feature) => {
              if (feature instanceof OLFeature) { // Ensure it's a feature
                foundFeatures.push(feature);
                if(!firstLayerNameWithFeatures) firstLayerNameWithFeatures = layer.name;
              }
            });
          }
        }
      });

      if (drawingSourceRef.current) {
        drawingSourceRef.current.forEachFeatureIntersectingExtent(extent, (feature) => {
          if (feature instanceof OLFeature) { // Ensure it's a feature
            foundFeatures.push(feature);
            if(!firstLayerNameWithFeatures) firstLayerNameWithFeatures = "Capa de Dibujo";
          }
        });
      }
    
      setCurrentInspectedLayerName(firstLayerNameWithFeatures || null); 
      processAndDisplayFeatures(foundFeatures, firstLayerNameWithFeatures);
    },
    [mapRef, layers, drawingSourceRef, isInspectModeActive, processAndDisplayFeatures]
  );


  const cleanupInspectionInteractions = useCallback(() => {
    if (mapRef.current) {
      if (mapElementRef.current) mapElementRef.current.classList.remove('cursor-crosshair');
      mapRef.current.un('singleclick', handleMapClick);
      if (dragBoxInteractionRef.current) {
        mapRef.current.removeInteraction(dragBoxInteractionRef.current);
        dragBoxInteractionRef.current.dispose();
        dragBoxInteractionRef.current = null;
      }
      if (olMapDragZoomInteractionRef.current) {
        olMapDragZoomInteractionRef.current.setActive(wasDragZoomOriginallyActive.current);
      }
    }
  }, [mapRef, mapElementRef, handleMapClick]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const currentMap = mapRef.current;

    if (isInspectModeActive && !activeDrawTool) {
        if (mapElementRef.current) mapElementRef.current.classList.add('cursor-crosshair');
        currentMap.on('singleclick', handleMapClick);

        if (!olMapDragZoomInteractionRef.current) {
            currentMap.getInteractions().forEach(interaction => {
                if (interaction instanceof DragZoom) {
                    olMapDragZoomInteractionRef.current = interaction;
                    wasDragZoomOriginallyActive.current = interaction.getActive();
                }
            });
        }
        if (olMapDragZoomInteractionRef.current) {
            olMapDragZoomInteractionRef.current.setActive(false);
        }

        if (!dragBoxInteractionRef.current) {
            dragBoxInteractionRef.current = new DragBox({ condition: platformModifierKeyOnly });
            currentMap.addInteraction(dragBoxInteractionRef.current);
            dragBoxInteractionRef.current.on('boxend', handleDragBoxEnd);
        }
    } else { 
        cleanupInspectionInteractions();
    }

    return () => { 
        cleanupInspectionInteractions();
    };
  }, [isInspectModeActive, activeDrawTool, isMapReady, mapRef, mapElementRef, handleMapClick, handleDragBoxEnd, cleanupInspectionInteractions]); 


  const toggleInspectMode = useCallback(() => {
    const newInspectModeState = !isInspectModeActive;
    setIsInspectModeActive(newInspectModeState); 

    if (newInspectModeState && activeDrawTool) { 
      stopDrawingTool(); 
    }
    
    if (!newInspectModeState) { 
      setIsFeatureAttributesPanelVisible(false);
      setSelectedFeatureAttributes(null);
      setCurrentInspectedLayerName(null);
    }
  }, [isInspectModeActive, activeDrawTool, stopDrawingTool]);


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
    processAndDisplayFeatures 
  };
}

    