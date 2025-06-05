
"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus } from 'lucide-react';
import { handleFileUpload as processUploadedFiles } from '@/services/file-parsers';
import { useToast } from "@/hooks/use-toast";
import type { MapLayer } from '@/lib/types';

interface FileUploadControlProps {
  onAddLayer: (layer: MapLayer) => void;
  uniqueIdPrefix?: string;
}

const FileUploadControl: React.FC<FileUploadControlProps> = ({ 
  onAddLayer, 
  uniqueIdPrefix = "fileupload" 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast(); // Direct use of the hook

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    setIsLoading(true);
    const files = event.target.files;
    let success = false;

    if (files.length > 1) {
       success = await processUploadedFiles({ selectedFile: null, selectedMultipleFiles: files, onAddLayer, toast, uniqueIdPrefix });
    } else if (files.length === 1) {
       success = await processUploadedFiles({ selectedFile: files[0], selectedMultipleFiles: null, onAddLayer, toast, uniqueIdPrefix });
    }
    
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <Input
        id={`${uniqueIdPrefix}-input`}
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilesSelected}
        accept=".kml,.kmz,.geojson,.json,.zip,.shp,.dbf"
        className="hidden"
        disabled={isLoading}
      />
      <Button 
        onClick={() => fileInputRef.current?.click()}
        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
        disabled={isLoading}
        title="Importar capa desde archivo"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        {isLoading ? 'Procesando...' : 'Importar Capa'}
      </Button>
    </div>
  );
};

export default FileUploadControl;
