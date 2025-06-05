
"use client";

import React, { useState, useEffect, useRef } from 'react';
import DraggablePanel from './DraggablePanel'; // Using the new generic DraggablePanel
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area'; // Keep for internal table scroll if needed

interface FeatureAttributesPanelProps {
  featuresAttributes: Record<string, any>[] | null;
  isVisible: boolean;
  layerName?: string | null;
  onClose: () => void;
  // Props for DraggablePanel positioning, if managed by parent
  panelRef: React.RefObject<HTMLDivElement>;
  initialPosition: { x: number; y: number };
  onMouseDownHeader: (e: React.MouseEvent<HTMLDivElement>) => void;
  isPanelCollapsed: boolean; // Renamed to avoid conflict if DraggablePanel has its own collapse state
  onTogglePanelCollapse: () => void; // Renamed
}

const ITEMS_PER_PAGE = 50;

const FeatureAttributesPanel: React.FC<FeatureAttributesPanelProps> = ({
  featuresAttributes,
  isVisible,
  layerName,
  onClose,
  panelRef,
  initialPosition,
  onMouseDownHeader,
  isPanelCollapsed,
  onTogglePanelCollapse,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (isVisible) {
      setCurrentPage(1);
    }
  }, [featuresAttributes, isVisible]);

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

  const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  const panelTitle = layerName 
    ? `${layerName} (${featuresAttributes.length})` 
    : `Atributos (${featuresAttributes.length})`;

  return (
    <DraggablePanel
      title={panelTitle}
      panelRef={panelRef}
      initialPosition={initialPosition} // Pass through for DraggablePanel's style
      onMouseDownHeader={onMouseDownHeader} // Pass through for DraggablePanel
      isCollapsed={isPanelCollapsed}
      onToggleCollapse={onTogglePanelCollapse}
      onClose={onClose}
      initialSize={{ width: 450, height: 350 }} // Default size for this specific panel
      minSize={{ width: 300, height: 250 }}
      style={{ top: `${initialPosition.y}px`, left: `${initialPosition.x}px` }} // Explicitly set top/left
      overflowY="hidden" // DraggablePanel's CardContent uses ScrollArea, so hide overflow here
    >
      {/* Content for the FeatureAttributesPanel */}
      <div className="flex-grow flex flex-col overflow-hidden h-full">
         <ScrollArea className="flex-grow h-0 w-full">
          {allKeys.length > 0 && currentVisibleFeatures.length > 0 ? (
            <div className="overflow-x-auto"> {/* Table itself might need horizontal scroll */}
              <Table className="min-w-full"> 
                <TableHeader>
                  <TableRow className="bg-gray-800/50 hover:bg-gray-800/70 sticky top-0 z-10">
                    {allKeys.map(key => (
                      <TableHead 
                        key={key} 
                        className="px-3 py-2 text-xs font-medium text-gray-300 whitespace-nowrap bg-gray-700/90 backdrop-blur-sm"
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
          <div className="flex items-center justify-between p-2 border-t border-gray-700/50 bg-gray-800/50 mt-auto">
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
      </div>
    </DraggablePanel>
  );
};

export default FeatureAttributesPanel;
