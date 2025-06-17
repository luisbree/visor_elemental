
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import LayerList from '@/components/layer-manager/LayerList';
// Accordion components are no longer needed here
import type { MapLayer } from '@/lib/types';
import { Layers as LayersIcon } from 'lucide-react'; // Or ListTree if preferred for the panel icon

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

// SectionHeader is removed as it was part of the Accordion structure

const LegendPanel: React.FC<LegendPanelProps> = ({
  panelRef, position, isCollapsed, onToggleCollapse, onClosePanel, onMouseDownHeader,
  layers, onToggleLayerVisibility, onRemoveLayer, onZoomToLayerExtent, onShowLayerTable,
  onExtractByPolygon, isDrawingSourceEmptyOrNotPolygon,
}) => {
  // activeAccordionItems state and useEffect related to it are removed

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
      {/* LayerList is now a direct child within DraggablePanel's content area */}
      <div className="space-y-3">
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

