
"use client";

import { useState, useCallback } from 'react';
import type { Map as OLMap } from 'ol';
import { toast } from "@/hooks/use-toast";

interface UseMapCaptureProps {
  mapRef: React.RefObject<OLMap | null>;
  activeBaseLayerId: string | undefined;
}

interface CaptureOptions {
  format: 'png' | 'jpeg';
  band?: 'red' | 'green' | 'blue';
}

function triggerDownload(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href); 
}

export function useMapCapture({ mapRef, activeBaseLayerId }: UseMapCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);

  const captureMap = useCallback(async (options: CaptureOptions) => {
    if (!mapRef.current) {
      toast({ description: "Mapa no disponible.", variant: "destructive" });
      return;
    }
    if (activeBaseLayerId !== 'esri-satellite') {
      toast({ description: "La captura solo está disponible para la capa base ESRI Satelital.", variant: "destructive" });
      return;
    }

    setIsCapturing(true);
    const formatDescription = options.format.toUpperCase();
    const bandDescription = options.band ? ` banda ${options.band}` : ' completa';
    toast({ description: `Preparando captura${bandDescription} como ${formatDescription}...` });

    const map = mapRef.current;

    map.once('rendercomplete', () => {
      try {
        const mapCanvas = map.getViewport().querySelector('canvas');
        if (!mapCanvas) {
          throw new Error("No se pudo encontrar el canvas del mapa.");
        }

        let dataURL: string;
        let fileName: string;
        const quality = options.format === 'jpeg' ? 0.9 : undefined;

        if (options.band) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = mapCanvas.width;
          tempCanvas.height = mapCanvas.height;
          const ctx = tempCanvas.getContext('2d');
          if (!ctx) {
            throw new Error("No se pudo obtener el contexto 2D del canvas temporal.");
          }
          
          const mainCtx = mapCanvas.getContext('2d');
          if (!mainCtx) {
             throw new Error("No se pudo obtener el contexto 2D del canvas principal.");
          }
          const imageData = mainCtx.getImageData(0, 0, mapCanvas.width, mapCanvas.height);
          const data = imageData.data;
          const newImageData = ctx.createImageData(mapCanvas.width, mapCanvas.height);
          const newData = newImageData.data;

          for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            switch (options.band) {
              case 'red':
                newData[i] = r; 
                newData[i + 1] = r; 
                newData[i + 2] = r; 
                break;
              case 'green':
                newData[i] = g; 
                newData[i + 1] = g; 
                newData[i + 2] = g; 
                break;
              case 'blue':
                newData[i] = b; 
                newData[i + 1] = b; 
                newData[i + 2] = b; 
                break;
            }
            newData[i + 3] = data[i + 3]; // Alpha
          }
          ctx.putImageData(newImageData, 0, 0);
          dataURL = tempCanvas.toDataURL(`image/${options.format}`, quality);
          fileName = `map_capture_${options.band}_band.${options.format}`;
        } else {
          dataURL = mapCanvas.toDataURL(`image/${options.format}`, quality);
          fileName = `map_capture_full.${options.format}`;
        }
        
        triggerDownload(dataURL, fileName);
        toast({ description: `Captura${bandDescription} descargada como ${fileName}.` });

      } catch (error: any) {
        console.error("Error capturando el mapa:", error);
        toast({ description: `Error al capturar: ${error.message}`, variant: "destructive" });
      } finally {
        setIsCapturing(false);
      }
    });

    map.renderSync();

  }, [mapRef, activeBaseLayerId, toast]);

  return {
    captureMap,
    isCapturing,
  };
}
