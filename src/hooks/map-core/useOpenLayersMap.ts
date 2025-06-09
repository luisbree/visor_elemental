
"use client";

import { useRef, useCallback, useEffect, useState } from 'react';
import { Map as OLMap, Feature as OLFeature } from 'ol';
import VectorLayerType from 'ol/layer/Vector';
import VectorSourceType from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { toast } from "@/hooks/use-toast";

export function useOpenLayersMap() {
  const mapRef = useRef<OLMap | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const drawingSourceRef = useRef<VectorSourceType<OLFeature<any>> | null>(null);
  const drawingLayerRef = useRef<VectorLayerType<VectorSourceType<OLFeature<any>>> | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const setMapInstanceAndElement = useCallback((mapInstance: OLMap, element: HTMLDivElement) => {
    mapRef.current = mapInstance;
    mapElementRef.current = element;

    if (!mapRef.current) {
      console.error("setMapInstanceAndElement called but mapRef.current is null.");
      return;
    }

    let drawingLayerSuccessfullySetup = false;

    if (!drawingLayerRef.current) { // Create drawing layer only if it doesn't exist
      try {
        if (!drawingSourceRef.current) {
             drawingSourceRef.current = new VectorSource({ wrapX: false });
        }

        if (!drawingSourceRef.current) {
            console.error("CRITICAL: drawingSourceRef.current is null after attempting initialization. Cannot create drawing layer.");
            setTimeout(() => {
              toast({description: "Error Crítico: No se pudo inicializar la fuente de la capa de dibujo."});
            }, 0);
            return; // Do not proceed if source is not created
        }

        drawingLayerRef.current = new VectorLayer({
            source: drawingSourceRef.current,
            style: new Style({
              fill: new Fill({ color: 'rgba(0, 150, 255, 0.2)' }),
              stroke: new Stroke({ color: '#007bff', width: 2 }),
              image: new CircleStyle({
                  radius: 7,
                  fill: new Fill({ color: '#007bff' }),
                  stroke: new Stroke({ color: '#ffffff', width: 1.5 })
              }),
            }),
            zIndex: 1000 // Set zIndex at creation
        });
        mapRef.current.addLayer(drawingLayerRef.current);
        drawingLayerSuccessfullySetup = true;
        console.log("Drawing layer added to map with zIndex 1000.");

      } catch (e: any) {
        console.error("Error during drawing layer/source INSTANTIATION or map ADDITION:", e.message, {
          drawingSourceRef_current_value_exists: !!drawingSourceRef.current,
          drawingLayerRef_current_value_exists: !!drawingLayerRef.current,
        });
        setTimeout(() => {
          toast({description: "Error Crítico: No se pudo inicializar la capa de dibujo (instantiation)."});
        }, 0);
        return; // Do not proceed if layer creation fails
      }
    } else {
        // Drawing layer already exists, ensure it's on map and zIndex is correct
        if (mapRef.current.getLayers().getArray().includes(drawingLayerRef.current)) {
            drawingLayerRef.current.setZIndex(1000);
        } else {
            // This case should be rare if MapView is not re-initializing
            console.warn("Drawing layer instance existed but was not on the map. Re-adding.");
            mapRef.current.addLayer(drawingLayerRef.current);
            drawingLayerRef.current.setZIndex(1000);
        }
        drawingLayerSuccessfullySetup = true; // It was already initialized or successfully re-managed
    }
    
    if (drawingLayerSuccessfullySetup) {
        setIsMapReady(true); // Set map as ready only if drawing layer setup was successful
    }

  }, [toast]);

  // Removed the separate useEffect for zIndex as it's now handled in setMapInstanceAndElement

  return {
    mapRef,
    mapElementRef,
    drawingSourceRef,
    drawingLayerRef,
    setMapInstanceAndElement,
    isMapReady,
  };
}
