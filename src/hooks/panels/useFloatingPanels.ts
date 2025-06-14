
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
  estimatedCollapsedHeaderHeight?: number; // Remains in props for potential other uses or future layouts
}

const DEFAULT_PANEL_WIDTH = 350;
const DEFAULT_PANEL_PADDING = 16;
// const DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT = 40; // Not used in this specific layout calculation

export function useFloatingPanels({
  layersPanelRef,
  toolsPanelRef,
  geoServerPanelRef,
  mapPanelRef,
  mapAreaRef,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelPadding = DEFAULT_PANEL_PADDING,
  // estimatedCollapsedHeaderHeight = DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT, // Not directly used for X,Y of horizontal layout
}: UseFloatingPanelsProps) {

  const [panels, setPanels] = useState<Record<string, PanelState>>({
    layers: { position: { x: panelPadding, y: panelPadding }, isCollapsed: true, ref: layersPanelRef },
    tools: { position: { x: panelWidth + 2 * panelPadding, y: panelPadding }, isCollapsed: true, ref: toolsPanelRef },
    geoserver: { position: { x: 2 * (panelWidth + panelPadding) + panelPadding, y: panelPadding }, isCollapsed: true, ref: geoServerPanelRef },
    map: { position: {x: 3 * (panelWidth + panelPadding) + panelPadding, y: panelPadding}, isCollapsed: true, ref: mapPanelRef },
  });

  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  useEffect(() => {
    if (mapAreaRef.current) {
      const yPos = panelPadding; // All panels at the same Y position, under the banner
      let currentXOffset = panelPadding; // Starting X for the first panel

      // Helper to determine width for placement. For initial horizontal layout,
      // we use panelWidth as the consistent spacing unit.
      const getPlacementWidth = () => panelWidth;

      const layersPanelX = currentXOffset;
      currentXOffset += getPlacementWidth() + panelPadding;

      const toolsPanelX = currentXOffset;
      currentXOffset += getPlacementWidth() + panelPadding;

      const geoServerPanelX = currentXOffset;
      currentXOffset += getPlacementWidth() + panelPadding;

      const mapPanelX = currentXOffset;
      // currentXOffset += getPlacementWidth() + panelPadding; // For the next panel, if any

      setPanels({
        layers: {
          position: { x: layersPanelX, y: yPos },
          isCollapsed: true,
          ref: layersPanelRef,
        },
        tools: {
          position: { x: toolsPanelX, y: yPos },
          isCollapsed: true,
          ref: toolsPanelRef,
        },
        geoserver: {
          position: { x: geoServerPanelX, y: yPos },
          isCollapsed: true,
          ref: geoServerPanelRef,
        },
        map: {
          position: { x: mapPanelX, y: yPos },
          isCollapsed: true,
          ref: mapPanelRef,
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAreaRef, panelPadding, panelWidth, layersPanelRef, toolsPanelRef, geoServerPanelRef, mapPanelRef]);
  // Removed estimatedCollapsedHeaderHeight from dependencies as it's not used for this specific horizontal layout's initial positioning.


  const handlePanelMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, panelId: string) => {
    const panel = panels[panelId];
    if (!panel || !panel.ref.current) return;

    const targetElement = e.target as HTMLElement;
    if (targetElement.closest('button') || targetElement.closest('input') || targetElement.closest('[role="combobox"]')) { // Prevent drag on interactive elements inside header
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
  };
}
    
