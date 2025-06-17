
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import BaseLayerSelector from '@/components/layer-manager/BaseLayerSelector';
import FileUploadControl from '@/components/layer-manager/FileUploadControl';
// LayerList removed
import InspectToolToggle from '@/components/feature-inspection/InspectToolToggle';
import LocationSearch, { type NominatimResult } from '@/components/location-search/LocationSearch';
import MapCaptureControl from '@/components/map-tools/MapCaptureControl';
import GeoServerUrlInput from '@/components/geoserver-connection/GeoServerUrlInput';
import GeoServerLayerList from '@/components/geoserver-connection/GeoServerLayerList';
import { Separator } from '@/components/ui/separator';
import type { BaseLayerOptionForSelect, GeoServerDiscoveredLayer, MapLayer } from '@/lib/types'; // MapLayer might not be needed here anymore
import { Database } from 'lucide-react'; // LayersIcon removed as it's no longer used for section header here

interface LayersPanelProps {
  panelRef: React.RefObject<HTMLDivElement>;
  position: { x: number; y: number };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClosePanel: () => void; 
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;

  // Props for LayerList are removed from here
  onAddLayer: (layer: MapLayer) => void; // FileUploadControl still needs this

  availableBaseLayers: BaseLayerOptionForSelect[];
  activeBaseLayerId: string;
  onChangeBaseLayer: (id: string) => void;

  isInspectModeActive: boolean;
  onToggleInspectMode: () => void;

  onZoomToBoundingBox: (bbox: [number, number, number, number]) => void;

  captureMap: (outputType: 'jpeg-full' | 'jpeg-red' | 'jpeg-green' | 'jpeg-blue') => void;
  isCapturingMap: boolean;

  geoServerUrlInput: string;
  onGeoServerUrlChange: (url: string) => void;
  onFetchGeoServerLayers: () => Promise<GeoServerDiscoveredLayer[]>; 
  geoServerDiscoveredLayers: GeoServerDiscoveredLayer[];
  setGeoServerDiscoveredLayers: React.Dispatch<React.SetStateAction<GeoServerDiscoveredLayer[]>>;
  isLoadingGeoServerLayers: boolean;
  onAddGeoServerLayerToMap: (layerName: string, layerTitle: string) => void;
  onAddGeoServerLayerAsWFS: (layerName: string, layerTitle: string) => Promise<void>;
}

// SectionHeader removed as "Capas Cargadas" section is gone

const LayersPanel: React.FC<LayersPanelProps> = ({
  panelRef, position, isCollapsed, onToggleCollapse, onClosePanel, onMouseDownHeader,
  onAddLayer, // For FileUploadControl
  availableBaseLayers, activeBaseLayerId, onChangeBaseLayer,
  isInspectModeActive, onToggleInspectMode,
  onZoomToBoundingBox,
  captureMap, isCapturingMap,
  geoServerUrlInput, onGeoServerUrlChange, onFetchGeoServerLayers, 
  geoServerDiscoveredLayers, setGeoServerDiscoveredLayers,
  isLoadingGeoServerLayers, onAddGeoServerLayerToMap, onAddGeoServerLayerAsWFS
}) => {
  
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
      title="Datos"
      icon={Database}
      panelRef={panelRef}
      initialPosition={position}
      onMouseDownHeader={onMouseDownHeader}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      onClose={onClosePanel}
      showCloseButton={true}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
    >
      <div className="space-y-3"> 
        
        <LocationSearch onLocationSelect={handleLocationSelection} />

        <div className="flex items-center gap-2"> 
            <div className="flex-grow">
                <BaseLayerSelector
                    availableBaseLayers={availableBaseLayers}
                    activeBaseLayerId={activeBaseLayerId}
                    onChangeBaseLayer={onChangeBaseLayer}
                />
            </div>
            <MapCaptureControl
                onCapture={captureMap}
                isCapturing={isCapturingMap}
            />
        </div>
        
        <Separator className="bg-white/15" />

        <GeoServerUrlInput
            geoServerUrlInput={geoServerUrlInput}
            onGeoServerUrlChange={onGeoServerUrlChange}
            onFetchGeoServerLayers={handleFetchGeoServer}
            isLoadingGeoServerLayers={isLoadingGeoServerLayers}
            uniqueIdPrefix="layerspanel-geoserver"
        />
        {geoServerDiscoveredLayers && geoServerDiscoveredLayers.length > 0 && (
          <>
            <GeoServerLayerList
              geoServerDiscoveredLayers={geoServerDiscoveredLayers}
              onAddGeoServerLayerToMap={onAddGeoServerLayerToMap}
              onAddGeoServerLayerAsWFS={onAddGeoServerLayerAsWFS}
            />
          </>
        )}

        <Separator className="bg-white/15" />
        
        <div className="flex items-center gap-2"> 
          <FileUploadControl onAddLayer={onAddLayer} uniqueIdPrefix="layerspanel-upload"/>
          <InspectToolToggle
            isInspectModeActive={isInspectModeActive}
            onToggleInspectMode={onToggleInspectMode}
          />
        </div>
        
        {/* Accordion for "Capas Cargadas" is removed */}

      </div>
    </DraggablePanel>
  );
};

export default LayersPanel;
