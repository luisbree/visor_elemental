
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { Map as OLMap, Feature as OLFeature } from 'ol'; // Value imports
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
  const originalDragZoomInteractionRef = useRef<DragZoom | null>(null);
  const wasDragZoomOriginallyActiveRef = useRef<boolean>(false);


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
          setTimeout(() => {
            toast("La(s) entidad(es) seleccionada(s) no tienen atributos visibles.");
          }, 0);
        }
      } else {
        setSelectedFeatureAttributes(null);
        setIsFeatureAttributesPanelVisible(false);
        setCurrentInspectedLayerName(null);
        setTimeout(() => {
          toast("Ninguna entidad encontrada para inspeccionar.");
        }, 0);
      }
  }, [toast]);

  const handleMapClick = useCallback((event: any) => {
    if (!isInspectModeActive || !mapRef.current || activeDrawTool) return;

    if (dragBoxInteractionRef.current && (event.type === 'pointerdrag' || event.dragging)) {
      return;
    }
    
    const clickedPixel = mapRef.current.getEventPixel(event.originalEvent);
    const featuresAtPixel: OLFeature<any>[] = [];
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
    (event: any) => { // DragBoxEvent is not exported from 'ol/interaction/DragBox', using 'any'
      if (!mapRef.current || !isInspectModeActive) return;
    
      const dragBoxInteraction = event.target as DragBox; 
      const extent = dragBoxInteraction.getGeometry().getExtent();
      const foundFeatures: OLFeature<any>[] = [];

      layers.forEach(layer => {
        if (layer.visible && layer.olLayer && typeof (layer.olLayer as VectorLayerType<any>).getSource === 'function') { // Check if it's a vector-like layer
          const source = (layer.olLayer as VectorLayerType<any>).getSource();
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

    const cleanupInspectionInteractions = () => {
        if (mapDiv) mapDiv.classList.remove('cursor-crosshair');
        currentMap.un('singleclick', handleMapClick);

        if (dragBoxInteractionRef.current) {
            currentMap.removeInteraction(dragBoxInteractionRef.current);
            dragBoxInteractionRef.current.dispose(); 
            dragBoxInteractionRef.current = null;
        }
        // Restore original DragZoom state if it was modified
        if (originalDragZoomInteractionRef.current) {
            originalDragZoomInteractionRef.current.setActive(wasDragZoomOriginallyActiveRef.current);
        }
    };

    if (isInspectModeActive && !activeDrawTool) {
        if (mapDiv) mapDiv.classList.add('cursor-crosshair');
        
        currentMap.on('singleclick', handleMapClick);

        // Manage DragZoom interaction
        if (!originalDragZoomInteractionRef.current) { 
            currentMap.getInteractions().forEach(interaction => {
                if (interaction instanceof DragZoom) {
                    originalDragZoomInteractionRef.current = interaction;
                    wasDragZoomOriginallyActiveRef.current = interaction.getActive();
                    interaction.setActive(false); // Deactivate while inspecting
                }
            });
        } else if (originalDragZoomInteractionRef.current.getActive()) {
            // If it somehow got re-activated, ensure it's off for inspect mode
            originalDragZoomInteractionRef.current.setActive(false);
        }


        if (!dragBoxInteractionRef.current) {
            dragBoxInteractionRef.current = new DragBox({
                condition: platformModifierKeyOnly, 
            });
            currentMap.addInteraction(dragBoxInteractionRef.current);
            dragBoxInteractionRef.current.on('boxend', handleDragBoxEnd);
        }
    } else { // Not inspect mode OR a draw tool is active
        cleanupInspectionInteractions();
    }

    return () => { // Cleanup on unmount or when dependencies change causing re-run
      cleanupInspectionInteractions();
    };

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
    processAndDisplayFeatures 
  };
}
