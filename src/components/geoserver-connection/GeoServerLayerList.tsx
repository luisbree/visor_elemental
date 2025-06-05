
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GeoServerDiscoveredLayer } from '@/lib/types';

interface GeoServerLayerListProps {
  geoServerDiscoveredLayers: GeoServerDiscoveredLayer[];
  onAddGeoServerLayerToMap: (layerName: string, layerTitle: string) => void;
}

const GeoServerLayerList: React.FC<GeoServerLayerListProps> = ({
  geoServerDiscoveredLayers,
  onAddGeoServerLayerToMap,
}) => {
  if (!geoServerDiscoveredLayers || geoServerDiscoveredLayers.length === 0) {
    return <p className="text-xs text-gray-400/80 text-center py-2">No hay capas de GeoServer para mostrar. Ingrese una URL y cargue capas.</p>;
  }

  return (
    <>
      <Label className="text-xs font-medium text-white/90 mb-1 block">Capas Disponibles en GeoServer:</Label>
      <ScrollArea className="h-32 border border-white/10 p-2 rounded-md bg-black/10">
          <ul className="space-y-1.5">
              {geoServerDiscoveredLayers.map((gsLayer) => (
                  <li key={gsLayer.name} className="flex items-center p-1.5 rounded-md border border-white/15 bg-black/10 hover:bg-white/20 transition-colors overflow-hidden">
                      <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-6 px-2 mr-2 bg-green-600/30 hover:bg-green-500/50 border-green-500/50 text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                          onClick={() => onAddGeoServerLayerToMap(gsLayer.name, gsLayer.title)}
                          disabled={gsLayer.addedToMap}
                          title={gsLayer.addedToMap ? "Capa ya añadida" : "Añadir capa al mapa"}
                      >
                          {gsLayer.addedToMap ? 'Añadida' : 'Añadir'}
                      </Button>
                      <span 
                        className="flex-1 cursor-default text-xs font-medium text-white truncate min-w-0"
                        title={`${gsLayer.title} (${gsLayer.name})`}
                      >
                          {gsLayer.title}
                      </span>
                  </li>
              ))}
          </ul>
      </ScrollArea>
    </>
  );
};

export default GeoServerLayerList;
