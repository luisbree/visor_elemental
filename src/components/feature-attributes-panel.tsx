
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X as LucideX, ChevronLeft, ChevronRight } from 'lucide-react';

interface FeatureAttributesPanelProps {
  featuresAttributes: Record<string, any>[] | null;
  isVisible: boolean;
  layerName?: string | null;
  onClose: () => void;
}

const ITEMS_PER_PAGE = 50;

const FeatureAttributesPanel: React.FC<FeatureAttributesPanelProps> = ({
  featuresAttributes,
  isVisible,
  layerName,
  onClose,
}) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState({ width: 450, height: 350 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (isVisible) {
      setCurrentPage(1);
    }
  }, [featuresAttributes, isVisible]);

  const handleMouseDownOnHeader = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    const targetElement = e.target as HTMLElement;
    if (targetElement.closest('button')) {
        return;
    }
    
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: position.x,
      panelY: position.y,
    };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !panelRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      let newX = dragStartRef.current.panelX + dx;
      let newY = dragStartRef.current.panelY + dy;
      
      if (!isNaN(newX) && !isNaN(newY)) {
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);


  if (!isVisible || !featuresAttributes || featuresAttributes.length === 0) {
    return null;
  }

  const totalPages = Math.ceil(featuresAttributes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentVisibleFeatures = featuresAttributes.slice(startIndex, endIndex);

  const allKeys = Array.from(
    new Set(featuresAttributes.flatMap(attrs => Object.keys(attrs)))
  ).sort();

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const panelTitle = layerName 
    ? `${layerName} (${featuresAttributes.length})` 
    : `Atributos (${featuresAttributes.length})`;

  return (
    <div
      ref={panelRef}
      className="absolute bg-gray-800/60 backdrop-blur-md text-white shadow-xl rounded-lg border border-gray-700 flex flex-col"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        minWidth: '300px', 
        minHeight: '250px', 
        maxWidth: '90vw',
        maxHeight: '80vh',
        zIndex: 40, 
        resize: 'both', 
        overflow: 'hidden',
      }}
      onMouseUpCapture={() => {
        if (panelRef.current) {
            const newWidth = panelRef.current.offsetWidth;
            const newHeight = panelRef.current.offsetHeight;
            if (newWidth !== size.width || newHeight !== size.height) {
                 setSize({ width: newWidth, height: newHeight });
            }
        }
      }}
    >
      <CardHeader
        className="flex flex-row items-center justify-between p-2 bg-gray-700/80 cursor-grab rounded-t-lg"
        onMouseDown={handleMouseDownOnHeader}
      >
        <CardTitle className="text-sm font-semibold text-white">{panelTitle}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 text-white hover:bg-gray-600/80">
          <LucideX className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </Button>
      </CardHeader>
      <CardContent className="p-3 flex-grow flex flex-col overflow-hidden">
        <ScrollArea className="flex-grow h-0 w-full"> 
          {allKeys.length > 0 && currentVisibleFeatures.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-full"> 
                <TableHeader>
                  <TableRow className="bg-gray-800/50 hover:bg-gray-800/70">
                    {allKeys.map(key => (
                      <TableHead 
                        key={key} 
                        className="px-3 py-2 text-xs font-medium text-gray-300 whitespace-nowrap sticky top-0 bg-gray-700/90 backdrop-blur-sm z-10"
                      >
                        {key}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentVisibleFeatures.map((attrs, idx) => (
                    <TableRow key={`${currentPage}-${startIndex + idx}`} className="hover:bg-gray-700/30">
                      {allKeys.map(key => (
                        <TableCell
                          key={key}
                          className="px-3 py-1.5 text-xs text-black dark:text-slate-200 border-b border-gray-700/50 whitespace-normal break-words"
                        >
                          {String(attrs[key] === null || attrs[key] === undefined ? '' : attrs[key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="p-4 text-sm text-center text-gray-400">
              {featuresAttributes.length > 0 ? 'No hay atributos para mostrar en esta página.' : 'No hay atributos para mostrar.'}
            </p>
          )}
        </ScrollArea>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-2 border-t border-gray-700/50 bg-gray-800/50 mt-auto"> {/* mt-auto para empujar al fondo */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="text-xs h-7 bg-gray-600/70 hover:bg-gray-500/70 border-gray-500 text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Anterior
            </Button>
            <span className="text-xs text-gray-300">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="text-xs h-7 bg-gray-600/70 hover:bg-gray-500/70 border-gray-500 text-white"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </div>
  );
};

export default FeatureAttributesPanel;
