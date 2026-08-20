import { useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { Topology } from '../types';

interface Props {
  topology: Topology | null;
  selectedService?: string | null;
  selectedSite?: string | null;
  siteAggregate?: boolean;
  height?: string;
  onNodeClick?: (nodeId: string) => void;
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
  // Known degraded connections based on alert data
  const degraded: [string, string][] = [
    ['regional-dc-1', 'branch-nyc'],  // Payment Gateway latency
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

export default function TopologyGraph({ topology, selectedService, selectedSite, siteAggregate = false, height = 'h-[500px]', onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const buildGraph = useCallback(() => {
    if (!containerRef.current || !topology) return;
    if (cyRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      cyRef.current.destroy();
    }

    const validNodeIds = new Set(topology.nodes.map(n => n.id));

    const edgeHealthMap = new Map<string, string>();
    topology.edges.forEach((e) => {
      if (validNodeIds.has(e.source) && validNodeIds.has(e.target)) {
        edgeHealthMap.set(`${e.source}-${e.target}`, getEdgeHealth(e.source, e.target));
      }
    });

    const validEdges = topology.edges.filter(
      e => validNodeIds.has(e.source) && validNodeIds.has(e.target)
    );

    const elements: cytoscape.ElementDefinition[] = [
      ...topology.nodes.map((n) => ({
        data: {
          id: n.id,
          label: siteAggregate
            ? `${n.name}\n${(n as any).device_count || 0} devices`
            : n.name,
          type: n.type,
          team: n.team || 'unassigned',
          site: n.site || 'unassigned',
          topology_type: (n as any).topology_type || '',
          device_count: (n as any).device_count || 0,
        },
      })),
      ...validEdges.map((e) => {
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
    ];

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

    if (selectedSite) {
      const siteNodeIds = new Set<string>();
      cy.nodes().forEach((n) => {
        if (n.data('site') === selectedSite) {
          siteNodeIds.add(n.id());
        }
      });
      if (siteNodeIds.size > 0) {
        cy.nodes().removeClass('highlighted site-highlight').addClass('dimmed');
        cy.edges().addClass('dimmed');
        cy.nodes().filter((n) => siteNodeIds.has(n.id())).removeClass('dimmed').addClass('highlighted site-highlight');
        cy.edges().filter((e) => {
          return siteNodeIds.has(e.source().id()) && siteNodeIds.has(e.target().id());
        }).removeClass('dimmed');
      }
    } else if (selectedService) {
      const nodeIds = new Set<string>();
      cy.nodes().forEach((n) => {
        const team = n.data('team');
        const name = n.data('label').toLowerCase();
        if (
          name.includes(selectedService.toLowerCase()) ||
          team === selectedService.toLowerCase()
        ) {
          nodeIds.add(n.id());
        }
      });
      if (nodeIds.size > 0) {
        const connectedEdges = cy.edges().filter((e) => {
          return nodeIds.has(e.source().id()) || nodeIds.has(e.target().id());
        });
        connectedEdges.forEach((e) => {
          nodeIds.add(e.source().id());
          nodeIds.add(e.target().id());
        });
        cy.nodes().removeClass('highlighted').addClass('dimmed');
        cy.edges().addClass('dimmed');
        cy.nodes().filter((n) => nodeIds.has(n.id())).removeClass('dimmed').addClass('highlighted');
        cy.edges().filter((e) => {
          return nodeIds.has(e.source().id()) && nodeIds.has(e.target().id());
        }).removeClass('dimmed');
      }
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
      onNodeClick?.(evt.target.id());
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      cy.destroy();
    };
  }, [topology, selectedService, selectedSite, siteAggregate, onNodeClick]);

  useEffect(() => {
    const cleanup = buildGraph();
    return () => cleanup?.();
  }, [buildGraph]);

  return <div ref={containerRef} className={`w-full ${height} bg-gray-900 rounded-xl border border-gray-700`} />;
}