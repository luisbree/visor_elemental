
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface OSMDownloadOptionsProps {
  isFetchingOSM: boolean;
  onFetchOSMDataTrigger: () => void;
  isActiveDrawToolPresent: boolean;

  downloadFormat: string; // Still needed to inform the hook, though not directly selected by user here
  onDownloadFormatChange: (format: string) => void;
  isDownloading: boolean;
  onDownloadOSMLayers: () => void;
  uniqueIdPrefix?: string;
}

const OSMDownloadOptions: React.FC<OSMDownloadOptionsProps> = ({
  isFetchingOSM,
  onFetchOSMDataTrigger,
  isActiveDrawToolPresent,
  downloadFormat, // Kept for consistency with the hook, though not directly used for selection in UI
  onDownloadFormatChange,
  isDownloading,
  onDownloadOSMLayers,
  uniqueIdPrefix = "osmdownload"
}) => {

  const handleDownloadWithFormat = (format: string) => {
    onDownloadFormatChange(format);
    // Add a slight delay to ensure state update before triggering download, if necessary
    // requestAnimationFrame(() => onDownloadOSMLayers()); 
    // Or, if onDownloadOSMLayers correctly uses the latest state from its hook, direct call is fine
    onDownloadOSMLayers(); 
  };

  return (
    <div className="space-y-3">
       <Separator className="my-2 bg-white/20" />
       <div className="flex items-center gap-2">
        <Button 
            onClick={onFetchOSMDataTrigger} 
            className="flex-1 bg-primary/70 hover:bg-primary/90 text-primary-foreground text-xs h-8"
            disabled={isFetchingOSM || isActiveDrawToolPresent}
            title="Obtener datos OSM del último polígono dibujado"
        >
            {isFetchingOSM ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <MapPin className="mr-2 h-3 w-3" />}
            {isFetchingOSM ? 'Obteniendo...' : 'Obtener Datos OSM'}
        </Button>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button 
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
                disabled={isDownloading}
                title="Descargar capas OSM importadas"
            >
                {isDownloading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Download className="mr-2 h-3 w-3" />}
                {isDownloading ? 'Descargando...' : 'Descargar Capas OSM'}
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-700 text-white border-gray-600 w-[--radix-dropdown-menu-trigger-width]">
            <DropdownMenuItem 
                className="text-xs hover:bg-gray-600 focus:bg-gray-600 cursor-pointer"
                onSelect={() => handleDownloadWithFormat('geojson')}
            >
                Como GeoJSON
            </DropdownMenuItem>
            <DropdownMenuItem 
                className="text-xs hover:bg-gray-600 focus:bg-gray-600 cursor-pointer"
                onSelect={() => handleDownloadWithFormat('kml')}
            >
                Como KML
            </DropdownMenuItem>
            <DropdownMenuItem 
                className="text-xs hover:bg-gray-600 focus:bg-gray-600 cursor-pointer"
                onSelect={() => handleDownloadWithFormat('shp')}
            >
                Como Shapefile (ZIP)
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* The original select for format is removed */}
    </div>
  );
};

export default OSMDownloadOptions;
