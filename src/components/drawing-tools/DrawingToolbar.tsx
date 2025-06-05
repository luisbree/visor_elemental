
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Square, PenLine, Dot, Ban, Eraser, Save } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface DrawingToolbarProps {
  activeDrawTool: string | null;
  onToggleDrawingTool: (toolType: 'Polygon' | 'LineString' | 'Point') => void;
  onStopDrawingTool: () => void;
  onClearDrawnFeatures: () => void;
  onSaveDrawnFeaturesAsKML: () => void;
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeDrawTool,
  onToggleDrawingTool,
  onStopDrawingTool,
  onClearDrawnFeatures,
  onSaveDrawnFeaturesAsKML,
}) => {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Button 
          onClick={() => onToggleDrawingTool('Polygon')} 
          className={`text-xs h-8 focus-visible:ring-primary ${
            activeDrawTool === 'Polygon'
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
              : 'border border-white/30 text-white/90 bg-black/20 hover:bg-black/40'
          }`}
          title="Dibujar Polígono (para obtener datos OSM)"
        >
          <Square className="mr-1 h-3 w-3" /> Polígono
        </Button>
        <Button 
          onClick={() => onToggleDrawingTool('LineString')} 
          className={`text-xs h-8 focus-visible:ring-primary ${
            activeDrawTool === 'LineString'
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
              : 'border border-white/30 text-white/90 bg-black/20 hover:bg-black/40'
          }`}
          title="Dibujar Línea"
        >
          <PenLine className="mr-1 h-3 w-3" /> Línea
        </Button>
        <Button 
          onClick={() => onToggleDrawingTool('Point')} 
          className={`text-xs h-8 focus-visible:ring-primary ${
            activeDrawTool === 'Point'
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
              : 'border border-white/30 text-white/90 bg-black/20 hover:bg-black/40'
          }`}
          title="Dibujar Punto"
        >
          <Dot className="mr-1 h-3 w-3" /> Punto
        </Button>
      </div>
      {activeDrawTool && (
        <Button 
          onClick={onStopDrawingTool} 
          className="w-full text-xs h-8 border border-white/30 hover:bg-white/10 text-white/90 bg-black/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <Ban className="mr-2 h-3 w-3" /> Detener Dibujo
        </Button>
      )}
      <Separator className="my-2 bg-white/20" />
      <Button 
        onClick={onClearDrawnFeatures} 
        className="w-full text-xs h-8 border border-white/30 text-white/90 bg-black/20 hover:bg-red-500/20 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        disabled={!!activeDrawTool}
      >
        <Eraser className="mr-2 h-3 w-3" /> Limpiar Dibujos
      </Button>
      <Button 
        onClick={onSaveDrawnFeaturesAsKML} 
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 mt-2"
        disabled={!!activeDrawTool}
      >
        <Save className="mr-2 h-3 w-3" /> Guardar Dibujos (KML)
      </Button>
    </div>
  );
};

export default DrawingToolbar;
