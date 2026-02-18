
import { Story } from './types';

export const INITIAL_STORY: Story = {
  id: 'default-adventure',
  name: 'The Whispering Spire',
  startNodeId: 'node-1',
  imageStyle: 'Epic Fantasy digital art',
  nodes: {
    'node-1': {
      id: 'node-1',
      title: 'The Entrance',
      content: 'You stand before the obsidian gates of the Whispering Spire. The air is cold, and the faint sound of voices echoes from within the stone.',
      choices: [
        { id: 'c1', text: 'Push the gates open', targetNodeId: 'node-2' },
        { id: 'c2', text: 'Examine the glyphs on the wall', targetNodeId: 'node-3' }
      ]
    },
    'node-2': {
      id: 'node-2',
      title: 'The Great Hall',
      content: 'The gates groan as they open. Inside, a vast hall illuminated by floating violet flames stretches out before you. A silver chalice sits on a pedestal in the center.',
      choices: [
        { id: 'c3', text: 'Approach the pedestal', targetNodeId: 'node-4' },
        { id: 'c4', text: 'Call out into the darkness', targetNodeId: 'node-5' }
      ]
    },
    'node-3': {
      id: 'node-3',
      title: 'Ancient Knowledge',
      content: 'The glyphs pulse with a soft blue light. As you trace them, visions of a fallen kingdom flood your mind. You feel a sudden surge of power, but also a lingering dread.',
      choices: []
    },
    'node-4': {
      id: 'node-4',
      title: 'The Chalice',
      content: 'As you touch the chalice, the violet flames turn red. A voice whispers in your mind: "Drink, and find your destiny."',
      choices: []
    },
    'node-5': {
      id: 'node-5',
      title: 'An Echo Returns',
      content: 'Your voice bounces off the walls. Instead of an echo, you hear a rhythmic tapping—something is descending from the vaulted ceiling.',
      choices: []
    }
  }
};
