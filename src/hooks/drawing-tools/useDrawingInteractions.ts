
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Map as OLMap, Feature as OLFeature } from 'ol';
import type VectorSourceType from 'ol/source/Vector';
import Draw, { type DrawEvent } from 'ol/interaction/Draw';
import KML from 'ol/format/KML';
import { toast } from "@/hooks/use-toast";

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
  isInspectModeActive: boolean; 
  toggleInspectMode: () => void; 
}

export function useDrawingInteractions({
  mapRef,
  isMapReady,
  drawingSourceRef,
  isInspectModeActive,
  toggleInspectMode, 
}: UseDrawingInteractionsProps) {
  const [activeDrawTool, setActiveDrawTool] = useState<string | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);

  const toggleDrawingTool = useCallback((toolType: 'Polygon' | 'LineString' | 'Point') => {
    if (!mapRef.current || !drawingSourceRef.current || !isMapReady) return;

    if (activeDrawTool === toolType) { 
      if (drawInteractionRef.current) {
        mapRef.current.removeInteraction(drawInteractionRef.current);
        drawInteractionRef.current.dispose(); 
        drawInteractionRef.current = null;
      }
      setActiveDrawTool(null);
      return;
    }

    if (drawInteractionRef.current) {
      mapRef.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current.dispose();
      drawInteractionRef.current = null;
    }

    if (isInspectModeActive) {
      toggleInspectMode(); 
    }

    const newDrawInteraction = new Draw({
      source: drawingSourceRef.current,
      type: toolType,
    });
    mapRef.current.addInteraction(newDrawInteraction);
    drawInteractionRef.current = newDrawInteraction;
    setActiveDrawTool(toolType);

    newDrawInteraction.on('drawend', (event: DrawEvent) => {
        setTimeout(() => {
          toast(`${toolType} dibujado.`);
        }, 0);
    });

  }, [mapRef, drawingSourceRef, activeDrawTool, isInspectModeActive, toggleInspectMode, isMapReady, toast]);

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
      setTimeout(() => {
        toast("Todos los dibujos han sido eliminados.");
      }, 0);
    }
  }, [drawingSourceRef, toast]);

  const saveDrawnFeaturesAsKML = useCallback(() => {
    if (!drawingSourceRef.current || drawingSourceRef.current.getFeatures().length === 0) {
      setTimeout(() => {
        toast("Nada dibujado para guardar.");
      }, 0);
      return;
    }
    const features = drawingSourceRef.current.getFeatures();
    const kmlFormat = new KML();
    try {
      const kmlString = kmlFormat.writeFeatures(features, {
        dataProjection: 'EPSG:4326', 
        featureProjection: 'EPSG:3857', 
      });
      triggerDownload(kmlString, 'drawings.kml', 'application/vnd.google-earth.kml+xml;charset=utf-8');
      setTimeout(() => {
        toast("Dibujos guardados como drawings.kml.");
      }, 0);
    } catch (error) {
      console.error("Error guardando KML:", error);
      setTimeout(() => {
        toast("No se pudieron guardar los dibujos KML.");
      }, 0);
    }
  }, [drawingSourceRef, toast]);
  
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
