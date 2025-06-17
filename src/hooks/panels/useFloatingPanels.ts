
"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

interface PanelConfig { // Renamed from PanelState to avoid confusion with internal state
  position: { x: number; y: number };
  isCollapsed: boolean;
  ref: React.RefObject<HTMLDivElement>;
  isMinimized: boolean;
}

// This will be the shape of the state managed internally
interface InternalPanelState extends Omit<PanelConfig, 'ref'>{
  // ref is handled by the refs passed in props
}

// This will be the shape of the object returned by the hook
export interface PanelStateWithZIndex extends PanelConfig {
  zIndex: number;
}


interface UseFloatingPanelsProps {
  layersPanelRef: React.RefObject<HTMLDivElement>; 
  toolsPanelRef: React.RefObject<HTMLDivElement>;  
  legendPanelRef: React.RefObject<HTMLDivElement>; 
  mapAreaRef: React.RefObject<HTMLDivElement>;
  panelWidth?: number;
  panelPadding?: number;
  estimatedCollapsedHeaderHeight?: number;
}

const DEFAULT_PANEL_WIDTH = 350;
const DEFAULT_PANEL_PADDING = 8;
const DEFAULT_ESTIMATED_COLLAPSED_HEADER_HEIGHT = 32; 
const BASE_PANEL_Z_INDEX = 30; // Base Z-index for the floating panels

export function useFloatingPanels({
  layersPanelRef,
  toolsPanelRef,
  legendPanelRef, 
  mapAreaRef,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelPadding = DEFAULT_PANEL_PADDING,
  // estimatedCollapsedHeaderHeight removed as it's not directly used in z-index logic
}: UseFloatingPanelsProps) {

  const panelRefs = useMemo(() => ({
    layers: layersPanelRef,
    tools: toolsPanelRef,
    legend: legendPanelRef,
  }), [layersPanelRef, toolsPanelRef, legendPanelRef]);

  const [internalPanelsState, setInternalPanelsState] = useState<Record<string, InternalPanelState>>({
    layers: { position: { x: panelPadding, y: panelPadding }, isCollapsed: false, isMinimized: true }, 
    tools: { position: { x: panelWidth + 2 * panelPadding, y: panelPadding }, isCollapsed: true, isMinimized: true },
    legend: { position: { x: panelPadding, y: panelPadding }, isCollapsed: false, isMinimized: true }, 
  });

  const [zOrder, setZOrder] = useState<string[]>(['tools', 'layers', 'legend']); // legend is on top by default

  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });

  useEffect(() => {
    // Initial position adjustment (runs once or if dependencies change significantly)
    if (mapAreaRef.current) {
      const mapWidth = mapAreaRef.current.offsetWidth;
      const yPos = panelPadding;
      
      setInternalPanelsState(prev => ({
        layers: {
          ...prev.layers,
          position: prev.layers.isMinimized ? prev.layers.position : { x: panelPadding, y: yPos },
        },
        tools: {
          ...prev.tools,
          position: prev.tools.isMinimized ? prev.tools.position : { x: (prev.layers.isMinimized ? 0 : panelWidth) + (prev.layers.isMinimized ? 0 : panelPadding) + panelPadding, y: yPos },
        },
        legend: {
          ...prev.legend,
          position: prev.legend.isMinimized ? prev.legend.position : { x: panelPadding, y: yPos }, // Default to left side
        }
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelPadding, panelWidth]); // Removed mapAreaRef from deps to prevent frequent recalcs if not needed


  const handlePanelMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, panelId: string) => {
    const panelConfig = internalPanelsState[panelId];
    const panelRef = panelRefs[panelId as keyof typeof panelRefs];

    if (!panelConfig || !panelRef.current || panelConfig.isMinimized) return;

    const targetElement = e.target as HTMLElement;
    if (targetElement.closest('button') || targetElement.closest('input') || targetElement.closest('[role="combobox"]') || targetElement.closest('[role="menuitem"]') || targetElement.closest('[role="menu"]')) {
        return; 
    }

    setDraggingPanelId(panelId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: panelConfig.position.x,
      panelY: panelConfig.position.y,
    };

    // Bring panel to front
    setZOrder(prevZOrder => {
      const newOrder = prevZOrder.filter(id => id !== panelId);
      newOrder.push(panelId); // Move to top
      return newOrder;
    });
    e.preventDefault();
  }, [internalPanelsState, panelRefs]);

  const togglePanelCollapse = useCallback((panelId: string) => {
    setInternalPanelsState(prev => {
      if (prev[panelId]?.isMinimized) return prev; 
      return {
        ...prev,
        [panelId]: { ...prev[panelId], isCollapsed: !prev[panelId].isCollapsed },
      };
    });
  }, []);

  const togglePanelMinimize = useCallback((panelId: string) => {
    setInternalPanelsState(prev => {
      const panel = prev[panelId];
      if (!panel) return prev;
      
      const newMinimizedState = !panel.isMinimized;
      let newPosition = panel.position;
      let newIsCollapsed = panel.isCollapsed;

      if (!newMinimizedState) { // Panel is being restored
        newIsCollapsed = false; 

        if (panelId === 'legend') { 
          newPosition = { x: panelPadding, y: panelPadding }; 
        }
         // Bring panel to front when restored
        setZOrder(prevZOrder => {
          const newOrder = prevZOrder.filter(id => id !== panelId);
          newOrder.push(panelId);
          return newOrder;
        });
      }

      return {
        ...prev,
        [panelId]: { 
          ...panel, 
          isMinimized: newMinimizedState,
          isCollapsed: newIsCollapsed,
          position: newPosition,
        },
      };
    });
  }, [panelPadding]);


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingPanelId || !mapAreaRef.current) return;

      const panelToMoveConfig = internalPanelsState[draggingPanelId];
      const panelToMoveRef = panelRefs[draggingPanelId as keyof typeof panelRefs];

      if (!panelToMoveConfig || !panelToMoveRef.current || panelToMoveConfig.isMinimized) return;

      const mapRect = mapAreaRef.current.getBoundingClientRect(); 
      const panelRect = panelToMoveRef.current.getBoundingClientRect(); 
      
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
        setInternalPanelsState(prev => ({
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
  }, [draggingPanelId, internalPanelsState, mapAreaRef, panelRefs]);

  const panels = useMemo(() => {
    const result: Record<string, PanelStateWithZIndex> = {};
    Object.keys(internalPanelsState).forEach(id => {
      const panelZOrderIndex = zOrder.indexOf(id);
      const panelRef = panelRefs[id as keyof typeof panelRefs];
      result[id] = {
        ...internalPanelsState[id],
        ref: panelRef, // Add the ref back here for the consumer
        zIndex: BASE_PANEL_Z_INDEX + panelZOrderIndex,
      };
    });
    return result;
  }, [internalPanelsState, zOrder, panelRefs]);


  return {
    panels,
    handlePanelMouseDown,
    togglePanelCollapse,
    togglePanelMinimize,
  };
}
