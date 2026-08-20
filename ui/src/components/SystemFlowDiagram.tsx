interface ComponentHealth {
  id: string;
  name: string;
  category: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms: number;
  throughput: number;
}

interface Props {
  components: ComponentHealth[];
}

const FLOW_STAGES = [
  { id: 'data_sources', label: 'Data Sources', icon: '📡', color: '#3b82f6' },
  { id: 'ingestion', label: 'Ingestion', icon: '📥', color: '#8b5cf6' },
  { id: 'processing', label: 'Processing', icon: '⚙️', color: '#f59e0b' },
  { id: 'storage', label: 'Storage', icon: '💾', color: '#22c55e' },
  { id: 'visualization', label: 'Visualization', icon: '📊', color: '#0ea5e9' },
];

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  degraded: '#f59e0b',
  down: '#ef4444',
};

export default function SystemFlowDiagram({ components }: Props) {
  const getStageComponents = (stageId: string) => {
    return components.filter(c => c.category === stageId);
  };

  const getStageStatus = (stageId: string): 'healthy' | 'degraded' | 'down' => {
    const stageComps = getStageComponents(stageId);
    if (stageComps.some(c => c.status === 'down')) return 'down';
    if (stageComps.some(c => c.status === 'degraded')) return 'degraded';
    return 'healthy';
  };

  return (
    <div className="relative">
      {/* Flow Diagram */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
        {FLOW_STAGES.map((stage, idx) => {
          const stageComps = getStageComponents(stage.id);
          const stageStatus = getStageStatus(stage.id);
          
          return (
            <div key={stage.id} className="flex items-center">
              <div className="flex flex-col items-center min-w-[140px]">
                {/* Stage Header */}
                <div 
                  className="relative flex items-center justify-center w-16 h-16 rounded-xl border-2 mb-2"
                  style={{ 
                    borderColor: STATUS_COLORS[stageStatus],
                    backgroundColor: `${stage.color}15`,
                  }}
                >
                  <span className="text-2xl">{stage.icon}</span>
                  <div 
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: STATUS_COLORS[stageStatus] }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-900 text-center">{stage.label}</span>
                
                {/* Component Count */}
                <div className="mt-2 text-center">
                  <div className="text-lg font-bold" style={{ color: stage.color }}>
                    {stageComps.length}
                  </div>
                  <div className="text-xs text-gray-500">components</div>
                </div>

                {/* Mini Component List */}
                <div className="mt-2 space-y-1">
                  {stageComps.slice(0, 3).map((comp) => (
                    <div key={comp.id} className="flex items-center gap-1.5 text-xs">
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[comp.status] }}
                      />
                      <span className="text-gray-600 truncate max-w-[100px]">{comp.name}</span>
                    </div>
                  ))}
                  {stageComps.length > 3 && (
                    <div className="text-xs text-gray-400">+{stageComps.length - 3} more</div>
                  )}
                </div>
              </div>

              {/* Arrow between stages */}
              {idx < FLOW_STAGES.length - 1 && (
                <div className="flex items-center mx-2">
                  <div className="w-8 h-0.5 bg-gray-300 relative">
                    <div 
                      className="absolute inset-y-0 left-0 bg-primary-500"
                      style={{ 
                        width: getStageStatus(stage.id) === 'healthy' ? '100%' : 
                               getStageStatus(stage.id) === 'degraded' ? '60%' : '20%'
                      }}
                    />
                  </div>
                  <svg className="w-4 h-4 text-gray-400 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Data Flow Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-5 gap-4 text-center">
          {FLOW_STAGES.map((stage) => {
            const stageComps = getStageComponents(stage.id);
            const avgLatency = stageComps.length > 0 
              ? stageComps.reduce((sum, c) => sum + c.latency_ms, 0) / stageComps.length 
              : 0;
            
            return (
              <div key={stage.id}>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Avg Latency</div>
                <div className="text-sm font-semibold text-gray-900">{avgLatency.toFixed(0)}ms</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
