export enum CalendarMediaItemType {
  TvShow = 'tv',
  Movie = 'movie',
}

export enum CalendarMediaFilter {
  All = 'all',
  TvShows = 'tv',
  Movies = 'movies',
}

export interface CalendarMediaItem {
  title: string;
  type: CalendarMediaItemType;
  date: string;
  tmdbId?: number;
  tvdbId?: number;
  overview?: string;
  releaseDate?: string;
  runtime?: number;
  hasFile?: boolean;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  airDateUtc?: string;
  finaleType?: string;
}
