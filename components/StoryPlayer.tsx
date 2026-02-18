
import React, { useState, useEffect, useRef } from 'react';
import { Story, StoryNode, Choice } from '../types';
import { generateNextSteps, generateImageForNode, generateSpeech, decodeBase64, pcmToWav, resizeBase64Image } from '../services/geminiService';
import { ArrowLeft, ArrowRight, Sparkles, Loader2, RefreshCcw, Image as ImageIcon, Volume2, VolumeX, Settings, Download, FileImage, Compass, Zap, Cpu, ChevronDown, X } from 'lucide-react';

interface StoryPlayerProps {
  story: Story;
  playerName: string;
  onUpdateStory: (newStory: Story) => void;
  onReset: () => void;
}

const AI_VOICES = [
  { name: 'Kore', label: 'Mystical' },
  { name: 'Puck', label: 'Ethereal' },
  { name: 'Charon', label: 'Deep' },
  { name: 'Fenrir', label: 'Gravely' },
  { name: 'Zephyr', label: 'Soft' }
];

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];

const StoryPlayer: React.FC<StoryPlayerProps> = ({ story, playerName, onUpdateStory, onReset }) => {
  const hasApiKey = !!process.env.API_KEY;

  const [currentNodeId, setCurrentNodeId] = useState(story.startNodeId);
  const [history, setHistory] = useState<string[]>([story.startNodeId]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [showFullSettings, setShowFullSettings] = useState(false);
  
  // Narration Config
  const [useAiVoice, setUseAiVoice] = useState(hasApiKey);
  const [selectedAiVoice, setSelectedAiVoice] = useState('Kore');
  const [selectedLocalVoiceURI, setSelectedLocalVoiceURI] = useState<string>('');
  const [localVoices, setLocalVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const currentNode = story.nodes[currentNodeId];

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setLocalVoices(voices);
        if (voices.length > 0 && !selectedLocalVoiceURI) {
          const defaultVoice = voices.find(v => v.default) || voices[0];
          setSelectedLocalVoiceURI(defaultVoice.voiceURI);
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [selectedLocalVoiceURI]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    return () => stopAudio();
  }, [currentNodeId]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    utteranceRef.current = null;
    setIsNarrating(false);
  };

  const handleReadAloud = async () => {
    if (isNarrating) {
      stopAudio();
      return;
    }
    stopAudio();
    if (!currentNode) return;

    const textToSpeak = currentNode.content.replace(/{name}/g, playerName);
    setIsNarrating(true);

    if (useAiVoice && hasApiKey) {
      try {
        const base64 = await generateSpeech(textToSpeak, selectedAiVoice);
        const wav = pcmToWav(decodeBase64(base64));
        const url = URL.createObjectURL(wav);
        const audio = new Audio(url);
        
        audio.defaultPlaybackRate = playbackSpeed;
        audio.playbackRate = playbackSpeed;
        
        audio.onended = () => {
          setIsNarrating(false);
          URL.revokeObjectURL(url);
        };
        
        audioRef.current = audio;
        audio.play();
      } catch (err) {
        console.error("AI Narration failed", err);
        setIsNarrating(false);
      }
    } else {
      if (!synthRef.current) {
        alert("Local text-to-speech is not supported.");
        setIsNarrating(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const voice = localVoices.find(v => v.voiceURI === selectedLocalVoiceURI);
      if (voice) utterance.voice = voice;
      utterance.rate = playbackSpeed;
      utterance.onend = () => setIsNarrating(false);
      utterance.onerror = () => setIsNarrating(false);
      utteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    }
  };

  const handleChoice = (targetId: string) => {
    stopAudio();
    setCurrentNodeId(targetId);
    setHistory(prev => [...prev, targetId]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStepBack = () => {
    if (history.length <= 1) return;
    stopAudio();
    const newHistory = [...history];
    newHistory.pop();
    setCurrentNodeId(newHistory[newHistory.length - 1]);
    setHistory(newHistory);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAiGeneration = async () => {
    if (!hasApiKey) return;
    setIsGenerating(true);
    try {
      const storyHistory = history.map(id => ({
        id,
        title: story.nodes[id].title,
        content: story.nodes[id].content
      }));

      const result = await generateNextSteps(playerName, storyHistory, currentNode, story.nodes);
      const newStory = { ...story };
      
      const newChoices: Choice[] = result.choices.map((c, idx) => {
        if (c.targetExistingNodeId && newStory.nodes[c.targetExistingNodeId]) {
          return {
            id: `ai-link-${Date.now()}-${idx}`,
            text: c.text,
            targetNodeId: c.targetExistingNodeId
          };
        }

        const newId = `ai-node-${Date.now()}-${idx}`;
        newStory.nodes[newId] = {
          id: newId,
          title: `The Path of ${c.text}`,
          content: c.nodeDescription || "The story unfolds...",
          choices: [],
          isAiGenerated: true
        };
        return {
          id: `ai-choice-${Date.now()}-${idx}`,
          text: c.text,
          targetNodeId: newId
        };
      });

      newStory.nodes[currentNodeId] = {
        ...currentNode,
        content: result.nodeContent || currentNode.content,
        choices: newChoices
      };

      onUpdateStory(newStory);
    } catch (err) {
      alert("The mystical energies failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isVideoUrl = (url?: string) => url?.startsWith('data:video/') || url?.endsWith('.mp4') || url?.endsWith('.webm');

  if (!currentNode) return null;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl">
        <div className="relative aspect-video bg-slate-950 flex items-center justify-center group border-b border-slate-700/50">
          {currentNode.imageUrl ? (
            isVideoUrl(currentNode.imageUrl) ? (
              <video src={currentNode.imageUrl} className="w-full h-full object-contain" autoPlay loop muted playsInline />
            ) : (
              <img src={currentNode.imageUrl} className="w-full h-full object-contain animate-in fade-in duration-1000" alt={currentNode.title} />
            )
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-600 bg-slate-900 w-full h-full justify-center">
              {isGeneratingImage ? <Loader2 className="w-10 h-10 animate-spin text-indigo-500" /> : <ImageIcon className="w-12 h-12 opacity-20" />}
            </div>
          )}
          {history.length > 1 && (
            <button onClick={handleStepBack} className="absolute top-4 left-4 p-2.5 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-full transition-all shadow-xl backdrop-blur">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={() => setShowFullSettings(!showFullSettings)}
            className={`absolute top-4 right-4 p-2.5 rounded-full transition-all backdrop-blur z-20 ${
              showFullSettings ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/80 text-slate-400 hover:text-white'
            }`}
            title="Narration Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 sm:p-12">
          {/* Quick Controls */}
          <div className="flex flex-wrap items-center gap-2 mb-10 p-4 bg-slate-950/50 rounded-2xl border border-slate-700/40 shadow-inner">
             <button 
               onClick={handleReadAloud} 
               className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl transition-all shadow-lg font-bold text-sm min-w-[140px] ${
                 isNarrating 
                 ? 'bg-red-600 text-white' 
                 : 'bg-indigo-600 text-white hover:bg-indigo-500'
               }`}
             >
               {isNarrating ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
               {isNarrating ? 'Stop' : 'Read Scene'}
             </button>

             <div className="h-10 w-px bg-slate-800 mx-1 hidden md:block"></div>

             <div className="relative flex flex-col gap-1 min-w-[70px]">
                <label className="text-[9px] font-bold uppercase text-slate-600 tracking-wider ml-1">Speed</label>
                <select 
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold rounded-lg px-2 py-2.5 appearance-none focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                >
                  {SPEEDS.map(s => <option key={s} value={s}>{s.toFixed(1)}x</option>)}
                </select>
             </div>

             <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                <div className="flex justify-between items-center ml-1">
                   <label className="text-[9px] font-bold uppercase text-slate-600 tracking-wider">
                      Narrator: {(useAiVoice && hasApiKey) ? 'AI' : 'Local'}
                   </label>
                   {hasApiKey && (
                    <button onClick={() => setUseAiVoice(!useAiVoice)} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase underline">Switch</button>
                   )}
                </div>
                
                {useAiVoice && hasApiKey ? (
                  <select 
                    value={selectedAiVoice}
                    onChange={(e) => setSelectedAiVoice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs font-medium rounded-lg px-2 py-2.5 outline-none"
                  >
                    {AI_VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                  </select>
                ) : (
                  <select 
                    value={selectedLocalVoiceURI}
                    onChange={(e) => setSelectedLocalVoiceURI(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-[11px] font-medium rounded-lg px-2 py-2.5 outline-none truncate"
                  >
                    {localVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>) }
                    {localVoices.length === 0 && <option disabled>No browser voices found</option>}
                  </select>
                )}
             </div>
          </div>

          {/* Full Settings Panel (Missing previously) */}
          {showFullSettings && (
            <div className="mb-10 p-6 bg-slate-900 border border-slate-700 rounded-3xl animate-in slide-in-from-top-2 duration-300 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3"><Settings className="w-12 h-12 text-slate-800/30" /></div>
              <div className="relative space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-white">Advanced Narration</h4>
                  <button onClick={() => setShowFullSettings(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
                
                <div className="space-y-3">
                   <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-widest">Playback Velocity</label>
                   <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0.5" 
                        max="3.0" 
                        step="0.1" 
                        value={playbackSpeed} 
                        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                        className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="w-12 text-center text-sm font-black text-indigo-400">{playbackSpeed.toFixed(1)}x</span>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <button 
                     onClick={() => setUseAiVoice(true)}
                     disabled={!hasApiKey}
                     className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${useAiVoice && hasApiKey ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-800/50 border-slate-800 text-slate-600'}`}
                   >
                      <Cpu className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Gemini AI</span>
                   </button>
                   <button 
                     onClick={() => setUseAiVoice(false)}
                     className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${!useAiVoice ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' : 'bg-slate-800/50 border-slate-800 text-slate-600'}`}
                   >
                      <Zap className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Local Voice</span>
                   </button>
                </div>

                {!hasApiKey && <p className="text-[10px] text-amber-500/80 font-medium italic text-center">AI Voices are disabled (No API Key found).</p>}
              </div>
            </div>
          )}

          <div className="mb-12">
             <h2 className="text-3xl font-bold text-white tracking-tight mb-6">{currentNode.title}</h2>
             <p className="story-text text-xl leading-relaxed text-slate-200 whitespace-pre-wrap">
               {currentNode.content.replace(/{name}/g, playerName)}
             </p>
          </div>

          <div className="space-y-4">
            {currentNode.choices.length > 0 ? (
              currentNode.choices.map((choice) => (
                <button 
                  key={choice.id} 
                  onClick={() => handleChoice(choice.targetNodeId)} 
                  className="w-full group flex items-center justify-between p-6 bg-slate-700/20 hover:bg-indigo-600/10 border border-slate-700 hover:border-indigo-500 rounded-2xl transition-all shadow-sm"
                >
                  <span className="text-lg font-semibold text-slate-200 group-hover:text-white">{choice.text}</span>
                  <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </button>
              ))
            ) : (
              hasApiKey ? (
                <div className="text-center pt-8">
                  <button onClick={handleAiGeneration} disabled={isGenerating} className="inline-flex items-center gap-3 px-12 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-105 rounded-2xl font-bold shadow-2xl transition-all text-lg">
                    {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    {isGenerating ? 'Forging Path...' : 'Explore Further'}
                  </button>
                </div>
              ) : (
                <div className="text-center pt-8 p-6 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                  <p className="text-slate-500 text-sm">The saga ends here. No further paths have been woven.</p>
                </div>
              )
            )}
          </div>

          <div className="mt-20 flex justify-center gap-10 text-[10px] font-bold uppercase tracking-widest text-slate-600">
             <button onClick={() => confirm("Restart?") && setCurrentNodeId(story.startNodeId)} className="hover:text-indigo-400 flex items-center gap-2 transition-colors"><RefreshCcw className="w-3.5 h-3.5" /> Restart</button>
             <button onClick={onReset} className="hover:text-indigo-400 flex items-center gap-2 transition-colors"><Compass className="w-3.5 h-3.5" /> Portal</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryPlayer;
