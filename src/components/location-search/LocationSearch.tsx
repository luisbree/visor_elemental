
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, X as ClearIcon, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[]; // [southLat, northLat, westLon, eastLon]
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  icon?: string;
}

interface LocationSearchProps {
  onLocationSelect: (location: NominatimResult) => void;
  className?: string;
}

const LocationSearch: React.FC<LocationSearchProps> = ({ onLocationSelect, className }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResultsVisible, setIsResultsVisible] = useState(false);
  const { toast } = useToast();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setResults([]);
      setIsResultsVisible(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`);
      if (!response.ok) {
        throw new Error('Error al buscar la ubicación.');
      }
      const data: NominatimResult[] = await response.json();
      setResults(data);
      setIsResultsVisible(data.length > 0);
    } catch (error) {
      console.error("Error fetching from Nominatim:", error);
      toast("Error al buscar ubicaciones. Intente nuevamente.");
      setResults([]);
      setIsResultsVisible(false);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (searchTerm.trim()) {
      debounceTimeoutRef.current = setTimeout(() => {
        handleSearch(searchTerm);
      }, 500); 
    } else {
      setResults([]);
      setIsResultsVisible(false);
    }
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchTerm, handleSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsResultsVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleSelectResult = (result: NominatimResult) => {
    setSearchTerm(result.display_name.split(',')[0]); 
    setIsResultsVisible(false);
    onLocationSelect(result);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setResults([]);
    setIsResultsVisible(false);
  };

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400/80" />
        <Input
          type="text"
          placeholder="Buscar ubicación..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsResultsVisible(results.length > 0 && searchTerm.length > 0)}
          className="text-xs h-8 pl-7 pr-7 border-white/30 bg-black/20 text-white/90 focus:ring-primary placeholder:text-gray-400/70"
        />
        {isLoading && (
          <Loader2 className="absolute right-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-400/80" />
        )}
        {searchTerm && !isLoading && (
          <button
            onClick={clearSearch}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400/80 hover:text-white"
            aria-label="Limpiar búsqueda"
          >
            <ClearIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isResultsVisible && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-600 bg-gray-700/95 backdrop-blur-sm shadow-lg">
          <ul className="py-1">
            {results.map((result) => (
              <li key={result.place_id}>
                <button
                  onClick={() => handleSelectResult(result)}
                  className="w-full px-2.5 py-1.5 text-left text-xs text-white hover:bg-primary/30"
                  title={result.display_name}
                >
                  <span className="block truncate">{result.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
