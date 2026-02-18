
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { StoryNode, Choice, Story } from "../types";

// Always use process.env.API_KEY directly for initialization within functions
// to ensure the latest API key is used.

export async function generateInitialStory(theme: string): Promise<Story> {
  // Initialize AI client per request as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Create a Choose Your Own Adventure story starting structure based on the theme: "${theme}".
    
    Structure Requirements:
    1. Create a non-linear graph structure with 5-6 nodes.
    2. CONVERGENT PATHS: Ensure at least one node is the destination for multiple different choices from different parent nodes.
    3. LOOPS: Optionally allow a path to lead back to a previous (non-start) node if it makes sense (e.g., getting lost in a forest).
    4. Format the output as a valid JSON object matching the Story type structure.
    5. Each node should have a compelling title and 1-2 paragraphs of content.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          startNodeId: { type: Type.STRING },
          nodes: {
            type: Type.OBJECT,
            additionalProperties: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                choices: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      text: { type: Type.STRING },
                      targetNodeId: { type: Type.STRING }
                    },
                    required: ["id", "text", "targetNodeId"]
                  }
                }
              },
              required: ["id", "title", "content", "choices"]
            }
          }
        },
        required: ["name", "startNodeId", "nodes"]
      }
    }
  });

  try {
    const story = JSON.parse(response.text || '{}') as Story;
    story.id = `story-${Date.now()}`;
    story.imageStyle = 'Epic Fantasy digital art';
    return story;
  } catch (e) {
    console.error("Failed to parse AI story seed", e);
    throw new Error("The muses are silent. Try another theme.");
  }
}

export async function generateNextSteps(
  playerName: string,
  history: { id: string; title: string; content: string }[],
  currentNode: StoryNode,
  allNodes: Record<string, StoryNode>
): Promise<{ nodeContent: string; choices: { text: string; nodeDescription: string; targetExistingNodeId?: string }[] }> {
  // Initialize AI client per request as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const historyText = history.map(h => `Node [ID: ${h.id}]: ${h.title}\nContent: ${h.content}`).join('\n\n');
  const existingNodeSummary = Object.values(allNodes)
    .map(n => `- [ID: ${n.id}] ${n.title}`)
    .join('\n');

  const prompt = `
    You are a Dungeon Master. The player ${playerName} is at a dead end.
    
    Full History:
    ${historyText}
    
    Existing Nodes in Story:
    ${existingNodeSummary}
    
    Task:
    1. Write the continuation content for the current scene.
    2. Provide 2-3 choices. 
    3. CONVERGENCE: For each choice, you can either:
       - Describe a NEW node (provide 'nodeDescription').
       - Link back to an EXISTING node from the list above if it narratively loops back (provide 'targetExistingNodeId').
    
    Return JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nodeContent: { type: Type.STRING },
          choices: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                nodeDescription: { type: Type.STRING, description: "Only if creating a new node." },
                targetExistingNodeId: { type: Type.STRING, description: "ID of an existing node to link to." }
              },
              required: ["text"]
            }
          }
        },
        required: ["nodeContent", "choices"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    throw new Error("Story weaver failed to find a thread.");
  }
}

export async function generateImageForNode(title: string, content: string, style: string = 'Fantasy digital art style'): Promise<string> {
  // Initialize AI client per request as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Style: ${style}. Scene: ${title}. Description: ${content.substring(0, 500)}. Avoid text. High detail.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "16:9" } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return await resizeBase64Image(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, 800);
    }
  }
  throw new Error("No image data");
}

export async function generateSpeech(text: string, voiceName: string = 'Kore'): Promise<string> {
  // Initialize AI client per request as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
}

export async function resizeBase64Image(base64Str: string, maxWidth: number = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
  });
}

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  return new Uint8Array(binaryString.length).map((_, i) => binaryString.charCodeAt(i));
}

export function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, pcmData.length, true);
  return new Blob([header, pcmData], { type: 'audio/wav' });
}
