
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
  estimatedCollapsedHeaderHeight?: number;
}

const DEFAULT_PANEL_WIDTH = 350;
const DEFAULT_PANEL_PADDING = 16;
const DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT = 40; // Matching the value from GeoMapperClient

export function useFloatingPanels({
  layersPanelRef,
  toolsPanelRef,
  geoServerPanelRef,
  mapPanelRef,
  mapAreaRef,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelPadding = DEFAULT_PANEL_PADDING,
  estimatedCollapsedHeaderHeight = DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT,
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

      const layersPanelX = panelPadding;
      const rightAlignedX = (pWidth: number) => Math.max(panelPadding, mapRect.width - pWidth - panelPadding);
      
      // Helper to get actual width or fallback. Note: offsetWidth might be 0 if not rendered or display:none.
      const getPanelActualWidth = (panelRef: React.RefObject<HTMLDivElement>, fallbackWidth: number) => {
        return panelRef.current?.offsetWidth || fallbackWidth;
      }

      const toolsPanelActualWidth = getPanelActualWidth(toolsPanelRef, panelWidth);
      const geoServerPanelActualWidth = getPanelActualWidth(geoServerPanelRef, panelWidth);
      const mapPanelActualWidth = getPanelActualWidth(mapPanelRef, panelWidth);
      // const layersPanelActualWidth = getPanelActualWidth(layersPanelRef, panelWidth); // Not strictly needed for X if always left

      const toolsY = panelPadding;
      const geoserverY = toolsY + estimatedCollapsedHeaderHeight + panelPadding;
      const mapPanelY = geoserverY + estimatedCollapsedHeaderHeight + panelPadding;

      setPanels(prev => ({
        layers: { ...prev.layers, position: {x: layersPanelX, y: panelPadding}, isCollapsed: true },
        tools: {
          ...prev.tools,
          position: { x: rightAlignedX(toolsPanelActualWidth), y: toolsY },
          isCollapsed: true,
        },
        geoserver: {
          ...prev.geoserver,
          position: { x: rightAlignedX(geoServerPanelActualWidth), y: geoserverY },
          isCollapsed: true,
        },
        map: {
          ...prev.map,
          position: { x: rightAlignedX(mapPanelActualWidth), y: mapPanelY },
          isCollapsed: true,
        }
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAreaRef, panelPadding, panelWidth, estimatedCollapsedHeaderHeight, layersPanelRef, toolsPanelRef, geoServerPanelRef, mapPanelRef]);

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

      const mapRect = mapAreaRef.current.getBoundingClientRect(); // Relative to viewport
      const panelRect = panelToMove.ref.current.getBoundingClientRect(); // Also relative to viewport
      
      // Calculate map container's offset from the document origin, if mapAreaRef is not the direct parent of the panels
      // For simplicity, assuming mapAreaRef contains the panels, so mapRect.left/top are 0 if it's the offsetParent
      // Or, if panels are absolutely positioned relative to mapAreaRef, then newX/newY should be within mapRect's bounds

      const panelCurrentWidth = panelRect.width;
      const panelCurrentHeight = panelRect.height;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      let newX = dragStartRef.current.panelX + dx;
      let newY = dragStartRef.current.panelY + dy;

      // Constrain within mapAreaRef bounds
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
    