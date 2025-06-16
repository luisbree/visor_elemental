
"use client";

import { useState, useCallback, useRef } from 'react';
import type { Map as OLMap } from 'ol';
import type TileLayer from 'ol/layer/Tile';
import { toast } from "@/hooks/use-toast";
import { BASE_LAYER_DEFINITIONS } from '@/components/map-view'; // Import definitions

interface UseMapCaptureProps {
  mapRef: React.RefObject<OLMap | null>;
}

function triggerDownload(dataURL: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function useMapCapture({ mapRef }: UseMapCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const previousActiveBaseLayerIdRef = useRef<string | null>(null);

  const captureMap = useCallback(async (
    outputType: 'jpeg-full' | 'jpeg-red' | 'jpeg-green' | 'jpeg-blue'
  ) => {
    if (!mapRef.current) {
      toast({ description: "El mapa no está listo.", variant: "destructive" });
      return;
    }
    if (isCapturing) {
      toast({ description: "Captura en progreso..." });
      return;
    }

    setIsCapturing(true);
    toast({ description: "Preparando captura con ESRI Satelital..." });

    const mapInstance = mapRef.current;
    const esriSatelliteLayerDef = BASE_LAYER_DEFINITIONS.find(def => def.id === 'esri-satellite');
    
    if (!esriSatelliteLayerDef) {
        toast({ description: "Definición de capa ESRI Satelital no encontrada.", variant: "destructive" });
        setIsCapturing(false);
        return;
    }

    let esriOlLayer: TileLayer | undefined;
    let originallyVisibleBaseLayer: TileLayer | undefined;
    previousActiveBaseLayerIdRef.current = null;

    mapInstance.getLayers().forEach(layer => {
        if (layer.get('isBaseLayer')) {
            const baseLayerId = layer.get('baseLayerId');
            if (baseLayerId === esriSatelliteLayerDef.id) {
                esriOlLayer = layer as TileLayer;
            }
            if (layer.getVisible()) {
                originallyVisibleBaseLayer = layer as TileLayer;
                previousActiveBaseLayerIdRef.current = baseLayerId;
            }
        }
    });

    if (!esriOlLayer) { // Should not happen if map-view is correct
        toast({ description: "Capa ESRI Satelital no encontrada en el mapa.", variant: "destructive" });
        setIsCapturing(false);
        return;
    }
    
    const esriLayerNeedsToggle = !esriOlLayer.getVisible();

    if (esriLayerNeedsToggle) {
        if (originallyVisibleBaseLayer && originallyVisibleBaseLayer !== esriOlLayer) {
            originallyVisibleBaseLayer.setVisible(false);
        }
        esriOlLayer.setVisible(true);
    }
    
    try {
      await new Promise<void>(resolve => {
        mapInstance.once('rendercomplete', () => {
          // Additional small delay to ensure rendering is fully flushed
          setTimeout(resolve, 250);
        });
        if (esriLayerNeedsToggle) {
            mapInstance.render(); // Force re-render if visibility changed
        } else {
            resolve(); // If already visible, proceed
        }
      });

      const mapCanvas = mapInstance.getViewport().querySelector('canvas');
      if (!mapCanvas) {
        throw new Error("Canvas del mapa no encontrado.");
      }

      let dataURL: string;
      let fileName: string;
      const jpegQuality = 0.9;

      if (outputType === 'jpeg-full') {
        dataURL = mapCanvas.toDataURL('image/jpeg', jpegQuality);
        fileName = 'map_capture_esri_full.jpg';
      } else {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = mapCanvas.width;
        tempCanvas.height = mapCanvas.height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas temporal.");

        ctx.drawImage(mapCanvas, 0, 0);
        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        let bandIndex = 0; // 0 for Red, 1 for Green, 2 for Blue
        if (outputType === 'jpeg-red') { bandIndex = 0; fileName = 'map_capture_esri_red.jpg'; }
        else if (outputType === 'jpeg-green') { bandIndex = 1; fileName = 'map_capture_esri_green.jpg'; }
        else { bandIndex = 2; fileName = 'map_capture_esri_blue.jpg'; }

        for (let i = 0; i < data.length; i += 4) {
          const bandValue = data[i + bandIndex];
          data[i] = bandValue;     // Red
          data[i + 1] = bandValue; // Green
          data[i + 2] = bandValue; // Blue
          // Alpha (data[i + 3]) remains unchanged
        }
        ctx.putImageData(imageData, 0, 0);
        dataURL = tempCanvas.toDataURL('image/jpeg', jpegQuality);
      }
      
      triggerDownload(dataURL, fileName);
      toast({ description: `Captura (${outputType.replace('jpeg-','')}) descargada como ${fileName}.` });

    } catch (error: any) {
      console.error("Error durante la captura de mapa:", error);
      toast({ description: error.message || "Error al capturar el mapa.", variant: "destructive" });
    } finally {
      // Restore original base layer visibility
      if (esriLayerNeedsToggle && esriOlLayer) {
        esriOlLayer.setVisible(false); // Hide ESRI if it was turned on
      }
      if (previousActiveBaseLayerIdRef.current) {
         mapInstance.getLayers().forEach(layer => {
            if (layer.get('isBaseLayer') && layer.get('baseLayerId') === previousActiveBaseLayerIdRef.current) {
                layer.setVisible(true);
                if (layer !== esriOlLayer && esriLayerNeedsToggle) { // if original was not esri and esri was toggled, render again
                     mapInstance.render();
                }
            }
        });
      }
      setIsCapturing(false);
    }
  }, [mapRef, isCapturing, toast]);

  return { captureMap, isCapturing };
}
