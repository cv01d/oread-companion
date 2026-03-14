// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../utils/characterConverter', () => ({
  characterFileToSettings: vi.fn((charFile) => {
    const c = charFile.character || charFile;
    return {
      name: c.name || '', age: c.age || '', gender: c.gender || '', species: c.species || '',
      role: c.role || '', avatarImage: c.avatarImage || '', knowledgeSkills: c.knowledgeSkills || '',
      hobbiesInterests: c.hobbiesInterests || '', thingsToAvoid: c.thingsToAvoid || '',
      backstory: c.backstory || '', inventory: c.inventory || '',
      traits: c.traits || { emotionalExpression: [], socialEnergy: [], thinkingStyle: [],
        humorPersonality: [], coreValues: [], howTheyCare: [], energyPresence: [], lifestyleInterests: [] }
    };
  }),
}));

// Mock UI primitives to avoid SCSS/complex dependencies
vi.mock('../components/ui/TextField', () => ({
  default: ({ value, placeholder }) => (
    <input data-testid="text-field" defaultValue={value} placeholder={placeholder} readOnly />
  ),
}));
vi.mock('../components/ui/TextArea', () => ({
  default: ({ value }) => <textarea data-testid="text-area" defaultValue={value} readOnly />,
}));
vi.mock('../components/ui/ImageUpload', () => ({
  default: () => <div data-testid="image-upload" />,
}));
vi.mock('../components/ui/MultiSelect', () => ({
  default: () => <div data-testid="multi-select" />,
}));

import CharacterEditor from '../components/settings/CharacterEditor';

describe('CharacterEditor', () => {
  const onCharacterChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders character data from inlineCharacter prop', () => {
    const char = { name: 'Echo', age: '25', gender: 'Non-binary', species: 'AI', role: 'Companion',
      avatarImage: '', knowledgeSkills: '', hobbiesInterests: '', thingsToAvoid: '', backstory: '', inventory: '',
      traits: { emotionalExpression: ['Warm'], socialEnergy: [], thinkingStyle: [], humorPersonality: [],
        coreValues: [], howTheyCare: [], energyPresence: [], lifestyleInterests: [] } };

    render(<CharacterEditor inlineCharacter={char} onCharacterChange={onCharacterChange} />);

    const nameField = screen.getAllByTestId('text-field')[0];
    expect(nameField).toHaveValue('Echo');
  });

  it('renders empty state when inlineCharacter is null', () => {
    render(<CharacterEditor inlineCharacter={null} onCharacterChange={onCharacterChange} />);

    const nameField = screen.getAllByTestId('text-field')[0];
    expect(nameField).toHaveValue('');
  });

  it('renders empty state when inlineCharacter is undefined', () => {
    render(<CharacterEditor onCharacterChange={onCharacterChange} />);

    const nameField = screen.getAllByTestId('text-field')[0];
    expect(nameField).toHaveValue('');
  });
});
