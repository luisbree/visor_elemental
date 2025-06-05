
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
    setIsMapReady(true);

    if (!mapRef.current) {
      console.error("setMapInstanceAndElement called but mapRef.current is null.");
      return;
    }

    if (!drawingLayerRef.current) {
      try {
        if (!drawingSourceRef.current) {
             drawingSourceRef.current = new VectorSource({ wrapX: false });
        }

        if (!drawingSourceRef.current) {
            console.error("CRITICAL: drawingSourceRef.current is null after attempting initialization. Cannot create drawing layer.");
            toast("Error Crítico: No se pudo inicializar la fuente de la capa de dibujo.");
            return;
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
            zIndex: 1000 // A high zIndex for the drawing layer
        });
        mapRef.current.addLayer(drawingLayerRef.current);
        console.log("Drawing layer added to map.");

      } catch (e: any) {
        console.error("Error during drawing layer/source INSTANTIATION or map ADDITION:", e.message, {
          drawingSourceRef_current_value_exists: !!drawingSourceRef.current,
          drawingLayerRef_current_value_exists: !!drawingLayerRef.current,
        });
        toast("Error Crítico: No se pudo inicializar la capa de dibujo (instantiation).");
      }
    }
  }, []);

  // Ensure drawing layer is always on top of other vector layers (but below base layers potentially)
    useEffect(() => {
        if (mapRef.current && drawingLayerRef.current) {
            // This ZIndex might need adjustment based on how other layers are indexed.
            // Max ZIndex for vector layers + 1
            drawingLayerRef.current.setZIndex(1000);
        }
    }, [isMapReady]);


  return {
    mapRef,
    mapElementRef,
    drawingSourceRef,
    drawingLayerRef,
    setMapInstanceAndElement,
    isMapReady,
  };
}
