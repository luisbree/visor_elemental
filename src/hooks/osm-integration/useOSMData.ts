
"use client";

import { useState, useCallback, useRef } from 'react';
import type { Feature as OLFeature } from 'ol';
import type VectorSourceType from 'ol/source/Vector';
import { transformExtent } from 'ol/proj';
import osmtogeojson from 'osmtogeojson';
import { GeoJSON as GeoJSONFormat, KML } from 'ol/format'; // Renamed GeoJSON to GeoJSONFormat to avoid conflict
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import shpwrite from 'shp-write'; // For SHP export
import { toast } from "@/hooks/use-toast";
import type { MapLayer, OSMCategoryConfig } from '@/lib/types';
import type * as GeoJSON from 'geojson'; // Import GeoJSON types for better type safety

// Helper function for downloads
function triggerDownload(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function triggerDownloadArrayBuffer(content: ArrayBuffer, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

interface UseOSMDataProps {
  drawingSourceRef: React.RefObject<VectorSourceType<OLFeature<any>> | null>;
  addLayer: (layer: MapLayer) => void; // from useLayerManager
  osmCategoryConfigs: OSMCategoryConfig[]; // Pass the full config array
}

export function useOSMData({ drawingSourceRef, addLayer, osmCategoryConfigs }: UseOSMDataProps) {
  const [isFetchingOSM, setIsFetchingOSM] = useState(false);
  const [selectedOSMCategoryIds, setSelectedOSMCategoryIds] = useState<string[]>([]);
  const [downloadFormat, setDownloadFormat] = useState<string>('geojson');
  const [isDownloading, setIsDownloading] = useState(false);

  const selectedOSMCategoryIdsRef = useRef(selectedOSMCategoryIds);
  selectedOSMCategoryIdsRef.current = selectedOSMCategoryIds;


  const fetchOSMData = useCallback(async () => {
    if (!drawingSourceRef.current) {
        toast("La capa de dibujo no está inicializada.");
        return;
    }
    const drawnFeatures = drawingSourceRef.current.getFeatures();
    if (drawnFeatures.length === 0) {
        toast("Por favor, dibuje una entidad en el mapa primero.");
        return;
    }
    const lastDrawnFeature = drawnFeatures[drawnFeatures.length - 1];

    if (selectedOSMCategoryIdsRef.current.length === 0) {
        toast("Por favor, seleccione al menos una categoría OSM para descargar.");
        return;
    }

    const geometry = lastDrawnFeature.getGeometry();
    if (!geometry || geometry.getType() !== 'Polygon') {
        toast("La descarga de datos OSM requiere un polígono dibujado. Por favor, dibuje un polígono.");
        return;
    }

    setIsFetchingOSM(true);
    toast("Descargando datos de OpenStreetMap...");

    try {
      const extent3857 = geometry.getExtent();
      if (!extent3857 || extent3857.some(val => !isFinite(val)) || (extent3857[2] - extent3857[0] <= 0 && extent3857[2] !== extent3857[0]) || (extent3857[3] - extent3857[1] <= 0 && extent3857[3] !== extent3857[1])) {
          throw new Error(`Área dibujada tiene una extensión inválida (inválida o puntos/líneas). Extent: ${extent3857.join(', ')}`);
      }

      const extent4326_transformed = transformExtent(extent3857, 'EPSG:3857', 'EPSG:4326');
      if (!extent4326_transformed || extent4326_transformed.some(val => !isFinite(val))) {
          throw new Error("Fallo al transformar área dibujada a coordenadas geográficas válidas.");
      }
      
      const s_coord = parseFloat(extent4326_transformed[1].toFixed(6));
      const w_coord = parseFloat(extent4326_transformed[0].toFixed(6));
      const n_coord = parseFloat(extent4326_transformed[3].toFixed(6));
      const e_coord = parseFloat(extent4326_transformed[2].toFixed(6));

      if (n_coord < s_coord) {
          throw new Error(`Error de Bounding Box (N < S): Norte ${n_coord} es menor que Sur ${s_coord}. BBox original: ${extent4326_transformed.join(', ')}`);
      }
      if (e_coord < w_coord && Math.abs(e_coord - w_coord) < 180) { // Check for anti-meridian crossing for small extents
          throw new Error(`Error de Bounding Box (E < W): Este ${e_coord} es menor que Oeste ${w_coord} (sin cruzar anti-meridiano). BBox original: ${extent4326_transformed.join(', ')}`);
      }
      
      const bboxStr = `${s_coord},${w_coord},${n_coord},${e_coord}`;

      let queryParts: string[] = [];
      const categoriesToFetch = osmCategoryConfigs.filter(cat => selectedOSMCategoryIdsRef.current.includes(cat.id));

      categoriesToFetch.forEach(cat => {
        queryParts.push(cat.overpassQueryFragment(bboxStr));
      });

      const overpassQuery = `
        [out:json][timeout:90];
        (
          ${queryParts.join('\n          ')}
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Overpass API error details:", errorBody);
        throw new Error(`Error Overpass API: ${response.status} ${response.statusText}`);
      }

      const osmData = await response.json();
      const geojsonData = osmtogeojson(osmData) as GeoJSON.FeatureCollection; // Cast to typed GeoJSON

      let featuresAddedCount = 0;
      categoriesToFetch.forEach(category => {
        const categoryFeaturesGeoJSON: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: geojsonData.features.filter((feature: GeoJSON.Feature) => category.matcher(feature.properties))
        };

        if (categoryFeaturesGeoJSON.features.length > 0) {
          const olFeatures = new GeoJSONFormat().readFeatures(categoryFeaturesGeoJSON, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });

          if (olFeatures && olFeatures.length > 0) {
            const vectorSource = new VectorSource({ features: olFeatures });
            const vectorLayer = new VectorLayer({
              source: vectorSource,
              style: category.style // Apply category-specific style
            });
            const layerId = `osm-${category.id}-${Date.now()}`;
            addLayer({ id: layerId, name: `${category.name} (${olFeatures.length})`, olLayer: vectorLayer, visible: true });
            featuresAddedCount += olFeatures.length;
          }
        }
      });

      if (featuresAddedCount > 0) {
        toast(`${featuresAddedCount} entidades OSM añadidas al mapa.`);
      } else {
        toast("Ninguna entidad OSM coincidió con sus criterios en el área seleccionada.");
      }

    } catch (error: any) {
      console.error("Error en fetchOSMData (procesamiento o API):", error);
      toast(error.message || "Ocurrió un error desconocido obteniendo datos OSM.");
    } finally {
      setIsFetchingOSM(false);
    }
  }, [drawingSourceRef, addLayer, osmCategoryConfigs]);

  const handleDownloadOSMLayers = useCallback(async (layersToDownload: MapLayer[]) => {
    setIsDownloading(true);
    toast(`Procesando descarga: ${downloadFormat.toUpperCase()}...`);

    const osmLayers = layersToDownload.filter(layer => layer.id.startsWith('osm-') && layer.olLayer instanceof VectorLayer);
    if (osmLayers.length === 0) {
      toast("No hay capas OSM (vectoriales) para descargar.");
      setIsDownloading(false);
      return;
    }

    const olGeoJsonFormatter = new GeoJSONFormat();

    try {
      if (downloadFormat === 'geojson') {
        const allFeatures: OLFeature<any>[] = [];
        osmLayers.forEach(layer => {
          const source = (layer.olLayer as VectorLayer<VectorSource<OLFeature<any>>>).getSource();
          if (source) allFeatures.push(...source.getFeatures());
        });
        if (allFeatures.length === 0) throw new Error("No hay entidades en las capas OSM seleccionadas.");
        const geojsonString = olGeoJsonFormatter.writeFeatures(allFeatures, {
          dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857',
          featureProperties: (feature: OLFeature<any>) => {
            const props = { ...feature.getProperties() };
            delete props[feature.getGeometryName() as string]; return props;
          }
        });
        triggerDownload(geojsonString, 'osm_data.geojson', 'application/geo+json;charset=utf-8');
        toast("Entidades OSM descargadas como GeoJSON.");

      } else if (downloadFormat === 'kml') {
        const allFeatures: OLFeature<any>[] = [];
        osmLayers.forEach(layer => {
            const source = (layer.olLayer as VectorLayer<VectorSource<OLFeature<any>>>).getSource();
            if (source) allFeatures.push(...source.getFeatures());
        });
        if (allFeatures.length === 0) throw new Error("No hay entidades en las capas OSM seleccionadas.");
        const kmlString = new KML().writeFeatures(allFeatures, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
        triggerDownload(kmlString, 'osm_data.kml', 'application/vnd.google-earth.kml+xml;charset=utf-8');
        toast("Entidades OSM descargadas como KML.");

      } else if (downloadFormat === 'shp') {
        const geoJsonDataForShpExport: { [fileName: string]: GeoJSON.FeatureCollection } = {};
        const typesForShpExport: { [fileName: string]: 'point' | 'line' | 'polygon' } = {};
        let featuresFoundForShp = false;

        const sanitizeProperties = (olFeature: OLFeature<any>): Record<string, any> => {
          const props = { ...olFeature.getProperties() };
          delete props[olFeature.getGeometryName() as string];
          const sanitizedProps: Record<string, any> = {};
          for (const key in props) {
            let sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 10);
            if(sanitizedKey.length === 0) sanitizedKey = `prop${Object.keys(sanitizedProps).length}`;
            let counter = 0; let finalKey = sanitizedKey;
            while(Object.prototype.hasOwnProperty.call(sanitizedProps, finalKey)) { // Ensure unique key
                counter++; finalKey = `${sanitizedKey.substring(0, 10 - String(counter).length)}${counter}`;
            }
            sanitizedProps[finalKey] = props[key];
          }
          return sanitizedProps;
        };

        osmLayers.forEach(layer => {
            const source = (layer.olLayer as VectorLayer<VectorSource<OLFeature<any>>>).getSource();
            const olFeatures = source ? source.getFeatures() : [];

            if (olFeatures.length > 0) {
                const baseLayerFileName = layer.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/\s+/g, '_');
                
                const points: GeoJSON.Feature[] = [];
                const lines: GeoJSON.Feature[] = [];
                const polygons: GeoJSON.Feature[] = [];

                olFeatures.forEach(olFeature => {
                    const geoJsonFeature = olGeoJsonFormatter.writeFeatureObject(olFeature, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    }) as GeoJSON.Feature;
                    geoJsonFeature.properties = sanitizeProperties(olFeature);

                    const geomType = geoJsonFeature.geometry?.type;
                    if (geomType === 'Point' || geomType === 'MultiPoint') {
                        points.push(geoJsonFeature);
                    } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                        lines.push(geoJsonFeature);
                    } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                        polygons.push(geoJsonFeature);
                    }
                });

                if (points.length > 0) {
                    const fileName = `${baseLayerFileName}_points`;
                    geoJsonDataForShpExport[fileName] = { type: "FeatureCollection", features: points };
                    typesForShpExport[fileName] = 'point';
                    featuresFoundForShp = true;
                }
                if (lines.length > 0) {
                    const fileName = `${baseLayerFileName}_lines`;
                    geoJsonDataForShpExport[fileName] = { type: "FeatureCollection", features: lines };
                    typesForShpExport[fileName] = 'line';
                    featuresFoundForShp = true;
                }
                if (polygons.length > 0) {
                    const fileName = `${baseLayerFileName}_polygons`;
                    geoJsonDataForShpExport[fileName] = { type: "FeatureCollection", features: polygons };
                    typesForShpExport[fileName] = 'polygon';
                    featuresFoundForShp = true;
                }
            }
        });

        if (!featuresFoundForShp) {
          throw new Error("No hay entidades en las capas OSM para exportar como Shapefile.");
        }
        
        // Defensive check for FeatureCollection structure
        for (const fileNameKey in geoJsonDataForShpExport) {
            if (Object.prototype.hasOwnProperty.call(geoJsonDataForShpExport, fileNameKey)) {
                const fc = geoJsonDataForShpExport[fileNameKey];
                if (!fc || typeof fc !== 'object' || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
                    console.error(`Estructura de FeatureCollection incorrecta para ${fileNameKey}:`, fc);
                    toast(`Error interno: Datos malformados para la capa de exportación '${fileNameKey}'. Falta la matriz 'features'.`);
                    setIsDownloading(false);
                    return; 
                }
            }
        }
        
        const shpWriteOptions = { folder: 'shapefiles_osm', types: typesForShpExport };
        const zipContentBase64 = await shpwrite.zip(geoJsonDataForShpExport, shpWriteOptions);
        const byteString = atob(zipContentBase64);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteString.length; i++) uint8Array[i] = byteString.charCodeAt(i);
        triggerDownloadArrayBuffer(arrayBuffer, 'osm_shapefiles.zip', 'application/zip');
        toast("Entidades OSM descargadas como Shapefile (ZIP).");
      }
    } catch (error: any) {
      console.error("Error descargando capas OSM:", error);
      toast(error.message || "No se pudieron descargar las capas.");
    } finally {
      setIsDownloading(false);
    }
  }, [downloadFormat]);


  return {
    isFetchingOSM,
    selectedOSMCategoryIds,
    setSelectedOSMCategoryIds,
    fetchOSMData,
    downloadFormat,
    setDownloadFormat,
    isDownloading,
    handleDownloadOSMLayers,
  };
}
