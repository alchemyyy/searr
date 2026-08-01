import Alert from '@app/components/Common/Alert';
import Header from '@app/components/Common/Header';
import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import CustomToolbar from '@app/components/ReleaseCalendar/CustomToolbar';
import MediaItemModal from '@app/components/ReleaseCalendar/MediaItemModal';
import defineMessages from '@app/utils/defineMessages';
import type { CalendarMediaItem } from '@server/constants/calendar';
import {
  CalendarMediaFilter,
  CalendarMediaItemType,
} from '@server/constants/calendar';
import axios from 'axios';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isValid,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { useIntl } from 'react-intl';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const messages = defineMessages('components.ReleaseCalendar', {
  calendar: 'Calendar',
  movie: 'Movie',
  tvshow: 'TV Show',
  noevents: 'No events for this period.',
  loaderror: 'Failed to load calendar events.',
});

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  type: CalendarMediaItemType;
  timeLabel: string;
  data: CalendarMediaItem;
}

const parseCalendarItemDate = (item: CalendarMediaItem): Date => {
  const dateValue =
    item.type === CalendarMediaItemType.TvShow && item.airDateUtc
      ? item.airDateUtc
      : item.date;

  // parseISO treats date-only values as local dates instead of UTC timestamps
  return parseISO(dateValue);
};

const ReleaseCalendar = () => {
  const intl = useIntl();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<CalendarMediaFilter>(
    CalendarMediaFilter.All
  );
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);

  const dateRange = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const rangeStart = startOfWeek(subMonths(monthStart, 1));
    const rangeEnd = endOfWeek(addMonths(monthEnd, 1));
    return {
      start: format(rangeStart, 'yyyy-MM-dd'),
      end: format(rangeEnd, 'yyyy-MM-dd'),
    };
  }, [currentDate]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchEvents = async (): Promise<void> => {
      setLoading(true);
      setLoadFailed(false);

      try {
        const response = await axios.get<CalendarMediaItem[]>(
          `/api/v1/calendar/${filter}/${dateRange.start}/${dateRange.end}`,
          { signal: abortController.signal }
        );
        const mappedEvents: CalendarEvent[] = [];

        for (const item of response.data) {
          const eventDate = parseCalendarItemDate(item);

          if (!isValid(eventDate)) {
            continue;
          }

          const isTV = item.type === CalendarMediaItemType.TvShow;
          const displayTitle = isTV
            ? `${item.seriesTitle ?? item.title} - S${String(item.seasonNumber ?? 0).padStart(2, '0')}E${String(item.episodeNumber ?? 0).padStart(2, '0')}`
            : item.title;
          const eventID = JSON.stringify([
            item.type,
            item.tvdbId ?? item.tmdbId ?? item.title,
            item.seasonNumber,
            item.episodeNumber,
            item.date,
          ]);

          mappedEvents.push({
            id: eventID,
            title: displayTitle,
            start: eventDate,
            end: eventDate,
            allDay: true,
            type: item.type,
            timeLabel:
              isTV && item.airDateUtc
                ? intl.formatTime(eventDate, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '',
            data: item,
          });
        }

        setEvents(mappedEvents);
      } catch (error) {
        if (axios.isCancel(error) || abortController.signal.aborted) {
          return;
        }

        setEvents([]);
        setLoadFailed(true);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchEvents();

    return () => abortController.abort();
  }, [dateRange.end, dateRange.start, filter, intl]);

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalOpen(true);
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const isMovie = event.type === CalendarMediaItemType.Movie;
    return {
      style: {
        backgroundColor: isMovie
          ? 'rgba(99, 102, 241, 0.12)'
          : 'rgba(139, 92, 246, 0.12)',
        borderColor: isMovie
          ? 'rgba(99, 102, 241, 0.35)'
          : 'rgba(139, 92, 246, 0.35)',
        color: '#e2e8f0',
        borderRadius: '0.5rem',
        border: '1px solid',
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '2px 8px',
        lineHeight: '1.15rem',
        whiteSpace: 'normal' as const,
        cursor: 'pointer',
      },
    };
  };

  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const isMovie = event.type === CalendarMediaItemType.Movie;
    const { data } = event;

    if (isMovie) {
      return (
        <div className="flex items-center gap-1.5 py-0.5" title={event.title}>
          <span className="text-gray-200">{data.title}</span>
        </div>
      );
    }

    return (
      <div className="py-0.5" title={event.title}>
        <div className="text-gray-200">
          <span className="text-[0.65rem] text-white/50">
            {event.timeLabel}
          </span>{' '}
          {data.seriesTitle ?? data.title}
        </div>
        <div className="truncate text-[0.65rem] leading-tight text-gray-400">
          S{String(data.seasonNumber ?? 0).padStart(2, '0')}E
          {String(data.episodeNumber ?? 0).padStart(2, '0')}
          {data.episodeTitle && ` - ${data.episodeTitle}`}
        </div>
      </div>
    );
  };

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.calendar)} />
      <div className="mb-4 md:flex md:items-center md:justify-between">
        <Header>{intl.formatMessage(messages.calendar)}</Header>
      </div>
      {loadFailed && (
        <Alert type="error" title={intl.formatMessage(messages.loaderror)} />
      )}
      {!loading && !loadFailed && events.length === 0 && (
        <Alert type="info" title={intl.formatMessage(messages.noevents)} />
      )}
      <div
        className={`release-calendar relative rounded-lg border border-gray-700 bg-gray-800 p-4 shadow ${loading ? 'opacity-70' : ''}`}
        aria-busy={loading}
      >
        {loading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <SmallLoadingSpinner />
          </div>
        )}
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          view={currentView}
          onNavigate={setCurrentDate}
          onView={setCurrentView}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          components={{
            toolbar: (props) => (
              <CustomToolbar
                {...props}
                filter={filter}
                onFilterChange={setFilter}
              />
            ),
            event: EventComponent,
          }}
          views={['month', 'week', 'agenda']}
          messages={{
            noEventsInRange: intl.formatMessage(messages.noevents),
          }}
          popup={false}
          showAllEvents
        />
      </div>
      <MediaItemModal
        event={selectedEvent}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEvent(null);
        }}
      />
    </>
  );
};

export default ReleaseCalendar;
