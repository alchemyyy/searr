import Badge from '@app/components/Common/Badge';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import type { DownloadingItem } from '@server/lib/downloadtracker';
import { FormattedRelativeTime, useIntl } from 'react-intl';

const messages = defineMessages('components.DownloadBlock', {
  estimatedtime: 'Estimated {time}',
  formattedTitle: '{title}: Season {seasonNumber} Episode {episodeNumber}',
});

interface DownloadBlockProps {
  downloadItem: DownloadingItem;
  is4k?: boolean;
  title?: string;
}

const getDownloadStateLabel = (downloadItem: DownloadingItem): string => {
  switch (downloadItem.trackedDownloadState) {
    case 'downloading':
      return 'Downloading';
    case 'importing':
      return 'Importing';
    case 'importPending':
      return 'Import Pending';
    case 'importBlocked':
      return 'Import Blocked';
    case 'failed':
    case 'failedPending':
      return 'Failed';
    case 'imported':
      return 'Imported';
    default:
      return downloadItem.status;
  }
};

const DownloadBlock = ({
  downloadItem,
  is4k = false,
  title,
}: DownloadBlockProps) => {
  const intl = useIntl();
  const { hasPermission } = useUser();

  const statusBadgeType =
    downloadItem.trackedDownloadStatus === 'error'
      ? 'danger'
      : downloadItem.trackedDownloadStatus === 'warning'
        ? 'warning'
        : undefined;

  const stateLabel: string = getDownloadStateLabel(downloadItem);

  const statusWarnings: string[] =
    downloadItem.statusMessages
      ?.flatMap((statusMessage) => statusMessage.messages ?? [])
      .filter(Boolean) ?? [];

  return (
    <div className="p-4">
      <div className="mb-2 w-56 truncate text-sm sm:w-80 md:w-full">
        {hasPermission(Permission.ADMIN)
          ? downloadItem.title
          : downloadItem.episode
            ? intl.formatMessage(messages.formattedTitle, {
                title,
                seasonNumber: downloadItem?.episode?.seasonNumber,
                episodeNumber: downloadItem?.episode?.episodeNumber,
              })
            : title}
      </div>
      <div className="relative mb-2 h-6 min-w-0 overflow-hidden rounded-full bg-gray-700">
        <div
          className="h-8 bg-indigo-600 transition-all duration-200 ease-in-out"
          style={{
            width: `${
              downloadItem.size
                ? Math.round(
                    ((downloadItem.size - downloadItem.sizeLeft) /
                      downloadItem.size) *
                      100
                  )
                : 0
            }%`,
          }}
        />
        <div className="absolute inset-0 flex h-6 w-full items-center justify-center text-xs">
          <span>
            {downloadItem.size
              ? Math.round(
                  ((downloadItem.size - downloadItem.sizeLeft) /
                    downloadItem.size) *
                    100
                )
              : 0}
            %
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1">
          {is4k && (
            <Badge badgeType="warning" className="mr-1">
              4K
            </Badge>
          )}
          <Badge badgeType={statusBadgeType} className="capitalize">
            {stateLabel}
          </Badge>
        </span>
        <span>
          {downloadItem.estimatedCompletionTime
            ? intl.formatMessage(messages.estimatedtime, {
                time: (
                  <FormattedRelativeTime
                    value={Math.floor(
                      (new Date(
                        downloadItem.estimatedCompletionTime
                      ).getTime() -
                        Date.now()) /
                        1000
                    )}
                    updateIntervalInSeconds={1}
                    numeric="auto"
                  />
                ),
              })
            : ''}
        </span>
      </div>
      {(downloadItem.downloadClient || downloadItem.indexer) && (
        <div className="mt-2 flex flex-wrap gap-1 text-xs text-gray-400">
          {downloadItem.downloadClient && (
            <span>{downloadItem.downloadClient}</span>
          )}
          {downloadItem.downloadClient && downloadItem.indexer && (
            <span className="text-gray-600">|</span>
          )}
          {downloadItem.indexer && <span>{downloadItem.indexer}</span>}
          {downloadItem.protocol && (
            <>
              <span className="text-gray-600">|</span>
              <span className="capitalize">{downloadItem.protocol}</span>
            </>
          )}
        </div>
      )}
      {statusWarnings.length > 0 && (
        <div className="mt-2 text-xs text-red-400">
          {statusWarnings.map((message, index) => (
            <div key={`${index}-${message}`}>{message}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DownloadBlock;
