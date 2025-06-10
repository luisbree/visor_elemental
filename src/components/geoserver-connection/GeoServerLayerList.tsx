
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GeoServerDiscoveredLayer } from '@/lib/types';
import { Layers, Workflow } from 'lucide-react'; // Workflow for WFS icon

interface GeoServerLayerListProps {
  geoServerDiscoveredLayers: GeoServerDiscoveredLayer[];
  onAddGeoServerLayerToMap: (layerName: string, layerTitle: string) => void; // For WMS
  onAddGeoServerLayerAsWFS: (layerName: string, layerTitle: string) => Promise<void>; // For WFS, now returns Promise<void>
}

const GeoServerLayerList: React.FC<GeoServerLayerListProps> = ({
  geoServerDiscoveredLayers,
  onAddGeoServerLayerToMap,
  onAddGeoServerLayerAsWFS,
}) => {
  if (!geoServerDiscoveredLayers || geoServerDiscoveredLayers.length === 0) {
    return <p className="text-xs text-gray-400/80 text-center py-2">No hay capas de GeoServer para mostrar. Ingrese una URL y cargue capas.</p>;
  }

  const handleAddWFS = async (layerName: string, layerTitle: string) => {
    try {
      await onAddGeoServerLayerAsWFS(layerName, layerTitle);
    } catch (e) {
      // This catch is a safety net. The onAddGeoServerLayerAsWFS function
      // should ideally handle its own errors and toast messages.
      console.error("Error invoking onAddGeoServerLayerAsWFS from GeoServerLayerList:", e);
      // Optionally, show a generic toast here if not handled internally by onAddGeoServerLayerAsWFS
      // import { toast } from "@/hooks/use-toast";
      // toast({ description: "Ocurrió un error inesperado al intentar añadir la capa WFS.", variant: "destructive" });
    }
  };

  return (
    <>
      <Label className="text-xs font-medium text-white/90 mb-1 block">Capas Disponibles en GeoServer:</Label>
      <ScrollArea className="h-40 border border-white/10 p-2 rounded-md bg-black/10">
          <ul className="space-y-1.5">
              {geoServerDiscoveredLayers.map((gsLayer) => (
                  <li key={gsLayer.name} className="p-1.5 rounded-md border border-white/15 bg-black/10 hover:bg-white/20 transition-colors overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span
                          className="flex-1 cursor-default text-xs font-medium text-white truncate min-w-0 mr-2"
                          title={`${gsLayer.title} (${gsLayer.name})`}
                        >
                            {gsLayer.title}
                        </span>
                        <div className="flex items-center space-x-1 shrink-0">
                           <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6 px-2 bg-sky-600/30 hover:bg-sky-500/50 border-sky-500/50 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                              onClick={() => onAddGeoServerLayerToMap(gsLayer.name, gsLayer.title)}
                              disabled={gsLayer.wmsAddedToMap}
                              title={gsLayer.wmsAddedToMap ? "Capa WMS ya añadida" : "Añadir capa como WMS (visual)"}
                          >
                              <Layers className="h-3 w-3 mr-1" /> WMS
                          </Button>
                           <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-6 px-2 bg-teal-600/30 hover:bg-teal-500/50 border-teal-500/50 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                              onClick={() => handleAddWFS(gsLayer.name, gsLayer.title)}
                              disabled={gsLayer.wfsAddedToMap}
                              title={gsLayer.wfsAddedToMap ? "Capa WFS ya añadida" : "Añadir capa como WFS (datos vectoriales)"}
                          >
                               <Workflow className="h-3 w-3 mr-1" /> WFS
                          </Button>
                        </div>
                      </div>
                  </li>
              ))}
          </ul>
      </ScrollArea>
    </>
  );
};

export default GeoServerLayerList;
