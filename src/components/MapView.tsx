import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface MapViewProps {
  mapType: 'roadmap' | 'satellite';
  showHeatmap: boolean;
  visibleLayers: Set<string>;
  searchQuery?: string;
  onMapReady?: (mapInstance: any) => void;
}

interface LocationData {
  id: string;
  endereco: string;
  bairro: string;
  processo: string;
  latitude: number;
  longitude: number;
  tipoDeUso: string;
  tituloDoProjetо: string;
  status: string;
  [key: string]: any;
}

interface ProximityData {
  escola: number;
  metro: number;
  hospital: number;
  loading: boolean;
}

// Criar ícones customizados e leves
const createIcon = (color: string) => {
  const html = `
    <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Telhado -->
      <path d="M14 2L2 12H4V28H24V12H26L14 2Z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <!-- Porta -->
      <rect x="11" y="18" width="6" height="10" fill="white" stroke="white" stroke-width="1"/>
      <!-- Maçaneta -->
      <circle cx="16.5" cy="23" r="0.8" fill="${color}"/>
      <!-- Janelas -->
      <rect x="6" y="14" width="3" height="3" fill="white" stroke="white" stroke-width="0.8"/>
      <rect x="19" y="14" width="3" height="3" fill="white" stroke="white" stroke-width="0.8"/>
    </svg>
  `;

  return window.L?.divIcon({
    html,
    iconSize: [28, 32],
    iconAnchor: [14, 32],
    popupAnchor: [0, -32],
    className: 'custom-icon'
  });
};

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
};

export default function MapView({ mapType, showHeatmap, visibleLayers, searchQuery, onMapReady }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const heatmapLayerRef = useRef<any>(null);
  const markerLayersRef = useRef<{ [key: string]: any }>({});
  const supabaseMarkersRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);
  const proximityMarkerRef = useRef<any>(null);
  const [, setMapReady] = useState(false);
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [proximityData, setProximityData] = useState<ProximityData>({
    escola: 0,
    metro: 0,
    hospital: 0,
    loading: false
  });
  const [mousePos, setMousePos] = useState({ lat: 0, lng: 0, visible: false });
  const lastFetchRef = useRef<{ lat: number; lng: number } | null>(null);
  const proximityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Buscar dados do Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('mcmv_database')
          .select('*');

        if (error) {
          console.error('Erro ao buscar dados:', error);
          setLoading(false);
          return;
        }

        if (data) {
          const formattedData: LocationData[] = data.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: item.processo || item['Processo'] || '',
            latitude: parseFloat(item['Latitude centróide'] || item.latitude || 0),
            longitude: parseFloat(item['Longitude centróide'] || item.longitude || 0),
            tipoDeUso: item['Tipo de uso'] || '',
            tituloDoProjetо: item['Título do projeto'] || '',
            construtora: item['Construtora contratada'] || '',
            status: item.status_enquadramento || '',
            licenca: item['Licença'] || '',
            dataLicenca: item['Data da licença'] || '',
            habiteSe: item['Habite-se'] || '',
            ...item
          }));

          setLocationData(formattedData);
        }
        setLoading(false);
      } catch (error) {
        console.error('Erro inesperado:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Função para calcular distância entre dois pontos (Haversine)
  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Raio da Terra em metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const fetchProximityData = async (lat: number, lng: number) => {
    setProximityData(prev => ({ ...prev, loading: true }));

    try {
      // Buscar escolas do Supabase
      const { data: escolas } = await supabase
        .from('escolas_municipais')
        .select('latitude,longitude')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      let distanciaEscola = 5000;
      if (escolas && escolas.length > 0) {
        const distances = escolas.map(e => calcDistance(lat, lng, e.latitude, e.longitude));
        distanciaEscola = Math.min(...distances);
      }

      // Buscar estações (usando Nominatim)
      const metroRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=train%20station&lat=${lat}&lon=${lng}&radius=3000&format=json&limit=1`
      ).catch(() => ({ json: async () => [] }));
      
      const metroData = await metroRes.json();
      let distanciaMetro = 5000;
      if (metroData.length > 0) {
        distanciaMetro = calcDistance(lat, lng, parseFloat(metroData[0].lat), parseFloat(metroData[0].lon));
      }

      // Buscar hospitais (usando Nominatim)
      const hospitalRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=hospital&lat=${lat}&lon=${lng}&radius=2000&format=json&limit=1`
      ).catch(() => ({ json: async () => [] }));
      
      const hospitalData = await hospitalRes.json();
      let distanciaHospital = 5000;
      if (hospitalData.length > 0) {
        distanciaHospital = calcDistance(lat, lng, parseFloat(hospitalData[0].lat), parseFloat(hospitalData[0].lon));
      }

      setProximityData({
        escola: Math.round(distanciaEscola),
        metro: Math.round(distanciaMetro),
        hospital: Math.round(distanciaHospital),
        loading: false
      });
    } catch (error) {
      console.error('Erro ao buscar proximidade:', error);
      setProximityData(prev => ({ ...prev, loading: false }));
    }
  };

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || !window.L) return;

    const map = window.L.map(mapRef.current).setView([-22.909427, -43.182134], 11);
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

    // Adicionar evento de mousemove ao mapa
    map.on('mousemove', (e: any) => {
      setMousePos({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        visible: true
      });
      
      if (proximityMarkerRef.current) {
        map.removeLayer(proximityMarkerRef.current);
      }
      
      if (window.L.circleMarker) {
        proximityMarkerRef.current = window.L.circleMarker([e.latlng.lat, e.latlng.lng], {
          radius: 4,
          color: '#000',
          weight: 2,
          opacity: 1,
          fillColor: '#fff',
          fillOpacity: 1
        }).addTo(map);
      }

      fetchProximityData(e.latlng.lat, e.latlng.lng);
    });

    map.on('mouseout', () => {
      setMousePos(prev => ({ ...prev, visible: false }));
      if (proximityMarkerRef.current) {
        map.removeLayer(proximityMarkerRef.current);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Adicionar markers do Supabase com clustering para melhor performance
  useEffect(() => {
    if (!mapInstanceRef.current || locationData.length === 0) return;

    // Remover markers antigos
    if (supabaseMarkersRef.current) {
      mapInstanceRef.current.removeLayer(supabaseMarkersRef.current);
    }

    // Usar FeatureGroup para melhor performance
    const markersGroup = window.L.featureGroup();

    locationData.forEach((location) => {
      if (location.latitude && location.longitude) {
        const popup = `
          <div style="font-size: 12px; width: 250px;">
            <b>${location.endereco}</b><br/>
            <strong>Bairro:</strong> ${location.bairro}<br/>
            <strong>Processo:</strong> ${location.processo}<br/>
            <strong>Tipo de Uso:</strong> ${location.tipoDeUso}<br/>
            <strong>Projeto:</strong> ${location.tituloDoProjetо}<br/>
            <strong>Construtora:</strong> ${location.construtora}<br/>
            <strong>Status:</strong> ${location.status}<br/>
            <strong>Licença:</strong> ${location.licenca}<br/>
            <strong>Data Licença:</strong> ${location.dataLicenca}
          </div>
        `;

        const color = location.status?.includes('enquadrado') ? '#22c55e' : '#ef4444';
        
        const marker = window.L.marker([location.latitude, location.longitude], {
          icon: createIcon(color)
        }).bindPopup(popup, { maxWidth: 300 });

        marker.addTo(markersGroup);
      }
    });

    markersGroup.addTo(mapInstanceRef.current);
    supabaseMarkersRef.current = markersGroup;
  }, [locationData]);

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
      const heatData: [number, number, number][] = locationData
        .filter(loc => loc.latitude && loc.longitude)
        .map(loc => [loc.latitude, loc.longitude, 0.5] as [number, number, number]);

      if (heatData.length > 0) {
        heatmapLayerRef.current = window.L.heatLayer(heatData, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
        }).addTo(mapInstanceRef.current);
      }
    }
  }, [showHeatmap, locationData]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    Object.keys(markerLayersRef.current).forEach((layerKey) => {
      if (!visibleLayers.has(layerKey)) {
        mapInstanceRef.current.removeLayer(markerLayersRef.current[layerKey]);
        delete markerLayersRef.current[layerKey];
      }
    });

    visibleLayers.forEach((layerKey) => {
      if (!markerLayersRef.current[layerKey] && POINTS_DATA[layerKey]) {
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
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      
      {mousePos.visible && (
        <div 
          className="fixed bg-white shadow-lg rounded-lg p-4 z-50 border border-gray-200"
          style={{
            left: '50%',
            top: '20px',
            transform: 'translateX(-50%)',
            minWidth: '320px'
          }}
        >
          <div className="text-sm font-semibold mb-3 text-gray-700">
            Proximidade
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏫</span>
                <span className="font-medium text-gray-700">Escola próxima</span>
              </div>
              <span className="font-bold text-blue-600">
                {proximityData.loading ? '...' : `${proximityData.escola}m`}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚇</span>
                <span className="font-medium text-gray-700">Metro/Trem próximo</span>
              </div>
              <span className="font-bold text-green-600">
                {proximityData.loading ? '...' : `${proximityData.metro}m`}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-red-50 rounded">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏥</span>
                <span className="font-medium text-gray-700">Hospital próximo</span>
              </div>
              <span className="font-bold text-red-600">
                {proximityData.loading ? '...' : `${proximityData.hospital}m`}
              </span>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded shadow">
          Carregando dados do mapa...
        </div>
      )}
    </div>
  );
}