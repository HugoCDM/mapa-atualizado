import { Search, Download, Map as MapIcon, Satellite } from 'lucide-react';
import { useState, KeyboardEvent } from 'react';

interface MapControlsProps {
  mapType: 'roadmap' | 'satellite';
  onMapTypeChange: (type: 'roadmap' | 'satellite') => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  onExport: () => void;
  onSearch: (query: string) => void;
}

export default function MapControls({
  mapType,
  onMapTypeChange,
  showHeatmap,
  onToggleHeatmap,
  onExport,
  onSearch
}: MapControlsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleMapType = () => {
    onMapTypeChange(mapType === 'roadmap' ? 'satellite' : 'roadmap');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 md:p-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 flex items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search for an address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-transparent outline-none text-sm text-gray-700"
          />
          {searchQuery && (
            <button
              onClick={handleSearch}
              className="ml-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
            >
              Search
            </button>
          )}
        </div>

        <button
          onClick={onExport}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-sm text-gray-700 transition-colors"
        >
          <Download size={18} />
          <span className="hidden sm:inline">Export</span>
        </button>

        <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
          <button
            onClick={toggleMapType}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-sm text-gray-700 transition-colors"
            title={mapType === 'roadmap' ? 'Switch to Satellite' : 'Switch to Roadmap'}
          >
            {mapType === 'roadmap' ? (
              <>
                <Satellite size={18} />
                <span className="hidden sm:inline">Satellite</span>
              </>
            ) : (
              <>
                <MapIcon size={18} />
                <span className="hidden sm:inline">Roadmap</span>
              </>
            )}
          </button>

          <button
            onClick={onToggleHeatmap}
            className={`p-2 rounded-lg transition-colors ${
              showHeatmap
                ? 'bg-orange-500 text-white'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            title="Heatmap"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <div className={`w-4 h-4 rounded-full ${showHeatmap ? 'bg-white' : 'bg-orange-500'}`}></div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
