
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react'; // MapPin, Download removed
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

  downloadFormat: string;
  onDownloadFormatChange: (format: string) => void;
  isDownloading: boolean;
  onDownloadOSMLayers: () => void;
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

  const handleDownloadWithFormat = (format: string) => {
    onDownloadFormatChange(format);
    onDownloadOSMLayers(); 
  };

  return (
    <div className="space-y-3">
       <Separator className="my-2 bg-white/20" />
       <div className="flex items-center gap-1">
        <Button 
            onClick={onFetchOSMDataTrigger} 
            size="sm"
            className="flex-1 min-w-0 bg-primary/70 hover:bg-primary/90 text-primary-foreground text-xs h-8 px-2"
            disabled={isFetchingOSM || isActiveDrawToolPresent}
            title="Obtener datos OSM del último polígono dibujado"
        >
            {isFetchingOSM && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            <span className="truncate">{isFetchingOSM ? 'Cargando...' : 'Obtener OSM'}</span>
        </Button>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button 
                size="sm" 
                className="flex-1 min-w-0 bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 px-2"
                disabled={isDownloading}
                title="Descargar capas OSM importadas"
            >
                {isDownloading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                <span className="truncate">{isDownloading ? 'Descargando...' : 'Descargar OSM'}</span>
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
    </div>
  );
};

export default OSMDownloadOptions;

