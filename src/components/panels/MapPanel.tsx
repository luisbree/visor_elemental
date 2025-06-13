
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react'; // Icon for the panel and button

interface MapPanelProps {
  panelRef: React.RefObject<HTMLDivElement>;
  position: { x: number; y: number };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCaptureMap: () => void;
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
      title="Mapa"
      panelRef={panelRef}
      initialPosition={position} // This will be controlled by useFloatingPanels
      onMouseDownHeader={onMouseDownHeader}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      showCloseButton={false}
      icon={Camera} // Icon for the panel header
    >
      <div className="space-y-3">
        <Button
          onClick={onCaptureMap}
          disabled={isCapturing || !canCapture}
          className="w-full bg-primary/80 hover:bg-primary text-primary-foreground text-xs h-8"
          title={canCapture ? "Tomar captura de la vista actual del mapa ESRI" : "Active la capa ESRI Satelital para capturar"}
        >
          <Camera className="mr-2 h-3.5 w-3.5" />
          {isCapturing ? 'Capturando...' : 'Capturar Vista (ESRI)'}
        </Button>
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
