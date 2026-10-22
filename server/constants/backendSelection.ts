export enum BackendSelectionRuleType {
  ALLOW = 'allow',
  BLOCK = 'block',
}

export enum BackendSelectionMatchType {
  ANY = 'any',
  ALL = 'all',
}

export enum MetadataTagProvider {
  TMDB = 'tmdb',
  TVDB = 'tvdb',
}

export enum MetadataTagType {
  GENRE = 'genre',
}

export interface MetadataTagReference {
  provider: MetadataTagProvider;
  type: MetadataTagType;
  id: number;
}
