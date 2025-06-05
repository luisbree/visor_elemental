
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Layers } from 'lucide-react';

interface GeoServerUrlInputProps {
  geoServerUrlInput: string;
  onGeoServerUrlChange: (url: string) => void;
  onFetchGeoServerLayers: () => void;
  isLoadingGeoServerLayers: boolean;
  uniqueIdPrefix?: string;
}

const GeoServerUrlInput: React.FC<GeoServerUrlInputProps> = ({
  geoServerUrlInput,
  onGeoServerUrlChange,
  onFetchGeoServerLayers,
  isLoadingGeoServerLayers,
  uniqueIdPrefix = "geoserverurl"
}) => {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
         <Label htmlFor={`${uniqueIdPrefix}-input`} className="text-xs font-medium text-white/90 block">URL de GeoServer (WMS)</Label>
         <Input 
           id={`${uniqueIdPrefix}-input`}
           type="text"
           placeholder="Ej: http://localhost:8080/geoserver"
           value={geoServerUrlInput}
           onChange={(e) => onGeoServerUrlChange(e.target.value)}
           className="w-full text-xs h-8 border-white/30 bg-black/20 text-white/90 focus:ring-primary placeholder:text-gray-400/70"
         />
      </div>
      <Button 
        onClick={onFetchGeoServerLayers} 
        className="w-full bg-primary/80 hover:bg-primary text-primary-foreground text-xs h-8"
        disabled={isLoadingGeoServerLayers || !geoServerUrlInput.trim()}
      >
        {isLoadingGeoServerLayers ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Layers className="mr-2 h-3 w-3" />}
        <span className="truncate">{isLoadingGeoServerLayers ? 'Cargando...' : 'Cargar Capas de GeoServer'}</span>
      </Button>
    </div>
  );
};

export default GeoServerUrlInput;
