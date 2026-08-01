import type { NextPage } from 'next';
import dynamic from 'next/dynamic';

const ReleaseCalendar = dynamic(
  () => import('@app/components/ReleaseCalendar'),
  { ssr: false }
);

const CalendarPage: NextPage = () => {
  return <ReleaseCalendar />;
};

export default CalendarPage;
