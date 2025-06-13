
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Camera, ChevronDown } from 'lucide-react'; 

interface MapPanelProps {
  panelRef: React.RefObject<HTMLDivElement>;
  position: { x: number; y: number };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCaptureMap: (options: { format: 'png' | 'jpeg'; band?: 'red' | 'green' | 'blue' }) => void;
  isCapturing: boolean;
  activeBaseLayerId: string | undefined;
}

const MapPanel: React.FC<MapPanelProps> = ({
  panelRef,
  position,
  isCollapsed,
  onToggleCollapse,
  onMouseDownHeader,
  onCaptureMap,
  isCapturing,
  activeBaseLayerId,
}) => {
  const canCapture = activeBaseLayerId === 'esri-satellite';

  return (
    <DraggablePanel
      title="Captura de Mapa"
      panelRef={panelRef}
      initialPosition={position}
      onMouseDownHeader={onMouseDownHeader}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      showCloseButton={false}
      icon={Camera} 
    >
      <div className="space-y-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={isCapturing || !canCapture}
              className="w-full bg-primary/80 hover:bg-primary text-primary-foreground text-xs h-8 flex items-center justify-between"
              title={canCapture ? "Seleccionar opción de captura" : "Active la capa ESRI Satelital para capturar"}
            >
              <div className="flex items-center">
                <Camera className="mr-2 h-3.5 w-3.5" />
                {isCapturing ? 'Capturando...' : 'Opciones de Captura'}
              </div>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] bg-gray-700 text-white border-gray-600">
            <DropdownMenuItem
              disabled={isCapturing || !canCapture}
              onSelect={() => onCaptureMap({ format: 'png' })}
              className="text-xs hover:bg-gray-600 focus:bg-gray-600 cursor-pointer"
            >
              Descargar PNG Completo
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isCapturing || !canCapture}
              onSelect={() => onCaptureMap({ format: 'jpeg' })}
              className="text-xs hover:bg-gray-600 focus:bg-gray-600 cursor-pointer"
            >
              Descargar JPG Completo
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isCapturing || !canCapture}
              onSelect={() => onCaptureMap({ format: 'jpeg', band: 'red' })}
              className="text-xs hover:bg-gray-600 focus:bg-gray-600 cursor-pointer"
            >
              Descargar Banda Roja (JPG)
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isCapturing || !canCapture}
              onSelect={() => onCaptureMap({ format: 'jpeg', band: 'green' })}
              className="text-xs hover:bg-gray-600 focus:bg-gray-600 cursor-pointer"
            >
              Descargar Banda Verde (JPG)
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isCapturing || !canCapture}
              onSelect={() => onCaptureMap({ format: 'jpeg', band: 'blue' })}
              className="text-xs hover:bg-gray-600 focus:bg-gray-600 cursor-pointer"
            >
              Descargar Banda Azul (JPG)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!canCapture && (
          <p className="text-xs text-muted-foreground text-center">
            La captura de pantalla solo está disponible con la capa base "ESRI Satelital".
          </p>
        )}
      </div>
    </DraggablePanel>
  );
};

export default MapPanel;
