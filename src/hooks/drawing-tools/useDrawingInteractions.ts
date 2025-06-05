
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Map as OLMap, Feature as OLFeature } from 'ol';
import type VectorSourceType from 'ol/source/Vector';
import Draw, { type DrawEvent } from 'ol/interaction/Draw';
import KML from 'ol/format/KML';
import { toast } from "@/hooks/use-toast";

// Helper function for downloads
function triggerDownload(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

interface UseDrawingInteractionsProps {
  mapRef: React.RefObject<OLMap | null>;
  isMapReady: boolean;
  drawingSourceRef: React.RefObject<VectorSourceType<OLFeature<any>> | null>;
  isInspectModeActive: boolean; // From useFeatureInspection
  toggleInspectMode: () => void; // From useFeatureInspection
}

export function useDrawingInteractions({
  mapRef,
  isMapReady,
  drawingSourceRef,
  isInspectModeActive,
  toggleInspectMode, // To turn off inspection when drawing starts
}: UseDrawingInteractionsProps) {
  const [activeDrawTool, setActiveDrawTool] = useState<string | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);

  const toggleDrawingTool = useCallback((toolType: 'Polygon' | 'LineString' | 'Point') => {
    if (!mapRef.current || !drawingSourceRef.current || !isMapReady) return;

    if (activeDrawTool === toolType) { // Toggle off
      if (drawInteractionRef.current) {
        mapRef.current.removeInteraction(drawInteractionRef.current);
        drawInteractionRef.current.dispose(); // Clean up interaction
        drawInteractionRef.current = null;
      }
      setActiveDrawTool(null);
      return;
    }

    // If another tool is active, remove it first
    if (drawInteractionRef.current) {
      mapRef.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current.dispose();
      drawInteractionRef.current = null;
    }

    // Turn off inspect mode if it's active
    if (isInspectModeActive) {
      toggleInspectMode(); // This will set isInspectModeActive to false
    }

    const newDrawInteraction = new Draw({
      source: drawingSourceRef.current,
      type: toolType,
    });
    mapRef.current.addInteraction(newDrawInteraction);
    drawInteractionRef.current = newDrawInteraction;
    setActiveDrawTool(toolType);

    // Optional: Listen for drawend to potentially auto-stop or provide feedback
    newDrawInteraction.on('drawend', (event: DrawEvent) => {
        // console.log('Feature drawn:', event.feature);
        // If you want to stop drawing after one feature:
        // stopDrawingTool();
        toast(`${toolType} dibujado.`);
    });

  }, [mapRef, drawingSourceRef, activeDrawTool, isInspectModeActive, toggleInspectMode, isMapReady]);

  const stopDrawingTool = useCallback(() => {
    if (mapRef.current && drawInteractionRef.current) {
      mapRef.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current.dispose();
      drawInteractionRef.current = null;
    }
    setActiveDrawTool(null);
  }, [mapRef]);

  const clearDrawnFeatures = useCallback(() => {
    if (drawingSourceRef.current) {
      drawingSourceRef.current.clear();
      toast("Todos los dibujos han sido eliminados.");
    }
  }, [drawingSourceRef]);

  const saveDrawnFeaturesAsKML = useCallback(() => {
    if (!drawingSourceRef.current || drawingSourceRef.current.getFeatures().length === 0) {
      toast("Nada dibujado para guardar.");
      return;
    }
    const features = drawingSourceRef.current.getFeatures();
    const kmlFormat = new KML();
    try {
      const kmlString = kmlFormat.writeFeatures(features, {
        dataProjection: 'EPSG:4326', // KML is typically geographic
        featureProjection: 'EPSG:3857', // Assuming map is in Web Mercator
      });
      triggerDownload(kmlString, 'drawings.kml', 'application/vnd.google-earth.kml+xml;charset=utf-8');
      toast("Dibujos guardados como drawings.kml.");
    } catch (error) {
      console.error("Error guardando KML:", error);
      toast("No se pudieron guardar los dibujos KML.");
    }
  }, [drawingSourceRef]);
  
  // Cleanup interaction when component unmounts or map changes
  useEffect(() => {
    return () => {
      if (mapRef.current && drawInteractionRef.current) {
        mapRef.current.removeInteraction(drawInteractionRef.current);
        drawInteractionRef.current.dispose();
      }
    };
  }, [mapRef]);

  return {
    activeDrawTool,
    toggleDrawingTool,
    stopDrawingTool,
    clearDrawnFeatures,
    saveDrawnFeaturesAsKML,
  };
}
