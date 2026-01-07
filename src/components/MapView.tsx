import { useEffect, useRef, useState } from 'react';

interface MapViewProps {
  mapType: 'roadmap' | 'satellite' | 'hybrid';
  showHeatmap: boolean;
  visibleLayers: Set<string>;
  onMapReady?: (mapInstance: any) => void;
}

if (typeof window !== 'undefined' && window.L) {
  delete (window.L.Icon.Default.prototype as any)._getIconUrl;
  window.L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });}

const POINTS_DATA: Record<string, [number, number, string][]> = {
  'Hotels': [
    [51.505, -0.09, "Hotel Conforto"],
    [51.51, -0.1, "Hotel Luxo"]
  ],
  'Education': [
    [51.49, -0.08, "Universidade de Londres"],
    [51.52, -0.12, "Escola Técnica"]
  ],
}

export default function MapView({ mapType, showHeatmap, visibleLayers, onMapReady }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const heatmapLayerRef = useRef<any>(null);
  const markerLayersRef = useRef<{ [key: string]: any}>({});
  const [, setMapReady] = useState(false);


  

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = window.L.map(mapRef.current).setView([51.505, -0.09], 13);
    mapInstanceRef.current = map;

    const roadmapLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    });

    const satelliteLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    });

    const hybridLayer = window.L.layerGroup([
      window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
      }),
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        opacity: 0.3
      })
    ]);

    // map.marker([51.5, -0.09]).addTo(map)

    layersRef.current = {
      roadmap: roadmapLayer,
      satellite: satelliteLayer,
      hybrid: hybridLayer
    };

    roadmapLayer.addTo(map);
    setMapReady(true);
    onMapReady?.(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    setTimeout(() => {
      mapInstanceRef.current.invalidateSize();
    }, 0);
  }, [visibleLayers]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    Object.values(layersRef.current).forEach(layer => {
      if (mapInstanceRef.current.hasLayer(layer)) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });

    if (layersRef.current[mapType]) {
      layersRef.current[mapType].addTo(mapInstanceRef.current);
    }
  }, [mapType]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (heatmapLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    if (showHeatmap && window.L.heatLayer) {
      const heatData: [number, number, number][] = [];
      for (let i = 0; i < 100; i++) {
        heatData.push([
          51.5 + (Math.random() - 0.5) * 0.1,
          -0.09 + (Math.random() - 0.5) * 0.1,
          Math.random()
        ]);
      }

      heatmapLayerRef.current = window.L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
      }).addTo(mapInstanceRef.current);
    }
  }, [showHeatmap]);

  useEffect(() => {
  if (!mapInstanceRef.current || !window.L) return;

  // 1. Limpar markers antigos que não estão mais no visibleLayers
  Object.keys(markerLayersRef.current).forEach((layerKey) => {
    if (!visibleLayers.has(layerKey)) {
      mapInstanceRef.current.removeLayer(markerLayersRef.current[layerKey]);
      delete markerLayersRef.current[layerKey];
    }
  });

  // 2. Adicionar markers para as camadas ativas que ainda não foram criadas
  visibleLayers.forEach((layerKey) => {
    if (!markerLayersRef.current[layerKey] && POINTS_DATA[layerKey]) {
      
      // Criamos um grupo para todos os markers desta categoria
      const markersGroup = window.L.layerGroup();

      POINTS_DATA[layerKey].forEach(([lat, lng, title]) => {
        const marker = window.L.marker([lat, lng])
          .bindPopup(`<b>${layerKey}</b><br>${title}`);
        
        marker.addTo(markersGroup);
      });

      markersGroup.addTo(mapInstanceRef.current);
      markerLayersRef.current[layerKey] = markersGroup;
    }
  });

}, [visibleLayers]); // Executa sempre que as camadas visíveis mudarem

  return (
    <div ref={mapRef} className="w-full h-full" />
  );

  
}

