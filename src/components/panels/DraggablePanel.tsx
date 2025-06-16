
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, X as LucideX } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DraggablePanelProps {
  title: string;
  initialPosition: { x: number; y: number };
  initialSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width?: number; height?: number };
  panelRef: React.RefObject<HTMLDivElement>;
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void; // Changed from optional to required for panels that can be closed
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  showCloseButton?: boolean;
  overflowX?: 'auto' | 'hidden' | 'visible';
  overflowY?: 'auto' | 'hidden' | 'visible';
  icon?: React.ElementType;
  zIndex?: number;
}

const DraggablePanel: React.FC<DraggablePanelProps> = ({
  title,
  initialPosition,
  initialSize = { width: 350, height: 400 },
  minSize = { width: 250, height: 200 },
  maxSize = {},
  panelRef,
  onMouseDownHeader,
  isCollapsed,
  onToggleCollapse,
  onClose, // Now used
  children,
  className,
  style,
  showCloseButton = true, // Default to true
  overflowX = 'hidden',
  overflowY = 'auto',
  icon: IconComponent,
  zIndex,
}) => {
  const [currentSize, setCurrentSize] = useState(initialSize);

  const handleResizeStop = useCallback(() => {
    if (panelRef.current) {
      const newWidth = panelRef.current.offsetWidth;
      const newHeight = panelRef.current.offsetHeight;
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
        ...style,
        width: `${currentSize.width}px`,
        height: isCollapsed ? 'auto' : `${currentSize.height}px`,
        minWidth: `${minSize.width}px`,
        minHeight: isCollapsed ? 'auto' : `${minSize.height}px`,
        maxWidth: maxSize.width ? `${maxSize.width}px` : '90vw',
        maxHeight: maxSize.height ? `${maxSize.height}px` : '80vh',
        resize: isCollapsed ? 'none' : 'both',
        overflow: 'hidden',
        zIndex: zIndex ?? 30,
      }}
      onMouseUpCapture={handleResizeStop}
    >
      <CardHeader
        className="flex flex-row items-center justify-between p-2 bg-gray-700/80 cursor-grab rounded-t-lg select-none"
        onMouseDown={onMouseDownHeader}
      >
        <div className="flex items-center">
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
              <span className="sr-only">Cerrar Panel</span>
            </Button>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="p-0 flex-grow flex flex-col overflow-hidden">
          <ScrollArea 
            className="flex-grow h-0 w-full" 
            style={{ overflowX: overflowX, overflowY: overflowY }}
          >
            <div className="p-3">
             {children}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </div>
  );
};

export default DraggablePanel;
