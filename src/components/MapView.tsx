import { useEffect, useMemo, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

interface LocationData {
  id: string;
  endereco: string;
  bairro: string;
  processo: string;
  latitude: number;
  longitude: number;
  tipoDeUso: string;
  tituloDoProjetо: string;
  construtora: string;
  status: string;
  licenca: string;
  dataLicenca: string;
  [key: string]: any;
}

interface ProximityData {
  escola: number | null;
  altaCapacidade: number | null;
  hospital: number | null;
  loading: boolean;
}

interface MapViewProps {
  mapType: 'roadmap' | 'satellite';
  showHeatmap: boolean;
  visibleLayers: Set<string>;
  searchQuery?: string;
  onMapReady?: (mapInstance: any) => void;
}



async function fetchFromAPI<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error(`Erro ao buscar ${endpoint}:`, error);
    return null;
  }
}

const fetchWithCache = async (endpoint: string, cacheKey: string) => {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed) return parsed;
  }
    
    const data = await fetchFromAPI(endpoint)
    if (data) {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    }
    return data
  }

// Carregar Leaflet.markercluster CSS
if (typeof window !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.4.1/MarkerCluster.css';
  document.head.appendChild(link);
  
  const link2 = document.createElement('link');
  link2.rel = 'stylesheet';
  link2.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.4.1/MarkerCluster.Default.css';
  document.head.appendChild(link2);

  // Carregar script de clustering
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.4.1/leaflet.markercluster.js';
  document.body.appendChild(script);
}

if (typeof window !== 'undefined' && window.L) {
  delete (window.L.Icon.Default.prototype as any)._getIconUrl;
  window.L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}


const createIcon = (color: string, emoji?: string) => {
  if (emoji) {
    // Retornar com emoji
    return window.L.divIcon({
      html: `<div style="font-size: 30px; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${emoji}</div>`,
      iconSize: [40, 40],
      className: 'custom-icon'
    });
  } else {
    // Retornar com ponto colorido
    return window.L.divIcon({
      html: `<div style="background-color: ${color}; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);"></div>`,
      iconSize: [30, 30],
      className: 'custom-icon'
    });
  }
};
const calcDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};



const getMinDistanceFromData = (
  lat: number,
  lng: number,
  data: { latitude: number; longitude: number }[],
  fallbackDistance = 5000
): number => {
  // latitude/longitude inválidas → retorna fallback
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    isNaN(lat) ||
    isNaN(lng)
  ) {
    return fallbackDistance;
  }

  // dataset inválido → retorna fallback
  if (!Array.isArray(data) || data.length === 0) {
    return fallbackDistance;
  }

  let minDistance = fallbackDistance;
  let foundValidPoint = false;

  for (const item of data) {
    if (
      typeof item.latitude !== 'number' ||
      typeof item.longitude !== 'number' ||
      isNaN(item.latitude) ||
      isNaN(item.longitude)
    ) continue;

    const distance = calcDistance(lat, lng, item.latitude, item.longitude);

    if (distance > 0 && distance < minDistance) {
      minDistance = distance;
      foundValidPoint = true;
    }
  }

  return foundValidPoint
    ? Math.round(minDistance)
    : fallbackDistance;
};

export default function MapView({ mapType, showHeatmap, visibleLayers, searchQuery, onMapReady }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const heatmapLayerRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);
  const supabaseMarkersRef = useRef<any>(null);
  const proximityMarkerRef = useRef<any>(null);

  // Estados para as tabelas do Supabase
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [estacoesTremData, setEstacoesTremData] = useState<LocationData[]>([]);
  const [estacoesMetroData, setEstacoesMetroData] = useState<LocationData[]>([]);
  const [escolasFederaisData, setEscolasFederais] = useState<LocationData[]>([]);
  const [escolasEstaduaisData, setEscolasEstaduais] = useState<LocationData[]>([]);
  const [escolasMunicipaisData, setEscolasMunicipais] = useState<LocationData[]>([]);
  const [pracasData, setPracas] = useState<LocationData[]>([]);
  const [unidadeSaudeMunicipaisData, setUnidadesSaudeMunicipais] = useState<LocationData[]>([]);
  const [gestaoEquipData, setGestaoEquip] = useState<LocationData[]>([]);
  const [vltData, setVlt] = useState<LocationData[]>([]);
  const [brtData, setBrt] = useState<LocationData[]>([]);
  const [supermercadoData, setSupermercado] = useState<LocationData[]>([]);
  
  const [, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proximityData, setProximityData] = useState<ProximityData>({
    escola: 5000,
    altaCapacidade: 5000,
    hospital: 5000,
    loading: false
  });
  const [mousePos, setMousePos] = useState({ x:0, y:0, lat: 0, lng: 0, visible: false });
  const proximityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ===== BUSCAR DADOS DE MCMV-DATABASE =====
        const mcmvData = await fetchWithCache('/api/locations', 'locations_cache');
        if (mcmvData) {

          const formattedData: LocationData[] = mcmvData.map((item: any) => ({
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

        // // ===== BUSCAR DADOS DE ESTAÇÕES DE TREM =====
        const trainData = await fetchWithCache('/api/train-stations', 'train_stations_cache');

        if (trainData) {
          const formattedEstacoesTrem: LocationData[] = trainData.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          }));

          setEstacoesTremData(formattedEstacoesTrem);
        }

        // // ===== BUSCAR DADOS DE ESTAÇÕES DE METRO =====
        const metroData = await fetchWithCache('/api/metro-stations', 'metro_stations_cache')

        if (metroData) {
          const formattedEstacoesMetro: LocationData[] = metroData.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          }));

          setEstacoesMetroData(formattedEstacoesMetro);
        }

        // ===== BUSCAR DADOS DE ESCOLAS FEDERAIS =====
        const federalSchools = await fetchWithCache('/api/federal-schools', 'federal_schools_cache')

        if (federalSchools) {
          const formattedEscolasFederais: LocationData[] = federalSchools.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          }));

          setEscolasFederais(formattedEscolasFederais);
        }

        // ===== BUSCAR DADOS DE ESCOLAS ESTADUAIS =====
        const stateSchools = await fetchWithCache('/api/state-schools', 'state_schools_cache')

        if (stateSchools) {
          const formattedEscolasEstaduais: LocationData[] = stateSchools.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          }));

          setEscolasEstaduais(formattedEscolasEstaduais);
        }

        // ===== BUSCAR DADOS DE ESCOLAS MUNICIPAIS =====
        const municipalSchools = await fetchWithCache('/api/municipal-schools', 'municipal_schools_cache')

        if (municipalSchools) {
          const formattedEscolasMunicipais: LocationData[] = municipalSchools.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          }));

          setEscolasMunicipais(formattedEscolasMunicipais);
        }

        // ===== BUSCAR DADOS DE PRAÇAS =====
        const squares = await fetchWithCache('/api/squares', 'squares_cache')

        if (squares) {
          const formattedPracas: LocationData[] = squares.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          })); 

          setPracas(formattedPracas);
        }

        // ===== BUSCAR UNIDADES DE SAUDE MUNICIPAIS =====
        const municipalHealthUnits = await fetchWithCache('/api/municipal-health-units', 'municipal_health_units_cache')

        if (municipalHealthUnits) {
          const formattedUnidadesSaudeMunicipais: LocationData[] = municipalHealthUnits.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          }));

          setUnidadesSaudeMunicipais(formattedUnidadesSaudeMunicipais);
          
        }

        // ===== BUSCAR UNIDADES DE GESTÃO DE EQUIPAMENTOS SMAS =====
        const equips = await fetchWithCache('/api/equipments', 'equipments_cache')
        if (equips) {
          const formattedGestaoEquip: LocationData[] = equips.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          }));

          setGestaoEquip(formattedGestaoEquip); 
        }

        //  // ===== BUSCAR PARADAS DE VLT =====
        const vlts = await fetchWithCache('/api/vlt-stations', 'vlts_cache')
        if (vlts) {
          const formattedVlt: LocationData[] = vlts.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
        }));
        setVlt(formattedVlt);
      }

        //  // ===== BUSCAR SUPERMERCADOS =====
        const supermarkets = await fetchWithCache('/api/supermarkets', 'supermarkets_cache')
        if (supermarkets) {
          const formattedSupermercados: LocationData[] = supermarkets.map((item: any) => ( {
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          }));
          setSupermercado(formattedSupermercados);
        }

        //  // ===== BUSCAR PARADAS DE BRT =====
        const brts = await fetchWithCache('/api/brt-stations', 'brts_cache')
        if (brts) {
          const formattedBrts: LocationData[] = brts.map((item: any) => ({
            id: item.id,
            endereco: item.endereco || item['Endereço'] || item.nome || '',
            bairro: item.bairro || item['Bairro'] || '',
            processo: '',
            latitude: parseFloat(item.latitude || 0),
            longitude: parseFloat(item.longitude || 0),
            tipoDeUso: 'Estação de Trem',
            tituloDoProjetо: item.nome || '',
            construtora: '',
            status: 'ativo',
            licenca: '',
            dataLicenca: '',
            ...item
          }));
          setBrt(formattedBrts);
        }

        setLoading(false);
      } catch (error) {
        console.error('Erro inesperado:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  

  const fetchProximityData = async (lat: number, lng: number) => {
    if (loading) return;

    if (proximityTimeoutRef.current) {
      clearTimeout(proximityTimeoutRef.current);
    }

    proximityTimeoutRef.current = setTimeout(async () => {
      setProximityData(prev => ({ ...prev, loading: true }));
      try {
      const distanciaEstacaoTrem = getMinDistanceFromData(
        lat,
        lng,
        [...estacoesTremData, ...estacoesMetroData]
      );
      
      // const todasEscolas = useMemo(
      //   () => [
      //     ...escolasEstaduaisData,
      //     ...escolasFederaisData,
      //     ...escolasMunicipaisData
      //   ],
      //   [escolasEstaduaisData, escolasMunicipaisData, escolasFederaisData]
      // )
      const distanciaEscola = getMinDistanceFromData(
        lat,
        lng,
        [...escolasEstaduaisData,
          ...escolasFederaisData,
          ...escolasMunicipaisData]
      );

      const distanciaHospital = getMinDistanceFromData(
        lat,
        lng,
        unidadeSaudeMunicipaisData
      );



      setProximityData({
        altaCapacidade: distanciaEstacaoTrem,
        escola: distanciaEscola,
        hospital: distanciaHospital,
        loading: false
      });

    } catch (error) {
      console.error('Erro ao calcular proximidade:', error);
      setProximityData(prev => ({ ...prev, loading: false }));
    }
  }, 200);
};

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

    const updateProximity = (e: any, isMobile = false) => {
  setMousePos({
    x: isMobile ? window.innerWidth / 2 : e.containerPoint.x,
    y: isMobile ? window.innerHeight * 0.55 : e.containerPoint.y,
    lat: e.latlng.lat,
    lng: e.latlng.lng,
    visible: true
  });

  if (proximityMarkerRef.current) {
    map.removeLayer(proximityMarkerRef.current);
  }

  proximityMarkerRef.current = window.L.circleMarker(
    [e.latlng.lat, e.latlng.lng],
    {
      radius: 5,
      color: '#000',
      weight: 2,
      fillColor: '#fff',
      fillOpacity: 1
    }
  ).addTo(map);

  fetchProximityData(e.latlng.lat, e.latlng.lng);
};

    map.on('mousemove', (e: any) => {
    if (window.innerWidth < 640) return;
      updateProximity(e, false);
    });

    map.on('click', (e: any) => {
      if (window.innerWidth >= 640) return;
      updateProximity(e, true);
    });

    map.on('mouseout', () => {
  if (window.innerWidth < 640) return; // ❗ NÃO esconder no mobile

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

  
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L?.markerClusterGroup) return;

    if (supabaseMarkersRef.current) {
      mapInstanceRef.current.removeLayer(supabaseMarkersRef.current);
    }

    // Criar grupo de clustering
    const markerClusterGroup = window.L.markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17
    });

    // ===== ADICIONAR MARCADORES DE MCMV-DATABASE =====
    locationData.forEach((location) => {
      if (
          typeof location.latitude === 'number' &&
          typeof location.longitude === 'number'
        ) {         
          
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
          icon: createIcon('#ccc', '🏢')
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

    // ===== ADICIONAR MARCADORES DE ESTAÇÕES DE TREM =====
    estacoesTremData.forEach((estacao) => {
      if (
          typeof estacao.latitude === 'number' &&
          typeof estacao.longitude === 'number'
        ) {         
          const popup = `
          <div style="font-size: 12px; width: 250px;">
          <h1 style="font-size: 16px;">Estação de trem:</h1>
            <b>${estacao.Estação}</b><br/>
            <strong>Rua:</strong> ${estacao.rua}<br/>
            <strong>Presente nos ramais:</strong> ${estacao.presencaRamais}<br/>
          </div>
        `;

        const marker = window.L.marker([estacao.latitude, estacao.longitude], {
          icon: createIcon('#8b5cf6', '🚆') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

    // ===== ADICIONAR MARCADORES DE ESTAÇÕES DE METRO =====
    estacoesMetroData.forEach((estacao) => {
      if (
          typeof estacao.latitude === 'number' &&
          typeof estacao.longitude === 'number'
        ) {          
          const popup = `
          <div style="font-size: 12px; width: 250px;">
            <h1 style="font-size: 16px;">Estação de metrô:</h1>
            <b>${estacao.nome}</b>
          </div>
        `;

        const marker = window.L.marker([estacao.latitude, estacao.longitude], {
          icon: createIcon('#00e5ff', '🚇') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

    // ===== ADICIONAR MARCADORES DE ESCOLAS FEDERAIS =====
    escolasFederaisData.forEach((escola) => {
      if (
          typeof escola.latitude === 'number' &&
          typeof escola.longitude === 'number'
        ) {  
          const popup = `
          <div style="font-size: 12px; width: 250px;">
            <h1 style="font-size: 16px;">Escola federal:</h1>
            <b>${escola.unidade}</b><br/>
            <strong>Endereço:</strong> ${escola.endereco}<br/>
            <strong>Zona:</strong> ${escola.zona}<br/>
            <strong>Telefone:</strong> ${escola.telefone}
          </div>
        `;

        const marker = window.L.marker([escola.latitude, escola.longitude], {
          icon: createIcon('#003cff', '🏫') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

    // ===== ADICIONAR MARCADORES DE ESCOLAS ESTADUAIS =====
    escolasEstaduaisData.forEach((escola) => {
      if (
          typeof escola.latitude === 'number' &&
          typeof escola.longitude === 'number'
        ) {        
          const popup = `
          <div style="font-size: 12px; width: 250px;">
            <h1 style="font-size: 16px;">Escola estadual:</h1>
            <b>${escola.unidade}</b><br/>
            <strong>Endereço:</strong> ${escola.endereco}<br/>
            <strong>Zona:</strong> ${escola.zona}<br/>
            <strong>Telefone:</strong> ${escola.telefone}
          </div>
        `;

        const marker = window.L.marker([escola.latitude, escola.longitude], {
          icon: createIcon('#00eeff', '🏫') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

    // ===== ADICIONAR MARCADORES DE ESCOLAS MUNICIPAIS =====
    escolasMunicipaisData.forEach((escola) => {
      if (
          typeof escola.latitude === 'number' &&
          typeof escola.longitude === 'number'
        ) {        
          const popup = `
          <div style="font-size: 12px; width: 250px;">
            <h1 style="font-size: 16px;">Escola municipal:</h1>
            <b>${escola.nome}</b><br/>
            <strong>Tipo:</strong> ${escola.tipo}
          </div>
        `;

        const marker = window.L.marker([escola.latitude, escola.longitude], {
          icon: createIcon('#00ff0d', '🏫') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

    // ===== ADICIONAR MARCADORES DE PRAÇAS =====
    pracasData.forEach((praca) => {
      if (
          typeof praca.latitude === 'number' &&
          typeof praca.longitude === 'number'
        ) {
        const popup = `
          <div style="font-size: 12px; width: 250px;">
            <h1 style="font-size: 16px;">Praça:</h1>
            <b>${praca.nomeCompleto}</b><br/>
            <strong>Endereço:</strong> ${praca.endereco}<br/>
            <strong>Ap:</strong> ${praca.ap}
          </div>
        `;

        const marker = window.L.marker([praca.latitude, praca.longitude], {
          icon: createIcon('#ff00d4', '⛲') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

    // ===== ADICIONAR MARCADORES DE UNIDADES DE SAUDE MUNICIPAIS =====
    unidadeSaudeMunicipaisData.forEach((unidadeSaude) => {
      if (
          typeof unidadeSaude.latitude === 'number' &&
          typeof unidadeSaude.longitude === 'number'
        ) 
        { 
        const popup = `
          <div style="font-size: 12px; width: 250px;">
            <b>${unidadeSaude.NOME}</b><br/>
            <strong>Endereço:</strong> ${unidadeSaude.ENDERECO}<br/>
            <strong>Bairro:</strong> ${unidadeSaude.BAIRRO}<br/>
            <strong>Tipo de unidade:</strong> ${unidadeSaude.TIPO_UNIDADE}<br/>
            <strong>CNES:</strong> ${unidadeSaude.CNES}<br/>
            <strong>Horário dia de semana:</strong> ${unidadeSaude.HORARIO_SEMANA}<br/>
            <strong>Horário sábado:</strong> ${unidadeSaude.HORARIO_SABADO}<br/>
            <strong>Email:</strong> ${unidadeSaude.EMAIL}<br/>
            <strong>Telefone:</strong> ${unidadeSaude.TELEFONE}
          </div>
        `;

        const marker = window.L.marker([unidadeSaude.latitude, unidadeSaude.longitude], { 
          icon: createIcon('#000000', '🏥') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

// ===== ADICIONAR MARCADORES DE GESTÃO DE EQUIPAMENTOS SMAS =====
    gestaoEquipData.forEach((gestaoEquip) => {
      if (
          typeof gestaoEquip.latitude === 'number' &&
          typeof gestaoEquip.longitude === 'number'
        ) {         
          const popup = `
          <div style="font-size: 12px; width: 250px;">
            <h1 style="font-size: 16px;">Equip.:</h1>
            <b>${gestaoEquip.nome_equip}</b><br/>
            <strong>Endereço:</strong> ${gestaoEquip.endereco}<br/>
            <strong>Bairro:</strong> ${gestaoEquip.bairro}<br/>
            <strong>Bairros atendidos:</strong> ${gestaoEquip.bairros_at}<br/>
            <strong>Hierarquia:</strong> ${gestaoEquip.hierarquia}
            <strong>Telefone:</strong> ${gestaoEquip.telefone}<br/>
          </div>
        `;

        const marker = window.L.marker([gestaoEquip.latitude, gestaoEquip.longitude], { 
          icon: createIcon('#ffee00') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

    // ===== ADICIONAR MARCADORES DE PARADAS VLT =====
    vltData.forEach((vlt) => {
      if (
          typeof vlt.latitude === 'number' &&
          typeof vlt.longitude === 'number'
        ) {         
          const popup = `
          <div style="font-size: 12px; width: 250px;">
            <h1 style="font-size: 16px;">VLT:</h1>
            <b>${vlt.nome}</b>
          </div>
        `;

        const marker = window.L.marker([vlt.latitude, vlt.longitude], { 
          icon: createIcon('#1900ff', '🚋') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });
    
    // ===== ADICIONAR MARCADORES DE PARADAS BRT =====
    brtData.forEach((brt) => {
      if (
          typeof brt.latitude === 'number' &&
          typeof brt.longitude === 'number'
        ) {         
          const popup = `
          <div style="font-size: 12px; width: 250px;">
            <h1 style="font-size: 16px;">BRT:</h1>
            <b>${brt.nome}</b><br/>
            <strong>Corredor:</strong> ${brt.corredor}
          </div>
        `;

        const marker = window.L.marker([brt.latitude, brt.longitude], { 
          icon: createIcon('#ff00a2', '🚌') // Roxo para estações de trem
        }).bindPopup(popup, { maxWidth: 300 });

        markerClusterGroup.addLayer(marker);
      }
    });

    // ===== ADICIONAR MARCADORES DE SUPERMERCADOS =====
    supermercadoData.forEach((supermercado) => {
      if (
          typeof supermercado.latitude === 'number' &&
          typeof supermercado.longitude === 'number'
        ) {         
          const popup = `
          <div style="font-size: 12px; width: 250px;">
            <h1 style="font-size: 16px;">Supermercado:</h1>
            <b>${supermercado.nome}</b>
          </div>
        `;

        const marker = window.L.marker([supermercado.latitude, supermercado.longitude], { 
          icon: createIcon('#d000ff', '🛒') 
        }).bindPopup(popup, { maxWidth: 300,  });

        markerClusterGroup.addLayer(marker);
      }
    });    
    

    markerClusterGroup.addTo(mapInstanceRef.current);
    supabaseMarkersRef.current = markerClusterGroup;
  }, [
  locationData,
  estacoesTremData,
  estacoesMetroData,
  escolasFederaisData,
  escolasEstaduaisData,
  escolasMunicipaisData,
  pracasData,
  unidadeSaudeMunicipaisData,
  gestaoEquipData,
  vltData,
  brtData,
  supermercadoData
]);

  

  

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

  const renderDistance = (
  value: number | null,
  loading: boolean
): string => {
  if (loading) return '—';
  if (value == null) return '—';
  if (value >= 5000) return '≥ 5 km';
  return `${value} m`;
};

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
  className="
    absolute
    bg-white/90 backdrop-blur-md
    border border-gray-200/70
    shadow-[0_10px_30px_rgba(0,0,0,0.12)]
    rounded-2xl
    p-5
    z-50
    w-80
    max-h-[35vh]
    overflow-y-auto
    pointer-events-none sm:pointer-events-auto
  "
  style={{
    left: window.innerWidth < 640
      ? '50%'
      : Math.min(mousePos.x + 15, window.innerWidth - 320),

    top: window.innerWidth < 640
      ? '75%'
      : Math.min(mousePos.y + 15, window.innerHeight - 220),

    transform: window.innerWidth < 640
      ? 'translate(-50%, -50%)'
      : 'none'
  }}
>
          <div className="text-[12px] uppercase tracking-widest font-semibold text-gray-500 mb-3">
  Proximidade
</div>
<div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4" />

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
  <div className="flex items-center gap-3 text-gray-700">
    <span className="text-base">🏫</span>
    <span>Escola mais próxima</span>
  </div>
  <span className="font-semibold text-gray-900">
  {renderDistance(proximityData.escola, proximityData.loading)}
</span>
</div>

<div className="flex items-center justify-between">
  <div className="flex items-center gap-3 text-gray-700">
    <span className="text-base">🚇</span>
    <span>Estação mais próxima</span>
  </div>
  <span className="font-semibold text-gray-900">
  {renderDistance(proximityData.altaCapacidade, proximityData.loading)}
</span>
</div>

<div className="flex items-center justify-between">
  <div className="flex items-center gap-3 text-gray-700">
    <span className="text-base">🏥</span>
    <span>Hospital próximo</span>
  </div>
  <span className="font-semibold text-gray-900">
  {renderDistance(proximityData.hospital, proximityData.loading)}
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