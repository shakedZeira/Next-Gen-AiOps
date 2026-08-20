import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { CIDeviceNeighbor } from '../types';

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

interface Props {
  ciId: string;
  ciName: string;
  neighbors: CIDeviceNeighbor[];
  onClose: () => void;
}

export default function ConnectionsMap({ ciId, ciName, neighbors, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (cyRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      cyRef.current.destroy();
    }

    const elements: cytoscape.ElementDefinition[] = [
      {
        data: {
          id: ciId,
          label: ciName,
          type: '_center',
        },
        position: { x: 400, y: 200 },
      },
      ...neighbors.map((n, i) => {
        const angle = (2 * Math.PI * i) / neighbors.length - Math.PI / 2;
        const radius = 160;
        return {
          data: {
            id: n.id,
            label: n.name || n.id,
            type: n.type,
          },
          position: {
            x: 400 + radius * Math.cos(angle),
            y: 200 + radius * Math.sin(angle),
          },
        };
      }),
      ...neighbors.map((n) => ({
        data: {
          source: n.direction === 'upstream' ? n.id : ciId,
          target: n.direction === 'upstream' ? ciId : n.id,
          label: n.relationship,
        },
      })),
    ];

    const style: any[] = [
      {
        selector: 'node',
        style: {
          'background-image': (ele: cytoscape.NodeSingular) => getIconDataUri(ele.data('type')),
          'background-width': '60%',
          'background-height': '60%',
          'background-fit': 'contain',
          'background-color': '#1e293b',
          'border-width': 2,
          'border-color': (ele: cytoscape.NodeSingular) =>
            ele.data('type') === '_center' ? '#fbbf24' : (NODE_COLORS[ele.data('type')] || '#64748b'),
          label: 'data(label)',
          'text-wrap': 'wrap',
          'text-max-width': '100px',
          color: '#e2e8f0',
          'font-size': '10px',
          'font-weight': 'bold' as cytoscape.Css.FontWeight,
          'text-outline-color': '#0f172a',
          'text-outline-width': 1.5,
          'text-valign': 'bottom' as string,
          'text-margin-y': 8,
          width: 50,
          height: 50,
          'overlay-padding': '4px',
        },
      },
      {
        selector: 'node[type="_center"]',
        style: {
          width: 72,
          height: 72,
          'border-width': 3,
          'border-color': '#fbbf24',
          'font-size': '12px',
        },
      },
      ...Object.entries(NODE_COLORS).map(([type, color]) => ({
        selector: `node[type="${type}"]`,
        style: { 'border-color': color },
      })),
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#64748b',
          'target-arrow-color': '#64748b',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 1.2,
          'line-dash-pattern': [6, 3],
          'line-dash-offset': 0,
          label: 'data(label)',
          'font-size': '9px',
          color: '#94a3b8',
          'text-outline-color': '#0f172a',
          'text-outline-width': 1,
          'text-rotation': 'autorotate' as any,
          'text-margin-y': -10,
        },
      },
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style,
      layout: { name: 'preset' },
      minZoom: 0.5,
      maxZoom: 3,
      userPanningEnabled: true,
    });

    cy.fit(undefined, 40);

    let offset = 0;
    const animateEdges = () => {
      offset = (offset + 0.4) % 20;
      cy.edges().forEach((e) => {
        e.style('line-dash-offset', -offset);
      });
      animFrameRef.current = requestAnimationFrame(animateEdges);
    };
    animFrameRef.current = requestAnimationFrame(animateEdges);

    cyRef.current = cy;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      cy.destroy();
    };
  }, [ciId, ciName, neighbors]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-[800px] max-w-[90vw]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <div>
            <h2 className="text-white font-semibold">Direct Connections</h2>
            <p className="text-xs text-gray-400">{ciName} · {neighbors.length} connected device{neighbors.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-lg px-2"
          >
            ✕
          </button>
        </div>
        <div ref={containerRef} className="h-[400px] bg-gray-950 rounded-b-xl" />
      </div>
    </div>
  );
}
