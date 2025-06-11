
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { MousePointerClick } from 'lucide-react';

interface InspectToolToggleProps {
  isInspectModeActive: boolean;
  onToggleInspectMode: () => void;
  // isActiveDrawToolPresent prop removed
}

const InspectToolToggle: React.FC<InspectToolToggleProps> = ({
  isInspectModeActive,
  onToggleInspectMode,
  // isActiveDrawToolPresent prop removed from destructuring
}) => {
  return (
    <Button 
      onClick={onToggleInspectMode} 
      className={`flex-1 text-xs h-8 focus-visible:ring-primary ${
        isInspectModeActive 
          ? 'bg-primary hover:bg-primary/90 text-primary-foreground' 
          : 'border border-white/30 text-white/90 bg-black/20 hover:bg-black/40 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary'
      }`}
      // disabled prop removed
      title="Activar/Desactivar modo inspector"
    >
      <MousePointerClick className="mr-2 h-4 w-4" />
      {isInspectModeActive ? 'Inspeccionando' : 'Inspeccionar'}
    </Button>
  );
};

export default InspectToolToggle;
