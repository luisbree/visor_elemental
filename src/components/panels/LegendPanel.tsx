
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import LayerList from '@/components/layer-manager/LayerList';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { MapLayer } from '@/lib/types';
import { Layers as LayersIcon } from 'lucide-react'; // Can reuse LayersIcon or use ListTree

interface LegendPanelProps {
  panelRef: React.RefObject<HTMLDivElement>;
  position: { x: number; y: number };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClosePanel: () => void;
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;

  layers: MapLayer[];
  onToggleLayerVisibility: (layerId: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onZoomToLayerExtent: (layerId: string) => void;
  onShowLayerTable: (layerId: string) => void;
  onExtractByPolygon: (layerId: string) => void;
  isDrawingSourceEmptyOrNotPolygon: boolean;
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

const LegendPanel: React.FC<LegendPanelProps> = ({
  panelRef, position, isCollapsed, onToggleCollapse, onClosePanel, onMouseDownHeader,
  layers, onToggleLayerVisibility, onRemoveLayer, onZoomToLayerExtent, onShowLayerTable,
  onExtractByPolygon, isDrawingSourceEmptyOrNotPolygon,
}) => {
  const [activeAccordionItems, setActiveAccordionItems] = React.useState<string[]>(['layers-section']);
  const prevLayersLengthRef = React.useRef(layers.length);

  React.useEffect(() => {
    if (layers.length > 0 && !activeAccordionItems.includes('layers-section') && prevLayersLengthRef.current === 0) {
        setActiveAccordionItems(prev => [...prev, 'layers-section'].filter((value, index, self) => self.indexOf(value) === index));
    }
    prevLayersLengthRef.current = layers.length;
  }, [layers.length, activeAccordionItems]);

  return (
    <DraggablePanel
      title="Capas"
      icon={LayersIcon} 
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
                onExtractByPolygon={onExtractByPolygon}
                isDrawingSourceEmptyOrNotPolygon={isDrawingSourceEmptyOrNotPolygon}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DraggablePanel>
  );
};

export default LegendPanel;
