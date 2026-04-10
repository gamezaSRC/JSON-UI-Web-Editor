import type { UIControlProperties } from '../../../types/JsonUITypes';

export interface PreviewMockCollectionItem {
  [key: string]: unknown;
}

export interface PreviewMockData {
  globals?: Record<string, unknown>;
  controls?: Record<string, Record<string, unknown>>;
  collections?: Record<string, PreviewMockCollectionItem[]>;
}

export function createEmptyPreviewMockData(): PreviewMockData {
  return {
    globals: {},
    controls: {},
    collections: {},
  };
}

export function getAutoPreviewMockData(
  filePath: string,
  namespace: string,
  fileDefs: Map<string, UIControlProperties>
): PreviewMockData | null {
  if (isBedrockmonHud(filePath, namespace, fileDefs)) 
    return createBedrockmonHudMockData();
  return null;
}

function isBedrockmonHud(
  filePath: string,
  namespace: string,
  fileDefs: Map<string, UIControlProperties>
): boolean {
  if (namespace !== 'hud') 
    return false;
  if (!/hud_screen\.json$/i.test(filePath)) 
    return false;
  return fileDefs.has('anguwuloso');
}

function createBedrockmonHudMockData(): PreviewMockData {
  return {
    globals: {
      hud_title_text_string: 'bedrockmon_preview',
    },
    controls: {
      bimbimbambam: {
        visible: true,
        bimbimbambam: 'bedrockmon_preview',
      },
    },
    collections: {
      bimbimbambam: [
        createPartyItem('Pikachu', 36, 0.92, 0.64, true, true, '1', 'electric', 'ultra_ball'),
        createPartyItem('Lucario', 44, 0.84, 0.18, true, false, '0', 'fighting', 'great_ball'),
        createPartyItem('Gardevoir', 41, 0.67, 0.82, true, false, '1', 'psychic', 'dream_ball'),
        createPartyItem('Gengar', 39, 0.53, 0.48, true, false, '3', 'ghost', 'dusk_ball'),
        createPartyItem('Garchomp', 48, 0.31, 0.25, true, false, '0', 'dragon', 'quick_ball'),
        createPartyItem('Froslass', 37, 0, 0.91, false, false, '1', 'ice', 'premier_ball'),
      ],
    },
  };
}

function createPartyItem(
  name: string,
  level: number,
  hp: number,
  xp: number,
  visible: boolean,
  selected: boolean,
  gender: string,
  typeIcon: string,
  ball: string
): PreviewMockCollectionItem {
  return {
    name,
    level,
    hp,
    xp,
    visible,
    selected,
    gender,
    icon_path: 'textures/ui/battle/poke2',
    item_path: `textures/ui/battle/types/${typeIcon}`,
    pokeball_path: `textures/ui/balls/${ball}`,
  };
}