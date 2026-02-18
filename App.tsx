
import React, { useState, useEffect, useRef } from 'react';
import { AppMode, Story } from './types';
import { INITIAL_STORY } from './constants';
import StoryPlayer from './components/StoryPlayer';
import StoryEditor from './components/StoryEditor';
import StoryVisualizer from './components/StoryVisualizer';
import { Play, Edit3, Network, Compass, BookOpen, User, Upload, ArrowRight, X, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { resizeBase64Image, generateInitialStory } from './services/geminiService';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('welcome');
  const [playerName, setPlayerName] = useState('');
  const [story, setStory] = useState<Story>(INITIAL_STORY);
  const [pendingImport, setPendingImport] = useState<Story | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isForging, setIsForging] = useState(false);
  const [forgeTheme, setForgeTheme] = useState('');
  const [showForgeWizard, setShowForgeWizard] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasApiKey = !!process.env.API_KEY;

  useEffect(() => {
    const saved = localStorage.getItem('adventure_forge_story');
    if (saved) {
      try {
        setStory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved story");
      }
    }
  }, []);

  const handleUpdateStory = (newStory: Story) => {
    setStory(newStory);
    try {
      localStorage.setItem('adventure_forge_story', JSON.stringify(newStory));
      setSaveError(false);
    } catch (e) {
      console.warn("Storage Limit Reached: Manual export recommended.");
      setSaveError(true);
    }
  };

  const handleForgeStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgeTheme.trim() || !hasApiKey) return;
    
    setIsForging(true);
    try {
      const newStory = await generateInitialStory(forgeTheme);
      handleUpdateStory(newStory);
      setShowForgeWizard(false);
      setMode('playing');
      if (playerName === '') setPlayerName('Adventurer');
    } catch (err) {
      alert("The mystical weave is tangled. Try a different theme.");
    } finally {
      setIsForging(false);
    }
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
        const nodeIds = Object.keys(importedStory.nodes);
        for (const id of nodeIds) {
          const node = importedStory.nodes[id];
          if (node.imageUrl && node.imageUrl.startsWith('data:image')) {
            node.imageUrl = await resizeBase64Image(node.imageUrl, 800);
          }
        }
        setPendingImport(importedStory);
      } catch (err) {
        alert("Corrupted saga file.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const finalizeImport = (chosenMode: AppMode) => {
    if (!pendingImport) return;
    handleUpdateStory(pendingImport);
    if (playerName === '') setPlayerName('Adventurer');
    setMode(chosenMode);
    setPendingImport(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />
      
      {(isImporting || isForging) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
           <div className="text-center animate-pulse">
              <Loader2 className="w-16 h-16 animate-spin text-indigo-500 mx-auto mb-4" />
              <p className="text-xl font-bold text-white uppercase tracking-widest">{isForging ? 'Forging Saga...' : 'Absorbing Data...'}</p>
           </div>
        </div>
      )}

      {showForgeWizard && hasApiKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-lg animate-in fade-in zoom-in duration-300">
          <div className="bg-slate-900 border border-slate-700 p-10 rounded-3xl shadow-2xl max-w-lg w-full relative">
            <button onClick={() => setShowForgeWizard(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            <div className="mb-8">
              <Sparkles className="w-12 h-12 text-amber-400 mb-4" />
              <h3 className="text-3xl font-extrabold text-white mb-2">Infinite Forge</h3>
              <p className="text-slate-400">Describe the seed of your world and let the AI weave the starting paths.</p>
            </div>
            <form onSubmit={handleForgeStory} className="space-y-6">
              <textarea 
                value={forgeTheme}
                onChange={(e) => setForgeTheme(e.target.value)}
                placeholder="e.g. A space station lost in a nebula, or a clockwork kingdom under siege."
                rows={4}
                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all text-lg"
                autoFocus
              />
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 text-lg">Forge Journey</button>
            </form>
          </div>
        </div>
      )}

      {pendingImport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative">
             <button onClick={() => setPendingImport(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
             <Upload className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
             <h3 className="text-xl font-bold text-white mb-2">Saga Detected</h3>
             <p className="text-slate-400 text-sm mb-8">"<span className="text-slate-200">{pendingImport.name}</span>" is ready for integration.</p>
             <div className="grid gap-3">
                <button onClick={() => finalizeImport('playing')} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all">Begin Adventure</button>
                <button onClick={() => finalizeImport('editing')} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl border border-slate-700">Open Editor</button>
             </div>
          </div>
        </div>
      )}
      
      <nav className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setMode('welcome')}>
          <div className="bg-indigo-600 p-1.5 rounded-lg"><Compass className="w-5 h-5 text-white" /></div>
          <h1 className="text-lg font-bold tracking-tighter text-white">AdventureForge</h1>
        </div>
        {mode !== 'welcome' && (
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setMode('playing')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${mode === 'playing' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-200'}`}>PLAY</button>
            <button onClick={() => setMode('editing')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${mode === 'editing' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-200'}`}>EDITOR</button>
            <button onClick={() => setMode('visualizing')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${mode === 'visualizing' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-200'}`}>GRAPH</button>
          </div>
        )}
      </nav>

      <main className="flex-1 flex flex-col">
        {saveError && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300">
             <AlertTriangle className="w-4 h-4 text-amber-500" />
             <p className="text-xs font-bold text-amber-200/80 uppercase tracking-widest">Storage limit hit. Use "Export" in the Editor to manually save your work!</p>
             <button onClick={() => setSaveError(false)} className="ml-4 text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {mode === 'welcome' && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
              <BookOpen className="w-16 h-16 text-indigo-500 mx-auto mb-8 opacity-20" />
              <h2 className="text-4xl font-extrabold mb-4 text-white">Infinite Saga</h2>
              <p className="text-slate-400 mb-10 text-lg">Your legacy begins with a name and a spark of imagination.</p>
              
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input type="text" placeholder="Adventurer Name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-900 border-2 border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 text-white transition-all" />
                </div>
                
                <div className="grid gap-3">
                  <button onClick={() => { if (playerName) setMode('playing'); else alert('Who are you?'); }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2">Enter the World <ArrowRight className="w-5 h-5" /></button>
                  {hasApiKey && (
                    <button onClick={() => setShowForgeWizard(true)} className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold py-4 rounded-2xl border border-amber-900/30 flex items-center justify-center gap-2"><Sparkles className="w-5 h-5" />Forge New World</button>
                  )}
                </div>
              </div>

              <div className="mt-12 flex justify-center gap-6">
                  <button onClick={() => fileInputRef.current?.click()} className="text-slate-600 hover:text-indigo-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"><Upload className="w-4 h-4" /> Import Saga</button>
              </div>
            </div>
          </div>
        )}

        {mode === 'playing' && <StoryPlayer story={story} playerName={playerName || 'Adventurer'} onUpdateStory={handleUpdateStory} onReset={() => setMode('welcome')} />}
        {mode === 'editing' && <StoryEditor story={story} onUpdateStory={handleUpdateStory} onExit={() => setMode('welcome')} />}
        {mode === 'visualizing' && <StoryVisualizer story={story} />}
      </main>

      <footer className="h-10 border-t border-slate-900 bg-slate-950 px-6 flex items-center justify-between text-[9px] text-slate-700 uppercase tracking-widest font-bold">
        <span>Saga: {story.name}</span>
        <div className="flex items-center gap-4">
          {saveError && <span className="text-amber-600">Manual Save Required</span>}
          <span>{hasApiKey ? 'Gemini-AI Engine 3.0' : 'Offline Mode'}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
