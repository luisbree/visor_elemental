
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import BaseLayerSelector from '@/components/layer-manager/BaseLayerSelector';
import FileUploadControl from '@/components/layer-manager/FileUploadControl';
import LayerList from '@/components/layer-manager/LayerList';
import InspectToolToggle from '@/components/feature-inspection/InspectToolToggle';
import LocationSearch, { type NominatimResult } from '@/components/location-search/LocationSearch';
import MapCaptureControl from '@/components/map-tools/MapCaptureControl';
import GeoServerUrlInput from '@/components/geoserver-connection/GeoServerUrlInput';
import GeoServerLayerList from '@/components/geoserver-connection/GeoServerLayerList';
import { Separator } from '@/components/ui/separator';
import type { MapLayer, BaseLayerOptionForSelect, GeoServerDiscoveredLayer } from '@/lib/types';
import { Layers as LayersIcon, Server as ServerIcon } from 'lucide-react'; // ServerIcon ya no se usará aquí para el header de GeoServer
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


interface LayersPanelProps {
  panelRef: React.RefObject<HTMLDivElement>;
  position: { x: number; y: number };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;

  layers: MapLayer[];
  onAddLayer: (layer: MapLayer) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onZoomToLayerExtent: (layerId: string) => void;
  onShowLayerTable: (layerId: string) => void;

  availableBaseLayers: BaseLayerOptionForSelect[];
  activeBaseLayerId: string;
  onChangeBaseLayer: (id: string) => void;

  isInspectModeActive: boolean;
  onToggleInspectMode: () => void;

  onZoomToBoundingBox: (bbox: [number, number, number, number]) => void;

  onCaptureMap: (outputType: 'jpeg-full' | 'jpeg-red' | 'jpeg-green' | 'jpeg-blue') => void;
  isCapturingMap: boolean;

  // GeoServer Props
  geoServerUrlInput: string;
  onGeoServerUrlChange: (url: string) => void;
  onFetchGeoServerLayers: () => Promise<GeoServerDiscoveredLayer[]>; 
  geoServerDiscoveredLayers: GeoServerDiscoveredLayer[];
  setGeoServerDiscoveredLayers: React.Dispatch<React.SetStateAction<GeoServerDiscoveredLayer[]>>;
  isLoadingGeoServerLayers: boolean;
  onAddGeoServerLayerToMap: (layerName: string, layerTitle: string) => void;
  onAddGeoServerLayerAsWFS: (layerName: string, layerTitle: string) => Promise<void>;
}

const SectionHeader: React.FC<{ title: string; icon: React.ElementType, description?: string }> = ({ title, icon: Icon, description }) => (
  <div className="flex items-center w-full">
    <Icon className="mr-2 h-4 w-4 text-primary" />
    <div className="flex-1 text-left">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description && <p className="text-xs text-gray-300/80">{description}</p>}
    </div>
  </div>
);


const LayersPanel: React.FC<LayersPanelProps> = ({
  panelRef, position, isCollapsed, onToggleCollapse, onMouseDownHeader,
  layers, onAddLayer, onToggleLayerVisibility, onRemoveLayer, onZoomToLayerExtent, onShowLayerTable,
  availableBaseLayers, activeBaseLayerId, onChangeBaseLayer,
  isInspectModeActive, onToggleInspectMode,
  onZoomToBoundingBox,
  onCaptureMap, isCapturingMap,
  geoServerUrlInput, onGeoServerUrlChange, onFetchGeoServerLayers, 
  geoServerDiscoveredLayers, setGeoServerDiscoveredLayers,
  isLoadingGeoServerLayers, onAddGeoServerLayerToMap, onAddGeoServerLayerAsWFS
}) => {

  const [activeAccordionItems, setActiveAccordionItems] = React.useState<string[]>(['layers-section']);
  const prevLayersLengthRef = React.useRef(layers.length);

   React.useEffect(() => {
    if (layers.length > 0 && !activeAccordionItems.includes('layers-section') && prevLayersLengthRef.current === 0) {
        setActiveAccordionItems(prev => [...prev, 'layers-section'].filter((value, index, self) => self.indexOf(value) === index));
    }
    prevLayersLengthRef.current = layers.length;
  }, [layers.length, activeAccordionItems]);
  
  // useEffect para expandir el acordeón de GeoServer eliminado

  const handleLocationSelection = (location: NominatimResult) => {
    const [sLat, nLat, wLon, eLon] = location.boundingbox.map(coord => parseFloat(coord));
    onZoomToBoundingBox([wLon, sLat, eLon, nLat]);
  };
  
  const handleFetchGeoServer = async () => {
    const discovered = await onFetchGeoServerLayers();
    setGeoServerDiscoveredLayers(discovered);
  };


  return (
    <DraggablePanel
      title="Capas y Utilitarios"
      panelRef={panelRef}
      initialPosition={position}
      onMouseDownHeader={onMouseDownHeader}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      showCloseButton={false}
    >
      <div className="space-y-3"> {/* Contenedor principal con espaciado vertical */}
        
        <LocationSearch onLocationSelect={handleLocationSelection} />

        <div className="flex items-center gap-2"> {/* Contenedor para BaseLayerSelector y MapCaptureControl en línea */}
            <div className="flex-grow">
                <BaseLayerSelector
                    availableBaseLayers={availableBaseLayers}
                    activeBaseLayerId={activeBaseLayerId}
                    onChangeBaseLayer={onChangeBaseLayer}
                />
            </div>
            <MapCaptureControl
                onCapture={onCaptureMap}
                isCapturing={isCapturingMap}
            />
        </div>
        
        <Separator className="bg-white/15" />

        {/* Sección de GeoServer integrada directamente */}
        <GeoServerUrlInput
            geoServerUrlInput={geoServerUrlInput}
            onGeoServerUrlChange={onGeoServerUrlChange}
            onFetchGeoServerLayers={handleFetchGeoServer}
            isLoadingGeoServerLayers={isLoadingGeoServerLayers}
            uniqueIdPrefix="layerspanel-geoserver"
        />
        {geoServerDiscoveredLayers && geoServerDiscoveredLayers.length > 0 && (
          <>
            {/* GeoServerLayerList no necesita un Separator antes si está agrupado lógicamente */}
            <GeoServerLayerList
              geoServerDiscoveredLayers={geoServerDiscoveredLayers}
              onAddGeoServerLayerToMap={onAddGeoServerLayerToMap}
              onAddGeoServerLayerAsWFS={onAddGeoServerLayerAsWFS}
            />
          </>
        )}

        <Separator className="bg-white/15" />
        
        <div className="flex items-center gap-2"> {/* Contenedor para FileUploadControl e InspectToolToggle en línea */}
          <FileUploadControl onAddLayer={onAddLayer} uniqueIdPrefix="layerspanel-upload"/>
          <InspectToolToggle
            isInspectModeActive={isInspectModeActive}
            onToggleInspectMode={onToggleInspectMode}
          />
        </div>
        
        <Separator className="bg-white/15" />

        <Accordion
          type="multiple" 
          value={activeAccordionItems}
          onValueChange={setActiveAccordionItems}
          className="w-full space-y-1" 
        >
            <AccordionItem value="layers-section" className="border-b-0 bg-white/5 rounded-md">
              <AccordionTrigger className="p-3 hover:no-underline hover:bg-white/10 rounded-t-md data-[state=open]:rounded-b-none">
                <SectionHeader
                  title="Capas Cargadas"
                  icon={LayersIcon}
                />
              </AccordionTrigger>
              <AccordionContent className="p-0 pt-0 border-t border-white/10 bg-transparent rounded-b-md">
                 <LayerList
                    layers={layers}
                    onToggleVisibility={onToggleLayerVisibility}
                    onZoomToExtent={onZoomToLayerExtent}
                    onShowTable={onShowLayerTable}
                    onRemoveLayer={onRemoveLayer}
                  />
              </AccordionContent>
            </AccordionItem>
        </Accordion>

      </div>
    </DraggablePanel>
  );
};

export default LayersPanel;

