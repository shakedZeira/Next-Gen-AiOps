import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopologyGraph from '../components/TopologyGraph';
import NodeDetailPanel from '../components/NodeDetailPanel';
import ConnectionsMap from '../components/ConnectionsMap';
import GeoMap from '../components/GeoMap';
import { cmdbAPI, dcAPI } from '../api/client';
import { CI, Topology, Service, SiteInfo, CIDeviceNeighbor, SiteLocation, InterSiteConnection, SiteFlow, SiteService } from '../types';

const TEAM_BADGE_COLORS: Record<string, string> = {
  frontend: 'bg-blue-100 text-blue-800',
  backend: 'bg-cyan-100 text-cyan-800',
  payments: 'bg-yellow-100 text-yellow-800',
  data: 'bg-green-100 text-green-800',
  platform: 'bg-purple-100 text-purple-800',
  security: 'bg-red-100 text-red-800',
  sre: 'bg-indigo-100 text-indigo-800',
  network: 'bg-teal-100 text-teal-800',
  unassigned: 'bg-gray-100 text-gray-600',
};

const TYPE_ICONS: Record<string, string> = {
  load_balancer: '⚡',
  host: '💻',
  api_gateway: '🔓',
  microservice: '⚙️',
  database: '🗄️',
  cache: '⚡',
  message_queue: '📨',
  storage: '📁',
  switch: '🔗',
  router: '🔌',
  firewall: '🛡️',
  physical_server: '🖥️',
  container: '📦',
  pod: '📦',
};

const SITE_BADGE_COLORS: Record<string, string> = {
  'global-hq': 'bg-blue-500 text-white',
  'regional-dc-1': 'bg-purple-500 text-white',
  'metro-ring-1': 'bg-green-500 text-white',
  'branch-nyc': 'bg-yellow-500 text-white',
  'branch-london': 'bg-red-500 text-white',
};

const TOPOLOGY_LABELS: Record<string, string> = {
  hierarchical: 'Three-Tier Hierarchical',
  hub_and_spoke: 'Hub-and-Spoke',
  ring: 'ERPS Ring',
};

export default function CMDBExplorer() {
  const [searchParams] = useSearchParams();
  const initialSite = searchParams.get('site') || 'all';
  const [cis, setCIs] = useState<CI[]>([]);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [selectedCI, setSelectedCI] = useState<CI | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<string>('all');
  const [selectedSite, setSelectedSite] = useState<string>(initialSite);
  const [viewMode, setViewMode] = useState<'detailed' | 'aggregated' | 'geo'>(initialSite !== 'all' ? 'detailed' : 'aggregated');
  const [loading, setLoading] = useState(true);
  const [siteAggregateTopo, setSiteAggregateTopo] = useState<Topology | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectionsData, setConnectionsData] = useState<{
    ciId: string;
    ciName: string;
    neighbors: CIDeviceNeighbor[];
  } | null>(null);
  const [siteRackCount, setSiteRackCount] = useState<number | null>(null);
  const [siteLocations, setSiteLocations] = useState<SiteLocation[]>([]);
  const [interSiteConns, setInterSiteConns] = useState<InterSiteConnection[]>([]);
  const [siteFlows, setSiteFlows] = useState<SiteFlow[]>([]);
  const [showFlows, setShowFlows] = useState(true);
  const [siteServices, setSiteServices] = useState<SiteService[]>([]);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ipSearch, setIpSearch] = useState('');

  useEffect(() => {
    Promise.all([
      cmdbAPI.getGlobalTopology().then((r) => setTopology(r.data)),
      cmdbAPI.listCI().then((r) => setCIs(r.data)),
      cmdbAPI.listServices().then((r) => setServices(r.data)),
      cmdbAPI.getSites().then((r) => setSites(r.data)),
      cmdbAPI.getSiteLocations().then((r) => setSiteLocations(r.data)),
      cmdbAPI.getInterSiteConnections().then((r) => setInterSiteConns(r.data)),
      cmdbAPI.getInterSiteFlows().then((r) => setSiteFlows(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (viewMode === 'aggregated' && selectedSite === 'all') {
      cmdbAPI.getSiteAggregateTopology().then((r) => setSiteAggregateTopo(r.data));
    } else {
      setSiteAggregateTopo(null);
      const serviceId = selectedService !== 'all' ? selectedService : undefined;
      if (selectedSite === 'all') {
        cmdbAPI.getGlobalTopology().then((r) => setTopology(r.data));
      } else {
        cmdbAPI.getSiteTopology(selectedSite, 'detailed', serviceId).then((r) => setTopology(r.data));
      }
    }
  }, [selectedSite, viewMode, selectedService]);

  useEffect(() => {
    if (viewMode === 'aggregated' && selectedSite !== 'all') {
      setSiteRackCount(null);
      dcAPI.getRooms(selectedSite).then((r) => {
        const rooms = r.data;
        const rackPromises = rooms.map((room: any) => dcAPI.getRacks(room.id));
        Promise.all(rackPromises).then((rackResults) => {
          const totalRacks = rackResults.reduce((sum, rr) => sum + rr.data.length, 0);
          setSiteRackCount(totalRacks);
        }).catch(() => setSiteRackCount(0));
      }).catch(() => setSiteRackCount(0));
    } else {
      setSiteRackCount(null);
    }
  }, [selectedSite, viewMode]);

  useEffect(() => {
    if (selectedSite !== 'all') {
      cmdbAPI.getSiteServices(selectedSite).then((r) => setSiteServices(r.data)).catch(() => setSiteServices([]));
    } else {
      setSiteServices([]);
    }
    setSelectedService('all');
    setSelectedFlow('all');
    setSearchQuery('');
    setIpSearch('');
  }, [selectedSite]);

  const flowOptions = [
    { value: 'all', label: 'All Services' },
    ...services.map((s) => ({ value: s.owner_team || s.name, label: `${s.name} (${s.owner_team || 'no team'})` })),
  ];

  const siteOptions = [
    { value: 'all', label: 'All Sites', count: cis.length },
    ...sites.map((s) => ({ value: s.name, label: `${s.name} (${TOPOLOGY_LABELS[s.topology_type || ''] || s.topology_type || 'unknown'})`, count: s.device_count })),
  ];

  const filteredCIs = (selectedSite === 'all' ? cis : cis.filter((ci) => ci.site === selectedSite))
    .filter((ci) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return ci.name.toLowerCase().includes(q) ||
             ci.type.toLowerCase().includes(q) ||
             (ci.team || '').toLowerCase().includes(q) ||
             (ci.site || '').toLowerCase().includes(q) ||
             (ci.provider || '').toLowerCase().includes(q);
    })
    .filter((ci) => {
      if (!ipSearch) return true;
      const q = ipSearch.toLowerCase();
      return (ci.management_ip || '').toLowerCase() === q ||
             (ci.loopback_ip || '').toLowerCase() === q;
    });

  const selectedServiceName = selectedService !== 'all'
    ? (siteServices.find((s) => s.id === selectedService)?.name || services.find((s) => s.id === selectedService)?.name || null)
    : null;
  const highlightedService = selectedServiceName || (selectedFlow !== 'all' ? selectedFlow : undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">CMDB Explorer</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Site:</label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500"
            >
              {siteOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label} ({opt.count})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search CIs..."
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500 w-48"
            />
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={ipSearch}
              onChange={(e) => setIpSearch(e.target.value)}
              placeholder="Search by IP..."
              className="px-3 py-1.5 rounded-lg border border-cyan-300 bg-white text-sm focus:ring-2 focus:ring-cyan-500 w-40 font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Flow:</label>
            <select
              value={selectedFlow}
              onChange={(e) => setSelectedFlow(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500"
            >
              {flowOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {selectedSite !== 'all' && siteServices.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Service:</label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Services ({siteServices.reduce((sum, s) => sum + s.ci_count, 0)} CIs)</option>
                {siteServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.ci_count} CIs)</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">View:</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'detailed' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Detailed
              </button>
              <button
                onClick={() => setViewMode('aggregated')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'aggregated' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Site Overview
              </button>
              <button
                onClick={() => setViewMode('geo')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'geo' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Geo Map
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'geo' ? (
        <div className="space-y-6">
          <GeoMap
            sites={siteLocations}
            connections={interSiteConns}
            flows={siteFlows}
            showFlows={showFlows}
            onToggleFlows={() => setShowFlows(!showFlows)}
            height="h-[500px]"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((site) => (
              <div
                key={site.name}
                onClick={() => { setSelectedSite(site.name); setViewMode('aggregated'); }}
                className="p-4 bg-white rounded-xl border cursor-pointer transition-all border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{site.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SITE_BADGE_COLORS[site.name] || 'bg-gray-500 text-white'}`}>
                    {site.site_type || 'unknown'}
                  </span>
                </div>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>{TOPOLOGY_LABELS[site.topology_type || ''] || site.topology_type || 'unknown'}</p>
                  <p>{site.device_count} devices</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === 'aggregated' && selectedSite === 'all' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Site Aggregate Topology</h2>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Hierarchical</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Hub-and-Spoke</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Ring</span>
              </div>
            </div>
            {loading ? (
              <div className="h-[500px] bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Loading topology...</div>
            ) : (
              <TopologyGraph
                topology={siteAggregateTopo}
                siteAggregate={true}
                height="h-[700px]"
              />
            )}
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Sites ({sites.length})</h2>
            <div className="space-y-2 max-h-[660px] overflow-y-auto">
              {sites.map((site) => (
                <div
                  key={site.name}
                  onClick={() => setSelectedSite(site.name)}
                  className="p-3 rounded-lg border cursor-pointer transition-all border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900">{site.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SITE_BADGE_COLORS[site.name] || 'bg-gray-500 text-white'}`}>
                      {site.site_type || 'unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-gray-500">
                    <span>{TOPOLOGY_LABELS[site.topology_type || ''] || site.topology_type || 'unknown'}</span>
                    <span>&middot;</span>
                    <span>{site.device_count} devices</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : viewMode === 'aggregated' && selectedSite !== 'all' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedSite}</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${SITE_BADGE_COLORS[selectedSite] || 'bg-gray-500 text-white'}`}>
                    {sites.find((s) => s.name === selectedSite)?.site_type || 'unknown'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {TOPOLOGY_LABELS[sites.find((s) => s.name === selectedSite)?.topology_type || ''] || sites.find((s) => s.name === selectedSite)?.topology_type || 'unknown'} topology
                </p>
              </div>
              <button
                onClick={() => setViewMode('detailed')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                View Full Topology
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Devices</p>
                <p className="text-2xl font-bold text-gray-900">{sites.find((s) => s.name === selectedSite)?.device_count || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Racks</p>
                <p className="text-2xl font-bold text-gray-900">{siteRackCount !== null ? siteRackCount : '—'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Teams</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {[...new Set(cis.filter((ci) => ci.site === selectedSite && ci.team).map((ci) => ci.team))].map((team) => (
                    <span key={team} className={`px-2 py-0.5 rounded-full text-xs font-medium ${TEAM_BADGE_COLORS[team || 'unassigned']}`}>
                      {team}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">CI Count</p>
                <p className="text-2xl font-bold text-gray-900">{cis.filter((ci) => ci.site === selectedSite).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">{selectedSite} Topology</h2>
            {loading ? (
              <div className="h-[500px] bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Loading topology...</div>
            ) : (
              <TopologyGraph
                topology={topology}
                selectedService={highlightedService}
                selectedSite={selectedSite}
                searchQuery={searchQuery || undefined}
                ipSearch={ipSearch || undefined}
                expandable={true}
                height="h-[700px]"
                onNodeClick={setSelectedNodeId}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {selectedSite === 'all' ? 'Global Topology' : `${selectedSite} Topology`}
              </h2>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Healthy</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> Degraded</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400"></span> No Data</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-dashed border-gray-400 border-t"></span> Flow</span>
              </div>
            </div>
            {loading ? (
              <div className="h-[500px] bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Loading topology...</div>
            ) : (
              <TopologyGraph
                topology={topology}
                selectedService={highlightedService}
                selectedSite={selectedSite !== 'all' ? selectedSite : undefined}
                searchQuery={searchQuery || undefined}
                ipSearch={ipSearch || undefined}
                height="h-[700px]"
                onNodeClick={setSelectedNodeId}
              />
            )}
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">
              Configuration Items {searchQuery ? `(${filteredCIs.length} of ${cis.filter((ci) => selectedSite === 'all' || ci.site === selectedSite).length})` : `(${filteredCIs.length})`}
              {selectedSite !== 'all' && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${SITE_BADGE_COLORS[selectedSite] || 'bg-gray-500 text-white'}`}>
                  {selectedSite}
                </span>
              )}
            </h2>
            <div className="space-y-2 max-h-[560px] overflow-y-auto">
              {filteredCIs.map((ci) => (
                <div
                  key={ci.id}
                  onClick={() => setSelectedCI(ci)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedCI?.id === ci.id
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                      : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900">
                      {TYPE_ICONS[ci.type] || '❓'} {ci.name}
                    </span>
                    <span className="text-xs text-gray-500">{ci.type}</span>
                  </div>
                  {(ci.management_ip || ci.loopback_ip) && (
                    <div className="text-xs font-mono text-cyan-600 mt-1">
                      {ci.management_ip && <span>{ci.management_ip}</span>}
                      {ci.management_ip && ci.loopback_ip && <span className="text-gray-400 mx-1">/</span>}
                      {ci.loopback_ip && <span className="text-gray-400">{ci.loopback_ip}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {ci.team && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TEAM_BADGE_COLORS[ci.team] || TEAM_BADGE_COLORS.unassigned}`}>
                        {ci.team}
                      </span>
                    )}
                    {ci.site && selectedSite === 'all' && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SITE_BADGE_COLORS[ci.site] || 'bg-gray-500 text-white'}`}>
                        {ci.site}
                      </span>
                    )}
                    {ci.provider && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{ci.provider}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedCI && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">CI Details: {selectedCI.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
            <div><span className="text-gray-500">Type:</span> <span className="font-medium">{selectedCI.type}</span></div>
            <div><span className="text-gray-500">Provider:</span> <span className="font-medium">{selectedCI.provider || '-'}</span></div>
            <div><span className="text-gray-500">Environment:</span> <span className="font-medium">{selectedCI.environment || '-'}</span></div>
            <div><span className="text-gray-500">Site:</span>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${SITE_BADGE_COLORS[selectedCI.site || ''] || 'bg-gray-500 text-white'}`}>
                {selectedCI.site || 'unassigned'}
              </span>
            </div>
            <div><span className="text-gray-500">Layer:</span> <span className="font-medium">{selectedCI.network_layer || '-'}</span></div>
            <div><span className="text-gray-500">Topology:</span> <span className="font-medium">{TOPOLOGY_LABELS[selectedCI.topology_type || ''] || selectedCI.topology_type || '-'}</span></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
            <div><span className="text-gray-500">Team:</span>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${TEAM_BADGE_COLORS[selectedCI.team || 'unassigned']}`}>
                {selectedCI.team || 'unassigned'}
              </span>
            </div>
            <div><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{selectedCI.id}</span></div>
          </div>
          {Object.keys(selectedCI.labels).length > 0 && (
            <div className="mt-4 flex gap-1 flex-wrap">
              {Object.entries(selectedCI.labels).map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{k}: {v}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <NodeDetailPanel
        ciId={selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        onViewConnections={(ciId, ciName, neighbors) => {
          setSelectedNodeId(null);
          setConnectionsData({ ciId, ciName, neighbors });
        }}
      />

      {connectionsData && (
        <ConnectionsMap
          ciId={connectionsData.ciId}
          ciName={connectionsData.ciName}
          neighbors={connectionsData.neighbors}
          onClose={() => setConnectionsData(null)}
        />
      )}
    </div>
  );
}
