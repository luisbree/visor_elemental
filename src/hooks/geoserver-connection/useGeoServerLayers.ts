
"use client";

import { useState, useCallback } from 'react';
import type { Map as OLMap, Feature as OLFeature } from 'ol';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSONFormat from 'ol/format/GeoJSON';
import { toast } from "@/hooks/use-toast";
import type { MapLayer, GeoServerDiscoveredLayer } from '@/lib/types';
import type * as GeoJSON from 'geojson';

interface UseGeoServerLayersProps {
  mapRef: React.RefObject<OLMap | null>;
  isMapReady: boolean;
  addLayer: (layer: MapLayer) => void;
  onLayerStateUpdate: (layerName: string, added: boolean, type: 'wms' | 'wfs') => void;
}

export function useGeoServerLayers({ mapRef, isMapReady, addLayer, onLayerStateUpdate }: UseGeoServerLayersProps) {
  const [geoServerUrlInput, setGeoServerUrlInput] = useState<string>('');
  const [isLoadingGeoServerLayers, setIsLoadingGeoServerLayers] = useState<boolean>(false);

  const handleFetchGeoServerLayers = useCallback(async (): Promise<GeoServerDiscoveredLayer[]> => {
    if (!geoServerUrlInput.trim()) {
      setTimeout(() => {
        toast({ description: "Por favor, ingrese la URL de GeoServer." });
      }, 0);
      return [];
    }
    setIsLoadingGeoServerLayers(true);
    setTimeout(() => {
      toast({ description: "Conectando a GeoServer..." });
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
                    discovered.push({ name: nameElement.textContent, title: titleElement?.textContent || nameElement.textContent, wmsAddedToMap: false, wfsAddedToMap: false });
                }
            });
      } else {
          layerNodes.forEach(node => {
            const nameElement = node.querySelector("Name");
            const titleElement = node.querySelector("Title");
            if (nameElement && nameElement.textContent) {
              discovered.push({ name: nameElement.textContent, title: titleElement?.textContent || nameElement.textContent, wmsAddedToMap: false, wfsAddedToMap: false });
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
          toast({ description: "No se encontraron capas publicadas en GeoServer o la estructura XML no es la esperada." });
        }, 0);
      } else if (discovered.length > 0) {
        setTimeout(() => {
          toast({ description: `${discovered.length} capas encontradas en GeoServer.` });
        }, 0);
      }
      return discovered;

    } catch (error: any) {
      console.error("Error conectando a GeoServer:", error);
      setTimeout(() => {
        toast({ description: error.message || "Ocurrió un error desconocido al conectar con GeoServer." });
      }, 0);
      return [];
    } finally {
      setIsLoadingGeoServerLayers(false);
    }
  }, [geoServerUrlInput, toast]);

  const handleAddGeoServerLayerToMap = useCallback((layerName: string, layerTitle: string) => { // This is for WMS
    if (!isMapReady || !mapRef.current || !geoServerUrlInput.trim()) {
        setTimeout(() => {
          toast({ description: "El mapa o la URL de GeoServer no están disponibles." });
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
        geoserverBaseWmsUrl = geoserverBaseWmsUrl.includes('/geoserver') ? `${geoserverBaseWmsUrl}/wms` : `${geoserverBaseWmsUrl}/geoserver/wms`; // Ensure /geoserver/wms
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

    const mapLayerId = `geoserver-wms-${layerName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}`;
    addLayer({
      id: mapLayerId,
      name: `${layerTitle || layerName} (WMS)`,
      olLayer: newOlLayer,
      visible: true,
      isGeoServerLayer: true,
      originType: 'wms',
    });
    onLayerStateUpdate(layerName, true, 'wms'); 
    setTimeout(() => {
      toast({ description: `Capa WMS "${layerTitle || layerName}" añadida al mapa.` });
    }, 0);
  }, [geoServerUrlInput, addLayer, mapRef, isMapReady, onLayerStateUpdate, toast]);

  const handleAddGeoServerLayerAsWFS = useCallback(async (layerName: string, layerTitle: string) => {
    if (!isMapReady || !mapRef.current || !geoServerUrlInput.trim()) {
      setTimeout(() => {
        toast({ description: "El mapa o la URL de GeoServer no están disponibles." });
      }, 0);
      return;
    }
    setTimeout(() => {
      toast({ description: `Solicitando capa WFS "${layerTitle || layerName}"...` });
    }, 0);

    let geoserverBaseUrl = geoServerUrlInput.trim();
     if (!geoserverBaseUrl.toLowerCase().startsWith('http://') && !geoserverBaseUrl.toLowerCase().startsWith('https://')) {
        geoserverBaseUrl = 'http://' + geoserverBaseUrl;
    }
    if (geoserverBaseUrl.endsWith('/')) geoserverBaseUrl = geoserverBaseUrl.slice(0, -1);
    if (geoserverBaseUrl.toLowerCase().endsWith('/web')) geoserverBaseUrl = geoserverBaseUrl.substring(0, geoserverBaseUrl.length - '/web'.length);
    else if (geoserverBaseUrl.toLowerCase().endsWith('/web/')) geoserverBaseUrl = geoserverBaseUrl.substring(0, geoserverBaseUrl.length - '/web/'.length);

    const workspace = layerName.includes(':') ? layerName.split(':')[0] : undefined;
    let wfsServiceUrl = `${geoserverBaseUrl}`;
    if (workspace && !wfsServiceUrl.endsWith(`/${workspace}`) && !wfsServiceUrl.includes(`/${workspace}/`)) {
        if (wfsServiceUrl.endsWith('/geoserver')) {
             wfsServiceUrl = `${wfsServiceUrl}/${workspace}/wfs`;
        } else {
             wfsServiceUrl = `${wfsServiceUrl}/geoserver/${workspace}/wfs`;
        }
    } else if (!wfsServiceUrl.toLowerCase().endsWith('/wfs')) {
        wfsServiceUrl = `${wfsServiceUrl}/wfs`;
    }
    
    if (geoServerUrlInput.toLowerCase().includes('/wfs') && workspace && geoServerUrlInput.toLowerCase().includes(`/${workspace}/`)){
        wfsServiceUrl = geoServerUrlInput.endsWith('/wfs') ? geoServerUrlInput : `${geoServerUrlInput}/wfs`;
    }


    const params = new URLSearchParams({
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: layerName,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326'
    });
    const getFeatureUrl = `${wfsServiceUrl}?${params.toString()}`;
    const proxyApiUrl = `/api/geoserver-proxy?url=${encodeURIComponent(getFeatureUrl)}`;

    try {
      const response = await fetch(proxyApiUrl);
      const contentType = response.headers.get('content-type');

      if (!response.ok || (contentType && !contentType.toLowerCase().includes('application/json'))) {
        const errorText = await response.text();
        console.error("WFS GetFeature error from proxy:", errorText, {status: response.status, statusText: response.statusText, contentType});
        
        let errorMessage = `Error ${response.status} al obtener capa WFS.`;
        if (contentType?.toLowerCase().includes('xml') || errorText.trim().startsWith('<')) { 
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(errorText, "text/xml");
                const exceptionNode = xmlDoc.querySelector("ServiceException, ExceptionText, ows\\:ExceptionText, ServiceExceptionReport ServiceException");
                const exceptionContent = exceptionNode?.textContent;
                if (exceptionContent) errorMessage += ` Detalles: ${exceptionContent.trim()}`;
                else errorMessage += ` Detalles: ${errorText.substring(0,200)}${errorText.length > 200 ? '...' : '' } (Respuesta XML no estándar)`;
            } catch (e) {
                 errorMessage += ` Detalles (error al parsear XML): ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`;
            }
        } else if (contentType?.toLowerCase().includes('json')) { // Should be an error JSON
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) errorMessage += ` Detalles: ${errorJson.error.message}`;
                else if (errorJson.error) errorMessage += ` Detalles: ${errorJson.error}`;
                else if (errorJson.message) errorMessage += ` Detalles: ${errorJson.message}`;
                else errorMessage += ` Detalles: ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`;
            } catch { 
                errorMessage += ` Detalles (error al parsear JSON): ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`;
            }
        } else {
             errorMessage += ` Respuesta inesperada del servidor: ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`;
        }
        throw new Error(errorMessage);
      }

      const geojsonData = await response.json() as GeoJSON.FeatureCollection;

      if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
        setTimeout(() => {
          toast({ description: `La capa WFS "${layerTitle || layerName}" no contiene entidades o está vacía.` });
        }, 0);
        return;
      }
      
      setTimeout(() => {
        if (geojsonData.features.length > 1000) {
             toast({ description: `Cargando ${geojsonData.features.length} entidades WFS. Esto podría tomar un momento...` });
        }
      },0);

      const olFeatures = new GeoJSONFormat().readFeatures(geojsonData, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });

      if (!olFeatures || olFeatures.length === 0) {
          throw new Error("No se pudieron convertir las entidades GeoJSON a formato OpenLayers.");
      }

      const vectorSource = new VectorSource({ features: olFeatures });
      const vectorLayer = new VectorLayer({ source: vectorSource });
      
      const mapLayerId = `geoserver-wfs-${layerName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}`;
      addLayer({
        id: mapLayerId,
        name: `${layerTitle || layerName} (WFS)`,
        olLayer: vectorLayer,
        visible: true,
        isGeoServerLayer: true,
        originType: 'wfs',
      });
      onLayerStateUpdate(layerName, true, 'wfs');
      setTimeout(() => {
        toast({ description: `Capa WFS "${layerTitle || layerName}" (${olFeatures.length} entidades) añadida.` });
      }, 0);

    } catch (error: any) {
      console.error("Error cargando capa WFS:", error);
      setTimeout(() => {
        toast({ description: error.message || `Error desconocido al cargar capa WFS.` });
      }, 0);
    }
  }, [geoServerUrlInput, addLayer, mapRef, isMapReady, onLayerStateUpdate, toast]);


  return {
    geoServerUrlInput,
    setGeoServerUrlInput,
    isLoadingGeoServerLayers,
    handleFetchGeoServerLayers,
    handleAddGeoServerLayerToMap, // WMS
    handleAddGeoServerLayerAsWFS, // WFS
  };
}

    