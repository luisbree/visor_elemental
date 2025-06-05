
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import BaseLayerSelector from '@/components/layer-manager/BaseLayerSelector';
import FileUploadControl from '@/components/layer-manager/FileUploadControl';
import LayerList from '@/components/layer-manager/LayerList';
import InspectToolToggle from '@/components/feature-inspection/InspectToolToggle';
import { Separator } from '@/components/ui/separator';
import type { MapLayer, BaseLayerOptionForSelect } from '@/lib/types';
import { Layers as LayersIcon } from 'lucide-react'; // Renamed to avoid conflict
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

  // Layer management props
  layers: MapLayer[];
  onAddLayer: (layer: MapLayer) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onZoomToLayerExtent: (layerId: string) => void;
  onShowLayerTable: (layerId: string) => void;

  // Base layer props
  availableBaseLayers: BaseLayerOptionForSelect[];
  activeBaseLayerId: string;
  onChangeBaseLayer: (id: string) => void;

  // Inspection props
  isInspectModeActive: boolean;
  onToggleInspectMode: () => void;
  isActiveDrawToolPresent: boolean; // To disable inspect when drawing
}

const SectionHeader: React.FC<{ title: string; icon: React.ElementType }> = ({ title, icon: Icon }) => (
  <div className="flex items-center w-full">
    <Icon className="mr-2 h-4 w-4 text-primary" />
    <div className="flex-1 text-left">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
  </div>
);


const LayersPanel: React.FC<LayersPanelProps> = ({
  panelRef, position, isCollapsed, onToggleCollapse, onMouseDownHeader,
  layers, onAddLayer, onToggleLayerVisibility, onRemoveLayer, onZoomToLayerExtent, onShowLayerTable,
  availableBaseLayers, activeBaseLayerId, onChangeBaseLayer,
  isInspectModeActive, onToggleInspectMode, isActiveDrawToolPresent
}) => {
  
  const [openAccordionItems, setOpenAccordionItems] = React.useState<string[]>(['layers-section']);
  const prevLayersLengthRef = React.useRef(layers.length);

   React.useEffect(() => {
    if (layers.length > 0 && !openAccordionItems.includes('layers-section') && prevLayersLengthRef.current === 0) {
        setOpenAccordionItems(prevItems => Array.from(new Set([...prevItems, 'layers-section'])));
    }
    prevLayersLengthRef.current = layers.length;
  }, [layers.length, openAccordionItems]);


  return (
    <DraggablePanel
      title="Capas y Utilitarios"
      panelRef={panelRef}
      initialPosition={position} // Used by style prop
      onMouseDownHeader={onMouseDownHeader}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      showCloseButton={false} // Typically layer panel is not closed
    >
      <div className="space-y-3">
        <BaseLayerSelector
          availableBaseLayers={availableBaseLayers}
          activeBaseLayerId={activeBaseLayerId}
          onChangeBaseLayer={onChangeBaseLayer}
        />
        <Separator className="bg-white/15" />
        <div className="flex items-center gap-2">
          <FileUploadControl onAddLayer={onAddLayer} uniqueIdPrefix="layerspanel-upload"/>
          <InspectToolToggle 
            isInspectModeActive={isInspectModeActive}
            onToggleInspectMode={onToggleInspectMode}
            isActiveDrawToolPresent={isActiveDrawToolPresent}
          />
        </div>
        <Separator className="bg-white/15" />
        
        <Accordion 
          type="multiple" 
          value={openAccordionItems}
          onValueChange={setOpenAccordionItems}
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
