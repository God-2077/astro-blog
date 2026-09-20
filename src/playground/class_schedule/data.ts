export type Weekday = '星期一' | '星期二' | '星期三' | '星期四' | '星期五' | '星期六' | '星期日';

export const WEEKDAYS: Weekday[] = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

export const CAMPUSES = ['海源校区', '杨林校区'] as const;
export type Campus = (typeof CAMPUSES)[number];

export interface TeachingEntry {
  period: string;
  session: string | null;
  time: string;
  campus: string | null;
}

export interface Course {
  courseName: string;
  courseTitle: string;
  teacher: string;
  className: string;
  weeks: string;
  periods: string;
  weeksAndPeriods: string;
  location: string;
  raw: string;
}

export interface CourseEntry extends Course {
  section: string;
  day: Weekday;
}

export type Timetable = Record<string, Partial<Record<Weekday, Course[]>>>;

export interface CourseTable {
  xnxq: string;
  zc: string;
  days: Weekday[];
  courses: CourseEntry[];
  timetable: Timetable;
  remark: string;
}

export const TEACHING_SCHEDULE: TeachingEntry[] = [
  { period: '上午', session: '第1-2节', time: '08:30-09:50', campus: null },
  { period: '上午', session: '课间休息', time: '09:50-10:05', campus: null },
  { period: '上午', session: '第3-4节', time: '10:05-11:25', campus: null },
  { period: '中午', session: '休息', time: '11:25-12:00', campus: null },
  { period: '中午', session: '中午上课', time: '12:00-13:20', campus: null },
  { period: '下午', session: '第5-6节', time: '13:30-14:50', campus: null },
  { period: '下午', session: '课间休息', time: '14:50-15:05', campus: null },
  { period: '下午', session: '第7-8节', time: '15:05-16:25', campus: null },
  { period: '运动时间', session: null, time: '16:30-17:30', campus: null },
  { period: '休息', session: null, time: '17:30-18:50', campus: '海源校区' },
  { period: '休息', session: null, time: '17:30-18:20', campus: '杨林校区' },
  { period: '晚上', session: '第9-10节', time: '19:00-20:20', campus: '海源校区' },
  { period: '晚上', session: '第9-10节', time: '18:30-19:50', campus: '杨林校区' },
  { period: '晚上', session: '课间休息', time: '20:20-20:30', campus: '海源校区' },
  { period: '晚上', session: '课间休息', time: '19:50-20:00', campus: '杨林校区' },
  { period: '晚上', session: '第11-12节', time: '20:30-21:50', campus: '海源校区' },
  { period: '晚上', session: '第11-12节', time: '20:00-21:20', campus: '杨林校区' },
];
