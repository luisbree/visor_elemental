
"use client";

import { useState, useCallback, useRef } from 'react';
import type { Feature as OLFeature } from 'ol';
import type VectorSourceType from 'ol/source/Vector';
import { transformExtent } from 'ol/proj';
import osmtogeojson from 'osmtogeojson';
import { GeoJSON as GeoJSONFormat, KML } from 'ol/format'; 
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import shpwrite from 'shp-write'; 
import { toast } from "@/hooks/use-toast";
import type { MapLayer, OSMCategoryConfig } from '@/lib/types';
import type * as GeoJSON from 'geojson'; 

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
  addLayer: (layer: MapLayer) => void; 
  osmCategoryConfigs: OSMCategoryConfig[]; 
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
        setTimeout(() => {
          toast("La capa de dibujo no está inicializada.");
        }, 0);
        return;
    }
    const drawnFeatures = drawingSourceRef.current.getFeatures();
    if (drawnFeatures.length === 0) {
        setTimeout(() => {
          toast("Por favor, dibuje una entidad en el mapa primero.");
        }, 0);
        return;
    }
    const lastDrawnFeature = drawnFeatures[drawnFeatures.length - 1];

    if (selectedOSMCategoryIdsRef.current.length === 0) {
        setTimeout(() => {
          toast("Por favor, seleccione al menos una categoría OSM para descargar.");
        }, 0);
        return;
    }

    const geometry = lastDrawnFeature.getGeometry();
    if (!geometry || geometry.getType() !== 'Polygon') {
        setTimeout(() => {
          toast("La descarga de datos OSM requiere un polígono dibujado. Por favor, dibuje un polígono.");
        }, 0);
        return;
    }

    setIsFetchingOSM(true);
    setTimeout(() => {
      toast("Descargando datos de OpenStreetMap...");
    }, 0);

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
      if (e_coord < w_coord && Math.abs(e_coord - w_coord) < 180) { 
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
      const geojsonData = osmtogeojson(osmData) as GeoJSON.FeatureCollection; 

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
              style: category.style 
            });
            const layerId = `osm-${category.id}-${Date.now()}`;
            addLayer({ id: layerId, name: `${category.name} (${olFeatures.length})`, olLayer: vectorLayer, visible: true });
            featuresAddedCount += olFeatures.length;
          }
        }
      });

      if (featuresAddedCount > 0) {
        setTimeout(() => {
          toast(`${featuresAddedCount} entidades OSM añadidas al mapa.`);
        }, 0);
      } else {
        setTimeout(() => {
          toast("Ninguna entidad OSM coincidió con sus criterios en el área seleccionada.");
        }, 0);
      }

    } catch (error: any) {
      console.error("Error en fetchOSMData (procesamiento o API):", error);
      setTimeout(() => {
        toast(error.message || "Ocurrió un error desconocido obteniendo datos OSM.");
      }, 0);
    } finally {
      setIsFetchingOSM(false);
    }
  }, [drawingSourceRef, addLayer, osmCategoryConfigs, toast]);

  const handleDownloadOSMLayers = useCallback(async (layersToDownload: MapLayer[]) => {
    setIsDownloading(true);
    setTimeout(() => {
      toast(`Procesando descarga: ${downloadFormat.toUpperCase()}...`);
    }, 0);

    const osmLayers = layersToDownload.filter(layer => layer.id.startsWith('osm-') && layer.olLayer instanceof VectorLayer);
    if (osmLayers.length === 0) {
      setTimeout(() => {
        toast("No hay capas OSM (vectoriales) para descargar.");
      }, 0);
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
        setTimeout(() => {
          toast("Entidades OSM descargadas como GeoJSON.");
        }, 0);

      } else if (downloadFormat === 'kml') {
        const allFeatures: OLFeature<any>[] = [];
        osmLayers.forEach(layer => {
            const source = (layer.olLayer as VectorLayer<VectorSource<OLFeature<any>>>).getSource();
            if (source) allFeatures.push(...source.getFeatures());
        });
        if (allFeatures.length === 0) throw new Error("No hay entidades en las capas OSM seleccionadas.");
        const kmlString = new KML().writeFeatures(allFeatures, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
        triggerDownload(kmlString, 'osm_data.kml', 'application/vnd.google-earth.kml+xml;charset=utf-8');
        setTimeout(() => {
          toast("Entidades OSM descargadas como KML.");
        }, 0);

      } else if (downloadFormat === 'shp') {
        const geoJsonDataForShpExport: { [fileName: string]: GeoJSON.FeatureCollection } = {};
        const typesForShpExport: { [fileName: string]: 'POINT' | 'POLYLINE' | 'POLYGON' } = {};
        let featuresFoundForShp = false;

        const sanitizeProperties = (olFeature: OLFeature<any>): Record<string, any> => {
          const originalProps = olFeature.getProperties();
          const sanitizedProps: Record<string, any> = {};
          const geometryName = olFeature.getGeometryName();
          let keyCounter = 0; 

          for (const key in originalProps) {
            if (Object.prototype.hasOwnProperty.call(originalProps, key) && key !== geometryName) {
              let value = originalProps[key];
              let sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 10);

              if (sanitizedKey.length === 0) sanitizedKey = `prop${keyCounter++}`;
              
              let baseKey = sanitizedKey;
              let counter = 0;
              while (Object.prototype.hasOwnProperty.call(sanitizedProps, sanitizedKey)) {
                  counter++;
                  const availableLength = 10 - String(counter).length;
                  if (availableLength <= 0) {
                     baseKey = "prop"; // fallback further
                     sanitizedKey = `${baseKey.substring(0, Math.max(1, 10 - String(counter).length))}${counter}`;
                     if(Object.prototype.hasOwnProperty.call(sanitizedProps, sanitizedKey)) { // Extremely unlikely collision
                        sanitizedKey = `p${Date.now().toString().slice(-3)}${counter}`; // even more unique
                     }
                     break; 
                  }
                  baseKey = baseKey.substring(0, availableLength);
                  sanitizedKey = `${baseKey}${counter}`;
              }
              
              if (value === null || value === undefined) {
                value = ""; 
              } else if (typeof value === 'boolean') {
                value = value ? "T" : "F"; 
              } else if (typeof value === 'object' || Array.isArray(value)) {
                try {
                  value = JSON.stringify(value);
                } catch (e) { value = "SerializationError"; }
              }
              
              if (typeof value === 'string' && value.length > 254) {
                value = value.substring(0, 254);
              }
              sanitizedProps[sanitizedKey] = value;
            }
          }
          return sanitizedProps;
        };


        osmLayers.forEach(layer => {
            const source = (layer.olLayer as VectorLayer<VectorSource<OLFeature<any>>>).getSource();
            const olFeatures = source ? source.getFeatures() : [];

            if (olFeatures.length > 0) {
                const baseLayerFileName = layer.name.replace(/[^\w-]/g, '_').replace(/\s+/g, '_').substring(0, 50); 
                
                const points: GeoJSON.Feature[] = [];
                const lines: GeoJSON.Feature[] = [];
                const polygons: GeoJSON.Feature[] = [];

                olFeatures.forEach(olFeature => {
                    const olGeometry = olFeature.getGeometry();
                    if (!olGeometry) {
                        console.warn(`Skipping feature with null OpenLayers geometry in layer ${layer.name}. Feature ID: ${olFeature.getId()}`);
                        return; 
                    }
                    
                    const geoJsonGeometry = JSON.parse(new GeoJSONFormat().writeGeometry(olGeometry.clone().transform('EPSG:3857', 'EPSG:4326'))) as GeoJSON.Geometry;

                    if (!geoJsonGeometry) {
                        console.warn(`Skipping feature with null GeoJSON geometry after transformation in layer ${layer.name}. Feature ID: ${olFeature.getId()}`);
                        return;
                    }
                    
                    const geoJsonFeature: GeoJSON.Feature = {
                        type: "Feature",
                        geometry: geoJsonGeometry,
                        properties: sanitizeProperties(olFeature)
                    };
                    
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
                    typesForShpExport[fileName] = 'POINT';
                    featuresFoundForShp = true;
                }
                if (lines.length > 0) {
                    const fileName = `${baseLayerFileName}_lines`;
                    geoJsonDataForShpExport[fileName] = { type: "FeatureCollection", features: lines };
                    typesForShpExport[fileName] = 'POLYLINE';
                    featuresFoundForShp = true;
                }
                if (polygons.length > 0) {
                    const fileName = `${baseLayerFileName}_polygons`;
                    geoJsonDataForShpExport[fileName] = { type: "FeatureCollection", features: polygons };
                    typesForShpExport[fileName] = 'POLYGON';
                    featuresFoundForShp = true;
                }
            }
        });

        if (!featuresFoundForShp) {
          throw new Error("No se encontraron entidades válidas en las capas OSM para exportar como Shapefile después de filtrar geometrías nulas.");
        }
        
        for (const fileNameKey in geoJsonDataForShpExport) {
            if (Object.prototype.hasOwnProperty.call(geoJsonDataForShpExport, fileNameKey)) {
                const fc = geoJsonDataForShpExport[fileNameKey];
                if (!fc || typeof fc !== 'object' || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
                    console.error(`Estructura de FeatureCollection incorrecta para ${fileNameKey}:`, fc);
                     setTimeout(() => {
                        toast(`Error interno: Datos malformados para la capa de exportación '${fileNameKey}'.`);
                    }, 0);
                    setIsDownloading(false);
                    return; 
                }
                 if (fc.features.length === 0) { 
                    delete geoJsonDataForShpExport[fileNameKey]; 
                    delete typesForShpExport[fileNameKey]; 
                }
            }
        }
        
        if (Object.keys(geoJsonDataForShpExport).length === 0) {
            throw new Error("No hay FeatureCollections con entidades para exportar a Shapefile después de procesar y filtrar vacías.");
        }
        
        const shpWriteOptions = { folder: 'shapefiles_osm', types: typesForShpExport };
        const zipContentBase64 = await shpwrite.zip(geoJsonDataForShpExport, shpWriteOptions);
        const byteString = atob(zipContentBase64);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteString.length; i++) uint8Array[i] = byteString.charCodeAt(i);
        triggerDownloadArrayBuffer(arrayBuffer, 'osm_shapefiles.zip', 'application/zip');
        setTimeout(() => {
          toast("Entidades OSM descargadas como Shapefile (ZIP).");
        }, 0);
      }
    } catch (error: any) {
      console.error("Error descargando capas OSM:", error);
      setTimeout(() => {
        toast(error.message || "No se pudieron descargar las capas.");
      }, 0);
    } finally {
      setIsDownloading(false);
    }
  }, [downloadFormat, toast]);


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
