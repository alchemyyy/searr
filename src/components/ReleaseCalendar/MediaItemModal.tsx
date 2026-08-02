import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import type { CalendarEvent } from '@app/components/ReleaseCalendar';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { FilmIcon, PlayIcon, TvIcon } from '@heroicons/react/24/outline';
import { CalendarMediaItemType } from '@server/constants/calendar';
import { isValid, parseISO } from 'date-fns';
import Link from 'next/link';
import { Fragment } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.ReleaseCalendar.MediaItemModal', {
  openMovie: 'Open Movie',
  openSeries: 'Open Series',
  playOnJellyfin: 'Play on Jellyfin',
  movie: 'Movie',
  tvshow: 'TV Show',
  season: 'Season {seasonNumber}',
  episode: 'Episode {episodeNumber}',
  airDate: 'Air Date',
  releaseDate: 'Release Date',
  runtime: '{minutes} min',
  close: 'Close',
  noOverview: 'No overview available.',
  available: 'Available',
  seriesFinale: 'Series Finale',
  seasonFinale: 'Season Finale',
  midseasonFinale: 'Midseason Finale',
});

interface MediaItemModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

const MediaItemModal = ({ event, isOpen, onClose }: MediaItemModalProps) => {
  const intl = useIntl();

  if (!event) return null;

  const { data } = event;
  const isMovie = data.type === CalendarMediaItemType.Movie;
  const isTV = data.type === CalendarMediaItemType.TvShow;
  const detailURL =
    data.tmdbId === undefined
      ? undefined
      : isMovie
        ? `/movie/${data.tmdbId}`
        : `/tv/${data.tmdbId}`;
  const releaseDate = data.releaseDate ? parseISO(data.releaseDate) : undefined;
  const airDate = data.airDateUtc ? parseISO(data.airDateUtc) : undefined;
  let finaleLabel: string | undefined;

  switch (data.finaleType) {
    case 'series':
      finaleLabel = intl.formatMessage(messages.seriesFinale);
      break;
    case 'season':
      finaleLabel = intl.formatMessage(messages.seasonFinale);
      break;
    case 'midseason':
      finaleLabel = intl.formatMessage(messages.midseasonFinale);
      break;
    default:
      finaleLabel = data.finaleType;
      break;
  }

  return (
    <Transition
      as={Fragment}
      show={isOpen}
      enter="transition-opacity duration-200"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-150"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Modal
        title={isMovie ? data.title : (data.seriesTitle ?? data.title)}
        subTitle={
          isTV && data.episodeTitle
            ? `S${String(data.seasonNumber ?? 0).padStart(2, '0')}E${String(data.episodeNumber ?? 0).padStart(2, '0')} - ${data.episodeTitle}`
            : undefined
        }
        onCancel={onClose}
        cancelText={intl.formatMessage(messages.close)}
        cancelButtonType="default"
      >
        <div className="space-y-4 text-gray-300">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              badgeType={isMovie ? 'primary' : 'default'}
              className={
                isMovie
                  ? 'border-indigo-500 bg-indigo-500/80'
                  : 'border-purple-500 bg-purple-500/80'
              }
            >
              {isMovie ? (
                <span className="flex items-center gap-1">
                  <FilmIcon className="h-3 w-3" />
                  {intl.formatMessage(messages.movie)}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <TvIcon className="h-3 w-3" />
                  {intl.formatMessage(messages.tvshow)}
                </span>
              )}
            </Badge>

            {data.hasFile && (
              <Badge badgeType="success">
                {intl.formatMessage(messages.available)}
              </Badge>
            )}

            {finaleLabel && <Badge badgeType="warning">{finaleLabel}</Badge>}

            {data.runtime && data.runtime > 0 && (
              <Badge badgeType="dark">
                {intl.formatMessage(messages.runtime, {
                  minutes: data.runtime,
                })}
              </Badge>
            )}
          </div>

          {isTV && data.seasonNumber != null && (
            <div className="text-sm text-gray-400">
              {intl.formatMessage(messages.season, {
                seasonNumber: data.seasonNumber,
              })}
              {' - '}
              {intl.formatMessage(messages.episode, {
                episodeNumber: data.episodeNumber,
              })}
            </div>
          )}

          <p className="text-sm leading-relaxed">
            {data.overview || intl.formatMessage(messages.noOverview)}
          </p>

          {isMovie && releaseDate && isValid(releaseDate) && (
            <div className="text-sm text-gray-400">
              <span className="font-semibold text-gray-300">
                {intl.formatMessage(messages.releaseDate)}:
              </span>{' '}
              {intl.formatDate(releaseDate, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          )}

          {isTV && airDate && isValid(airDate) && (
            <div className="text-sm text-gray-400">
              <span className="font-semibold text-gray-300">
                {intl.formatMessage(messages.airDate)}:
              </span>{' '}
              {intl.formatDate(airDate, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}{' '}
              {intl.formatTime(airDate, {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          )}

          {(data.jellyfinUrl || detailURL) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {data.hasFile && data.jellyfinUrl && (
                <Button
                  as="a"
                  href={data.jellyfinUrl}
                  target="_blank"
                  rel="noreferrer"
                  buttonType="success"
                >
                  <PlayIcon className="mr-2 h-4 w-4" />
                  {intl.formatMessage(messages.playOnJellyfin)}
                </Button>
              )}
              {detailURL && (
                <Link
                  href={detailURL}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  {isMovie ? (
                    <>
                      <FilmIcon className="h-4 w-4" />
                      {intl.formatMessage(messages.openMovie)}
                    </>
                  ) : (
                    <>
                      <TvIcon className="h-4 w-4" />
                      {intl.formatMessage(messages.openSeries)}
                    </>
                  )}
                </Link>
              )}
            </div>
          )}
        </div>
      </Modal>
    </Transition>
  );
};

export default MediaItemModal;
