
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import LayerList from '@/components/layer-manager/LayerList';
import FileUploadControl from '@/components/layer-manager/FileUploadControl';
import InspectToolToggle from '@/components/feature-inspection/InspectToolToggle';
import { Separator } from '@/components/ui/separator';
import type { MapLayer } from '@/lib/types';
import { ListTree } from 'lucide-react'; // Changed from LayersIcon

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

  // Props for new controls
  onAddLayer: (layer: MapLayer) => void;
  isInspectModeActive: boolean;
  onToggleInspectMode: () => void;
}


const LegendPanel: React.FC<LegendPanelProps> = ({
  panelRef, position, isCollapsed, onToggleCollapse, onClosePanel, onMouseDownHeader,
  layers, onToggleLayerVisibility, onRemoveLayer, onZoomToLayerExtent, onShowLayerTable,
  onExtractByPolygon, isDrawingSourceEmptyOrNotPolygon,
  onAddLayer, isInspectModeActive, onToggleInspectMode, // Destructure new props
}) => {

  return (
    <DraggablePanel
      title="Capas"
      icon={ListTree} 
      panelRef={panelRef}
      initialPosition={position}
      onMouseDownHeader={onMouseDownHeader}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      onClose={onClosePanel}
      showCloseButton={true}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
    >
      <div className="space-y-2"> {/* Adjusted main space-y */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-md"> {/* Container for new buttons */}
          <FileUploadControl onAddLayer={onAddLayer} uniqueIdPrefix="legendpanel-upload" />
          <InspectToolToggle
            isInspectModeActive={isInspectModeActive}
            onToggleInspectMode={onToggleInspectMode}
          />
        </div>
        <Separator className="bg-white/10" /> {/* Separator below new buttons */}
        <LayerList
          layers={layers}
          onToggleVisibility={onToggleLayerVisibility}
          onZoomToExtent={onZoomToLayerExtent}
          onShowTable={onShowLayerTable}
          onRemoveLayer={onRemoveLayer}
          onExtractByPolygon={onExtractByPolygon}
          isDrawingSourceEmptyOrNotPolygon={isDrawingSourceEmptyOrNotPolygon}
        />
      </div>
    </DraggablePanel>
  );
};

export default LegendPanel;
