
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CloudDownload, Download } from 'lucide-react'; 
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OSMDownloadOptionsProps {
  isFetchingOSM: boolean;
  onFetchOSMDataTrigger: () => void;
  // isActiveDrawToolPresent prop removed in previous steps

  downloadFormat: string;
  onDownloadFormatChange: (format: string) => void;
  isDownloading: boolean;
  onDownloadOSMLayers: () => void;
  uniqueIdPrefix?: string;
}

const OSMDownloadOptions: React.FC<OSMDownloadOptionsProps> = ({
  isFetchingOSM,
  onFetchOSMDataTrigger,
  // isActiveDrawToolPresent removed
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

  const getFetchButtonTooltipContent = () => {
    if (isFetchingOSM) return "Cargando...";
    return "Obtener OSM";
  };

  const getDownloadButtonTooltipContent = () => {
    if (isDownloading) return "Descargando...";
    return "Descargar OSM";
  };

  const iconButtonBaseClass = "h-8 w-8 p-0 flex items-center justify-center";

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-3">
        <Separator className="my-2 bg-white/20" />
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                  onClick={onFetchOSMDataTrigger} 
                  className={`${iconButtonBaseClass} bg-primary/70 hover:bg-primary/90 text-primary-foreground`}
                  disabled={isFetchingOSM}
                  aria-label={getFetchButtonTooltipContent()}
              >
                  {isFetchingOSM ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{getFetchButtonTooltipContent()}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                  <Button 
                      className={`${iconButtonBaseClass} bg-primary hover:bg-primary/90 text-primary-foreground`}
                      disabled={isDownloading}
                      aria-label={getDownloadButtonTooltipContent()}
                  >
                      {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
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
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{getDownloadButtonTooltipContent()}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default OSMDownloadOptions;
