
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
  mapPanelRef: React.RefObject<HTMLDivElement>;
  mapAreaRef: React.RefObject<HTMLDivElement>; 
  panelWidth?: number;
  panelPadding?: number;
}

const DEFAULT_PANEL_WIDTH = 350;
const DEFAULT_PANEL_PADDING = 16;
const ESTIMATED_COLLAPSED_HEADER_HEIGHT = 40; // Approximate height of a panel header

export function useFloatingPanels({
  layersPanelRef,
  toolsPanelRef,
  geoServerPanelRef,
  mapPanelRef,
  mapAreaRef,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelPadding = DEFAULT_PANEL_PADDING,
}: UseFloatingPanelsProps) {
  
  const [panels, setPanels] = useState<Record<string, PanelState>>({
    layers: { position: { x: panelPadding, y: panelPadding }, isCollapsed: true, ref: layersPanelRef },
    tools: { position: { x: 0, y: panelPadding }, isCollapsed: true, ref: toolsPanelRef }, 
    geoserver: { position: { x: 0, y: 0 }, isCollapsed: true, ref: geoServerPanelRef },
    map: { position: {x: 0, y: 0}, isCollapsed: true, ref: mapPanelRef },
  });

  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  useEffect(() => {
    if (mapAreaRef.current) {
      const mapRect = mapAreaRef.current.getBoundingClientRect();
      
      // Use the passed panelWidth for calculating X positions, as offsetWidth might not be ready or reflect collapsed state correctly for initial positioning.
      const layersPanelX = panelPadding;
      const rightAlignedX = (pWidth: number) => mapRect.width - pWidth - panelPadding;

      const toolsPanelInitialWidth = panelWidth; // Use the default/prop panelWidth for initial X calc
      const geoServerPanelInitialWidth = panelWidth;
      const mapPanelInitialWidth = panelWidth;

      const toolsY = panelPadding;
      const geoserverY = toolsY + ESTIMATED_COLLAPSED_HEADER_HEIGHT + panelPadding;
      const mapPanelY = geoserverY + ESTIMATED_COLLAPSED_HEADER_HEIGHT + panelPadding;

      setPanels(prev => ({
        layers: { ...prev.layers, position: {x: layersPanelX, y: panelPadding} },
        tools: {
          ...prev.tools,
          position: { x: rightAlignedX(toolsPanelInitialWidth), y: toolsY },
        },
        geoserver: {
          ...prev.geoserver,
          position: { x: rightAlignedX(geoServerPanelInitialWidth), y: geoserverY },
        },
        map: {
          ...prev.map,
          position: { x: rightAlignedX(mapPanelInitialWidth), y: mapPanelY },
        }
      }));
    }
  // Dependencies ensure this runs once on mount and if critical refs/sizing props change.
  // Not including specific panelRefs here to avoid re-running just for offsetWidth changes after mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAreaRef, panelPadding, panelWidth]);


  const handlePanelMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, panelId: string) => {
    const panel = panels[panelId];
    if (!panel || !panel.ref.current) return;

    const targetElement = e.target as HTMLElement;
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
      const panelCurrentWidth = panelToMove.ref.current.offsetWidth;
      const panelCurrentHeight = panelToMove.ref.current.offsetHeight;


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
  };
}
