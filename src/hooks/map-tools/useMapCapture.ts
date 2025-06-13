
"use client";

import { useState, useCallback } from 'react';
import type { Map as OLMap } from 'ol';
import { toast } from "@/hooks/use-toast";

interface UseMapCaptureProps {
  mapRef: React.RefObject<OLMap | null>;
  activeBaseLayerId: string | undefined;
}

function triggerDownload(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href); // Clean up blob URL
}

export function useMapCapture({ mapRef, activeBaseLayerId }: UseMapCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);

  const captureMapAsPNG = useCallback(() => {
    if (!mapRef.current) {
      toast({ description: "Mapa no disponible.", variant: "destructive" });
      return;
    }
    if (activeBaseLayerId !== 'esri-satellite') {
      toast({ description: "La captura solo está disponible para la capa base ESRI Satelital.", variant: "destructive" });
      return;
    }

    setIsCapturing(true);
    toast({ description: "Preparando captura de mapa..." });

    const map = mapRef.current;

    map.once('rendercomplete', () => {
      try {
        const mapCanvas = map.getViewport().querySelector('canvas');
        if (!mapCanvas) {
          throw new Error("No se pudo encontrar el canvas del mapa.");
        }

        // Ensure the canvas is not tainted if cross-origin images are used without CORS.
        // For ESRI Satellite, this should generally be fine.
        const dataURL = mapCanvas.toDataURL('image/png');
        
        triggerDownload(dataURL, 'map_capture_esri.png');
        toast({ description: "Captura de mapa descargada como PNG." });

      } catch (error: any) {
        console.error("Error capturando el mapa:", error);
        toast({ description: `Error al capturar: ${error.message}`, variant: "destructive" });
      } finally {
        setIsCapturing(false);
      }
    });

    // Trigger a re-render to ensure 'rendercomplete' fires.
    // This is important if the map hasn't rendered recently or if an immediate capture is needed.
    map.renderSync();

  }, [mapRef, activeBaseLayerId, toast]);

  return {
    captureMapAsPNG,
    isCapturing,
  };
}
