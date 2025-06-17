
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';

interface PanelState {
  position: { x: number; y: number };
  isCollapsed: boolean;
  ref: React.RefObject<HTMLDivElement>;
  isMinimized: boolean; 
}

interface UseFloatingPanelsProps {
  layersPanelRef: React.RefObject<HTMLDivElement>; // Datos
  toolsPanelRef: React.RefObject<HTMLDivElement>;  // Herramientas
  legendPanelRef: React.RefObject<HTMLDivElement>; // Capas (nuevo)
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
  legendPanelRef, // Nuevo ref
  mapAreaRef,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelPadding = DEFAULT_PANEL_PADDING,
  estimatedCollapsedHeaderHeight = DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT,
}: UseFloatingPanelsProps) {

  const [panels, setPanels] = useState<Record<string, PanelState>>({
    layers: { position: { x: panelPadding, y: panelPadding }, isCollapsed: false, ref: layersPanelRef, isMinimized: true }, 
    tools: { position: { x: panelWidth + 2 * panelPadding, y: panelPadding }, isCollapsed: true, ref: toolsPanelRef, isMinimized: true },
    legend: { position: { x: 2 * (panelWidth + panelPadding) + panelPadding, y: panelPadding }, isCollapsed: false, ref: legendPanelRef, isMinimized: true }, // Nuevo panel "Capas"
  });

  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  useEffect(() => {
    if (mapAreaRef.current) {
      const mapWidth = mapAreaRef.current.offsetWidth;
      const yPos = panelPadding; 
      
      // Calculate initial positions, ensuring they don't overlap excessively if map is narrow
      // For panels starting minimized, their initial "layout" width is effectively 0 for this calculation
      
      const layersX = panelPadding;
      const toolsX = layersX + (panels.layers.isMinimized ? 0 : panelWidth) + (panels.layers.isMinimized ? 0 : panelPadding);
      const legendX = toolsX + (panels.tools.isMinimized ? 0 : panelWidth) + (panels.tools.isMinimized ? 0 : panelPadding);


      setPanels(prev => ({
        layers: {
          ...prev.layers,
          position: prev.layers.isMinimized ? prev.layers.position : { x: layersX, y: yPos },
          ref: layersPanelRef,
        },
        tools: {
          ...prev.tools,
          position: prev.tools.isMinimized ? prev.tools.position : { x: toolsX, y: yPos },
          ref: toolsPanelRef,
        },
        legend: {
          ...prev.legend,
           position: prev.legend.isMinimized ? prev.legend.position : { x: Math.max(panelPadding, mapWidth - panelWidth - panelPadding), y: yPos }, // Default to right side
          ref: legendPanelRef,
        }
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAreaRef, panelPadding, panelWidth, layersPanelRef, toolsPanelRef, legendPanelRef, estimatedCollapsedHeaderHeight]);
  // draggingPanelId intentionally omitted


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
      if (prev[panelId]?.isMinimized) return prev; 
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

       if (!newMinimizedState && mapAreaRef.current) { // Restoring
        // If panel was minimized, try to place it intelligently or restore last known good pos
        if (panelId === 'layers') newPosition = { x: panelPadding, y: panelPadding };
        else if (panelId === 'tools') newPosition = { x: panelWidth + 2 * panelPadding, y: panelPadding };
        else if (panelId === 'legend') newPosition = { x: Math.max(panelPadding, mapAreaRef.current.offsetWidth - panelWidth - panelPadding), y: panelPadding };
      }


      return {
        ...prev,
        [panelId]: { 
          ...panel, 
          isMinimized: newMinimizedState,
          position: newPosition,
        },
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelPadding, panelWidth, mapAreaRef]);


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
    togglePanelMinimize,
  };
}

