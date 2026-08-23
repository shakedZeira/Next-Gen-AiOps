import { useEffect, useRef, useCallback, useState } from 'react';
import cytoscape from 'cytoscape';
import { Topology } from '../types';

interface Props {
  topology: Topology | null;
  selectedService?: string | null;
  selectedSite?: string | null;
  searchQuery?: string | null;
  ipSearch?: string | null;
  siteAggregate?: boolean;
  expandable?: boolean;
  height?: string;
  onNodeClick?: (nodeId: string) => void;
  traceroutePath?: { name: string; site: string }[];
  failedLinks?: Array<{ a_id: string; b_id: string }>;
  impactNodes?: Array<{ ci_id: string; ci_name: string; ci_type: string; depth: number }>;
  highlightedNodeId?: string | null;
}

const NODE_COLORS: Record<string, string> = {
  load_balancer: '#6366f1',
  host: '#3b82f6',
  api_gateway: '#8b5cf6',
  microservice: '#0ea5e9',
  database: '#22c55e',
  cache: '#f59e0b',
  message_queue: '#a855f7',
  storage: '#ec4899',
  switch: '#14b8a6',
  router: '#f97316',
  firewall: '#ef4444',
  physical_server: '#64748b',
  container: '#06b6d4',
  pod: '#8b5cf6',
};

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SITE_ICON = svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/></svg>');

const SITE_TOPOLOGY_COLORS: Record<string, string> = {
  hierarchical: '#3b82f6',
  hub_and_spoke: '#a855f7',
  ring: '#22c55e',
};

const ICON_SVGS: Record<string, string> = {
  router: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="12" rx="2"/><rect width="20" height="8" x="2" y="4" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
  switch: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
  firewall: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  load_balancer: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
  physical_server: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
  host: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
  container: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  pod: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  database: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>',
  storage: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>',
  cache: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  message_queue: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
  api_gateway: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  microservice: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>',
};

const iconDataUriCache = new Map<string, string>();
function getIconDataUri(type: string): string {
  if (iconDataUriCache.has(type)) return iconDataUriCache.get(type)!;
  const svg = ICON_SVGS[type] || ICON_SVGS['host'];
  const uri = svgToDataUri(svg);
  iconDataUriCache.set(type, uri);
  return uri;
}

const EDGE_HEALTH: Record<string, { color: string; width: number }> = {
  healthy: { color: '#22c55e', width: 2.5 },
  degraded: { color: '#f59e0b', width: 3 },
  critical: { color: '#ef4444', width: 3.5 },
  unknown: { color: '#94a3b8', width: 2 },
};

function getEdgeHealth(source: string, target: string): string {
  const degraded: [string, string][] = [
    ['regional-dc-1', 'branch-nyc'],
  ];
  const isDegraded = degraded.some(
    ([s, t]) => (s === source && t === target) || (s === target && t === source)
  );
  return isDegraded ? 'degraded' : 'healthy';
}

const NODE_SHAPES: Record<string, string> = {
  database: 'ellipse',
  cache: 'diamond',
  message_queue: 'hexagon',
  storage: 'tag',
  switch: 'rectangle',
  router: 'ellipse',
  firewall: 'rectangle',
  physical_server: 'rectangle',
  container: 'round-rectangle',
  pod: 'ellipse',
};

const PRINCIPAL_TYPES = new Set(['router', 'switch', 'firewall', 'load_balancer']);

export default function TopologyGraph({ topology, selectedService, selectedSite, searchQuery, ipSearch, siteAggregate = false, expandable = false, height = 'h-[500px]', onNodeClick, traceroutePath, failedLinks, impactNodes, highlightedNodeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const buildGraph = useCallback(() => {
    if (!containerRef.current || !topology) return;
    if (cyRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      cyRef.current.destroy();
    }

    const allNodeIds = new Set(topology.nodes.map(n => n.id));

    // Build adjacency: for each node, which nodes is it connected to
    const adjacency = new Map<string, Set<string>>();
    topology.edges.forEach(e => {
      if (!allNodeIds.has(e.source) || !allNodeIds.has(e.target)) return;
      if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
      if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
      adjacency.get(e.source)!.add(e.target);
      adjacency.get(e.target)!.add(e.source);
    });

    // In expandable mode, determine visible nodes and edges
    let visibleNodes: Set<string>;
    let visibleEdges: { source: string; target: string; type: string }[];

    if (expandable) {
      visibleNodes = new Set();
      // Always show principal nodes
      topology.nodes.forEach(n => {
        if (PRINCIPAL_TYPES.has(n.type)) visibleNodes.add(n.id);
      });
      // Show expanded children
      expandedNodes.forEach(parentId => {
        const neighbors = adjacency.get(parentId);
        if (neighbors) neighbors.forEach(childId => visibleNodes.add(childId));
      });
      visibleEdges = topology.edges.filter(e =>
        visibleNodes.has(e.source) && visibleNodes.has(e.target)
      );
    } else {
      visibleNodes = allNodeIds;
      visibleEdges = topology.edges.filter(e =>
        allNodeIds.has(e.source) && allNodeIds.has(e.target)
      );
    }

    const edgeHealthMap = new Map<string, string>();
    visibleEdges.forEach(e => {
      edgeHealthMap.set(`${e.source}-${e.target}`, getEdgeHealth(e.source, e.target));
    });

    const elements: cytoscape.ElementDefinition[] = [
      ...topology.nodes
        .filter(n => visibleNodes.has(n.id))
        .map(n => {
          // Count hidden children for expandable nodes with hidden neighbors
          let hiddenCount = 0;
          if (expandable && !expandedNodes.has(n.id)) {
            const neighbors = adjacency.get(n.id);
            if (neighbors) {
              neighbors.forEach(childId => {
                if (!visibleNodes.has(childId)) hiddenCount++;
              });
            }
          }
          const label = hiddenCount > 0
            ? `${n.name}\n+${hiddenCount}`
            : siteAggregate
              ? `${n.name}\n${(n as any).device_count || 0} devices`
              : n.name;
          return {
            data: {
              id: n.id,
              label,
              type: n.type,
              team: n.team || 'unassigned',
              site: n.site || 'unassigned',
              management_ip: (n as any).management_ip || '',
              loopback_ip: (n as any).loopback_ip || '',
              topology_type: (n as any).topology_type || '',
              device_count: (n as any).device_count || 0,
              hidden_count: hiddenCount,
              expanded: expandedNodes.has(n.id),
            },
          };
        }),
      ...visibleEdges.map(e => {
        const key = `${e.source}-${e.target}`;
        const health = edgeHealthMap.get(key) || 'unknown';
        return {
          data: {
            source: e.source,
            target: e.target,
            label: e.type,
            health,
          },
        };
      }),
    ];

    const style: any[] = [
      {
        selector: 'node',
        style: {
          'background-image': (ele: cytoscape.NodeSingular) =>
            siteAggregate && ele.data('type') === 'site'
              ? SITE_ICON
              : getIconDataUri(ele.data('type')),
          'background-width': '60%',
          'background-height': '60%',
          'background-fit': 'contain',
          'background-color': '#1e293b',
          'border-width': 2.5,
          'border-color': (ele: cytoscape.NodeSingular) => NODE_COLORS[ele.data('type')] || '#64748b',
          label: 'data(label)',
          'text-wrap': 'wrap',
          'text-max-width': '110px',
          color: '#e2e8f0',
          'font-size': '10px',
          'font-weight': 'bold' as cytoscape.Css.FontWeight,
          'text-outline-color': '#0f172a',
          'text-outline-width': 1.5,
          'text-valign': 'bottom' as string,
          'text-margin-y': 8,
          width: 56,
          height: 56,
          'overlay-padding': '4px',
        },
      },
      ...(siteAggregate
        ? [
            {
              selector: 'node[type="site"]',
              style: {
                width: 100,
                height: 100,
                'border-width': 3,
                'border-color': (ele: cytoscape.NodeSingular) =>
                  SITE_TOPOLOGY_COLORS[ele.data('topology_type')] || '#64748b',
                'background-color': '#0f172a',
                'font-size': '11px',
                'text-margin-y': 10,
                'background-width': '50%',
                'background-height': '50%',
              },
            },
            ...Object.entries(SITE_TOPOLOGY_COLORS).map(([topoType, color]) => ({
              selector: `node[topology_type="${topoType}"]`,
              style: { 'border-color': color },
            })),
          ]
        : []),
      ...Object.entries(NODE_COLORS).map(([type, color]) => ({
        selector: `node[type="${type}"]`,
        style: { 'border-color': color },
      })),
      ...Object.entries(NODE_SHAPES).map(([type, shape]) => ({
        selector: `node[type="${type}"]`,
        style: { shape: shape as string },
      })),
      {
        selector: 'node[type="switch"]',
        style: { width: 56, height: 44 },
      },
      {
        selector: 'node[type="router"]',
        style: { width: 58, height: 58 },
      },
      {
        selector: 'node[type="firewall"]',
        style: { width: 52, height: 52 },
      },
      {
        selector: 'node[type="database"]',
        style: { width: 56, height: 50 },
      },
      {
        selector: 'node[type="cache"]',
        style: { width: 48, height: 48 },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#94a3b8',
          'target-arrow-color': '#94a3b8',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 1.2,
          'line-dash-pattern': [6, 3],
          'line-dash-offset': 0,
        },
      },
      ...Object.entries(EDGE_HEALTH).map(([health, cfg]) => ({
        selector: `edge[health="${health}"]`,
        style: {
          'line-color': cfg.color,
          'target-arrow-color': cfg.color,
          width: cfg.width,
        },
      })),
      {
        selector: '.dimmed',
        style: { opacity: 0.15 },
      },
      {
        selector: '.highlighted',
        style: { opacity: 1 },
      },
      {
        selector: 'node.highlighted',
        style: {
          'border-width': 3,
          'border-color': '#fbbf24',
        },
      },
      {
        selector: '.site-highlight',
        style: {
          'border-width': 4,
          'border-color': '#fbbf24',
          opacity: 1,
        },
      },
      {
        selector: '.ip-highlight',
        style: {
          'border-width': 4,
          'border-color': '#06b6d4',
          opacity: 1,
        },
      },
      {
        selector: '.traceroute-node',
        style: {
          'border-width': 4,
          'border-color': '#a855f7',
          opacity: 1,
        },
      },
      {
        selector: '.traceroute-edge',
        style: {
          'line-color': '#a855f7',
          'target-arrow-color': '#a855f7',
          width: 4,
          'line-style': 'solid',
        },
      },
      {
        selector: '.failed-link',
        style: {
          'line-color': '#ef4444',
          'target-arrow-color': '#ef4444',
          width: 4,
          'line-style': 'solid',
        },
      },
      {
        selector: '.recovered-link',
        style: {
          'line-color': '#22c55e',
          'target-arrow-color': '#22c55e',
          width: 4,
          'line-style': 'solid',
        },
      },
      {
        selector: '.cross-site-marker',
        style: {
          'border-width': 5,
          'border-color': '#f59e0b',
          'border-style': 'dashed',
          opacity: 1,
        },
      },
      {
        selector: '.impact-node',
        style: {
          'border-width': 4,
          'border-color': '#ef4444',
          opacity: 1,
          'background-color': '#ef4444',
        },
      },
      {
        selector: '.impact-source',
        style: {
          'border-width': 5,
          'border-color': '#f59e0b',
          opacity: 1,
        },
      },
      {
        selector: '.impact-edge',
        style: {
          'line-color': '#ef4444',
          'target-arrow-color': '#ef4444',
          width: 3,
          'line-style': 'dashed',
        },
      },
    ];

    // Expandable mode: style nodes with hidden children
    if (expandable) {
      style.push({
        selector: 'node[hidden_count > 0]',
        style: {
          'border-width': 3.5,
          'border-color': '#22d3ee',
          'overlay-padding': '6px',
        },
      });
      style.push({
        selector: 'node[expanded = true]',
        style: {
          'border-width': 2.5,
          'border-color': (ele: cytoscape.NodeSingular) => NODE_COLORS[ele.data('type')] || '#64748b',
        },
      });
    }

    const layoutOpts = siteAggregate
      ? {
          name: topology.nodes.length === 5 ? 'preset' : 'circle',
          padding: 80,
          ...(topology.nodes.length === 5
            ? {
                positions: (node: cytoscape.NodeSingular) => {
                  const idx = topology.nodes.findIndex((n) => n.id === node.id());
                  const angle = (2 * Math.PI * idx) / 5 - Math.PI / 2;
                  const radius = 250;
                  return { x: 450 + radius * Math.cos(angle), y: 350 + radius * Math.sin(angle) };
                },
              }
            : {}),
        }
      : { name: 'breadthfirst', directed: true, padding: 60, spacingFactor: 1.5, idealEdgeLength: 120 };

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style,
      layout: layoutOpts,
      minZoom: 0.3,
      maxZoom: 3,
    });

    if (selectedSite || selectedService || searchQuery || ipSearch) {
      let siteNodeIds: Set<string> | null = null;
      if (selectedSite) {
        siteNodeIds = new Set<string>();
        cy.nodes().forEach((n) => {
          if (n.data('site') === selectedSite) {
            siteNodeIds!.add(n.id());
          }
        });
      }

      let serviceNodeIds: Set<string> | null = null;
      if (selectedService) {
        serviceNodeIds = new Set<string>();
        cy.nodes().forEach((n) => {
          const team = n.data('team');
          const label = n.data('label') || '';
          const name = label.toLowerCase();
          if (
            name.includes(selectedService.toLowerCase()) ||
            team === selectedService.toLowerCase()
          ) {
            serviceNodeIds!.add(n.id());
          }
        });
      }

      let searchNodeIds: Set<string> | null = null;
      if (searchQuery) {
        searchNodeIds = new Set<string>();
        const q = searchQuery.toLowerCase();
        cy.nodes().forEach((n) => {
          const label = (n.data('label') || '').toLowerCase();
          const team = (n.data('team') || '').toLowerCase();
          const type = (n.data('type') || '').toLowerCase();
          const site = (n.data('site') || '').toLowerCase();
          if (
            label.includes(q) ||
            team.includes(q) ||
            type.includes(q) ||
            site.includes(q)
          ) {
            searchNodeIds!.add(n.id());
          }
        });
      }

      let ipNodeIds: Set<string> | null = null;
      if (ipSearch) {
        ipNodeIds = new Set<string>();
        const q = ipSearch.toLowerCase();
        cy.nodes().forEach((n) => {
          const mip = (n.data('management_ip') || '').toLowerCase();
          const lip = (n.data('loopback_ip') || '').toLowerCase();
          if (mip === q || lip === q) {
            ipNodeIds!.add(n.id());
          }
        });
      }

      let matchedNodeIds: Set<string> | null = null;
      const sets = [siteNodeIds, serviceNodeIds, searchNodeIds, ipNodeIds].filter((s): s is Set<string> => s !== null);
      for (const set of sets) {
        if (matchedNodeIds === null) {
          matchedNodeIds = set;
        } else {
          const result = new Set<string>();
          for (const id of matchedNodeIds) {
            if (set.has(id)) result.add(id);
          }
          matchedNodeIds = result;
        }
      }

      if (matchedNodeIds && matchedNodeIds.size > 0) {
        const connectedEdges = cy.edges().filter((e) => {
          return matchedNodeIds!.has(e.source().id()) || matchedNodeIds!.has(e.target().id());
        });
        connectedEdges.forEach((e) => {
          matchedNodeIds!.add(e.source().id());
          matchedNodeIds!.add(e.target().id());
        });

        const highlightClass = ipSearch ? 'ip-highlight' : 'site-highlight';
        cy.nodes().removeClass('highlighted site-highlight ip-highlight').addClass('dimmed');
        cy.edges().addClass('dimmed');
        cy.nodes().filter((n) => matchedNodeIds!.has(n.id())).removeClass('dimmed').addClass(`highlighted ${highlightClass}`);
        cy.edges().filter((e) => {
          return matchedNodeIds!.has(e.source().id()) && matchedNodeIds!.has(e.target().id());
        }).removeClass('dimmed');
      }
    }

    // Traceroute path highlighting — matches device names to node labels
    if (traceroutePath && traceroutePath.length > 1) {
      const traceNodeIds: string[] = [];
      const seenIds = new Set<string>();
      let lastMatchedSite = '';
      let firstCrossSiteHop: { name: string; site: string } | null = null;

      for (const hop of traceroutePath) {
        let found = false;
        cy.nodes().forEach((n) => {
          if (found || seenIds.has(n.id())) return;
          const label = (n.data('label') || '').split('\n')[0];
          if (label === hop.name) {
            traceNodeIds.push(n.id());
            seenIds.add(n.id());
            lastMatchedSite = hop.site;
            found = true;
          }
        });
        if (!found && lastMatchedSite && hop.site && hop.site !== lastMatchedSite && !firstCrossSiteHop) {
          firstCrossSiteHop = hop;
        }
      }

      if (traceNodeIds.length >= 1) {
        cy.nodes().removeClass('dimmed highlighted site-highlight ip-highlight');
        cy.edges().addClass('dimmed');
        cy.nodes().forEach((n) => {
          if (traceNodeIds.includes(n.id())) {
            n.removeClass('dimmed').addClass('traceroute-node');
          } else {
            n.addClass('dimmed');
          }
        });
        for (let i = 0; i < traceNodeIds.length - 1; i++) {
          cy.edges().filter((e) => {
            return (e.source().id() === traceNodeIds[i] && e.target().id() === traceNodeIds[i + 1]) ||
                   (e.source().id() === traceNodeIds[i + 1] && e.target().id() === traceNodeIds[i]);
          }).removeClass('dimmed').addClass('traceroute-edge');
        }
        if (firstCrossSiteHop && traceNodeIds.length > 0) {
          const lastNode = cy.getElementById(traceNodeIds[traceNodeIds.length - 1]);
          const origLabel = (lastNode.data('label') || '').split('\n')[0];
          lastNode.data('label', `${origLabel}\n→ ${firstCrossSiteHop.site}`);
          lastNode.addClass('cross-site-marker');
        }
      }
    }

    // Failed link highlighting
    if (failedLinks && failedLinks.length > 0) {
      const failedKeys = new Set(failedLinks.map(l => `${l.a_id}-${l.b_id}`));
      cy.edges().forEach((e) => {
        const key1 = `${e.source().id()}-${e.target().id()}`;
        const key2 = `${e.target().id()}-${e.source().id()}`;
        if (failedKeys.has(key1) || failedKeys.has(key2)) {
          e.removeClass('dimmed recovered-link').addClass('failed-link');
        }
      });
    }

    // Impact analysis highlighting
    if (impactNodes && impactNodes.length > 0 && highlightedNodeId) {
      const impactIds = new Set(impactNodes.map(n => n.ci_id));
      cy.nodes().forEach((n) => {
        if (n.id() === highlightedNodeId) {
          n.removeClass('dimmed').addClass('impact-source');
        } else if (impactIds.has(n.id())) {
          n.removeClass('dimmed').addClass('impact-node');
          const depth = impactNodes.find(n2 => n2.ci_id === n.id())?.depth || 0;
          const origLabel = (n.data('label') || '').split('\n')[0];
          n.data('label', `${origLabel}\n⬇ depth ${depth}`);
        } else {
          n.addClass('dimmed');
        }
      });
      cy.edges().forEach((e) => {
        const src = e.source().id();
        const tgt = e.target().id();
        if ((src === highlightedNodeId && impactIds.has(tgt)) || (impactIds.has(src) && tgt === highlightedNodeId) || (impactIds.has(src) && impactIds.has(tgt))) {
          e.removeClass('dimmed').addClass('impact-edge');
        } else {
          e.addClass('dimmed');
        }
      });
    }

    let offset = 0;
    const animateEdges = () => {
      offset = (offset + 0.4) % 20;
      cy.edges().forEach((e) => {
        if (!e.hasClass('dimmed')) {
          e.style('line-dash-offset', -offset);
        }
      });
      animFrameRef.current = requestAnimationFrame(animateEdges);
    };
    animFrameRef.current = requestAnimationFrame(animateEdges);

    cyRef.current = cy;

    cy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id();
      if (expandable) {
        const hiddenCount = evt.target.data('hidden_count');
        if (hiddenCount > 0 || expandedNodes.has(nodeId)) {
          toggleExpand(nodeId);
          return;
        }
      }
      onNodeClick?.(nodeId);
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      cy.destroy();
    };
  }, [topology, selectedService, selectedSite, searchQuery, ipSearch, siteAggregate, expandable, expandedNodes, toggleExpand, onNodeClick, traceroutePath, failedLinks, impactNodes, highlightedNodeId]);

  useEffect(() => {
    const cleanup = buildGraph();
    return () => cleanup?.();
  }, [buildGraph]);

  return <div ref={containerRef} className={`w-full ${height} bg-gray-900 rounded-xl border border-gray-700`} />;
}
