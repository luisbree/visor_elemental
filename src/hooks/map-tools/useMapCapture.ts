
"use client";

import { useState, useCallback, useRef } from 'react';
import type { Map as OLMap } from 'ol';
import type TileLayer from 'ol/layer/Tile';
import { toast } from "@/hooks/use-toast";
import { BASE_LAYER_DEFINITIONS } from '@/components/map-view'; 

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

const FHD_WIDTH = 1920;
const FHD_HEIGHT = 1080;

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
    toast({ description: `Preparando captura FHD (${FHD_WIDTH}x${FHD_HEIGHT}) con ESRI Satelital...` });

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
            const baseLayerId = layer.get('baseLayerId') as string; 
            if (baseLayerId === esriSatelliteLayerDef.id) {
                esriOlLayer = layer as TileLayer;
            }
            if (layer.getVisible()) {
                originallyVisibleBaseLayer = layer as TileLayer;
                previousActiveBaseLayerIdRef.current = baseLayerId;
            }
        }
    });

    if (!esriOlLayer) { 
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
          setTimeout(resolve, 250); 
        });
        if (esriLayerNeedsToggle) {
            mapInstance.render(); 
        } else {
            resolve(); 
        }
      });

      const mapCanvas = mapInstance.getViewport().querySelector('canvas');
      if (!mapCanvas) {
        throw new Error("Canvas del mapa no encontrado.");
      }

      const targetCanvas = document.createElement('canvas');
      targetCanvas.width = FHD_WIDTH;
      targetCanvas.height = FHD_HEIGHT;
      const targetCtx = targetCanvas.getContext('2d');
      if (!targetCtx) {
        throw new Error("No se pudo obtener el contexto 2D del canvas de destino.");
      }
      targetCtx.drawImage(mapCanvas, 0, 0, mapCanvas.width, mapCanvas.height, 0, 0, FHD_WIDTH, FHD_HEIGHT);


      let dataURL: string;
      let fileName: string;
      const jpegQuality = 0.9;

      if (outputType === 'jpeg-full') {
        dataURL = targetCanvas.toDataURL('image/jpeg', jpegQuality);
        fileName = 'map_capture_esri_full_fhd.jpg';
      } else {
        const bandCanvas = document.createElement('canvas');
        bandCanvas.width = FHD_WIDTH;
        bandCanvas.height = FHD_HEIGHT;
        const bandCtx = bandCanvas.getContext('2d');
        if (!bandCtx) throw new Error("No se pudo obtener el contexto 2D del canvas de banda.");

        const imageData = targetCtx.getImageData(0, 0, FHD_WIDTH, FHD_HEIGHT);
        const data = imageData.data;

        let bandIndex = 0; 
        if (outputType === 'jpeg-red') { bandIndex = 0; fileName = 'map_capture_esri_red_fhd.jpg'; }
        else if (outputType === 'jpeg-green') { bandIndex = 1; fileName = 'map_capture_esri_green_fhd.jpg'; }
        else { bandIndex = 2; fileName = 'map_capture_esri_blue_fhd.jpg'; } 

        const bandImageData = bandCtx.createImageData(FHD_WIDTH, FHD_HEIGHT);
        const bandData = bandImageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const bandValue = data[i + bandIndex];
          bandData[i] = bandValue;     
          bandData[i + 1] = bandValue; 
          bandData[i + 2] = bandValue; 
          bandData[i + 3] = data[i + 3]; 
        }
        bandCtx.putImageData(bandImageData, 0, 0);
        dataURL = bandCanvas.toDataURL('image/jpeg', jpegQuality);
      }
      
      triggerDownload(dataURL, fileName);
      toast({ description: `Captura (${outputType.replace('jpeg-','')}) descargada como ${fileName}.` });

    } catch (error: any) {
      console.error("Error durante la captura de mapa:", error);
      toast({ description: error.message || "Error al capturar el mapa.", variant: "destructive" });
    } finally {
      if (esriLayerNeedsToggle && esriOlLayer) {
        esriOlLayer.setVisible(false); 
      }
      if (previousActiveBaseLayerIdRef.current && 
          (!esriOlLayer || esriOlLayer.get('baseLayerId') !== previousActiveBaseLayerIdRef.current || esriLayerNeedsToggle) ) {
         mapInstance.getLayers().forEach(layer => {
            if (layer.get('isBaseLayer') && layer.get('baseLayerId') === previousActiveBaseLayerIdRef.current) {
                layer.setVisible(true);
                if (layer !== esriOlLayer) { 
                     mapInstance.render();
                }
            } else if (layer.get('isBaseLayer') && layer !== esriOlLayer && previousActiveBaseLayerIdRef.current !== layer.get('baseLayerId')) {
                if (layer.get('baseLayerId') !== esriSatelliteLayerDef.id) { 
                   layer.setVisible(false);
                }
            }
        });
      }
      setIsCapturing(false);
    }
  }, [mapRef, isCapturing, toast]);

  return { captureMap, isCapturing };
}

