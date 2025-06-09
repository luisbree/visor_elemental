
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { Map as OLMap, Feature as OLFeature } from 'ol';
import VectorLayer from 'ol/layer/Vector'; // Changed from VectorLayerType
import type VectorSourceType from 'ol/source/Vector'; // Keep as type if only used for type hints
import TileLayer from 'ol/layer/Tile';
import DragBox from 'ol/interaction/DragBox';
import DragZoom from 'ol/interaction/DragZoom'; // Import DragZoom
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
          setTimeout(() => {
            toast({ description: "La(s) entidad(es) seleccionada(s) no tienen atributos visibles." });
          }, 0);
        }
      } else {
        setSelectedFeatureAttributes(null);
        setIsFeatureAttributesPanelVisible(false);
        setCurrentInspectedLayerName(null);
        setTimeout(() => {
          toast({ description: "Ninguna entidad encontrada para inspeccionar." });
        }, 0);
      }
  }, [toast]);

  const handleMapClick = useCallback((event: any) => {
    if (!isInspectModeActive || !mapRef.current || activeDrawTool) return;
    
    if (dragBoxInteractionRef.current && (event.type === 'pointerdrag' || event.dragging || event.originalEvent.metaKey || event.originalEvent.ctrlKey || event.originalEvent.shiftKey) ) {
      return;
    }
    
    const clickedPixel = mapRef.current.getEventPixel(event.originalEvent);
    const featuresAtPixel: OLFeature[] = [];
    let clickedLayerName: string | undefined;

    mapRef.current.forEachFeatureAtPixel(clickedPixel, (featureOrLayer, layer) => {
        if (featureOrLayer instanceof OLFeature) {
            featuresAtPixel.push(featureOrLayer);
            if (layer && typeof layer.get === 'function' && layer.get('title')) { 
                clickedLayerName = layer.get('title');
            } else {
                 const appLayer = layers.find(l => l.olLayer === layer);
                 if (appLayer) clickedLayerName = appLayer.name;
            }
        }
        return false; 
    }, { hitTolerance: 5, layerFilter: (layer) => !(layer instanceof TileLayer) });

    setCurrentInspectedLayerName(clickedLayerName || null);
    processAndDisplayFeatures(featuresAtPixel, clickedLayerName);

  }, [isInspectModeActive, activeDrawTool, mapRef, processAndDisplayFeatures, layers]);

  const handleDragBoxEnd = useCallback(
    (event: any) => { 
      // DragBoxEvent is not exported from 'ol/interaction/DragBox', using 'any' for event
      if (!mapRef.current || !isInspectModeActive) return;
    
      const dragBoxInteraction = event.target as DragBox; 
      const extent = dragBoxInteraction.getGeometry().getExtent();
      const foundFeatures: OLFeature[] = [];

      layers.forEach(layer => {
        // Use VectorLayer for instanceof check
        if (layer.visible && layer.olLayer instanceof VectorLayer && typeof (layer.olLayer as VectorLayer<any>).getSource === 'function') { 
          const source = (layer.olLayer as VectorLayer<any>).getSource();
          if (source && typeof source.forEachFeatureIntersectingExtent === 'function') {
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
    
      setCurrentInspectedLayerName(null); 
      processAndDisplayFeatures(foundFeatures);
    },
    [mapRef, layers, drawingSourceRef, isInspectModeActive, processAndDisplayFeatures]
  );


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


  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const currentMap = mapRef.current;
    const mapDiv = mapElementRef.current;

    if (isInspectModeActive && !activeDrawTool) {
        // Inspect mode is active
        if (mapDiv) mapDiv.classList.add('cursor-crosshair');
        currentMap.on('singleclick', handleMapClick);

        // Find and manage the map's default DragZoom interaction
        if (!olMapDragZoomInteractionRef.current) { // Find it once
            currentMap.getInteractions().forEach(interaction => {
                if (interaction instanceof DragZoom) {
                    olMapDragZoomInteractionRef.current = interaction;
                }
            });
        }
        if (olMapDragZoomInteractionRef.current) { // If found
            wasDragZoomOriginallyActive.current = olMapDragZoomInteractionRef.current.getActive(); // Store its current state
            olMapDragZoomInteractionRef.current.setActive(false); // Deactivate it for inspect mode
        }

        // Add DragBox for inspect mode selection
        if (!dragBoxInteractionRef.current) {
            dragBoxInteractionRef.current = new DragBox({
                condition: platformModifierKeyOnly, 
            });
            currentMap.addInteraction(dragBoxInteractionRef.current);
            dragBoxInteractionRef.current.on('boxend', handleDragBoxEnd);
        }
    } else { 
        // Cleanup when inspect mode is off OR a draw tool is active
        if (mapDiv) mapDiv.classList.remove('cursor-crosshair');
        currentMap.un('singleclick', handleMapClick);

        if (dragBoxInteractionRef.current) {
            currentMap.removeInteraction(dragBoxInteractionRef.current);
            dragBoxInteractionRef.current.dispose(); // Dispose the interaction
            dragBoxInteractionRef.current = null;
        }

        // Restore map's default DragZoom interaction to its original state
        if (olMapDragZoomInteractionRef.current) {
            olMapDragZoomInteractionRef.current.setActive(wasDragZoomOriginallyActive.current);
        }
    }

    return () => { // Cleanup function for when the component unmounts or dependencies change
        if (mapDiv) mapDiv.classList.remove('cursor-crosshair');
        if (currentMap) { // Check if map instance still exists
            currentMap.un('singleclick', handleMapClick);
            if (dragBoxInteractionRef.current) {
                currentMap.removeInteraction(dragBoxInteractionRef.current);
                // dragBoxInteractionRef.current.dispose(); // Consider if dispose is needed and safe here
                dragBoxInteractionRef.current = null;
            }
            // Restore DragZoom on cleanup if it was managed
            if (olMapDragZoomInteractionRef.current) {
                olMapDragZoomInteractionRef.current.setActive(wasDragZoomOriginallyActive.current);
            }
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInspectModeActive, activeDrawTool, mapRef, mapElementRef, isMapReady]); // Removed handleMapClick, handleDragBoxEnd from deps as they are stable


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

    