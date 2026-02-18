
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Story, StoryNode, Choice } from '../types';
import { 
  Plus, 
  ImageIcon, 
  Film, 
  Sparkles, 
  Loader2, 
  Download, 
  Upload, 
  X, 
  FileText, 
  Compass, 
  Search, 
  Filter, 
  Link2Off,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ChevronRight
} from 'lucide-react';
import { generateImageForNode, resizeBase64Image } from '../services/geminiService';

interface StoryEditorProps {
  story: Story;
  onUpdateStory: (newStory: Story) => void;
  onExit: () => void;
}

const StoryEditor: React.FC<StoryEditorProps> = ({ story, onUpdateStory, onExit }) => {
  const hasApiKey = !!process.env.API_KEY;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(story.startNodeId);
  const [editNode, setEditNode] = useState<StoryNode | null>(story.nodes[story.startNodeId] || null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(window.innerWidth > 1024);
  
  // Search states
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [inboundSearch, setInboundSearch] = useState('');
  const [choiceDestSearch, setChoiceDestSearch] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaUploadRef = useRef<HTMLInputElement>(null);

  // Close sidebar on mobile when a node is selected
  const handleSelectNode = (id: string) => {
    setSelectedNodeId(id);
    setEditNode({ ...story.nodes[id] });
    setInboundSearch('');
    setChoiceDestSearch({});
    if (window.innerWidth < 1024) {
      setIsSidebarVisible(false);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredNodes = useMemo(() => {
    const allNodes = Object.values(story.nodes) as StoryNode[];
    if (!sidebarSearch.trim()) return allNodes;
    const term = sidebarSearch.toLowerCase();
    return allNodes.filter(node => 
      node.title.toLowerCase().includes(term) || 
      node.id.toLowerCase().includes(term) ||
      node.content.toLowerCase().includes(term)
    );
  }, [story.nodes, sidebarSearch]);

  const linkedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    (Object.values(story.nodes) as StoryNode[]).forEach(node => {
      node.choices.forEach(choice => ids.add(choice.targetNodeId));
    });
    return ids;
  }, [story.nodes]);

  const inboundLinks = useMemo(() => {
    if (!selectedNodeId) return [];
    const links = (Object.values(story.nodes) as StoryNode[]).filter(node => 
      node.choices.some(choice => choice.targetNodeId === selectedNodeId)
    );
    if (!inboundSearch.trim()) return links;
    const term = inboundSearch.toLowerCase();
    return links.filter(node => 
      node.title.toLowerCase().includes(term) || 
      node.id.toLowerCase().includes(term)
    );
  }, [story.nodes, selectedNodeId, inboundSearch]);

  const handleSaveNode = () => {
    if (!editNode) return;
    const newStory = { ...story };
    newStory.nodes[editNode.id] = editNode;
    onUpdateStory(newStory);
    alert("Scene preserved in saga memory.");
  };

  const handleAddNode = () => {
    const newId = `node-${Date.now()}`;
    const newNode: StoryNode = {
      id: newId,
      title: 'New Chapter',
      content: 'A new thread begins...',
      choices: []
    };
    const newStory = { ...story };
    newStory.nodes[newId] = newNode;
    onUpdateStory(newStory);
    handleSelectNode(newId);
  };

  const handleDeleteNode = (id: string) => {
    if (id === story.startNodeId) {
      alert("The origin cannot be unmade.");
      return;
    }
    if (confirm("Permanently erase this scene from the timeline?")) {
      const newStory = { ...story };
      delete newStory.nodes[id];
      Object.keys(newStory.nodes).forEach(nodeKey => {
        newStory.nodes[nodeKey].choices = newStory.nodes[nodeKey].choices.filter(c => c.targetNodeId !== id);
      });
      onUpdateStory(newStory);
      handleSelectNode(story.startNodeId);
    }
  };

  const handleAddChoice = () => {
    if (!editNode) return;
    const newChoice: Choice = {
      id: `choice-${Date.now()}`,
      text: 'New Path',
      targetNodeId: story.startNodeId
    };
    setEditNode({
      ...editNode,
      choices: [...editNode.choices, newChoice]
    });
  };

  const handleGenerateImage = async () => {
    if (!editNode || !hasApiKey) return;
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateImageForNode(editNode.title, editNode.content, story.imageStyle);
      setEditNode({ ...editNode, imageUrl });
    } catch (err) {
      alert("The visual forge failed. Check your description.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const processFile = (file: File) => {
    if (!file || !editNode) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert("Format not supported. Use an image or video file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      if (isImage && !file.type.includes('gif')) {
        const resized = await resizeBase64Image(base64, 800);
        setEditNode({ ...editNode, imageUrl: resized });
      } else {
        setEditNode({ ...editNode, imageUrl: base64 });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const storyToExport = JSON.parse(JSON.stringify(story)) as Story;
      const dataStr = JSON.stringify(storyToExport, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `${story.name.replace(/\s+/g, '_')}_Saga.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (err) {
      alert("Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importedStory = JSON.parse(content) as Story;
        
        if (!importedStory.nodes || !importedStory.startNodeId || !importedStory.name) {
          throw new Error("Invalid Saga format.");
        }

        onUpdateStory(importedStory);
        handleSelectNode(importedStory.startNodeId);
        alert("Saga integrated successfully.");
      } catch (err) {
        console.error(err);
        alert("Failed to integrate imported Saga. Ensure the file is a valid JSON story.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; 
  };

  const isVideoUrl = (url?: string) => url?.startsWith('data:video/') || url?.endsWith('.mp4') || url?.endsWith('.webm');

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
        accept=".json" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={mediaUploadRef} 
        onChange={handleMediaUpload} 
        accept="image/*,video/*" 
        className="hidden" 
      />
      
      {/* Sidebar: Node List */}
      <div className={`
        ${isSidebarVisible ? 'translate-x-0 w-full sm:w-80' : '-translate-x-full w-0 sm:w-0 overflow-hidden'} 
        transition-all duration-300 ease-in-out
        bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 
        absolute lg:relative z-40 h-full
      `}>
        <div className="p-4 bg-slate-950/50 border-b border-slate-800">
           <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Saga Identity</label>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={handleImportClick} 
                  disabled={isImporting}
                  className="p-1.5 hover:bg-slate-800 rounded text-amber-500 transition-colors"
                  title="Import Saga JSON"
                >
                  {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={handleExport} 
                  disabled={isExporting}
                  className="p-1.5 hover:bg-slate-800 rounded text-emerald-500 transition-colors"
                  title="Export Saga JSON"
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={() => setIsSidebarVisible(false)}
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-400 lg:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
           </div>
           <input
             type="text"
             value={story.name}
             onChange={(e) => onUpdateStory({ ...story, name: e.target.value })}
             className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
             placeholder="Story Name..."
           />
        </div>

        <div className="px-4 py-3 bg-slate-950/30 border-b border-slate-800/50">
           <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search nodes..." 
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {sidebarSearch && <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>}
           </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredNodes.map((node) => {
            const isOrphan = node.id !== story.startNodeId && !linkedNodeIds.has(node.id);
            const hasMedia = !!node.imageUrl;
            const isVideo = isVideoUrl(node.imageUrl);

            return (
              <button
                key={node.id}
                onClick={() => handleSelectNode(node.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-800/30 transition group ${
                  selectedNodeId === node.id ? 'bg-slate-800 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{node.title || "Untitled"}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {hasMedia && (
                        <span title={isVideo ? "Has Video" : "Has Image"}>
                          {isVideo ? <Film className="w-3 h-3 text-indigo-400" /> : <ImageIcon className="w-3 h-3 text-indigo-400" />}
                        </span>
                      )}
                      {isOrphan && <span title="Orphan Node (No Incoming Links)"><Link2Off className="w-3 h-3 text-amber-500" /></span>}
                    </div>
                  </div>
                  {node.id === story.startNodeId && <span title="Start Node" className="flex shrink-0"><Compass className="w-3 h-3 text-emerald-500" /></span>}
                </div>
              </button>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
           <button onClick={handleAddNode} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all">
             <Plus className="w-4 h-4" /> Add Scene
           </button>
        </div>
      </div>

      {/* Sidebar Toggle (Visible only when sidebar is hidden) */}
      {!isSidebarVisible && (
        <button 
          onClick={() => setIsSidebarVisible(true)}
          className="absolute left-4 top-4 z-50 p-2.5 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-500 transition-all scale-100 hover:scale-110 active:scale-95"
          title="Open Scene Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Main Panel */}
      <div className={`flex-1 bg-slate-950 p-4 sm:p-8 overflow-y-auto transition-all ${!isSidebarVisible ? 'pl-16' : ''}`}>
        {editNode ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                 {isSidebarVisible && (
                    <button 
                      onClick={() => setIsSidebarVisible(false)}
                      className="hidden lg:flex p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                      title="Collapse Sidebar"
                    >
                      <PanelLeftClose className="w-5 h-5" />
                    </button>
                 )}
                 <h2 className="text-xl sm:text-2xl font-bold text-white">Scene Editor <span className="text-xs font-mono text-slate-500 ml-2 hidden sm:inline">ID: {editNode.id}</span></h2>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => handleDeleteNode(editNode.id)} className="flex-1 sm:flex-none px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition text-[10px] font-bold uppercase tracking-widest">Delete</button>
                <button onClick={handleSaveNode} className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg transition font-bold shadow-lg">Save Scene</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative aspect-video bg-slate-950 rounded-2xl border transition-all overflow-hidden group flex items-center justify-center ${
                    isDragging ? 'border-indigo-500 border-dashed ring-4 ring-indigo-500/20' : 'border-slate-800'
                  }`}
                >
                  {editNode.imageUrl ? (
                    isVideoUrl(editNode.imageUrl) ? (
                      <video src={editNode.imageUrl} className="w-full h-full object-contain" autoPlay loop muted playsInline />
                    ) : (
                      <img src={editNode.imageUrl} className="w-full h-full object-contain" alt="Scene Visual" />
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 italic bg-slate-900">
                      <ImageIcon className={`w-12 h-12 mb-2 opacity-10 transition-transform ${isDragging ? 'scale-110' : ''}`} />
                      {isDragging ? 'Release to Upload' : 'No visual for this chapter'}
                    </div>
                  )}
                  <div className={`absolute inset-0 bg-slate-950/80 transition-opacity flex items-center justify-center gap-4 ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {isDragging ? (
                      <Upload className="w-10 h-10 text-indigo-400 animate-bounce" />
                    ) : (
                      <>
                        {hasApiKey && (
                          <button onClick={handleGenerateImage} disabled={isGeneratingImage} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-2">
                            {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Forge
                          </button>
                        )}
                        <button onClick={() => mediaUploadRef.current?.click()} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">Upload Media</button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <input type="text" value={editNode.title} onChange={e => setEditNode({ ...editNode, title: e.target.value })} placeholder="Scene Title..." className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white font-bold" />
                  <textarea rows={8} value={editNode.content} onChange={e => setEditNode({ ...editNode, content: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white story-text text-lg" placeholder="Narrate the story..." />
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 flex justify-between">Paths Leading Here <span className="text-indigo-400">{inboundLinks.length}</span></h4>
                  <div className="relative mb-3">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
                    <input type="text" placeholder="Filter sources..." value={inboundSearch} onChange={e => setInboundSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 py-1 text-[10px] text-slate-300" />
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {inboundLinks.map(n => (
                      <button key={n.id} onClick={() => handleSelectNode(n.id)} className="w-full text-left p-2 bg-slate-950/50 rounded-lg text-[10px] text-slate-400 hover:text-white border border-transparent hover:border-indigo-500 truncate transition-all">
                        {n.title || n.id}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold uppercase text-slate-500">Choices</h4>
                    <button onClick={handleAddChoice} className="p-1 bg-indigo-600 rounded text-white hover:bg-indigo-500 transition"><Plus className="w-3 h-3" /></button>
                  </div>
                  <div className="space-y-4">
                    {editNode.choices.map((choice, idx) => (
                      <div key={choice.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 relative group">
                        <button onClick={() => setEditNode({...editNode, choices: editNode.choices.filter((_, i) => i !== idx)})} className="absolute -top-1 -right-1 p-1 bg-red-900 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                        <input type="text" value={choice.text} onChange={e => {
                          const newChoices = [...editNode.choices];
                          newChoices[idx].text = e.target.value;
                          setEditNode({ ...editNode, choices: newChoices });
                        }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" placeholder="Option text..." />
                        
                        <div className="space-y-1.5">
                          <div className="relative">
                             <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
                             <input 
                               type="text" 
                               placeholder="Filter destinations..." 
                               value={choiceDestSearch[choice.id] || ''}
                               onChange={e => setChoiceDestSearch({...choiceDestSearch, [choice.id]: e.target.value})}
                               className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 py-1 text-[10px] text-slate-400 mb-1.5"
                             />
                          </div>
                          <select value={choice.targetNodeId} onChange={e => {
                            const newChoices = [...editNode.choices];
                            newChoices[idx].targetNodeId = e.target.value;
                            setEditNode({ ...editNode, choices: newChoices });
                          }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[10px] text-slate-400">
                            {(Object.values(story.nodes) as StoryNode[])
                              .filter(n => n.title.toLowerCase().includes((choiceDestSearch[choice.id] || '').toLowerCase()) || n.id === choice.targetNodeId)
                              .map(n => <option key={n.id} value={n.id}>{n.title || "Untitled"}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-800">
            <Compass className="w-20 h-20 opacity-5 mb-4" />
            <p className="text-slate-600 font-bold tracking-widest uppercase text-xs">Select a scene to begin forging</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryEditor;
