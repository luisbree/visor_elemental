
"use client";

import React from 'react';
// ScrollArea removed
import LayerItem from './LayerItem';
import type { MapLayer } from '@/lib/types';
import { Layers } from 'lucide-react';

interface LayerListProps {
  layers: MapLayer[];
  onToggleVisibility: (layerId: string) => void;
  onZoomToExtent: (layerId: string) => void; 
  onShowTable: (layerId: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onExtractByPolygon: (layerId: string) => void;
  isDrawingSourceEmptyOrNotPolygon: boolean;
}

const LayerList: React.FC<LayerListProps> = ({
  layers,
  onToggleVisibility,
  onZoomToExtent, 
  onShowTable,
  onRemoveLayer,
  onExtractByPolygon,
  isDrawingSourceEmptyOrNotPolygon,
}) => {
  if (layers.length === 0) {
    return (
      <div className="text-center py-6 px-3">
        <Layers className="mx-auto h-10 w-10 text-gray-400/40" />
        <p className="mt-1.5 text-xs text-gray-300/90">No hay capas cargadas.</p>
        <p className="text-xs text-gray-400/70">Use el botón \"Importar\" para añadir.</p>
      </div>
    );
  }

  // ScrollArea component removed, ul is now the direct child or returned directly
  return (
    <ul className="space-y-1.5">
      {layers.map((layer) => (
        <LayerItem
          key={layer.id}
          layer={layer}
          onToggleVisibility={onToggleVisibility}
          onZoomToExtent={onZoomToExtent}
          onShowTable={onShowTable}
          onRemove={onRemoveLayer}
          onExtractByPolygon={onExtractByPolygon}
          isDrawingSourceEmptyOrNotPolygon={isDrawingSourceEmptyOrNotPolygon}
        />
      ))}
    </ul>
  );
};

export default LayerList;
