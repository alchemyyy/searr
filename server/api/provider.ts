import type {
  TmdbSeasonWithEpisodes,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import type { MetadataTagProvider } from '@server/entity/BackendSelectionRule';

export interface ProviderGenre {
  provider: MetadataTagProvider;
  id: number;
  name: string;
}

export interface TvShowDetails extends TmdbTvDetails {
  providerGenres?: ProviderGenre[];
}

export interface TvShowProvider {
  getTvShow({
    tvId,
    language,
  }: {
    tvId: number;
    language?: string;
  }): Promise<TvShowDetails>;
  getTvSeason({
    tvId,
    seasonNumber,
    language,
  }: {
    tvId: number;
    seasonNumber: number;
    language?: string;
  }): Promise<TmdbSeasonWithEpisodes>;
  getShowByTvdbId({
    tvdbId,
    language,
  }: {
    tvdbId: number;
    language?: string;
  }): Promise<TvShowDetails>;
}
