
"use client";

import { useState, useCallback } from 'react';
import type { Map as OLMap } from 'ol';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import { toast } from "@/hooks/use-toast";
import type { MapLayer, GeoServerDiscoveredLayer } from '@/lib/types';

interface UseGeoServerLayersProps {
  mapRef: React.RefObject<OLMap | null>;
  isMapReady: boolean;
  addLayer: (layer: MapLayer) => void; // from useLayerManager
  onLayerStateUpdate: (layerName: string, added: boolean) => void; // Callback to update GeoServerDiscoveredLayer's addedToMap state
}

export function useGeoServerLayers({ mapRef, isMapReady, addLayer, onLayerStateUpdate }: UseGeoServerLayersProps) {
  const [geoServerUrlInput, setGeoServerUrlInput] = useState<string>('');
  const [isLoadingGeoServerLayers, setIsLoadingGeoServerLayers] = useState<boolean>(false);

  const handleFetchGeoServerLayers = useCallback(async (): Promise<GeoServerDiscoveredLayer[]> => {
    if (!geoServerUrlInput.trim()) {
      setTimeout(() => {
        toast("Por favor, ingrese la URL de GeoServer.");
      }, 0);
      return [];
    }
    setIsLoadingGeoServerLayers(true);
    setTimeout(() => {
      toast("Conectando a GeoServer...");
    }, 0);

    try {
      let url = geoServerUrlInput.trim();
      if (!url.toLowerCase().startsWith('http://') && !url.toLowerCase().startsWith('https://')) {
        url = 'http://' + url;
      }
      if (url.endsWith('/')) url = url.slice(0, -1);
      if (url.toLowerCase().endsWith('/web')) url = url.substring(0, url.length - '/web'.length);
      else if (url.toLowerCase().endsWith('/web/')) url = url.substring(0, url.length - '/web/'.length);
      
      const capabilitiesUrl = `${url}/wms?service=WMS&version=1.3.0&request=GetCapabilities`;
      const proxyApiUrl = `/api/geoserver-proxy?url=${encodeURIComponent(capabilitiesUrl)}`;
      const response = await fetch(proxyApiUrl);

      if (!response.ok) {
         const errorData = await response.json().catch(() => ({
           error: "Error desconocido del proxy o respuesta no JSON",
           details: `Proxy status: ${response.status} ${response.statusText}`
         }));
         console.error("Error desde el proxy de GeoServer:", errorData, "Status:", response.status, response.statusText);
         throw new Error(errorData.error || `Error al obtener capacidades vía proxy: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      
      const errorNode = xmlDoc.querySelector("ServiceExceptionReport ServiceException, ServiceExceptionReport > ServiceException");
      if (errorNode) {
        console.error("GeoServer ServiceException:", errorNode.textContent);
        throw new Error(`Error de GeoServer: ${errorNode.textContent || 'Error desconocido en la respuesta XML de GeoServer.'}`);
      }
      const exceptionTextNode = xmlDoc.querySelector("ExceptionText");
      if(exceptionTextNode && exceptionTextNode.textContent?.trim()) {
        console.error("GeoServer ExceptionText:", exceptionTextNode.textContent);
        throw new Error(`Error de GeoServer: ${exceptionTextNode.textContent.trim()}`);
      }

      const discovered: GeoServerDiscoveredLayer[] = [];
      const layerNodes = xmlDoc.querySelectorAll("Capability > Layer > Layer, WMS_Capabilities > Capability > Layer > Layer");
      
      if (layerNodes.length === 0) {
           const topLayerNodes = xmlDoc.querySelectorAll("Capability > Layer");
            topLayerNodes.forEach(node => {
                 const nameElement = node.querySelector("Name");
                const titleElement = node.querySelector("Title");
                if (nameElement && nameElement.textContent) {
                    discovered.push({ name: nameElement.textContent, title: titleElement?.textContent || nameElement.textContent, addedToMap: false });
                }
            });
      } else {
          layerNodes.forEach(node => {
            const nameElement = node.querySelector("Name");
            const titleElement = node.querySelector("Title");
            if (nameElement && nameElement.textContent) {
              discovered.push({ name: nameElement.textContent, title: titleElement?.textContent || nameElement.textContent, addedToMap: false });
            }
          });
      }

      if (discovered.length === 0 && !errorNode && !exceptionTextNode) {
        const ogcExceptionNode = xmlDoc.querySelector("ows\\:ExceptionText");
        if (ogcExceptionNode && ogcExceptionNode.textContent) {
             console.error("GeoServer OGC Exception:", ogcExceptionNode.textContent);
             throw new Error(`Error de GeoServer (OGC): ${ogcExceptionNode.textContent}`);
        }
        setTimeout(() => {
          toast("No se encontraron capas publicadas en GeoServer o la estructura XML no es la esperada.");
        }, 0);
      } else if (discovered.length > 0) {
        setTimeout(() => {
          toast(`${discovered.length} capas encontradas en GeoServer.`);
        }, 0);
      }
      return discovered;

    } catch (error: any) {
      console.error("Error conectando a GeoServer:", error);
      setTimeout(() => {
        toast(error.message || "Ocurrió un error desconocido al conectar con GeoServer.");
      }, 0);
      return [];
    } finally {
      setIsLoadingGeoServerLayers(false);
    }
  }, [geoServerUrlInput, toast]);

  const handleAddGeoServerLayerToMap = useCallback((layerName: string, layerTitle: string) => {
    if (!isMapReady || !mapRef.current || !geoServerUrlInput.trim()) {
        setTimeout(() => {
          toast("El mapa o la URL de GeoServer no están disponibles.");
        }, 0);
        return;
    }

    let geoserverBaseWmsUrl = geoServerUrlInput.trim();
    if (!geoserverBaseWmsUrl.toLowerCase().startsWith('http://') && !geoserverBaseWmsUrl.toLowerCase().startsWith('https://')) {
        geoserverBaseWmsUrl = 'http://' + geoserverBaseWmsUrl;
    }
    if (geoserverBaseWmsUrl.endsWith('/')) geoserverBaseWmsUrl = geoserverBaseWmsUrl.slice(0, -1);
    if (geoserverBaseWmsUrl.toLowerCase().endsWith('/web')) geoserverBaseWmsUrl = geoserverBaseWmsUrl.substring(0, geoserverBaseWmsUrl.length - '/web'.length);
    else if (geoserverBaseWmsUrl.toLowerCase().endsWith('/web/')) geoserverBaseWmsUrl = geoserverBaseWmsUrl.substring(0, geoserverBaseWmsUrl.length - '/web/'.length);
    if (!geoserverBaseWmsUrl.toLowerCase().endsWith('/wms')) {
        geoserverBaseWmsUrl = geoserverBaseWmsUrl.includes('/geoserver') ? `${geoserverBaseWmsUrl}/wms` : `${geoserverBaseWmsUrl}/wms`;
    }
    
    const wmsSource = new TileWMS({
        url: geoserverBaseWmsUrl,
        params: { 'LAYERS': layerName, 'TILED': true },
        serverType: 'geoserver',
        transition: 0,
    });

    const newOlLayer = new TileLayer({
        source: wmsSource,
        properties: { 'title': layerTitle } 
    });

    const mapLayerId = `geoserver-${layerName}-${Date.now()}`;
    addLayer({
      id: mapLayerId,
      name: layerTitle || layerName,
      olLayer: newOlLayer,
      visible: true,
      isGeoServerLayer: true,
    });
    onLayerStateUpdate(layerName, true); 
    setTimeout(() => {
      toast(`Capa "${layerTitle || layerName}" añadida al mapa.`);
    }, 0);

  }, [geoServerUrlInput, addLayer, mapRef, isMapReady, onLayerStateUpdate, toast]);

  return {
    geoServerUrlInput,
    setGeoServerUrlInput,
    isLoadingGeoServerLayers,
    handleFetchGeoServerLayers,
    handleAddGeoServerLayerToMap,
  };
}
