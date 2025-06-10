
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import DrawingToolbar from '@/components/drawing-tools/DrawingToolbar';
import OSMCategorySelector from '@/components/osm-integration/OSMCategorySelector';
import OSMDownloadOptions from '@/components/osm-integration/OSMDownloadOptions';
import { PenLine, Map as MapIcon } from 'lucide-react'; // MapIcon for OSM section
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from '@/components/ui/separator';
import type { MapLayer } from '@/lib/types'; // For handleDownloadOSMLayers prop

interface OSMCategory { // Duplicating for local use, consider moving to types.ts if widely used
  id: string;
  name: string;
}

interface ToolsPanelProps {
  panelRef: React.RefObject<HTMLDivElement>;
  position: { x: number; y: number };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;

  // Drawing props
  activeDrawTool: string | null;
  onToggleDrawingTool: (toolType: 'Polygon' | 'LineString' | 'Point') => void;
  onStopDrawingTool: () => void;
  onClearDrawnFeatures: () => void;
  onSaveDrawnFeaturesAsKML: () => void;

  // OSM props
  isFetchingOSM: boolean;
  onFetchOSMDataTrigger: () => void;
  osmCategoriesForSelection: OSMCategory[];
  selectedOSMCategoryIds: string[];
  onSelectedOSMCategoriesChange: (ids: string[]) => void;
  downloadFormat: string;
  onDownloadFormatChange: (format: string) => void;
  isDownloading: boolean;
  onDownloadOSMLayers: () => void; 

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

const ToolsPanel: React.FC<ToolsPanelProps> = ({
  panelRef, position, isCollapsed, onToggleCollapse, onMouseDownHeader,
  activeDrawTool, onToggleDrawingTool, onStopDrawingTool, onClearDrawnFeatures, onSaveDrawnFeaturesAsKML,
  isFetchingOSM, onFetchOSMDataTrigger, osmCategoriesForSelection, selectedOSMCategoryIds, onSelectedOSMCategoriesChange,
  downloadFormat, onDownloadFormatChange, isDownloading, onDownloadOSMLayers
}) => {
  
  // Keep 'openstreetmap-section' open by default, drawing tools are now always visible
  const [openAccordionItems, setOpenAccordionItems] = React.useState<string[]>(['openstreetmap-section']);

  return (
    <DraggablePanel
      title="Herramientas"
      panelRef={panelRef}
      initialPosition={position}
      onMouseDownHeader={onMouseDownHeader}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      showCloseButton={false}
    >
        {/* Drawing Toolbar is now directly rendered, without an AccordionItem wrapper */}
        <div className="p-3"> {/* Overall padding for the section in the panel */}
            <div className="bg-white/5 rounded-md p-2"> {/* Wrapper for DrawingToolbar with desired styling */}
                <DrawingToolbar
                    activeDrawTool={activeDrawTool}
                    onToggleDrawingTool={onToggleDrawingTool}
                    onStopDrawingTool={onStopDrawingTool}
                    onClearDrawnFeatures={onClearDrawnFeatures}
                    onSaveDrawnFeaturesAsKML={onSaveDrawnFeaturesAsKML}
                />
            </div>
        </div>
        
        <Separator className="my-2 mx-3 bg-white/10" />

        <Accordion 
          type="multiple" 
          value={openAccordionItems} // Controlled state for OSM section
          onValueChange={setOpenAccordionItems}
          className="w-full space-y-1"
        >
            <AccordionItem value="openstreetmap-section" className="border-b-0 bg-white/5 rounded-md">
              <AccordionTrigger className="p-3 hover:no-underline hover:bg-white/10 rounded-t-md data-[state=open]:rounded-b-none">
                <SectionHeader 
                  title="OpenStreetMap"
                  description="Obtener y descargar datos de OSM."
                  icon={MapIcon} 
                />
              </AccordionTrigger>
              <AccordionContent className="p-3 pt-2 space-y-3 border-t border-white/10 bg-transparent rounded-b-md">
                <OSMCategorySelector
                    osmCategoriesForSelection={osmCategoriesForSelection}
                    selectedOSMCategoryIds={selectedOSMCategoryIds}
                    onSelectedOSMCategoriesChange={onSelectedOSMCategoriesChange}
                />
                <OSMDownloadOptions
                    isFetchingOSM={isFetchingOSM}
                    onFetchOSMDataTrigger={onFetchOSMDataTrigger}
                    isActiveDrawToolPresent={!!activeDrawTool}
                    downloadFormat={downloadFormat}
                    onDownloadFormatChange={onDownloadFormatChange}
                    isDownloading={isDownloading}
                    onDownloadOSMLayers={onDownloadOSMLayers}
                />
              </AccordionContent>
            </AccordionItem>
        </Accordion>
    </DraggablePanel>
  );
};

export default ToolsPanel;

