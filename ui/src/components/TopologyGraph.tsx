import { useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { Topology } from '../types';

interface Props {
  topology: Topology | null;
  selectedService?: string | null;
  height?: string;
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
};

const EDGE_HEALTH: Record<string, { color: string; width: number }> = {
  healthy: { color: '#22c55e', width: 2.5 },
  degraded: { color: '#f59e0b', width: 3 },
  critical: { color: '#ef4444', width: 3.5 },
  unknown: { color: '#94a3b8', width: 2 },
};

function getEdgeHealth(): string {
  const r = Math.random();
  if (r < 0.55) return 'healthy';
  if (r < 0.8) return 'degraded';
  return 'unknown';
}

export default function TopologyGraph({ topology, selectedService, height = 'h-[500px]' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const buildGraph = useCallback(() => {
    if (!containerRef.current || !topology) return;
    if (cyRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      cyRef.current.destroy();
    }

    const edgeHealthMap = new Map<string, string>();
    topology.edges.forEach((e) => {
      edgeHealthMap.set(`${e.source}-${e.target}`, getEdgeHealth());
    });

    const elements: cytoscape.ElementDefinition[] = [
      ...topology.nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.name,
          type: n.type,
          team: n.team || 'unassigned',
        },
      })),
      ...topology.edges.map((e) => {
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

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#3b82f6',
            label: 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': '110px',
            color: '#fff',
            'font-size': '10px',
            'font-weight': 'bold' as any,
            'text-outline-color': '#1e293b',
            'text-outline-width': 1.5,
            width: 50,
            height: 50,
            'border-width': 2,
            'border-color': '#1e293b',
            'overlay-padding': '4px',
          },
        },
        ...Object.entries(NODE_COLORS).map(([type, color]) => ({
          selector: `node[type="${type}"]`,
          style: { 'background-color': color },
        })),
        {
          selector: 'node[type="database"]',
          style: { shape: 'cylinder' as any, width: 55, height: 45 },
        },
        {
          selector: 'node[type="cache"]',
          style: { shape: 'diamond' as any, width: 45, height: 45 },
        },
        {
          selector: 'node[type="message_queue"]',
          style: { shape: 'hexagon' as any, width: 50, height: 50 },
        },
        {
          selector: 'node[type="storage"]',
          style: { shape: 'tag' as any, width: 50, height: 50 },
        },
        {
          selector: 'node:after',
          style: {
            content: 'data(team)',
            'font-size': '7px',
            color: '#e2e8f0',
            'text-valign': 'bottom' as any,
            'text-halign': 'center' as any,
            'text-margin-y': 8,
            'text-outline-color': '#0f172a',
            'text-outline-width': 1,
          },
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
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 60, spacingFactor: 1.1 },
      minZoom: 0.3,
      maxZoom: 3,
    });

    if (selectedService) {
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

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      cy.destroy();
    };
  }, [topology, selectedService]);

  useEffect(() => {
    const cleanup = buildGraph();
    return () => cleanup?.();
  }, [buildGraph]);

  return <div ref={containerRef} className={`w-full ${height} bg-gray-900 rounded-xl border border-gray-700`} />;
}
