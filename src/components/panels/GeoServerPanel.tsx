
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import GeoServerUrlInput from '@/components/geoserver-connection/GeoServerUrlInput';
import GeoServerLayerList from '@/components/geoserver-connection/GeoServerLayerList';
import { Server as ServerIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { GeoServerDiscoveredLayer } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface GeoServerPanelProps {
  panelRef: React.RefObject<HTMLDivElement>;
  position: { x: number; y: number };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;

  geoServerUrlInput: string;
  onGeoServerUrlChange: (url: string) => void;
  onFetchGeoServerLayers: () => Promise<GeoServerDiscoveredLayer[]>;
  geoServerDiscoveredLayers: GeoServerDiscoveredLayer[];
  setGeoServerDiscoveredLayers: React.Dispatch<React.SetStateAction<GeoServerDiscoveredLayer[]>>;
  isLoadingGeoServerLayers: boolean;
  onAddGeoServerLayerToMap: (layerName: string, layerTitle: string) => void; // WMS
  onAddGeoServerLayerAsWFS: (layerName: string, layerTitle: string) => void; // WFS
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


const GeoServerPanel: React.FC<GeoServerPanelProps> = ({
  panelRef, position, isCollapsed, onToggleCollapse, onMouseDownHeader,
  geoServerUrlInput, onGeoServerUrlChange, onFetchGeoServerLayers, 
  geoServerDiscoveredLayers, setGeoServerDiscoveredLayers, 
  isLoadingGeoServerLayers, onAddGeoServerLayerToMap, onAddGeoServerLayerAsWFS
}) => {

  const handleFetch = async () => {
    const discovered = await onFetchGeoServerLayers();
    setGeoServerDiscoveredLayers(discovered);
  };
  
  const [openAccordionItems, setOpenAccordionItems] = React.useState<string[]>(['geoserver-connection-section']);


  return (
    <DraggablePanel
      title="Conexión GeoServer"
      panelRef={panelRef}
      initialPosition={position}
      onMouseDownHeader={onMouseDownHeader}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      showCloseButton={false}
      icon={ServerIcon}
    >
      <Accordion 
          type="single" 
          collapsible 
          defaultValue="geoserver-connection-section"
          value={openAccordionItems[0]} 
          onValueChange={(value) => setOpenAccordionItems(value ? [value] : [])}
          className="w-full space-y-1"
        >
          <AccordionItem value="geoserver-connection-section" className="border-b-0 bg-white/5 rounded-md">
            <AccordionTrigger className="p-3 hover:no-underline hover:bg-white/10 rounded-t-md data-[state=open]:rounded-b-none">
               <SectionHeader 
                  title="GeoServer"
                  description="Conectar y cargar capas WMS/WFS."
                  icon={ServerIcon} 
                />
            </AccordionTrigger>
            <AccordionContent className="p-3 pt-2 space-y-3 border-t border-white/10 bg-transparent rounded-b-md">
                <GeoServerUrlInput
                    geoServerUrlInput={geoServerUrlInput}
                    onGeoServerUrlChange={onGeoServerUrlChange}
                    onFetchGeoServerLayers={handleFetch}
                    isLoadingGeoServerLayers={isLoadingGeoServerLayers}
                />
                {geoServerDiscoveredLayers && geoServerDiscoveredLayers.length > 0 && (
                <>
                    <Separator className="my-2 bg-white/20" />
                    <GeoServerLayerList
                      geoServerDiscoveredLayers={geoServerDiscoveredLayers}
                      onAddGeoServerLayerToMap={onAddGeoServerLayerToMap}
                      onAddGeoServerLayerAsWFS={onAddGeoServerLayerAsWFS}
                    />
                </>
                )}
            </AccordionContent>
          </AccordionItem>
      </Accordion>
    </DraggablePanel>
  );
};

export default GeoServerPanel;
