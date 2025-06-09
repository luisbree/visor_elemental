
"use client";

import React, { useEffect, useRef } from 'react';
import { Map as OLMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import {defaults as defaultControls} from 'ol/control';
import { fromLonLat } from 'ol/proj';

interface MapViewProps {
  setMapInstanceAndElement: (map: OLMap, element: HTMLDivElement) => void;
  onMapClick?: (event: any) => void; 
  activeBaseLayerId?: string; 
}

export const BASE_LAYER_DEFINITIONS = [
  {
    id: 'osm-standard',
    name: 'OpenStreetMap',
    createLayer: () => new TileLayer({
      source: new OSM(),
      properties: { baseLayerId: 'osm-standard', isBaseLayer: true, name: 'OSMBaseLayer' },
    }),
  },
  {
    id: 'carto-light',
    name: 'OSM Gris (Carto)',
    createLayer: () => new TileLayer({
      source: new XYZ({ 
        url: 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        attributions: 'Map tiles by <a href="https://carto.com/attributions">Carto</a>, under CC BY 3.0. Data by <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, under ODbL.',
        maxZoom: 20,
      }),
      visible: false, 
      properties: { baseLayerId: 'carto-light', isBaseLayer: true, name: 'CartoGrayscaleBaseLayer' },
    }),
  },
  {
    id: 'esri-satellite',
    name: 'ESRI Satelital',
    createLayer: () => new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
      }),
      visible: false, 
      properties: { baseLayerId: 'esri-satellite', isBaseLayer: true, name: 'ESRISatelliteBaseLayer' },
    }),
  },
] as const;


const MapView: React.FC<MapViewProps> = ({ setMapInstanceAndElement, onMapClick, activeBaseLayerId }) => {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const olMapInstanceRef = useRef<OLMap | null>(null); // Internal ref to the map instance created by this component

  // Effect for map initialization (runs once)
  useEffect(() => {
    if (!mapElementRef.current || olMapInstanceRef.current) { // Only run if div exists and map not yet created
      return;
    }

    const initialBaseLayers = BASE_LAYER_DEFINITIONS.map(def => {
        const layer = def.createLayer();
        // Set initial visibility based on activeBaseLayerId (first one if not specified)
        layer.setVisible(def.id === (activeBaseLayerId || BASE_LAYER_DEFINITIONS[0].id));
        return layer;
    });

    const map = new OLMap({
      target: mapElementRef.current,
      layers: [...initialBaseLayers], 
      view: new View({
        center: fromLonLat([-60.0, -36.5], 'EPSG:3857'),
        zoom: 7,
        projection: 'EPSG:3857', 
        constrainResolution: true, 
      }),
      controls: defaultControls({
        attributionOptions: {
          collapsible: false,
        },
        zoom: true,
        rotate: false, 
      }),
    });
    
    olMapInstanceRef.current = map; // Store locally
    setMapInstanceAndElement(map, mapElementRef.current);

    return () => {
      // Cleanup when MapView unmounts completely
      if (olMapInstanceRef.current) {
        olMapInstanceRef.current.setTarget(undefined); // Detach map from target
        // olMapInstanceRef.current.dispose(); // Consider if full disposal is needed
        olMapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMapInstanceAndElement]); // setMapInstanceAndElement should be stable

  // Effect to handle 'onMapClick' listener changes
  useEffect(() => {
    if (!olMapInstanceRef.current) return; // Map not yet created
    const currentMap = olMapInstanceRef.current;

    if (onMapClick) {
      currentMap.on('singleclick', onMapClick);
    }
    return () => {
      if (onMapClick) { // Check if onMapClick was actually defined and attached
        currentMap.un('singleclick', onMapClick);
      }
    };
  }, [onMapClick]); // Only depends on onMapClick callback changing

  // Effect to handle base layer visibility changes
  useEffect(() => {
    if (!olMapInstanceRef.current || !activeBaseLayerId) return; // Map not yet created or no activeBaseLayerId
    const currentMap = olMapInstanceRef.current;

    currentMap.getLayers().forEach(layer => {
        if (layer.get('isBaseLayer')) {
            layer.setVisible(layer.get('baseLayerId') === activeBaseLayerId);
        }
    });
  }, [activeBaseLayerId]); // Only depends on activeBaseLayerId changing

  return <div ref={mapElementRef} className="w-full h-full bg-gray-200" />;
};

export default MapView;
