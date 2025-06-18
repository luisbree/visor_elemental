
"use client";

import React from 'react';
import DraggablePanel from './DraggablePanel';
import { ListChecks } from 'lucide-react';

interface AttributesPanelProps {
  panelRef: React.RefObject<HTMLDivElement>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClosePanel: () => void;
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
}

const AttributesPanel: React.FC<AttributesPanelProps> = ({
  panelRef,
  isCollapsed,
  onToggleCollapse,
  onClosePanel,
  onMouseDownHeader,
  style,
}) => {
  return (
    <DraggablePanel
      title="Atributos"
      icon={ListChecks}
      panelRef={panelRef}
      initialPosition={{ x: 0, y: 0 }} // Position controlled by useFloatingPanels
      onMouseDownHeader={onMouseDownHeader}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      onClose={onClosePanel}
      showCloseButton={true}
      style={style}
      zIndex={style?.zIndex as number | undefined}
    >
      <div className="p-3">
        <p className="text-sm text-gray-300">
          Este es el panel de Atributos. Su contenido se definirá más adelante.
        </p>
        {/* Aquí puedes agregar el contenido específico del panel de atributos */}
      </div>
    </DraggablePanel>
  );
};

export default AttributesPanel;
