// WebSocket event types for VTT session synchronization

export interface WsCharacterInfo {
  id: string;
  fullName: string;
  nickname: string | null;
  playerName: string | null;
  level: number;
  characterClass: string;
  race: string;
  fullImageUrl: string | null;
  avatarImageUrl: string | null;
  externalLink: string | null;
  currentHp: number;
  maxHp: number;
  ac: number;
}

export interface WsMapInfo {
  id: string;
  name: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  gridOffsetX: number;
  gridOffsetY: number;
  gridCellSize: number;
  gridRows: number;
  gridCols: number;
}

export interface WsSessionMapInfo {
  id: string;
  mapId: string;
  sortOrder: number;
  map: WsMapInfo;
}

export interface WsTokenInfo {
  id: string;
  sessionId: string;
  characterId: string;
  mapId: string;
  x: number;
  y: number;
  character: {
    id: string;
    fullName: string;
    nickname: string | null;
    avatarImageUrl: string | null;
    currentHp: number;
    maxHp: number;
    ac: number;
  };
}

export interface WsInitiativeEntryInfo {
  id: string;
  encounterId: string;
  characterId: string;
  roll: number;
  sortOrder: number;
  character: {
    id: string;
    fullName: string;
    nickname: string | null;
    avatarImageUrl: string | null;
  };
}

export interface WsEncounterInfo {
  id: string;
  name: string;
  sessionId: string;
  status: string;
  currentTurn: number;
  initiative: WsInitiativeEntryInfo[];
}

export interface WsDeviceAuthInfo {
  id: string;
  characterId: string | null;
  character: WsCharacterInfo | null;
}

export interface WsSessionState {
  id: string;
  name: string;
  shortCode: string;
  status: string;
  campaignId: string;
  campaignName: string;
  activeMapId: string | null;
  activeEncounterId: string | null;
  characters: WsCharacterInfo[];
  sessionMaps: WsSessionMapInfo[];
  tokens: WsTokenInfo[];
  encounters: WsEncounterInfo[];
  deviceAuths: WsDeviceAuthInfo[];
}

export interface WsPlayerContext {
  deviceAuthId: string;
  characterId: string | null;
  character: WsCharacterInfo | null;
}

// Server → Client events
export type WsServerEvent =
  | { type: "session:state"; data: { session: WsSessionState; playerContext?: WsPlayerContext } }
  | { type: "session:status-changed"; data: { status: string; activeEncounterId?: string | null } }
  | { type: "session:map-changed"; data: { activeMapId: string } }
  | { type: "session:token-moved"; data: { characterId: string; mapId: string; x: number; y: number } }
  | { type: "session:token-placed"; data: WsTokenInfo }
  | { type: "session:token-removed"; data: { characterId: string; mapId: string } }
  | { type: "session:encounter-started"; data: WsEncounterInfo }
  | { type: "session:encounter-ended"; data: { encounterId: string; activeEncounterId: string | null } }
  | { type: "session:initiative-updated"; data: { encounterId: string; initiative: WsInitiativeEntryInfo[] } }
  | { type: "session:turn-changed"; data: { encounterId: string; currentTurn: number } }
  | { type: "session:character-selected"; data: { deviceAuthId: string; characterId: string; character: WsCharacterInfo } }
  | { type: "session:character-deselected"; data: { deviceAuthId: string } }
  | { type: "session:player-joined"; data: { deviceAuth: WsDeviceAuthInfo } }
  | { type: "error"; data: { message: string } };
