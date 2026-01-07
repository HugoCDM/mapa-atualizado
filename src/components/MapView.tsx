import { useEffect, useRef, useState } from 'react';

interface MapViewProps {
  mapType: 'roadmap' | 'satellite';
  showHeatmap: boolean;
  visibleLayers: Set<string>;
  searchQuery?: string;
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
  'hotels': [
    [51.505, -0.09, "Hotel Conforto"],
    [51.51, -0.1, "Hotel Luxo"],
    [51.495, -0.105, "Budget Inn"],
    [51.515, -0.085, "Grand Plaza"]
  ],
  'education': [
    [51.49, -0.08, "Universidade de Londres"],
    [51.52, -0.12, "Escola Técnica"],
    [51.505, -0.15, "Central Academy"],
    [51.48, -0.1, "Language Institute"]
  ],
  'restaurants': [
    [51.508, -0.095, "The Modern Brasserie"],
    [51.502, -0.085, "London Fish & Chips"],
    [51.512, -0.105, "Café Europa"],
    [51.49, -0.075, "Garden Restaurant"]
  ],
  'parks': [
    [51.525, -0.1, "Central Green Park"],
    [51.48, -0.08, "Riverside Park"],
    [51.5, -0.12, "Botanical Gardens"]
  ]
}

export default function MapView({ mapType, showHeatmap, visibleLayers, searchQuery, onMapReady }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const heatmapLayerRef = useRef<any>(null);
  const markerLayersRef = useRef<{ [key: string]: any}>({});
  const searchMarkerRef = useRef<any>(null);
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

    layersRef.current = {
      roadmap: roadmapLayer,
      satellite: satelliteLayer
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

}, [visibleLayers]);

  useEffect(() => {
    if (!mapInstanceRef.current || !searchQuery) return;

    const geocodeAddress = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
        );
        const data = await response.json();

        if (data && data.length > 0) {
          const { lat, lon, display_name } = data[0];
          const latNum = parseFloat(lat);
          const lonNum = parseFloat(lon);

          mapInstanceRef.current.setView([latNum, lonNum], 15);

          if (searchMarkerRef.current) {
            mapInstanceRef.current.removeLayer(searchMarkerRef.current);
          }

          searchMarkerRef.current = window.L.marker([latNum, lonNum])
            .addTo(mapInstanceRef.current)
            .bindPopup(`<b>Search Result</b><br>${display_name}`)
            .openPopup();
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    };

    geocodeAddress();
  }, [searchQuery]);

  return (
    <div ref={mapRef} className="w-full h-full" />
  );
}

