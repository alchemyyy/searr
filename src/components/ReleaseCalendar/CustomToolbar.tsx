import defineMessages from '@app/utils/defineMessages';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { CalendarMediaFilter } from '@server/constants/calendar';
import type { NavigateAction, View } from 'react-big-calendar';
import type { MessageDescriptor } from 'react-intl';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.ReleaseCalendar.CustomToolbar', {
  today: 'Today',
  month: 'Month',
  week: 'Week',
  agenda: 'Agenda',
  all: 'All',
  movies: 'Movies',
  tvshows: 'TV Shows',
  previous: 'Previous period',
  next: 'Next period',
  mediafilter: 'Media filter',
  calendarview: 'Calendar view',
});

interface ToolbarOption<T> {
  label: MessageDescriptor;
  value: T;
}

const viewOptions: ToolbarOption<View>[] = [
  { label: messages.month, value: 'month' },
  { label: messages.week, value: 'week' },
  { label: messages.agenda, value: 'agenda' },
];

const filterOptions: ToolbarOption<CalendarMediaFilter>[] = [
  { label: messages.all, value: CalendarMediaFilter.All },
  { label: messages.movies, value: CalendarMediaFilter.Movies },
  { label: messages.tvshows, value: CalendarMediaFilter.TvShows },
];

interface CustomToolbarProps {
  label: string;
  onNavigate: (action: NavigateAction) => void;
  onView: (view: View) => void;
  view: View;
  filter: CalendarMediaFilter;
  onFilterChange: (filter: CalendarMediaFilter) => void;
}

const CustomToolbar = ({
  label,
  onNavigate,
  onView,
  view,
  filter,
  onFilterChange,
}: CustomToolbarProps) => {
  const intl = useIntl();

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-md border border-gray-600">
          <button
            type="button"
            onClick={() => onNavigate('PREV')}
            aria-label={intl.formatMessage(messages.previous)}
            title={intl.formatMessage(messages.previous)}
            className="px-2 py-1.5 text-gray-300 transition hover:bg-gray-700 hover:text-white"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('TODAY')}
            className="border-x border-gray-600 px-3 py-1 text-sm font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white"
          >
            {intl.formatMessage(messages.today)}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('NEXT')}
            aria-label={intl.formatMessage(messages.next)}
            title={intl.formatMessage(messages.next)}
            className="px-2 py-1.5 text-gray-300 transition hover:bg-gray-700 hover:text-white"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
        <span className="ml-2 text-lg font-semibold text-gray-100">
          {label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex overflow-hidden rounded-md border border-gray-600"
          aria-label={intl.formatMessage(messages.mediafilter)}
          role="group"
        >
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              aria-pressed={filter === option.value}
              className={`px-3 py-1 text-xs font-medium transition ${
                filter === option.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {intl.formatMessage(option.label)}
            </button>
          ))}
        </div>

        <div
          className="flex overflow-hidden rounded-md border border-gray-600"
          aria-label={intl.formatMessage(messages.calendarview)}
          role="group"
        >
          {viewOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onView(option.value)}
              aria-pressed={view === option.value}
              className={`px-3 py-1 text-xs font-medium transition ${
                view === option.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {intl.formatMessage(option.label)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustomToolbar;
