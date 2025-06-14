
"use client";

import { useState, useCallback } from 'react';
import type { Map as OLMap } from 'ol';
import type TileLayer from 'ol/layer/Tile';
import type XYZ from 'ol/source/XYZ'; // Needed for type assertion
import { toast } from "@/hooks/use-toast";

interface UseMapCaptureProps {
  mapRef: React.RefObject<OLMap | null>;
  // activeBaseLayerId is no longer needed here as we always capture ESRI
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

export function useMapCapture({ mapRef }: UseMapCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);

  const captureMap = useCallback(async (options: CaptureOptions) => {
    if (!mapRef.current) {
      toast({ description: "Mapa no disponible.", variant: "destructive" });
      return;
    }

    setIsCapturing(true);
    const formatDescription = options.format.toUpperCase();
    const bandDescription = options.band ? ` banda ${options.band}` : ' completa';
    toast({ description: `Preparando captura ESRI${bandDescription} como ${formatDescription}...` });

    const map = mapRef.current;
    const layers = map.getLayers().getArray();
    const esriLayer = layers.find(l => l.get('isBaseLayer') && l.get('baseLayerId') === 'esri-satellite') as TileLayer<XYZ> | undefined;
    
    if (!esriLayer) {
        toast({ description: "Capa ESRI Satelital no encontrada en el mapa.", variant: "destructive" });
        setIsCapturing(false);
        return;
    }

    let originallyVisibleUserBaseLayers: TileLayer<any>[] = [];
    let esriWasOriginallyVisible = esriLayer.getVisible();

    if (!esriWasOriginallyVisible) {
        layers.forEach(l => {
            if (l.get('isBaseLayer') && l.getVisible() && l !== esriLayer) {
                originallyVisibleUserBaseLayers.push(l as TileLayer<any>);
                l.setVisible(false); 
            }
        });
        esriLayer.setVisible(true);
        map.renderSync(); 
        await new Promise<void>(resolve => map.once('rendercomplete', () => resolve()));
    }
    
    // Give a very short timeout to ensure canvas is fully updated after rendercomplete
    // This can sometimes help with intermittent issues on complex maps.
    await new Promise(resolve => setTimeout(resolve, 50));


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
        fileName = `map_capture_esri_${options.band}_band.${options.format}`;
      } else {
        dataURL = mapCanvas.toDataURL(`image/${options.format}`, quality);
        fileName = `map_capture_esri_full.${options.format}`;
      }
      
      triggerDownload(dataURL, fileName);
      toast({ description: `Captura ESRI${bandDescription} descargada como ${fileName}.` });

    } catch (error: any) {
      console.error("Error capturando el mapa:", error);
      toast({ description: `Error al capturar: ${error.message}`, variant: "destructive" });
    } finally {
      if (!esriWasOriginallyVisible) {
          esriLayer.setVisible(false);
          originallyVisibleUserBaseLayers.forEach(l => l.setVisible(true));
          map.renderSync();
      }
      setIsCapturing(false);
    }
  }, [mapRef, toast]);

  return {
    captureMap,
    isCapturing,
  };
}
