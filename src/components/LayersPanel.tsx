import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface Layer {
  id: string;
  name: string;
  color?: string;
  children?: Layer[];
}

interface LayersPanelProps {
  visibleLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;
}

const layersData: Layer[] = [
  {
    id: 'operational',
    name: 'Operational Layers',
    children: [
      {
        id: 'general-city',
        name: 'General City Information',
        children: [
          { id: 'hotels', name: 'Hotels' },
          { id: 'residential-units', name: 'Residential Units' },
          { id: 'commercial-units', name: 'Commercial Units' },
          { id: 'retail-units', name: 'Retail Units' },
          { id: 'education', name: 'Education', color: 'bg-red-500' },
          { id: 'places-interest', name: 'Places of Interest', color: 'bg-green-500' },
          { id: 'post-office', name: 'Post Office', color: 'bg-red-600' },
        ]
      }
    ]
  },
  {
    id: 'transport',
    name: 'Transport',
    children: [
      { id: 'underground', name: 'Underground Stations', color: 'bg-blue-600' },
      { id: 'bus-stations', name: 'Bus Stations', color: 'bg-gray-700' },
    ]
  },
  {
    id: 'driving-cycling',
    name: 'Driving and Cycling',
    children: [
      { id: 'compulsory-movements', name: 'Compulsory Movements', color: 'bg-blue-400' },
      { id: 'earned-movements', name: 'Earned Movements', color: 'bg-green-400' },
    ]
  }
];

function LayerItem({ layer, level = 0, visibleLayers, onToggleLayer }: {
  layer: Layer;
  level?: number;
  visibleLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = layer.children && layer.children.length > 0;
  const isChecked = visibleLayers.has(layer.id);

  return (
    <div>
      <div
        className="flex items-center py-1 hover:bg-gray-50 cursor-pointer"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mr-1 text-gray-600"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggleLayer(layer.id)}
          className="mr-2"
        />
        {layer.color && (
          <span className={`w-3 h-3 ${layer.color} rounded-sm mr-2`}></span>
        )}
        <span className="text-sm text-gray-700">{layer.name}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {layer.children?.map(child => (
            <LayerItem
              key={child.id}
              layer={child}
              level={level + 1}
              visibleLayers={visibleLayers}
              onToggleLayer={onToggleLayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LayersPanel({ visibleLayers, onToggleLayer }: LayersPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full overflow-y-auto">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Layers</h3>
      <div>
        {layersData.map(layer => (
          <LayerItem
            key={layer.id}
            layer={layer}
            visibleLayers={visibleLayers}
            onToggleLayer={onToggleLayer}
          />
        ))}
      </div>
    </div>
  );
}
