
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, X as LucideX } from 'lucide-react'; // Removed GripVertical
import { ScrollArea } from '@/components/ui/scroll-area';

interface DraggablePanelProps {
  title: string;
  initialPosition: { x: number; y: number };
  initialSize?: { width: number; height: number }; // Optional initial size
  minSize?: { width: number; height: number };
  maxSize?: { width?: number; height?: number };
  panelRef: React.RefObject<HTMLDivElement>; // Pass the ref from parent
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void; // Pass mousedown handler from parent hook
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void; // Optional close button handler
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties; // To apply position and size from parent hook
  showCloseButton?: boolean;
  overflowX?: 'auto' | 'hidden' | 'visible';
  overflowY?: 'auto' | 'hidden' | 'visible';
  icon?: React.ElementType; // Optional icon for the panel header
}

const DraggablePanel: React.FC<DraggablePanelProps> = ({
  title,
  initialPosition, // Used by parent hook to set style.top/left
  initialSize = { width: 350, height: 400 },
  minSize = { width: 250, height: 200 },
  maxSize = {},
  panelRef,
  onMouseDownHeader,
  isCollapsed,
  onToggleCollapse,
  onClose,
  children,
  className,
  style,
  showCloseButton = true,
  overflowX = 'hidden',
  overflowY = 'auto',
  icon: IconComponent,
}) => {
  const [currentSize, setCurrentSize] = useState(initialSize);

  // Effect to update size state when panelRef's dimensions change (e.g., via resize handle)
  // This assumes the parent hook updates the style prop for position.
  // The panelRef.current.offsetWidth/Height reflect the actual rendered size.
  const handleResizeStop = useCallback(() => {
    if (panelRef.current) {
      const newWidth = panelRef.current.offsetWidth;
      const newHeight = panelRef.current.offsetHeight;
      // Update internal size state only if it has actually changed
      if (newWidth !== currentSize.width || newHeight !== currentSize.height) {
        setCurrentSize({ width: newWidth, height: newHeight });
      }
    }
  }, [panelRef, currentSize.width, currentSize.height]);


  return (
    <div
      ref={panelRef}
      className={`absolute bg-gray-800/70 backdrop-blur-md text-white shadow-xl rounded-lg border border-gray-700/80 flex flex-col ${className}`}
      style={{
        ...style, // This should include top, left
        width: `${currentSize.width}px`, // Maintain width even when collapsed
        height: isCollapsed ? 'auto' : `${currentSize.height}px`, // Adjust height when collapsed
        minWidth: `${minSize.width}px`,
        minHeight: isCollapsed ? 'auto' : `${minSize.height}px`,
        maxWidth: maxSize.width ? `${maxSize.width}px` : '90vw',
        maxHeight: maxSize.height ? `${maxSize.height}px` : '80vh',
        resize: isCollapsed ? 'none' : 'both', // Allow resize only when not collapsed
        overflow: 'hidden', // Outer div hides overflow, scroll area handles inner content
        zIndex: 30, // Ensure panels are on top
      }}
      onMouseUpCapture={handleResizeStop} // Capture mouse up on the panel itself for resize
    >
      <CardHeader
        className="flex flex-row items-center justify-between p-2 bg-gray-700/80 cursor-grab rounded-t-lg select-none"
        onMouseDown={onMouseDownHeader}
      >
        <div className="flex items-center">
          {/* Icono de agarre eliminado */}
          {IconComponent && <IconComponent className="h-4 w-4 mr-2 text-primary" />}
          <CardTitle className="text-sm font-semibold text-white truncate" title={title}>{title}</CardTitle>
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-6 w-6 text-white hover:bg-gray-600/80">
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            <span className="sr-only">{isCollapsed ? 'Expandir' : 'Colapsar'}</span>
          </Button>
          {showCloseButton && onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 text-white hover:bg-gray-600/80">
              <LucideX className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="p-0 flex-grow flex flex-col overflow-hidden"> {/* Changed p-3 to p-0 */}
          <ScrollArea 
            className="flex-grow h-0 w-full" 
            style={{ overflowX: overflowX, overflowY: overflowY }} // Control scroll on ScrollArea
          >
            <div className="p-3"> {/* Add padding back here for the content inside scroll area */}
             {children}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </div>
  );
};

export default DraggablePanel;
