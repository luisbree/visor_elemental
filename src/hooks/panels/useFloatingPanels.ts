
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';

interface PanelState {
  position: { x: number; y: number };
  isCollapsed: boolean;
  ref: React.RefObject<HTMLDivElement>;
  isMinimized: boolean; // New state
}

interface UseFloatingPanelsProps {
  layersPanelRef: React.RefObject<HTMLDivElement>;
  toolsPanelRef: React.RefObject<HTMLDivElement>;
  mapAreaRef: React.RefObject<HTMLDivElement>;
  panelWidth?: number;
  panelPadding?: number;
  estimatedCollapsedHeaderHeight?: number;
}

const DEFAULT_PANEL_WIDTH = 350;
const DEFAULT_PANEL_PADDING = 8;
const DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT = 32; 

export function useFloatingPanels({
  layersPanelRef,
  toolsPanelRef,
  mapAreaRef,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelPadding = DEFAULT_PANEL_PADDING,
  estimatedCollapsedHeaderHeight = DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT,
}: UseFloatingPanelsProps) {

  const [panels, setPanels] = useState<Record<string, PanelState>>({
    layers: { position: { x: panelPadding, y: panelPadding }, isCollapsed: false, ref: layersPanelRef, isMinimized: false },
    tools: { position: { x: panelWidth + 2 * panelPadding, y: panelPadding }, isCollapsed: true, ref: toolsPanelRef, isMinimized: false },
  });

  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  useEffect(() => {
    if (mapAreaRef.current) {
      const yPos = panelPadding; 
      let currentXOffset = panelPadding;
      
      const getPanelEffectiveWidth = (panelId: string, isCollapsed: boolean, isMinimized: boolean) => {
         if (isMinimized) return 0; // Minimized panels don't take up layout space
         const panelRef = panels[panelId]?.ref;
         if (panelRef?.current && isCollapsed) {
           return panelRef.current.offsetWidth > 0 ? panelRef.current.offsetWidth : estimatedCollapsedHeaderHeight * 1.5;
         }
         return panelWidth;
      };

      // Only adjust positions if not manually dragged
      if (!draggingPanelId) {
          const layersPanelX = currentXOffset;
          currentXOffset += getPanelEffectiveWidth('layers', panels.layers.isCollapsed, panels.layers.isMinimized) + (panels.layers.isMinimized ? 0 : panelPadding);
    
          const toolsPanelX = currentXOffset;
    
          setPanels(prev => ({
            layers: {
              ...prev.layers,
              position: prev.layers.isMinimized ? prev.layers.position : { x: layersPanelX, y: yPos }, // Keep position if minimized
              ref: layersPanelRef,
            },
            tools: {
              ...prev.tools,
              position: prev.tools.isMinimized ? prev.tools.position : { x: toolsPanelX, y: yPos }, // Keep position if minimized
              ref: toolsPanelRef,
            },
          }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAreaRef, panelPadding, panelWidth, layersPanelRef, toolsPanelRef, estimatedCollapsedHeaderHeight]);
  // draggingPanelId intentionally omitted from deps here to avoid re-layout during drag


  const handlePanelMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, panelId: string) => {
    const panel = panels[panelId];
    if (!panel || !panel.ref.current || panel.isMinimized) return;

    const targetElement = e.target as HTMLElement;
    if (targetElement.closest('button') || targetElement.closest('input') || targetElement.closest('[role="combobox"]') || targetElement.closest('[role="menuitem"]') || targetElement.closest('[role="menu"]')) {
        return; 
    }

    setDraggingPanelId(panelId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: panel.position.x,
      panelY: panel.position.y,
    };
    e.preventDefault();
  }, [panels]);

  const togglePanelCollapse = useCallback((panelId: string) => {
    setPanels(prev => {
      if (prev[panelId]?.isMinimized) return prev; // Don't change collapse state if minimized
      return {
        ...prev,
        [panelId]: { ...prev[panelId], isCollapsed: !prev[panelId].isCollapsed },
      };
    });
  }, []);

  const togglePanelMinimize = useCallback((panelId: string) => {
    setPanels(prev => {
      const panel = prev[panelId];
      if (!panel) return prev;
      
      const newMinimizedState = !panel.isMinimized;
      let newPosition = panel.position;

      if (!newMinimizedState) { // Restoring
        // If panel was minimized, try to place it intelligently or restore last known good pos
        // For now, use its current position which might have been its last non-minimized pos
        // Or, a default position if it was never unminimized (though initial state handles that)
      }

      return {
        ...prev,
        [panelId]: { 
          ...panel, 
          isMinimized: newMinimizedState,
          position: newPosition,
          // isCollapsed: newMinimizedState ? true : panel.isCollapsed, // Optionally force collapse on minimize
        },
      };
    });
  }, []);


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingPanelId || !mapAreaRef.current) return;

      const panelToMove = panels[draggingPanelId];
      if (!panelToMove || !panelToMove.ref.current || panelToMove.isMinimized) return;

      const mapRect = mapAreaRef.current.getBoundingClientRect(); 
      const panelRect = panelToMove.ref.current.getBoundingClientRect(); 
      
      const panelCurrentWidth = panelRect.width;
      const panelCurrentHeight = panelRect.height;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      let newX = dragStartRef.current.panelX + dx;
      let newY = dragStartRef.current.panelY + dy;

      if (panelCurrentWidth > 0 && panelCurrentHeight > 0 && mapRect.width > 0 && mapRect.height > 0) {
        newX = Math.max(0, Math.min(newX, mapRect.width - panelCurrentWidth));
        newY = Math.max(0, Math.min(newY, mapRect.height - panelCurrentHeight));
      }

      if (!isNaN(newX) && !isNaN(newY)) {
        setPanels(prev => ({
          ...prev,
          [draggingPanelId]: { ...prev[draggingPanelId], position: { x: newX, y: newY } },
        }));
      }
    };

    const handleMouseUp = () => {
      setDraggingPanelId(null);
    };

    if (draggingPanelId) {
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
  }, [draggingPanelId, panels, mapAreaRef]);

  return {
    panels,
    handlePanelMouseDown,
    togglePanelCollapse,
    togglePanelMinimize, // Expose new function
  };
}
