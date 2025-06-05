
"use client";

import type { Feature as OLFeature } from 'ol';
import JSZip from 'jszip';
import shpjs from 'shpjs';
import type { GeoJSON as GeoJSONFormatType } from 'ol/format';
import type KMLFormatType from 'ol/format/KML';
import type VectorSourceType from 'ol/source/Vector';
import type VectorLayerType from 'ol/layer/Vector';

import type { MapLayer } from '@/lib/types';
import type { ToastSignature } from '@/hooks/use-toast'; // Assuming useToast exports its signature

interface FileUploadOptions {
  selectedFile: File | null;
  selectedMultipleFiles: FileList | null;
  onAddLayer: (layer: MapLayer) => void;
  toast: ToastSignature; // Or the specific type from your useToast hook
  uniqueIdPrefix?: string;
}

export async function handleFileUpload({
  selectedFile,
  selectedMultipleFiles,
  onAddLayer,
  toast,
  uniqueIdPrefix = 'file'
}: FileUploadOptions): Promise<boolean> {
  if (!selectedFile && (!selectedMultipleFiles || selectedMultipleFiles.length === 0)) {
    toast("No se seleccionó ningún archivo.");
    return false;
  }
  
  const uniqueFileId = `${uniqueIdPrefix}-${Date.now()}`;

  try {
    const { default: GeoJSONFormat } = await import('ol/format/GeoJSON') as { default: typeof GeoJSONFormatType };
    const { default: KMLFormat } = await import('ol/format/KML') as { default: typeof KMLFormatType };
    const { default: VectorSource } = await import('ol/source/Vector') as { default: typeof VectorSourceType };
    const { default: VectorLayer } = await import('ol/layer/Vector') as { default: typeof VectorLayerType };
    const commonFormatOptions = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' };

    let features: OLFeature[] | undefined;
    let layerName = "Capa Cargada";

    if (selectedMultipleFiles && selectedMultipleFiles.length > 0) {
      let shpFileBuffer: ArrayBuffer | null = null;
      let dbfFileBuffer: ArrayBuffer | null = null;
      let shapeFileName = "Shapefile";

      for (let i = 0; i < selectedMultipleFiles.length; i++) {
        const file = selectedMultipleFiles[i];
        const fileNameLower = file.name.toLowerCase();
        if (fileNameLower.endsWith('.shp')) {
          shpFileBuffer = await file.arrayBuffer();
          shapeFileName = file.name.substring(0, file.name.lastIndexOf('.'));
        } else if (fileNameLower.endsWith('.dbf')) {
          dbfFileBuffer = await file.arrayBuffer();
        }
      }

      if (shpFileBuffer && dbfFileBuffer) {
        const geojson = shpjs.combine([shpjs.parseShp(shpFileBuffer), shpjs.parseDbf(dbfFileBuffer)]);
        features = new GeoJSONFormat().readFeatures(geojson, commonFormatOptions);
        layerName = shapeFileName;
        if (!features || features.length === 0) throw new Error(`No se encontraron entidades en Shapefile ${shapeFileName} o los archivos están vacíos.`);
      } else {
        throw new Error("Un Shapefile requiere al menos archivos .shp y .dbf. Por favor, seleccione ambos.");
      }

    } else if (selectedFile) {
      const fileName = selectedFile.name;
      layerName = fileName.substring(0, fileName.lastIndexOf('.'));
      const fileExtension = fileName.split('.').pop()?.toLowerCase();

      if (fileExtension === 'kmz' || (fileExtension === 'zip' && fileName.toLowerCase().endsWith('.kmz'))) {
        const zip = await JSZip.loadAsync(await selectedFile.arrayBuffer());
        const kmlFileEntry = zip.file(/^doc\\.kml$/i)?.[0] || zip.file(/\\.kml$/i)?.[0] || null;
        if (kmlFileEntry) {
          layerName = kmlFileEntry.name.substring(0, kmlFileEntry.name.lastIndexOf('.'));
          const kmlContent = await kmlFileEntry.async('text');
          features = new KMLFormat().readFeatures(kmlContent, commonFormatOptions);
        } else {
          throw new Error(`Archivo KMZ/ZIP ${fileName} no contiene un archivo KML válido.`);
        }
      } else if (fileExtension === 'zip') {
        const zip = await JSZip.loadAsync(await selectedFile.arrayBuffer());
        let shpFile: JSZip.JSZipObject | null = null;
        let dbfFile: JSZip.JSZipObject | null = null;
        zip.forEach((relativePath, file) => {
          if (relativePath.toLowerCase().endsWith('.shp')) { shpFile = file; layerName = relativePath.substring(0, relativePath.lastIndexOf('.'));}
          if (relativePath.toLowerCase().endsWith('.dbf')) dbfFile = file;
        });
        if (shpFile && dbfFile) {
          const shpBuffer = await shpFile.async('arraybuffer');
          const dbfBuffer = await dbfFile.async('arraybuffer');
          const geojson = shpjs.combine([shpjs.parseShp(shpBuffer), shpjs.parseDbf(dbfBuffer)]);
          features = new GeoJSONFormat().readFeatures(geojson, commonFormatOptions);
        } else {
            const kmlFileEntry = zip.file(/^doc\\.kml$/i)?.[0] || zip.file(/\\.kml$/i)?.[0] || null;
            if(kmlFileEntry) {
                layerName = kmlFileEntry.name.substring(0, kmlFileEntry.name.lastIndexOf('.'));
                const kmlContent = await kmlFileEntry.async('text');
                features = new KMLFormat().readFeatures(kmlContent, commonFormatOptions);
            } else {
                 throw new Error(`Archivo ZIP ${fileName} no contiene un Shapefile válido (archivos .shp y .dbf) ni un archivo KML.`);
            }
        }
      } else if (fileExtension === 'kml') {
        const fileContent = await selectedFile.text();
        features = new KMLFormat().readFeatures(fileContent, commonFormatOptions);
      } else if (fileExtension === 'geojson' || fileExtension === 'json') {
        const fileContent = await selectedFile.text();
        features = new GeoJSONFormat().readFeatures(fileContent, commonFormatOptions);
      } else {
        throw new Error(`Tipo de archivo no soportado: .${fileExtension}. Por favor, cargue KML, KMZ, GeoJSON, o un ZIP conteniendo un Shapefile.`);
      }
    }

    if (features && features.length > 0) {
      const vectorSource = new VectorSource({ features });
      const vectorLayer = new VectorLayer({ source: vectorSource });
      const newLayerId = `${uniqueFileId}-${layerName.replace(/\s/g, '_')}`;
      onAddLayer({ id: newLayerId, name: layerName, olLayer: vectorLayer as VectorLayerType<VectorSourceType<OLFeature<any>>>, visible: true });
      toast(`${layerName} añadido exitosamente al mapa.`);
      return true;
    } else if (features) { 
       toast(`No se encontraron entidades en el archivo cargado.`);
       return false;
    } else {
        throw new Error("No se pudieron procesar las entidades del archivo.");
    }

  } catch (parseError: any) {
    console.error("Error procesando archivo:", parseError);
    toast(parseError.message || "Error de Procesamiento: Ocurrió un error desconocido.");
    return false;
  }
}
