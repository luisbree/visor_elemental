
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
  mapAreaRef: React.RefObject<HTMLDivElement>;
  panelWidth?: number;
  panelPadding?: number;
  estimatedCollapsedHeaderHeight?: number; // Keep if used for Y positioning
}

const DEFAULT_PANEL_WIDTH = 350;
const DEFAULT_PANEL_PADDING = 8;
// const DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT = 32; // No longer used for horizontal layout

export function useFloatingPanels({
  layersPanelRef,
  toolsPanelRef,
  geoServerPanelRef,
  mapAreaRef,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelPadding = DEFAULT_PANEL_PADDING,
  // estimatedCollapsedHeaderHeight = DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT, // No longer used for horizontal layout
}: UseFloatingPanelsProps) {

  const [panels, setPanels] = useState<Record<string, PanelState>>({
    layers: { position: { x: panelPadding, y: panelPadding }, isCollapsed: true, ref: layersPanelRef },
    tools: { position: { x: panelWidth + 2 * panelPadding, y: panelPadding }, isCollapsed: true, ref: toolsPanelRef },
    geoserver: { position: { x: 2 * (panelWidth + panelPadding) + panelPadding, y: panelPadding }, isCollapsed: true, ref: geoServerPanelRef },
  });

  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  useEffect(() => {
    if (mapAreaRef.current) {
      const yPos = panelPadding; // All panels aligned to the top, under the header
      let currentXOffset = panelPadding;
      
      const getPanelEffectiveWidth = (panelId: string) => {
        // If the panel ref has a current element, use its actual width.
        // Otherwise, fall back to the configured panelWidth (for initial placement before render).
        // This is more relevant if panels could start uncollapsed or have variable initial widths.
        // For now, as all start collapsed, their actual width will be small initially.
        // The panelWidth prop is used more for desired spacing *between* full-sized panels.
        // When collapsed, their actual width is determined by their content (e.g., header only).
        // For consistent horizontal layout of *collapsed* panels, we might need a different approach
        // if panelWidth is meant for expanded state.
        // Let's assume panelWidth is a reasonable proxy for the space they *should* occupy
        // or the starting point for their left edge.
        
        // Since they start collapsed and we want them side-by-side,
        // we use panelWidth as the space allocated for each before the next one starts.
        return panelWidth;
      };

      const layersPanelX = currentXOffset;
      currentXOffset += getPanelEffectiveWidth('layers') + panelPadding;

      const toolsPanelX = currentXOffset;
      currentXOffset += getPanelEffectiveWidth('tools') + panelPadding;

      const geoServerPanelX = currentXOffset;
      // currentXOffset += getPanelEffectiveWidth('geoserver') + panelPadding; // For next one

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
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAreaRef, panelPadding, panelWidth, layersPanelRef, toolsPanelRef, geoServerPanelRef]);


  const handlePanelMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, panelId: string) => {
    const panel = panels[panelId];
    if (!panel || !panel.ref.current) return;

    const targetElement = e.target as HTMLElement;
    if (targetElement.closest('button') || targetElement.closest('input') || targetElement.closest('[role="combobox"]') || targetElement.closest('[role="menuitem"]') || targetElement.closest('[role="menu"]')) {
        return; // Do not drag if clicking on interactive elements within the header or panel
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
