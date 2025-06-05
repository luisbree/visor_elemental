
"use client";

import React, { useEffect, useRef } from 'react';
import { Map as OLMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import {defaults as defaultControls} from 'ol/control';
import { fromLonLat } from 'ol/proj';

interface MapViewProps {
  // mapRef is now managed by useOpenLayersMap hook
  setMapInstanceAndElement: (map: OLMap, element: HTMLDivElement) => void;
  onMapClick?: (event: any) => void; // For feature inspection
  activeBaseLayerId?: string; // To control visibility
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
  const localMapRef = useRef<OLMap | null>(null); // Local ref for map instance within this component

  useEffect(() => {
    if (!mapElementRef.current || localMapRef.current) { 
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

    localMapRef.current = map;
    setMapInstanceAndElement(map, mapElementRef.current);

    if (onMapClick) {
      map.on('singleclick', onMapClick);
    }

    return () => {
      if (localMapRef.current) {
        if (onMapClick) localMapRef.current.un('singleclick', onMapClick);
        localMapRef.current.setTarget(undefined); 
        localMapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMapInstanceAndElement, onMapClick]); // activeBaseLayerId removed to avoid re-init on change, visibility handled by effect below

  // Effect to handle base layer visibility changes
  useEffect(() => {
    if (localMapRef.current && activeBaseLayerId) {
        localMapRef.current.getLayers().forEach(layer => {
            if (layer.get('isBaseLayer')) {
                layer.setVisible(layer.get('baseLayerId') === activeBaseLayerId);
            }
        });
    }
  }, [activeBaseLayerId]);

  return <div ref={mapElementRef} className="w-full h-full bg-gray-200" />;
};

export default MapView;

