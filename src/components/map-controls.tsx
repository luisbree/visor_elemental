
"use client";

import React from 'react';
import type { Feature } from 'ol';
import { useId } from 'react';
import JSZip from 'jszip';
import shpjs from 'shpjs';
import type { GeoJSON as GeoJSONFormatType } from 'ol/format';
import type KMLFormatType from 'ol/format/KML';
import type VectorSourceType from 'ol/source/Vector';
import type VectorLayerType from 'ol/layer/Vector';
import type TileLayer from 'ol/layer/Tile';
import type TileWMS from 'ol/source/TileWMS';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Layers, FileText, Loader2, MousePointerClick, XCircle, ZoomIn, Trash2,
  Square, PenLine, Dot, Ban, Eraser, Save, ListFilter, Download, MapPin, Plus, Map as MapIcon, Table2,
  Eye, EyeOff, Server
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MapLayer } from '@/components/geo-mapper-client';
import { toast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';

interface GeoServerDiscoveredLayerForControls {
  name: string;
  title: string;
  addedToMap: boolean;
}
interface RenderConfig {
  baseLayers?: boolean;
  layers?: boolean;
  geoServer?: boolean;
  inspector?: boolean; 
  osmCapabilities?: boolean;
  drawing?: boolean;
}

interface BaseLayerOptionForSelect {
  id: string;
  name: string;
}

interface MapControlsProps {
  renderConfig: RenderConfig;
  onAddLayer: (layer: MapLayer) => void;
  
  availableBaseLayers?: BaseLayerOptionForSelect[];
  activeBaseLayerId?: string;
  onChangeBaseLayer?: (id: string) => void;

  layers?: MapLayer[]; 
  onToggleLayerVisibility?: (layerId: string) => void;
  onRemoveLayer?: (layerId: string) => void;
  onZoomToLayerExtent?: (layerId: string) => void;
  onShowLayerTable?: (layerId: string) => void; 
  
  isInspectModeActive?: boolean;
  onToggleInspectMode?: () => void;

  activeDrawTool?: string | null;
  onToggleDrawingTool?: (toolType: 'Polygon' | 'LineString' | 'Point') => void;
  onStopDrawingTool?: () => void;
  onClearDrawnFeatures?: () => void;
  onSaveDrawnFeaturesAsKML?: () => void;
  
  isFetchingOSM?: boolean;
  onFetchOSMDataTrigger?: () => void;
  osmCategoriesForSelection?: { id: string; name: string; }[];
  selectedOSMCategoryIds?: string[];
  onSelectedOSMCategoriesChange?: (ids: string[]) => void;
  downloadFormat?: string;
  onDownloadFormatChange?: (format: string) => void;
  onDownloadOSMLayers?: () => void;
  isDownloading?: boolean;

  geoServerUrlInput?: string;
  onGeoServerUrlChange?: (url: string) => void;
  onFetchGeoServerLayers?: () => void;
  geoServerDiscoveredLayers?: GeoServerDiscoveredLayerForControls[];
  isLoadingGeoServerLayers?: boolean;
  onAddGeoServerLayerToMap?: (layerName: string, layerTitle: string) => void;
}

const SectionHeader: React.FC<{ title: string; description?: string; icon: React.ElementType }> = ({ title, description, icon: Icon }) => (
  <div className="flex items-center w-full">
    <Icon className="mr-2 h-4 w-4 text-primary" />
    <div className="flex-1 text-left">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description && <p className="text-xs text-gray-300/80">{description}</p>}
    </div>
  </div>
);


const MapControls: React.FC<MapControlsProps> = ({ 
  renderConfig,
  onAddLayer, 
  
  availableBaseLayers,
  activeBaseLayerId,
  onChangeBaseLayer,

  layers = [], 
  onToggleLayerVisibility = () => {},
  onRemoveLayer = () => {},
  onZoomToLayerExtent = () => {},
  onShowLayerTable = () => {}, 

  isInspectModeActive = false,
  onToggleInspectMode = () => {},

  activeDrawTool = null,
  onToggleDrawingTool = () => {},
  onStopDrawingTool = () => {},
  onClearDrawnFeatures = () => {},
  onSaveDrawnFeaturesAsKML = () => {},

  isFetchingOSM = false,
  onFetchOSMDataTrigger = () => {},
  osmCategoriesForSelection = [],
  selectedOSMCategoryIds = [],
  onSelectedOSMCategoriesChange = () => {},

  downloadFormat = 'geojson',
  onDownloadFormatChange = () => {},
  onDownloadOSMLayers = () => {},
  isDownloading = false,

  geoServerUrlInput = '',
  onGeoServerUrlChange = () => {},
  onFetchGeoServerLayers = () => {},
  geoServerDiscoveredLayers = [],
  isLoadingGeoServerLayers = false,
  onAddGeoServerLayerToMap = () => {},
}) => {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedMultipleFiles, setSelectedMultipleFiles] = React.useState<FileList | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uniqueIdPrefix = useId();

  const [openAccordionItems, setOpenAccordionItems] = React.useState<string[]>(['layers-section', 'geoserver-section']);
  const prevLayersLengthRef = React.useRef(layers.length);

  React.useEffect(() => {
    if (renderConfig.layers && layers.length > 0 && !openAccordionItems.includes('layers-section') && prevLayersLengthRef.current === 0) {
        setOpenAccordionItems(prevItems => {
          const newItems = new Set(prevItems);
          newItems.add('layers-section');
          return Array.from(newItems);
        });
    }
    prevLayersLengthRef.current = layers.length;
  }, [layers.length, renderConfig.layers, openAccordionItems, setOpenAccordionItems]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      if (event.target.files.length > 1) {
        setSelectedMultipleFiles(event.target.files);
        setSelectedFile(null); 
      } else if (event.target.files.length === 1) {
        setSelectedFile(event.target.files[0]);
        setSelectedMultipleFiles(null); 
      } else {
        setSelectedFile(null);
        setSelectedMultipleFiles(null);
      }
    }
  };

  const resetFileInput = React.useCallback(() => {
    setSelectedFile(null);
    setSelectedMultipleFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFileUpload = React.useCallback(async () => {
    if (!selectedFile && !selectedMultipleFiles) {
      return;
    }
    setIsLoading(true);
    const uniqueFileId = `${uniqueIdPrefix}-${Date.now()}`;

    try {
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
          const features = new (await import('ol/format/GeoJSON')).default().readFeatures(geojson, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });

          if (features && features.length > 0) {
            const VectorSource = (await import('ol/source/Vector')).default;
            const VectorLayer = (await import('ol/layer/Vector')).default;
            const vectorSource = new VectorSource({ features });
            const vectorLayer = new VectorLayer({ source: vectorSource });
            const newLayerId = `${uniqueFileId}-${shapeFileName}`;
            onAddLayer({ id: newLayerId, name: shapeFileName, olLayer: vectorLayer as VectorLayerType<VectorSourceType<Feature<any>>>, visible: true });
            toast(`${shapeFileName} añadido exitosamente al mapa.`);
          } else {
            throw new Error(`No se encontraron entidades en Shapefile ${shapeFileName} o los archivos están vacíos.`);
          }
        } else {
          throw new Error("Un Shapefile requiere al menos archivos .shp y .dbf. Por favor, seleccione ambos.");
        }
      } else if (selectedFile) {
        const fileName = selectedFile.name;
        const fileBaseName = fileName.substring(0, fileName.lastIndexOf('.'));
        const fileExtension = fileName.split('.').pop()?.toLowerCase();

        const { default: GeoJSONFormat } = await import('ol/format/GeoJSON') as { default: typeof GeoJSONFormatType };
        const { default: KMLFormat } = await import('ol/format/KML') as { default: typeof KMLFormatType };
        const { default: VectorSource } = await import('ol/source/Vector') as { default: typeof VectorSourceType };
        const { default: VectorLayer } = await import('ol/layer/Vector') as { default: typeof VectorLayerType };

        let features: Feature[] | undefined;
        const commonFormatOptions = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' };


        if (fileExtension === 'kmz' || (fileExtension === 'zip' && fileName.toLowerCase().endsWith('.kmz'))) {
          const zip = await JSZip.loadAsync(await selectedFile.arrayBuffer());
          let kmlFileEntry: JSZip.JSZipObject | null = null;
          let kmlFileNameInZip = fileBaseName;
          
          kmlFileEntry = zip.file(/^doc\\.kml$/i)?.[0] || zip.file(/\\.kml$/i)?.[0] || null;
          
          if (kmlFileEntry) {
            kmlFileNameInZip = kmlFileEntry.name.substring(0, kmlFileEntry.name.lastIndexOf('.'));
            const kmlContent = await kmlFileEntry.async('text');
            features = new KMLFormat().readFeatures(kmlContent, commonFormatOptions);
             toast(`${kmlFileNameInZip} (de KMZ) añadido exitosamente.`);
          } else {
            throw new Error(`Archivo KMZ/ZIP ${fileName} no contiene un archivo KML válido.`);
          }

        } else if (fileExtension === 'zip') { 
          const zip = await JSZip.loadAsync(await selectedFile.arrayBuffer());
          let shpFile: JSZip.JSZipObject | null = null;
          let dbfFile: JSZip.JSZipObject | null = null;
          let shpFileNameInZip = fileBaseName;


          zip.forEach((relativePath, file) => {
            if (relativePath.toLowerCase().endsWith('.shp')) {
               shpFile = file;
               shpFileNameInZip = relativePath.substring(0, relativePath.lastIndexOf('.'));
            }
            if (relativePath.toLowerCase().endsWith('.dbf')) dbfFile = file;
          });

          if (shpFile && dbfFile) {
            const shpBuffer = await shpFile.async('arraybuffer');
            const dbfBuffer = await dbfFile.async('arraybuffer');
            const geojson = shpjs.combine([shpjs.parseShp(shpBuffer), shpjs.parseDbf(dbfBuffer)]);
            features = new GeoJSONFormat().readFeatures(geojson, commonFormatOptions);
            toast(`${shpFileNameInZip} (Shapefile de ZIP) añadido exitosamente.`);
          } else {
            let kmlFileEntry: JSZip.JSZipObject | null = null;
            kmlFileEntry = zip.file(/^doc\\.kml$/i)?.[0] || zip.file(/\\.kml$/i)?.[0] || null;
            if (kmlFileEntry) {
              const kmlFileNameInZip = kmlFileEntry.name.substring(0, kmlFileEntry.name.lastIndexOf('.'));
              const kmlContent = await kmlFileEntry.async('text');
              features = new KMLFormat().readFeatures(kmlContent, commonFormatOptions);
              toast(`${kmlFileNameInZip} (de ZIP conteniendo KML) añadido exitosamente.`);
            } else {
              throw new Error(`Archivo ZIP ${fileName} no contiene un Shapefile válido (archivos .shp y .dbf) ni un archivo KML.`);
            }
          }
        } else if (fileExtension === 'kml') {
          const fileContent = await selectedFile.text();
          features = new KMLFormat().readFeatures(fileContent, commonFormatOptions);
          toast(`${fileBaseName} añadido exitosamente al mapa.`);
        } else if (fileExtension === 'geojson' || fileExtension === 'json') {
          const fileContent = await selectedFile.text();
          features = new GeoJSONFormat().readFeatures(fileContent, commonFormatOptions);
          toast(`${fileBaseName} añadido exitosamente al mapa.`);
        } else {
          throw new Error(`Tipo de archivo no soportado: .${fileExtension}. Por favor, cargue KML, KMZ, GeoJSON, o un ZIP conteniendo un Shapefile.`);
        }

        if (features && features.length > 0) {
          const vectorSource = new VectorSource({ features });
          const vectorLayer = new VectorLayer({ source: vectorSource });
          const newLayerId = `${uniqueFileId}-${fileBaseName}`;
          onAddLayer({ id: newLayerId, name: fileBaseName, olLayer: vectorLayer as VectorLayerType<VectorSourceType<Feature<any>>>, visible: true });
        } else if (features) { 
           toast(`No se encontraron entidades en ${fileName}.`);
        }
      }
    } catch (parseError: any) {
      console.error("Error procesando archivo:", parseError);
      toast(parseError.message || "Error de Procesamiento: Ocurrió un error desconocido.");
    } finally {
      setIsLoading(false);
      resetFileInput();
    }
  }, [selectedFile, selectedMultipleFiles, onAddLayer, resetFileInput, uniqueIdPrefix, toast]);

  React.useEffect(() => {
    if ((selectedFile || selectedMultipleFiles)) { 
      handleFileUpload();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, selectedMultipleFiles]);

  const handleOSMCategoryChange = (categoryId: string, checked: boolean) => {
    const newSelectedIds = checked
      ? [...selectedOSMCategoryIds, categoryId]
      : selectedOSMCategoryIds.filter(id => id !== categoryId);
    onSelectedOSMCategoriesChange(newSelectedIds);
  };

  return (
    <ScrollArea className="h-full bg-transparent text-white">
      <div className="p-2 space-y-2">
        {renderConfig.baseLayers && availableBaseLayers && activeBaseLayerId && onChangeBaseLayer && (
          <div className="mb-2 p-2 bg-white/5 rounded-md">
            <Label htmlFor={`${uniqueIdPrefix}-base-layer-select`} className="text-xs font-medium text-white/90 mb-1 block">Capa Base</Label>
            <Select value={activeBaseLayerId} onValueChange={onChangeBaseLayer}>
              <SelectTrigger id={`${uniqueIdPrefix}-base-layer-select`} className="w-full text-xs h-8 border-white/30 bg-black/20 text-white/90 focus:ring-primary">
                <SelectValue placeholder="Seleccionar capa base" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 text-white border-gray-600">
                {availableBaseLayers.map(bl => (
                  <SelectItem key={bl.id} value={bl.id} className="text-xs hover:bg-gray-600 focus:bg-gray-600">{bl.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
             <Separator className="my-3 bg-white/15" />
          </div>
        )}

        {renderConfig.layers && (
          <div className="mb-2 p-2 bg-white/5 rounded-md">
            <div className="flex items-center gap-2">
              <Input
                id={`${uniqueIdPrefix}-file-upload-input-layers`}
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                accept=".kml,.kmz,.geojson,.json,.zip,.shp,.dbf"
                className="hidden"
                disabled={isLoading}
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
                disabled={isLoading}
                title="Importar capa desde archivo"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {isLoading ? 'Procesando...' : 'Importar'}
              </Button>
              {renderConfig.inspector && onToggleInspectMode && (
                <Button 
                  onClick={onToggleInspectMode} 
                  className={`flex-1 text-xs h-8 focus-visible:ring-primary ${
                    isInspectModeActive 
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground' 
                      : 'border border-white/30 text-white/90 bg-black/20 hover:bg-black/40 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary'
                  }`}
                  disabled={!!activeDrawTool} 
                  title="Activar/Desactivar modo inspector"
                >
                  <MousePointerClick className="mr-2 h-4 w-4" />
                  {isInspectModeActive ? 'Inspeccionando' : 'Inspeccionar'}
                </Button>
              )}
            </div>
             <Separator className="my-3 bg-white/15" />
          </div>
        )}


        <Accordion 
          type="multiple" 
          value={openAccordionItems}
          onValueChange={setOpenAccordionItems}
          className="w-full space-y-1"
        >
          {renderConfig.layers && (
            <AccordionItem value="layers-section" className="border-b-0 bg-white/5 rounded-md">
              <AccordionTrigger className="p-3 hover:no-underline hover:bg-white/10 rounded-t-md data-[state=open]:rounded-b-none">
                <SectionHeader 
                  title="Capas Cargadas" 
                  description={layers.length > 0 ? "Alternar visibilidad y acciones" : "No hay capas cargadas"}
                  icon={Layers} 
                />
              </AccordionTrigger>
              <AccordionContent className="p-0 pt-0 border-t border-white/10 bg-transparent rounded-b-md">
                {layers.length === 0 ? (
                  <div className="text-center py-6 px-3">
                    <Layers className="mx-auto h-10 w-10 text-gray-400/40" />
                    <p className="mt-1.5 text-xs text-gray-300/90">No hay capas cargadas.</p>
                    <p className="text-xs text-gray-400/70">Use el botón \"Importar\" para añadir.</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-48 p-2"> 
                    <ul className="space-y-1.5">
                      {layers.map((layer) => (
                        <li key={layer.id} className="flex items-center p-1.5 rounded-md border border-white/15 bg-black/10 hover:bg-white/15 transition-colors overflow-hidden">
                           <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onToggleLayerVisibility(layer.id)}
                              className="h-6 w-6 text-white hover:bg-gray-600/80 p-0 mr-2 flex-shrink-0"
                              aria-label={`Alternar visibilidad para ${layer.name}`}
                              title={layer.visible ? "Ocultar capa" : "Mostrar capa"}
                            >
                              {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            </Button>
                          <span className="flex-1 cursor-default text-xs font-medium text-white truncate min-w-0" title={layer.name}>
                            {layer.name}
                          </span>
                          <div className="flex items-center space-x-0.5 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onZoomToLayerExtent(layer.id)}
                              className="h-6 w-6 text-white hover:bg-gray-600/80 p-0"
                              aria-label={`Zoom a ${layer.name}`}
                              title="Ir a la extensión de la capa"
                            >
                              <ZoomIn className="h-3.5 w-3.5" />
                            </Button>
                             <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onShowLayerTable(layer.id)}
                              className="h-6 w-6 text-white hover:bg-gray-600/80 p-0"
                              aria-label={`Ver tabla de atributos de ${layer.name}`}
                              title="Ver tabla de atributos de la capa"
                            >
                              <Table2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onRemoveLayer(layer.id)}
                              className="h-6 w-6 text-white hover:bg-red-500/30 hover:text-red-400 p-0"
                              aria-label={`Eliminar ${layer.name}`}
                              title="Eliminar capa"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {renderConfig.geoServer && (
            <AccordionItem value="geoserver-section" className="border-b-0 bg-white/5 rounded-md">
              <AccordionTrigger className="p-3 hover:no-underline hover:bg-white/10 rounded-t-md data-[state=open]:rounded-b-none">
                <SectionHeader 
                  title="GeoServer"
                  description="Conectar y cargar capas WMS."
                  icon={Server} 
                />
              </AccordionTrigger>
              <AccordionContent className="p-3 pt-2 space-y-3 border-t border-white/10 bg-transparent rounded-b-md">
                <div className="space-y-1">
                   <Label htmlFor={`${uniqueIdPrefix}-geoserver-url`} className="text-xs font-medium text-white/90 block">URL de GeoServer (WMS)</Label>
                   <Input 
                     id={`${uniqueIdPrefix}-geoserver-url`}
                     type="text"
                     placeholder="Ej: http://localhost:8080/geoserver"
                     value={geoServerUrlInput}
                     onChange={(e) => onGeoServerUrlChange(e.target.value)}
                     className="w-full text-xs h-8 border-white/30 bg-black/20 text-white/90 focus:ring-primary placeholder:text-gray-400/70"
                   />
                </div>
                <Button 
                  onClick={onFetchGeoServerLayers} 
                  className="w-full bg-primary/80 hover:bg-primary text-primary-foreground text-xs h-8"
                  disabled={isLoadingGeoServerLayers || !geoServerUrlInput.trim()}
                >
                  {isLoadingGeoServerLayers ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Layers className="mr-2 h-3 w-3" />}
                  <span className="truncate">{isLoadingGeoServerLayers ? 'Cargando...' : 'Cargar Capas de GeoServer'}</span>
                </Button>
                {geoServerDiscoveredLayers && geoServerDiscoveredLayers.length > 0 && (
                  <>
                    <Separator className="my-2 bg-white/20" />
                    <Label className="text-xs font-medium text-white/90 mb-1 block">Capas Disponibles en GeoServer:</Label>
                    <ScrollArea className="h-32 border border-white/10 p-2 rounded-md bg-black/10">
                        <ul className="space-y-1.5">
                            {geoServerDiscoveredLayers.map((gsLayer) => (
                                <li key={gsLayer.name} className="flex items-center p-1.5 rounded-md border border-white/15 bg-black/10 hover:bg-white/20 transition-colors overflow-hidden">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-6 px-2 mr-2 bg-green-600/30 hover:bg-green-500/50 border-green-500/50 text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                        onClick={() => onAddGeoServerLayerToMap(gsLayer.name, gsLayer.title)}
                                        disabled={gsLayer.addedToMap}
                                        title={gsLayer.addedToMap ? "Capa ya añadida" : "Añadir capa al mapa"}
                                    >
                                        {gsLayer.addedToMap ? 'Añadida' : 'Añadir'}
                                    </Button>
                                    <span 
                                      className="flex-1 cursor-default text-xs font-medium text-white truncate min-w-0"
                                      title={`${gsLayer.title} (${gsLayer.name})`}
                                    >
                                        {gsLayer.title}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
          
          {renderConfig.drawing && (
            <AccordionItem value="drawing-tools-section" className="border-b-0 bg-white/5 rounded-md">
              <AccordionTrigger className="p-3 hover:no-underline hover:bg-white/10 rounded-t-md data-[state=open]:rounded-b-none">
                <SectionHeader 
                  title="Herramientas de Dibujo"
                  description="Dibuje en el mapa y guarde sus trazos."
                  icon={PenLine} 
                />
              </AccordionTrigger>
              <AccordionContent className="p-3 pt-2 space-y-2 border-t border-white/10 bg-transparent rounded-b-md">
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    onClick={() => onToggleDrawingTool('Polygon')} 
                    className={`text-xs h-8 focus-visible:ring-primary ${
                      activeDrawTool === 'Polygon'
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        : 'border border-white/30 text-white/90 bg-black/20 hover:bg-black/40'
                    }`}
                    title="Dibujar Polígono (para obtener datos OSM)"
                  >
                    <Square className="mr-1 h-3 w-3" /> Polígono
                  </Button>
                  <Button 
                    onClick={() => onToggleDrawingTool('LineString')} 
                    className={`text-xs h-8 focus-visible:ring-primary ${
                      activeDrawTool === 'LineString'
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        : 'border border-white/30 text-white/90 bg-black/20 hover:bg-black/40'
                    }`}
                    title="Dibujar Línea"
                  >
                    <PenLine className="mr-1 h-3 w-3" /> Línea
                  </Button>
                  <Button 
                    onClick={() => onToggleDrawingTool('Point')} 
                    className={`text-xs h-8 focus-visible:ring-primary ${
                      activeDrawTool === 'Point'
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        : 'border border-white/30 text-white/90 bg-black/20 hover:bg-black/40'
                    }`}
                    title="Dibujar Punto"
                  >
                    <Dot className="mr-1 h-3 w-3" /> Punto
                  </Button>
                </div>
                {activeDrawTool && (
                  <Button 
                    onClick={onStopDrawingTool} 
                    className="w-full text-xs h-8 border border-white/30 hover:bg-white/10 text-white/90 bg-black/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                  >
                    <Ban className="mr-2 h-3 w-3" /> Detener Dibujo
                  </Button>
                )}
                <Separator className="my-2 bg-white/20" />
                <Button 
                  onClick={onClearDrawnFeatures} 
                  className="w-full text-xs h-8 border border-white/30 text-white/90 bg-black/20 hover:bg-red-500/20 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                  disabled={!!activeDrawTool}
                >
                  <Eraser className="mr-2 h-3 w-3" /> Limpiar Dibujos
                </Button>
                <Button 
                  onClick={onSaveDrawnFeaturesAsKML} 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 mt-2"
                  disabled={!!activeDrawTool}
                >
                  <Save className="mr-2 h-3 w-3" /> Guardar Dibujos (KML)
                </Button>
              </AccordionContent>
            </AccordionItem>
          )}

          {renderConfig.osmCapabilities && (
             <AccordionItem value="openstreetmap-section" className="border-b-0 bg-white/5 rounded-md">
              <AccordionTrigger className="p-3 hover:no-underline hover:bg-white/10 rounded-t-md data-[state=open]:rounded-b-none">
                <SectionHeader 
                  title="OpenStreetMap"
                  description="Obtener y descargar datos de OSM."
                  icon={MapIcon} 
                />
              </AccordionTrigger>
              <AccordionContent className="p-3 pt-2 space-y-3 border-t border-white/10 bg-transparent rounded-b-md">
                <div>
                  <Label className="text-xs font-medium text-white/90 mb-1 block">Categorías OSM a Incluir</Label>
                  <ScrollArea className="h-32 border border-white/10 p-2 rounded-md bg-black/10"> 
                    <div className="space-y-1.5">
                      {osmCategoriesForSelection.map(category => (
                        <div key={category.id} className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-white/5">
                          <Checkbox
                            id={`osm-cat-${category.id}`}
                            checked={selectedOSMCategoryIds.includes(category.id)}
                            onCheckedChange={(checked) => handleOSMCategoryChange(category.id, !!checked)}
                            className="data-[state=checked]:bg-accent data-[state=checked]:border-accent-foreground border-muted-foreground/70"
                          />
                          <Label htmlFor={`osm-cat-${category.id}`} className="text-xs font-medium text-white/90 cursor-pointer">
                            {category.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <Separator className="my-2 bg-white/20" />
                
                <Button 
                  onClick={onFetchOSMDataTrigger} 
                  className="w-full bg-primary/70 hover:bg-primary/90 text-primary-foreground text-xs h-8"
                  disabled={isFetchingOSM || !!activeDrawTool}
                >
                  {isFetchingOSM ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <MapPin className="mr-2 h-3 w-3" />}
                  {isFetchingOSM ? 'Obteniendo Datos...' : 'Obtener Datos OSM (del último polígono)'}
                </Button>

                <Separator className="my-2 bg-white/20" />

                <div>
                  <Label htmlFor={`${uniqueIdPrefix}-download-format-select-osm`} className="text-xs font-medium text-white/90 mb-1 block">Formato de Descarga Capas OSM</Label>
                  <Select value={downloadFormat} onValueChange={onDownloadFormatChange}>
                    <SelectTrigger id={`${uniqueIdPrefix}-download-format-select-osm`} className="w-full text-xs h-8 border-white/30 bg-black/20 text-white/90 focus:ring-primary">
                      <SelectValue placeholder="Seleccionar formato" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 text-white border-gray-600">
                      <SelectItem value="geojson" className="text-xs hover:bg-gray-600 focus:bg-gray-600">GeoJSON</SelectItem>
                      <SelectItem value="kml" className="text-xs hover:bg-gray-600 focus:bg-gray-600">KML</SelectItem>
                      <SelectItem value="shp" className="text-xs hover:bg-gray-600 focus:bg-gray-600">Shapefile (ZIP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={onDownloadOSMLayers} 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 mt-2"
                  disabled={isDownloading}
                >
                  {isDownloading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Download className="mr-2 h-3 w-3" />}
                  {isDownloading ? 'Descargando...' : 'Descargar Capas OSM'}
                </Button>
              </AccordionContent>
            </AccordionItem>
          )}

        </Accordion>
      </div>
    </ScrollArea>
  );
};

export default MapControls;

