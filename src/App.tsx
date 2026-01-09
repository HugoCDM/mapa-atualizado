import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Minus, Home } from 'lucide-react';
import MapView from './components/MapView';
import LayersPanel from './components/LayersPanel';
import MapControls from './components/MapControls';

function App() {
  const [layersPanelOpen, setLayersPanelOpen] = useState(true);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    new Set(['operational', 'transport', 'driving-cycling'])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const mapInstanceRef = useRef<any>(null);

  const toggleLayer = (layerId: string) => {
    const newVisibleLayers = new Set(visibleLayers);
    if (newVisibleLayers.has(layerId)) {
      newVisibleLayers.delete(layerId);
    } else {
      newVisibleLayers.add(layerId);
    }
    setVisibleLayers(newVisibleLayers);
  };

  const handleExport = () => {
    alert('Export functionality - Connect to your data source to export data');
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleHome = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([-22.909427, -43.442134], 11);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-hidden">
        {layersPanelOpen && (
          <div className="w-full md:w-80 lg:w-96 flex-shrink-0">
            <div className="h-64 md:h-full">
              <LayersPanel
                visibleLayers={visibleLayers}
                onToggleLayer={toggleLayer}
              />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
          <MapControls
            mapType={mapType}
            onMapTypeChange={setMapType}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
            onExport={handleExport}
            onSearch={handleSearch}
          />

          <div className="flex-1 relative bg-white rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={() => setLayersPanelOpen(!layersPanelOpen)}
              className="absolute top-4 left-4 z-[1000] bg-white hover:bg-gray-100 p-2 rounded-lg shadow-lg transition-colors"
              title={layersPanelOpen ? 'Close layers panel' : 'Open layers panel'}
            >
              {layersPanelOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>

            <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
              <button
                className="bg-white hover:bg-gray-100 p-2 rounded-lg shadow-lg transition-colors"
                onClick={handleHome}
                title="Return to home view"
              >
                <Home size={20} />
              </button>
              <button
                className="bg-white hover:bg-gray-100 p-2 rounded-lg shadow-lg transition-colors"
                onClick={handleZoomIn}
                title="Zoom in"
              >
                <Plus size={20} />
              </button>
              <button
                className="bg-white hover:bg-gray-100 p-2 rounded-lg shadow-lg transition-colors"
                onClick={handleZoomOut}
                title="Zoom out"
              >
                <Minus size={20} />
              </button>
            </div>

            <MapView
              mapType={mapType}
              showHeatmap={showHeatmap}
              visibleLayers={visibleLayers}
              searchQuery={searchQuery}
              onMapReady={(map) => {
                mapInstanceRef.current = map;
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
