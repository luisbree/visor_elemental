
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
  setIsWfsLoading: (isLoading: boolean) => void; // Added prop
}

export function useGeoServerLayers({ mapRef, isMapReady, addLayer, onLayerStateUpdate, setIsWfsLoading }: UseGeoServerLayersProps) {
  const [geoServerUrlInput, setGeoServerUrlInput] = useState<string>('http://www.minfra.gba.gob.ar/ambientales/geoserver');
  const [isLoadingGeoServerLayers, setIsLoadingGeoServerLayers] = useState<boolean>(false);

  const handleFetchGeoServerLayers = useCallback(async (): Promise<GeoServerDiscoveredLayer[]> => {
    if (!geoServerUrlInput.trim()) {
      toast({ description: "Por favor, ingrese la URL de GeoServer." });
      return [];
    }
    setIsLoadingGeoServerLayers(true);
    toast({ description: "Conectando a GeoServer..." });

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
        toast({ description: "No se encontraron capas publicadas en GeoServer o la estructura XML no es la esperada." });
      } else if (discovered.length > 0) {
        toast({ description: `${discovered.length} capas encontradas en GeoServer.` });
      }
      return discovered;

    } catch (error: any) {
      console.error("Error conectando a GeoServer:", error);
      toast({ description: error.message || "Ocurrió un error desconocido al conectar con GeoServer.", variant: "destructive" });
      return [];
    } finally {
      setIsLoadingGeoServerLayers(false);
    }
  }, [geoServerUrlInput, toast]);

  const handleAddGeoServerLayerToMap = useCallback((
    layerName: string,
    layerTitle: string,
    initialVisibility: boolean = true // Added initialVisibility parameter
  ) => {
    if (!isMapReady || !mapRef.current || !geoServerUrlInput.trim()) {
        if (initialVisibility) { // Only toast for user-initiated actions if map isn't ready
          toast({ description: "El mapa o la URL de GeoServer no están disponibles." });
        }
        return;
    }

    let geoserverBaseWmsUrl = geoServerUrlInput.trim();
    if (!geoserverBaseWmsUrl.toLowerCase().startsWith('http://') && !geoserverBaseWmsUrl.toLowerCase().startsWith('https://')) {
        geoserverBaseWmsUrl = 'http://' + geoserverBaseWmsUrl;
    }
    if (geoserverBaseWmsUrl.endsWith('/')) geoserverBaseWmsUrl = geoserverBaseWmsUrl.slice(0, -1);
    if (geoserverBaseWmsUrl.toLowerCase().endsWith('/web')) geoserverBaseWmsUrl = geoserverBaseWmsUrl.substring(0, geoserverBaseWmsUrl.length - '/web'.length);
    else if (geoserverBaseWmsUrl.toLowerCase().endsWith('/web/')) geoserverBaseWmsUrl = geoserverBaseWmsUrl.substring(0, geoserverBaseWmsUrl.length - '/web/'.length);
    
    // Ensure /wms is part of the URL structure, trying to be intelligent about common GeoServer setups
    if (!geoserverBaseWmsUrl.toLowerCase().includes('/wms')) {
        if (geoserverBaseWmsUrl.toLowerCase().includes('/geoserver')) {
            // URL might be http://host/geoserver
            geoserverBaseWmsUrl = `${geoserverBaseWmsUrl}/wms`;
        } else {
            // URL might be http://host or http://host/something_else
            geoserverBaseWmsUrl = `${geoserverBaseWmsUrl}/geoserver/wms`;
        }
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
      visible: initialVisibility, // Use initialVisibility
      isGeoServerLayer: true,
      originType: 'wms',
    });
    
    onLayerStateUpdate(layerName, true, 'wms'); // Update state in GeoServerLayerList

    if (initialVisibility) { // Only toast if layer is added visibly (user action)
        toast({ description: `Capa WMS "${layerTitle || layerName}" añadida al mapa.` });
    }
  }, [geoServerUrlInput, addLayer, mapRef, isMapReady, onLayerStateUpdate, toast]);

  const handleAddGeoServerLayerAsWFS = useCallback(async (layerName: string, layerTitle: string): Promise<void> => {
    if (!isMapReady || !mapRef.current || !geoServerUrlInput.trim()) {
      toast({ description: "El mapa o la URL de GeoServer no están disponibles.", variant: "destructive" });
      return;
    }
    
    setIsWfsLoading(true); 
    toast({ description: `Solicitando capa WFS "${layerTitle || layerName}"...` });

    try {
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
            wfsServiceUrl = `${wfsServiceUrl.includes('/geoserver') ? wfsServiceUrl : `${wfsServiceUrl}/geoserver`}/wfs`;
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

        const response = await fetch(proxyApiUrl);
        const contentType = response.headers.get('content-type');
        const responseBodyText = await response.text(); 

        if (!response.ok || (contentType && !contentType.toLowerCase().includes('application/json'))) {
            let errorMessage = `Error ${response.status} al obtener capa WFS.`;
            
            if (contentType?.toLowerCase().includes('xml') || responseBodyText.trim().startsWith('<')) {
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(responseBodyText, "text/xml");
                    const parserErrorNode = xmlDoc.querySelector("parsererror");
                    if (parserErrorNode) {
                        console.warn("XML parsing error by DOMParser:", parserErrorNode.textContent); 
                        errorMessage += ` (Error al interpretar XML: ${parserErrorNode.textContent?.substring(0,100) || 'Error de parseo'})`;
                    } else {
                        const exceptionNode = xmlDoc.querySelector("ServiceException, ExceptionText, ows\\:ExceptionText, ServiceExceptionReport ServiceException, ows\\:Exception");
                        const exceptionContent = exceptionNode?.textContent;
                        if (exceptionContent) {
                            errorMessage += ` Detalles: ${exceptionContent.trim()}`;
                        } else {
                            errorMessage += ` (XML no estándar: ${responseBodyText.substring(0,100)}${responseBodyText.length > 100 ? '...' : ''})`;
                        }
                    }
                } catch (e: any) {
                    console.warn("Error during manual XML parsing attempt:", e); 
                    errorMessage += ` (Error crítico al procesar XML: ${e.message})`;
                }
            } else if (contentType?.toLowerCase().includes('json')) { 
                try {
                    const errorJson = JSON.parse(responseBodyText);
                    if (errorJson.error?.message) errorMessage += ` Detalles: ${errorJson.error.message}`;
                    else if (errorJson.error) errorMessage += ` Detalles: ${errorJson.error}`;
                    else if (errorJson.message) errorMessage += ` Detalles: ${errorJson.message}`;
                    else errorMessage += ` Detalles: ${responseBodyText.substring(0, 200)}${responseBodyText.length > 200 ? '...' : ''}`;
                } catch {
                    errorMessage += ` Detalles (error al parsear JSON): ${responseBodyText.substring(0, 200)}${responseBodyText.length > 200 ? '...' : ''}`;
                }
            } else {
                errorMessage += ` Respuesta inesperada: ${responseBodyText.substring(0, 200)}${responseBodyText.length > 200 ? '...' : ''}`;
            }

            toast({ description: errorMessage, variant: "destructive" });
            return; 
        }

        const geojsonData = JSON.parse(responseBodyText) as GeoJSON.FeatureCollection;

        if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
            toast({ description: `La capa WFS "${layerTitle || layerName}" no contiene entidades o está vacía.` });
            return;
        }

        if (geojsonData.features.length > 1000) {
            toast({ description: `Cargando ${geojsonData.features.length} entidades WFS. Esto podría tomar un momento...` });
        }

        const olFeatures = new GeoJSONFormat().readFeatures(geojsonData, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
        });

        if (!olFeatures || olFeatures.length === 0) {
            toast({ description: "No se pudieron convertir las entidades GeoJSON a formato OpenLayers.", variant: "destructive"});
            return;
        }

        const vectorSource = new VectorSource({ features: olFeatures });
        const vectorLayer = new VectorLayer({ source: vectorSource, properties: { 'originalGeoServerName': layerName } });

        const mapLayerId = `geoserver-wfs-${layerName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}`;
        addLayer({
            id: mapLayerId,
            name: `${layerTitle || layerName} (WFS)`,
            olLayer: vectorLayer,
            visible: true, // WFS layers are typically added visibly for interaction
            isGeoServerLayer: true,
            originType: 'wfs',
        });
        onLayerStateUpdate(layerName, true, 'wfs');
        toast({ description: `Capa WFS "${layerTitle || layerName}" (${olFeatures.length} entidades) añadida.` });

    } catch (error: any) { 
      console.warn("Error cargando capa WFS (inesperado):", error);
      toast({ description: error.message || `Error desconocido al cargar capa WFS.`, variant: "destructive" });
    } finally {
        setIsWfsLoading(false); 
    }
  }, [geoServerUrlInput, addLayer, mapRef, isMapReady, onLayerStateUpdate, toast, setIsWfsLoading]);


  return {
    geoServerUrlInput,
    setGeoServerUrlInput,
    isLoadingGeoServerLayers,
    handleFetchGeoServerLayers,
    handleAddGeoServerLayerToMap, // WMS
    handleAddGeoServerLayerAsWFS, // WFS
  };
}

    