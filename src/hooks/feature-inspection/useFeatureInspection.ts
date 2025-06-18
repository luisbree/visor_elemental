
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { Map as OLMap, Feature as OLFeature } from 'ol'; // Value imports
import VectorLayer from 'ol/layer/Vector'; // Value import
import TileLayer from 'ol/layer/Tile'; // Value import
import DragBox, { type DragBoxEvent } from 'ol/interaction/DragBox';
import DragZoom from 'ol/interaction/DragZoom';
import { platformModifierKeyOnly } from 'ol/events/condition';
import { toast } from "@/hooks/use-toast";
import type { MapLayer } from '@/lib/types';
import type VectorSourceType from 'ol/source/Vector'; // Keep as type if only used for types
import type { Geometry as OLGeometry } from 'ol/geom';

interface UseFeatureInspectionProps {
  mapRef: React.RefObject<OLMap | null>;
  mapElementRef: React.RefObject<HTMLDivElement | null>;
  isMapReady: boolean;
  // layers: MapLayer[]; // Managed internally via updateLayers
  drawingSourceRef: React.RefObject<VectorSourceType<OLFeature<any>> | null>;
  drawingLayerRef: React.RefObject<VectorLayer<VectorSourceType<OLFeature<any>>> | null>;
  activeDrawTool: string | null;
  stopDrawingTool: () => void;
}

export function useFeatureInspection({
  mapRef,
  mapElementRef,
  isMapReady,
  // layers: initialLayers,
  drawingSourceRef,
  drawingLayerRef,
  activeDrawTool,
  stopDrawingTool,
}: UseFeatureInspectionProps) {
  const [isInspectModeActive, setIsInspectModeActive] = useState(false);
  const [selectedFeatureAttributes, setSelectedFeatureAttributes] = useState<Record<string, any>[] | null>(null);
  const [isFeatureAttributesPanelVisible, setIsFeatureAttributesPanelVisible] = useState(false);
  const [currentInspectedLayerName, setCurrentInspectedLayerName] = useState<string | null>(null);
  const [currentLayers, setCurrentLayers] = useState<MapLayer[]>([]);

  const dragBoxInteractionRef = useRef<DragBox | null>(null);
  const olMapDragZoomInteractionRef = useRef<DragZoom | null>(null);
  const wasDragZoomOriginallyActive = useRef<boolean>(false);

  const updateLayers = useCallback((newLayers: MapLayer[]) => {
    setCurrentLayers(newLayers);
  }, []);

  const processAndDisplayFeatures = useCallback((foundFeatures: OLFeature[], layerName?: string) => {
    if (foundFeatures.length > 0) {
        const allAttributes = foundFeatures
          .map(feature => {
            if (!(feature instanceof OLFeature)) {
              console.warn('Encountered non-OLFeature in foundFeatures:', feature);
              return null;
            }
            const properties = feature.getProperties();
            const attributesToShow: Record<string, any> = {};
            const geometryName = feature.getGeometryName(); // Default is 'geometry'

            for (const key in properties) {
              if (Object.prototype.hasOwnProperty.call(properties, key)) {
                if (key !== geometryName) { // Only exclude the actual geometry value
                  const value = properties[key];
                  // Attempt to convert objects to string representation for display
                  if (typeof value === 'object' && value !== null) {
                     attributesToShow[key] = String(value); // Will show [object Object] for complex ones
                  } else {
                    attributesToShow[key] = value; // Primitives, null, undefined
                  }
                }
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
        // Optional: toast if click yielded no features at all?
        // setTimeout(() => {
        //   toast({ description: "No se encontraron entidades en el punto de inspección." });
        // }, 0);
      }
  }, [toast]);


  const handleMapClick = useCallback((event: any) => {
    if (!isInspectModeActive || !mapRef.current || activeDrawTool) return;

    // Prevent click processing if it's likely part of a drag box operation
    if (dragBoxInteractionRef.current && (event.type === 'pointerdrag' || event.dragging || event.originalEvent.metaKey || event.originalEvent.ctrlKey || event.originalEvent.shiftKey) ) {
      return;
    }

    const clickedPixel = mapRef.current.getEventPixel(event.originalEvent);
    const featuresAtPixel: OLFeature[] = [];
    let clickedLayerName: string | undefined;

    mapRef.current.forEachFeatureAtPixel(clickedPixel, (featureOrLayer, layer) => {
        if (featureOrLayer instanceof OLFeature) {
            featuresAtPixel.push(featureOrLayer);
             // Determine layer name for the panel title
            if (layer && drawingLayerRef.current && layer === drawingLayerRef.current) {
                clickedLayerName = "Capa de Dibujo";
            } else if (layer && typeof layer.get === 'function' && layer.get('title')) { // For WMS layers etc.
                clickedLayerName = layer.get('title');
            } else { // For vector layers managed by useLayerManager
                 const appLayer = currentLayers.find(l => l.olLayer === layer);
                 if (appLayer) clickedLayerName = appLayer.name;
            }
        }
        return false; // continue checking other features/layers at pixel
    }, { hitTolerance: 5, layerFilter: (layerCandidate) => !(layerCandidate instanceof TileLayer) });

    processAndDisplayFeatures(featuresAtPixel, clickedLayerName);

  }, [isInspectModeActive, activeDrawTool, mapRef, processAndDisplayFeatures, currentLayers, drawingLayerRef]);


  const handleDragBoxEnd = useCallback(
    (event: DragBoxEvent) => { 
      if (!mapRef.current || !isInspectModeActive) return;

      const boxGeometry: OLGeometry | undefined = event.geometry;
      if (!boxGeometry) {
        console.warn("DragBox 'boxend' event did not contain a geometry.");
        return;
      }
      const extent = boxGeometry.getExtent();

      const foundFeatures: OLFeature[] = [];
      let firstLayerNameWithFeatures: string | undefined;

      currentLayers.forEach(appLayer => {
        if (appLayer.visible && appLayer.olLayer instanceof VectorLayer && typeof (appLayer.olLayer as VectorLayer<any>).getSource === 'function') {
          const source = (appLayer.olLayer as VectorLayer<any>).getSource();
          if (source && typeof source.forEachFeatureIntersectingExtent === 'function') {
            source.forEachFeatureIntersectingExtent(extent, (feature) => {
              if (feature instanceof OLFeature) {
                foundFeatures.push(feature);
                if(!firstLayerNameWithFeatures) firstLayerNameWithFeatures = appLayer.name;
              }
            });
          }
        }
      });

      if (drawingSourceRef.current) {
        drawingSourceRef.current.forEachFeatureIntersectingExtent(extent, (feature) => {
          if (feature instanceof OLFeature) {
            foundFeatures.push(feature);
            if(!firstLayerNameWithFeatures) firstLayerNameWithFeatures = "Capa de Dibujo";
          }
        });
      }
      processAndDisplayFeatures(foundFeatures, firstLayerNameWithFeatures);
    },
    [mapRef, currentLayers, drawingSourceRef, isInspectModeActive, processAndDisplayFeatures]
  );

  const cleanupInspectionInteractions = useCallback(() => {
    if (mapRef.current) {
      if (mapElementRef.current) mapElementRef.current.classList.remove('cursor-crosshair');
      mapRef.current.un('singleclick', handleMapClick);

      if (dragBoxInteractionRef.current) {
        mapRef.current.removeInteraction(dragBoxInteractionRef.current);
        dragBoxInteractionRef.current.dispose(); // Important to dispose
        dragBoxInteractionRef.current = null;
      }
      // Restore original DragZoom state
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

        // Manage DragZoom: Deactivate if it exists
        if (!olMapDragZoomInteractionRef.current) { // Find it only once
            currentMap.getInteractions().forEach(interaction => {
                if (interaction instanceof DragZoom) {
                    olMapDragZoomInteractionRef.current = interaction;
                    wasDragZoomOriginallyActive.current = interaction.getActive();
                }
            });
        }
        if (olMapDragZoomInteractionRef.current) {
            olMapDragZoomInteractionRef.current.setActive(false); // Deactivate for inspection
        }

        // Add DragBox for area selection
        if (!dragBoxInteractionRef.current) {
            dragBoxInteractionRef.current = new DragBox({ condition: platformModifierKeyOnly });
            currentMap.addInteraction(dragBoxInteractionRef.current);
            dragBoxInteractionRef.current.on('boxend', handleDragBoxEnd as (evt: Event) => void | boolean);
        }
    } else {
        cleanupInspectionInteractions();
    }
  }, [isInspectModeActive, activeDrawTool, isMapReady, mapRef, mapElementRef, handleMapClick, handleDragBoxEnd, cleanupInspectionInteractions]);


  const toggleInspectMode = useCallback(() => {
    const newInspectModeState = !isInspectModeActive;
    setIsInspectModeActive(newInspectModeState);

    if (newInspectModeState && activeDrawTool) {
      stopDrawingTool(); // If activating inspect, stop any active drawing tool
    }

    if (!newInspectModeState) { // If deactivating inspect mode
      setIsFeatureAttributesPanelVisible(false);
      setSelectedFeatureAttributes(null);
      setCurrentInspectedLayerName(null);
      // Interactions are cleaned up by the useEffect above
    }
  }, [isInspectModeActive, activeDrawTool, stopDrawingTool]);


  const closeFeatureAttributesPanel = useCallback(() => {
    setIsFeatureAttributesPanelVisible(false);
  }, []);

  return {
    isInspectModeActive,
    toggleInspectMode,
    selectedFeatureAttributes,
    isFeatureAttributesPanelVisible,
    currentInspectedLayerName,
    closeFeatureAttributesPanel,
    processAndDisplayFeatures,
    updateLayers,
  };
}

