
export interface Choice {
  id: string;
  text: string;
  targetNodeId: string;
}

export interface StoryNode {
  id: string;
  title: string;
  content: string;
  choices: Choice[];
  isAiGenerated?: boolean;
  imageUrl?: string;
}

export interface Story {
  id: string;
  name: string;
  nodes: Record<string, StoryNode>;
  startNodeId: string;
  imageStyle?: string;
}

export type AppMode = 'welcome' | 'playing' | 'editing' | 'visualizing';
