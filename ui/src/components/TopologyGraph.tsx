import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { Topology } from '../types';

export default function TopologyGraph({ topology }: { topology: Topology | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || !topology) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const elements = [
      ...topology.nodes.map(n => ({
        data: { id: n.id, label: n.name, type: n.type },
      })),
      ...topology.edges.map(e => ({
        data: { source: e.source, target: e.target, label: e.type },
      })),
    ];

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        { selector: 'node', style: { 'background-color': '#3b82f6', label: 'data(label)', 'text-wrap': 'wrap', 'text-max-width': '100px', color: '#fff', 'font-size': '10px' } },
        { selector: 'edge', style: { width: 2, 'line-color': '#94a3b8', 'target-arrow-color': '#94a3b8', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': '8px', color: '#64748b' } },
        { selector: 'node[type="database"]', style: { 'background-color': '#22c55e' } },
        { selector: 'node[type="cache"]', style: { 'background-color': '#f59e0b' } },
        { selector: 'node[type="queue"]', style: { 'background-color': '#8b5cf6' } },
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 50 },
    });

    return () => { cyRef.current?.destroy(); };
  }, [topology]);

  return <div ref={containerRef} className="w-full h-96 bg-gray-50 rounded-xl border" />;
}
