
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, ZoomIn, Table2, Trash2 } from 'lucide-react';
import type { MapLayer } from '@/lib/types';
import VectorLayer from 'ol/layer/Vector'; // Import VectorLayer

interface LayerItemProps {
  layer: MapLayer;
  onToggleVisibility: (layerId: string) => void;
  onZoomToExtent: (layerId: string) => void;
  onShowTable: (layerId: string) => void;
  onRemove: (layerId: string) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  onToggleVisibility,
  onZoomToExtent,
  onShowTable,
  onRemove,
}) => {
  return (
    <li className="flex items-center p-1.5 rounded-md border border-white/15 bg-black/10 hover:bg-white/15 transition-colors overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onToggleVisibility(layer.id)}
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
          onClick={() => onZoomToExtent(layer.id)}
          className="h-6 w-6 text-white hover:bg-gray-600/80 p-0"
          aria-label={`Zoom a ${layer.name}`}
          title="Ir a la extensión de la capa"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        {/* Check if the layer is an instance of VectorLayer to show the table button */}
        {layer.olLayer instanceof VectorLayer && (
           <Button
             variant="ghost"
             size="icon"
             onClick={() => onShowTable(layer.id)}
             className="h-6 w-6 text-white hover:bg-gray-600/80 p-0"
             aria-label={`Ver tabla de atributos de ${layer.name}`}
             title="Ver tabla de atributos de la capa"
           >
             <Table2 className="h-3.5 w-3.5" />
           </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(layer.id)}
          className="h-6 w-6 text-white hover:bg-red-500/30 hover:text-red-400 p-0"
          aria-label={`Eliminar ${layer.name}`}
          title="Eliminar capa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
};

export default LayerItem;
