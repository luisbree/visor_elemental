
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';

interface PanelState {
  position: { x: number; y: number };
  isCollapsed: boolean;
  ref: React.RefObject<HTMLDivElement>;
}

interface UseFloatingPanelsProps {
  layersPanelRef: React.RefObject<HTMLDivElement>;
  toolsPanelRef: React.RefObject<HTMLDivElement>;
  geoServerPanelRef: React.RefObject<HTMLDivElement>;
  mapAreaRef: React.RefObject<HTMLDivElement>; // To constrain dragging within map area
  panelWidth?: number;
  panelPadding?: number;
}

const DEFAULT_PANEL_WIDTH = 350;
const DEFAULT_PANEL_PADDING = 16;

export function useFloatingPanels({
  layersPanelRef,
  toolsPanelRef,
  geoServerPanelRef,
  mapAreaRef,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelPadding = DEFAULT_PANEL_PADDING,
}: UseFloatingPanelsProps) {
  
  const [panels, setPanels] = useState<Record<string, PanelState>>({
    layers: { position: { x: panelPadding, y: panelPadding }, isCollapsed: false, ref: layersPanelRef },
    tools: { position: { x: 0, y: panelPadding }, isCollapsed: false, ref: toolsPanelRef }, // X will be calculated
    geoserver: { position: { x: 0, y: 0 }, isCollapsed: false, ref: geoServerPanelRef }, // X, Y will be calculated
  });

  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  // Initialize positions based on mapAreaRef
  useEffect(() => {
    if (mapAreaRef.current) {
      const mapRect = mapAreaRef.current.getBoundingClientRect();
      const toolsPanelActualWidth = toolsPanelRef.current?.offsetWidth || panelWidth;
      const geoServerPanelActualWidth = geoServerPanelRef.current?.offsetWidth || panelWidth;
      const toolsPanelHeight = toolsPanelRef.current?.offsetHeight || 200; // Approx height

      setPanels(prev => ({
        ...prev,
        tools: {
          ...prev.tools,
          position: { x: mapRect.width - toolsPanelActualWidth - panelPadding, y: panelPadding },
        },
        geoserver: {
          ...prev.geoserver,
          position: { x: mapRect.width - geoServerPanelActualWidth - panelPadding, y: panelPadding + toolsPanelHeight + panelPadding * 2 },
        },
      }));
    }
  }, [mapAreaRef, panelPadding, panelWidth, toolsPanelRef, geoServerPanelRef]);


  const handlePanelMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, panelId: string) => {
    const panel = panels[panelId];
    if (!panel || !panel.ref.current) return;

    const targetElement = e.target as HTMLElement;
    // Ignore clicks on buttons within the header (like collapse button)
    if (targetElement.closest('button')) {
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
    setPanels(prev => ({
      ...prev,
      [panelId]: { ...prev[panelId], isCollapsed: !prev[panelId].isCollapsed },
    }));
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingPanelId || !mapAreaRef.current) return;

      const panelToMove = panels[draggingPanelId];
      if (!panelToMove || !panelToMove.ref.current) return;

      const mapRect = mapAreaRef.current.getBoundingClientRect();
      const panelRect = panelToMove.ref.current.getBoundingClientRect();

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      let newX = dragStartRef.current.panelX + dx;
      let newY = dragStartRef.current.panelY + dy;

      // Constrain to mapArea boundaries
      if (panelRect.width > 0 && panelRect.height > 0 && mapRect.width > 0 && mapRect.height > 0) {
        newX = Math.max(0, Math.min(newX, mapRect.width - panelRect.width));
        newY = Math.max(0, Math.min(newY, mapRect.height - panelRect.height));
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
  };
}
