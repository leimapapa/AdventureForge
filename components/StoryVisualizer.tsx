
import React, { useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Story, StoryNode } from '../types';

interface StoryVisualizerProps {
  story: Story;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  isAi: boolean;
  isStart: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  indexInGroup?: number;
  totalInGroup?: number;
}

const StoryVisualizer: React.FC<StoryVisualizerProps> = ({ story }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const graphData = useMemo(() => {
    // Cast Object.values results to StoryNode[] to avoid unknown type errors
    const nodes: GraphNode[] = (Object.values(story.nodes) as StoryNode[]).map(n => ({
      id: n.id,
      name: n.title || 'Untitled',
      isAi: !!n.isAiGenerated,
      isStart: n.id === story.startNodeId
    }));

    const links: GraphLink[] = [];
    (Object.values(story.nodes) as StoryNode[]).forEach(node => {
      node.choices.forEach(choice => {
        links.push({
          source: node.id,
          target: choice.targetNodeId,
          label: choice.text
        });
      });
    });

    // Group links by source/target pair to handle multi-edges with curves
    const linkGroups: Record<string, GraphLink[]> = {};
    links.forEach(link => {
      const key = [link.source, link.target].sort().join('-');
      if (!linkGroups[key]) linkGroups[key] = [];
      link.indexInGroup = linkGroups[key].length;
      linkGroups[key].push(link);
    });
    
    Object.values(linkGroups).forEach(group => {
      group.forEach(link => link.totalInGroup = group.length);
    });

    return { nodes, links };
  }, [story]);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 1200;
    const height = 800;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .append("path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#6366f1");

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom as any);

    const simulation = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(graphData.links).id(d => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(70));

    const link = g.append("g")
      .selectAll("path")
      .data(graphData.links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "#334155")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead)");

    const node = g.append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .join("g")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", (e, d) => {
          if (!e.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => {
          if (!e.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }) as any
      );

    node.append("circle")
      .attr("r", d => d.isStart ? 12 : 8)
      .attr("fill", d => d.isStart ? "#10b981" : (d.isAi ? "#f59e0b" : "#6366f1"))
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0 0 8px rgba(99, 102, 241, 0.3))");

    node.append("text")
      .attr("dx", 15)
      .attr("dy", ".35em")
      .attr("fill", "#f1f5f9")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,0.5)")
      .style("pointer-events", "none")
      .text(d => d.name);

    simulation.on("tick", () => {
      link.attr("d", d => {
        const source = d.source as any;
        const target = d.target as any;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        
        // If multiple links exist between same nodes, curve them
        if (d.totalInGroup && d.totalInGroup > 1) {
          const curveScale = 1.2;
          const offset = (d.indexInGroup || 0) - (d.totalInGroup - 1) / 2;
          const curve = dr * curveScale / Math.abs(offset || 1);
          return `M${source.x},${source.y}A${curve},${curve} 0 0,${offset > 0 ? 1 : 0} ${target.x},${target.y}`;
        }
        
        // Self-loop handling
        if (source.id === target.id) {
          const xRotation = 0;
          const largeArc = 1;
          const sweep = 1;
          const drx = 30;
          const dry = 30;
          return `M${source.x},${source.y}A${drx},${dry} ${xRotation} ${largeArc},${sweep} ${source.x+1},${source.y+1}`;
        }

        return `M${source.x},${source.y}L${target.x},${target.y}`;
      });

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [graphData]);

  return (
    <div className="w-full h-[calc(100vh-64px)] bg-slate-950 overflow-hidden flex flex-col relative">
      <div className="absolute top-6 left-6 flex flex-col gap-2 z-10 p-4 bg-slate-900/60 border border-slate-800 backdrop-blur rounded-2xl shadow-2xl">
          <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2">Graph Key</h4>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-xs text-slate-300">Origin Node</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
              <span className="text-xs text-slate-300">Standard Scene</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-xs text-slate-300">AI Branch</span>
          </div>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" viewBox="0 0 1200 800" />
    </div>
  );
};

export default StoryVisualizer;
