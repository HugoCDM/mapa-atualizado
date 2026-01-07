import { Search, Download, Map as MapIcon, Satellite, Layers as LayersIcon } from 'lucide-react';

interface MapControlsProps {
  mapType: 'roadmap' | 'satellite' | 'hybrid';
  onMapTypeChange: (type: 'roadmap' | 'satellite' | 'hybrid') => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  onExport: () => void;
}

export default function MapControls({
  mapType,
  onMapTypeChange,
  showHeatmap,
  onToggleHeatmap,
  onExport
}: MapControlsProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-3 md:p-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 flex items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search bar"
            className="flex-1 bg-transparent outline-none text-sm text-gray-700"
          />
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
            onClick={() => onMapTypeChange('roadmap')}
            className={`p-2 rounded-lg transition-colors ${
              mapType === 'roadmap'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            title="Roadmap"
          >
            <MapIcon size={20} />
          </button>

          <button
            onClick={() => onMapTypeChange('satellite')}
            className={`p-2 rounded-lg transition-colors ${
              mapType === 'satellite'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            title="Satellite"
          >
            <Satellite size={20} />
          </button>

          <button
            onClick={() => onMapTypeChange('hybrid')}
            className={`p-2 rounded-lg transition-colors ${
              mapType === 'hybrid'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            title="Hybrid"
          >
            <LayersIcon size={20} />
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

      <div className="mt-2 flex gap-2 text-xs text-gray-500 md:hidden">
        <span>Roadmap</span>
        <span>Satellite</span>
        <span>Hybrid</span>
        <span>Heatmap</span>
      </div>
    </div>
  );
}
