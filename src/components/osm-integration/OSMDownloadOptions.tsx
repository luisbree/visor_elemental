
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { MapLayer } from '@/lib/types';

interface OSMDownloadOptionsProps {
  isFetchingOSM: boolean;
  onFetchOSMDataTrigger: () => void;
  isActiveDrawToolPresent: boolean;

  downloadFormat: string;
  onDownloadFormatChange: (format: string) => void;
  isDownloading: boolean;
  onDownloadOSMLayers: () => void; // Simplified: assumes it knows which layers to download (e.g., all OSM layers)
  uniqueIdPrefix?: string;
}

const OSMDownloadOptions: React.FC<OSMDownloadOptionsProps> = ({
  isFetchingOSM,
  onFetchOSMDataTrigger,
  isActiveDrawToolPresent,
  downloadFormat,
  onDownloadFormatChange,
  isDownloading,
  onDownloadOSMLayers,
  uniqueIdPrefix = "osmdownload"
}) => {
  return (
    <div className="space-y-3">
       <Separator className="my-2 bg-white/20" />
      <Button 
        onClick={onFetchOSMDataTrigger} 
        className="w-full bg-primary/70 hover:bg-primary/90 text-primary-foreground text-xs h-8"
        disabled={isFetchingOSM || isActiveDrawToolPresent}
      >
        {isFetchingOSM ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <MapPin className="mr-2 h-3 w-3" />}
        {isFetchingOSM ? 'Obteniendo Datos...' : 'Obtener Datos OSM (del último polígono)'}
      </Button>
      <Separator className="my-2 bg-white/20" />
      <div>
        <Label htmlFor={`${uniqueIdPrefix}-format-select`} className="text-xs font-medium text-white/90 mb-1 block">Formato de Descarga Capas OSM</Label>
        <Select value={downloadFormat} onValueChange={onDownloadFormatChange}>
          <SelectTrigger id={`${uniqueIdPrefix}-format-select`} className="w-full text-xs h-8 border-white/30 bg-black/20 text-white/90 focus:ring-primary">
            <SelectValue placeholder="Seleccionar formato" />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 text-white border-gray-600">
            <SelectItem value="geojson" className="text-xs hover:bg-gray-600 focus:bg-gray-600">GeoJSON</SelectItem>
            <SelectItem value="kml" className="text-xs hover:bg-gray-600 focus:bg-gray-600">KML</SelectItem>
            <SelectItem value="shp" className="text-xs hover:bg-gray-600 focus:bg-gray-600">Shapefile (ZIP)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button 
        onClick={onDownloadOSMLayers} 
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 mt-2"
        disabled={isDownloading}
      >
        {isDownloading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Download className="mr-2 h-3 w-3" />}
        {isDownloading ? 'Descargando...' : 'Descargar Capas OSM'}
      </Button>
    </div>
  );
};

export default OSMDownloadOptions;
