import type { JellyfinLibraryItem } from '@server/api/jellyfin';

export function normalizeJellyfinGuid(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, '').toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function buildJellyfinMediaURL(
  hostname: string,
  mediaID: string,
  serverID?: string
): string {
  const normalizedHostname = hostname.replace(/\/+$/, '');
  const queryParameters = new URLSearchParams({ id: mediaID });

  if (serverID) {
    queryParameters.set('serverId', serverID);
  }

  return `${normalizedHostname}/web/#/details?${queryParameters.toString()}`;
}

export function findJellyfinEpisode(
  episodes: JellyfinLibraryItem[],
  seasonNumber: number,
  episodeNumber: number
): JellyfinLibraryItem | undefined {
  return episodes.find((episode) => {
    if (
      episode.ParentIndexNumber !== seasonNumber ||
      episode.IndexNumber === undefined
    ) {
      return false;
    }

    const episodeEndNumber = episode.IndexNumberEnd ?? episode.IndexNumber;
    return (
      episode.IndexNumber <= episodeNumber && episodeEndNumber >= episodeNumber
    );
  });
}
