"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, CalendarDays, Check, ChevronRight, CircleAlert, Clock3,
  ExternalLink, GraduationCap, Heart, LayoutDashboard, Mail, Menu, Search,
  Sparkles, Trash2, Users, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CourseEmails } from "@/components/course-emails";

type Instructor = { name: string; note?: string };
type Meeting = {
  date: string; startTime: string; endTime: string; venue: string;
  sessionType: "lecture" | "tutorial"; instructors?: string[];
};
type Exam = {
  kind: "exam" | "presentation" | "midterm" | "other";
  date: string | null; startTime: string | null; endTime: string | null;
  venue: string | null; raw: string;
};
type Section = {
  sectionId: string; instructors: Instructor[]; timeBucket: "AM" | "PM" | "NT";
  dayPattern: string; meetingDays: number[]; outlinePdfPath: string | null;
  meetings: Meeting[]; examOrFinal?: Exam | null;
};
type Course = {
  courseCode: string; courseTitle: string; module: number;
  courseType: "Core" | "Elective" | "Capstone"; streamTags: string[];
  outlinePdfPath: string | null; examOrFinal: Exam | null; sections: Section[];
};
type Requirements = {
  totalCourses: number; creditsPerCourse: number; coreCourses: string[];
  electiveCount: number; capstoneCourses: { courseCode: string; courseTitle: string }[];
  streams: Record<string, { name: string; description: string; listA?: CourseList; listB?: CourseList; listC?: CourseList; listD?: CourseList }>;
  notes: string[];
};
type CourseList = { name: string; minRequired: number; courses: string[] };
type Selection = { key: string; courseCode: string; module: number; sectionId: string };

const moduleDates = ["", "Sep 5 – Oct 21", "Oct 22 – Nov 30", "Dec 1 – Jan 21", "Jan 22 – Mar 10", "Mar 18 – May 4"];
const weekDays = [
  { day: 1, short: "MON", label: "Monday" },
  { day: 2, short: "TUE", label: "Tuesday" },
  { day: 3, short: "WED", label: "Wednesday" },
  { day: 4, short: "THU", label: "Thursday" },
  { day: 5, short: "FRI", label: "Friday" },
  { day: 6, short: "SAT", label: "Saturday" },
  { day: 0, short: "SUN", label: "Sunday" },
] as const;
const calendarStartMinutes = 8 * 60;
const calendarEndMinutes = 22 * 60;
const calendarHourHeight = 68;
const nav = [
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "planner", label: "My Plan", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "emails", label: "Course Emails", icon: Mail },
  { id: "requirements", label: "Requirements", icon: GraduationCap },
] as const;
type Tab = (typeof nav)[number]["id"];

declare global {
  interface Document {
    modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> };
  }
}

function selectionKey(course: Course, section: Section) {
  return course.courseCode + "|M" + course.module + "|" + section.sectionId;
}
function resolveSelection(courses: Course[], value: Selection) {
  const course = courses.find((item) => item.courseCode === value.courseCode && item.module === value.module);
  const section = course?.sections.find((item) => item.sectionId === value.sectionId);
  return course && section ? { course, section, selection: value } : null;
}
function instructorNames(section: Section) {
  return section.instructors.map((item) => item.name + (item.note ? " (" + item.note + ")" : "")).join(" / ");
}
function examFor(course: Course, section: Section) {
  return section.examOrFinal === undefined ? course.examOrFinal : section.examOrFinal;
}
function overlaps(a: Meeting, b: Meeting) {
  return a.date === b.date && a.startTime < b.endTime && b.startTime < a.endTime;
}
function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
function meetingWeekday(date: string) {
  return new Date(date + "T00:00:00Z").getUTCDay();
}
function accentFor(code: string) {
  const tones = ["blue", "cyan", "violet", "indigo", "emerald", "amber", "rose"];
  return tones[Number(code.slice(-2)) % tones.length];
}
function tagLabel(tag: string) {
  const labels: Record<string, string> = {
    "AI-A": "AI · List A", "AI-M": "AI · List B",
    "MC-AM": "MC · List C", "MC-DE": "MC · List D"
  };
  return labels[tag] || tag;
}
function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  return <span className={"pill pill-" + tone}>{children}</span>;
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("courses");
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<number | "all">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2400);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/courses.json").then((response) => response.json()),
      fetch("/requirements.json").then((response) => response.json())
    ]).then(([courseData, requirementData]) => {
      setCourses(courseData);
      setRequirements(requirementData);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("hku-ba-plan-v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.selected && typeof parsed.selected === "object") setSelected(parsed.selected);
        if (Array.isArray(parsed.wishlist)) setWishlist(parsed.wishlist);
      } catch {}
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) localStorage.setItem("hku-ba-plan-v2", JSON.stringify({ selected, wishlist }));
  }, [selected, wishlist, hydrated]);

  const catalog = useMemo(() => {
    const groups = new Map<string, Course[]>();
    courses.forEach((course) => groups.set(course.courseCode, [...(groups.get(course.courseCode) || []), course]));
    return Array.from(groups.entries()).map(([code, offerings]) => ({
      code,
      title: offerings[0].courseTitle,
      type: offerings[0].courseType,
      tags: Array.from(new Set(offerings.flatMap((item) => item.streamTags))),
      offerings: offerings.sort((a, b) => a.module - b.module)
    }));
  }, [courses]);

  const selectedItems = useMemo(
    () => Object.values(selected).map((item) => resolveSelection(courses, item)).filter(Boolean) as { course: Course; section: Section; selection: Selection }[],
    [courses, selected]
  );

  const conflicts = useMemo(() => {
    const result = new Set<string>();
    selectedItems.forEach((left, index) => {
      selectedItems.slice(index + 1).forEach((right) => {
        const leftMeetings = left.section.meetings.filter((item) => item.sessionType === "lecture");
        const rightMeetings = right.section.meetings.filter((item) => item.sessionType === "lecture");
        if (leftMeetings.some((a) => rightMeetings.some((b) => overlaps(a, b)))) {
          result.add(left.selection.key);
          result.add(right.selection.key);
        }
      });
    });
    return result;
  }, [selectedItems]);

  const filtered = catalog.filter((group) => {
    const text = [
      group.code, group.title,
      ...group.offerings.flatMap((course) => course.sections.flatMap((section) => section.instructors.map((item) => item.name)))
    ].join(" ").toLowerCase();
    return text.includes(query.toLowerCase())
      && (moduleFilter === "all" || group.offerings.some((item) => item.module === moduleFilter))
      && (typeFilter === "all" || group.type === typeFilter);
  });

  const chooseSection = (course: Course, section: Section) => {
    const key = selectionKey(course, section);
    if (selected[course.courseCode]?.key === key) {
      setSelected((current) => {
        const next = { ...current };
        delete next[course.courseCode];
        return next;
      });
      showNotice(course.courseCode + " Class " + section.sectionId + " removed");
      return;
    }
    setSelected((current) => ({
      ...current,
      [course.courseCode]: { key, courseCode: course.courseCode, module: course.module, sectionId: section.sectionId }
    }));
    setWishlist((current) => current.filter((code) => code !== course.courseCode));
    showNotice(course.courseCode + " · Module " + course.module + " · Class " + section.sectionId + " selected");
  };
  const toggleWishlist = (code: string) => {
    setWishlist((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool || courses.length === 0) return;
    const lifecycle = new AbortController();
    const addCourse = (code: string, module?: number, classId?: string) => {
      const course = courses.find((item) => item.courseCode === code && (!module || item.module === module))
        || courses.find((item) => item.courseCode === code);
      const section = course?.sections.find((item) => !classId || item.sectionId === classId) || course?.sections[0];
      if (!course || !section) throw new Error("Unknown course or class");
      const key = selectionKey(course, section);
      setSelected((current) => ({
        ...current,
        [code]: { key, courseCode: code, module: course.module, sectionId: section.sectionId }
      }));
      return { added: code, module: course.module, classId: section.sectionId };
    };
    void Promise.resolve(context.registerTool({
      name: "add_course_to_plan",
      title: "Add course class to plan",
      description: "Choose a specific HKU MSc(BA) course class. Module and classId are optional.",
      inputSchema: {
        type: "object",
        properties: { code: { type: "string" }, module: { type: "number" }, classId: { type: "string" } },
        required: ["code"], additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input: unknown) => {
        const value = input as { code: string; module?: number; classId?: string };
        return addCourse(value.code, value.module, value.classId);
      }
    }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({
      name: "read_course_plan",
      title: "Read course plan",
      description: "Return selected courses, modules and classes.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({ selected: Object.values(selected) })
    }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({
      name: "read_course_emails",
      title: "Read Moodle course emails",
      description: "Read Moodle messages forwarded into the private course inbox. Returns subjects, content, dates and detected course codes.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => {
        const accessKey = localStorage.getItem("hku-course-email-access-v1");
        if (!accessKey) return { connected: false, error: "Course email inbox is locked. Open Course Emails and enter the private access key." };
        const response = await fetch("/api/course-emails/messages", {
          cache: "no-store",
          headers: { authorization: `Bearer ${accessKey}` },
        });
        const result = await response.json();
        if (!response.ok) return { connected: false, ...result };
        return { connected: true, ...result };
      }
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [courses, selected]);

  const coreCount = selectedItems.filter((item) => item.course.courseType === "Core").length;
  const electiveCount = selectedItems.filter((item) => item.course.courseType === "Elective").length;
  const capstoneCount = selectedItems.filter((item) => item.course.courseType === "Capstone").length;
  const completion = Math.min(100, Math.round((selectedItems.length / (requirements?.totalCourses || 10)) * 100));
  const activeOfferings = activeCode ? catalog.find((item) => item.code === activeCode)?.offerings || [] : [];

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setTab("courses")} aria-label="Go to courses">
        <span className="brand-mark"><GraduationCap size={22} /></span>
        <span><strong>HKU</strong> MSc(BA) Planner</span>
      </button>
      <nav className="desktop-nav" aria-label="Main navigation">
        {nav.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "nav-item active" : "nav-item"} onClick={() => setTab(id)}>
          <Icon size={17} />{label}{id === "planner" && selectedItems.length > 0 && <span className="nav-count">{selectedItems.length}</span>}
        </button>)}
      </nav>
      <div className="top-actions"><Pill tone="green">AY 2026–27</Pill><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu"><Menu size={21} /></button></div>
    </header>
    {mobileOpen && <nav className="mobile-nav">{nav.map(({ id, label }) => <button key={id} onClick={() => { setTab(id); setMobileOpen(false); }}>{label}</button>)}</nav>}

    <main className="page-wrap">
      {tab === "courses" && <section>
        <div className="page-heading">
          <div><p className="eyebrow">AY 2026–27 · {catalog.length || 28} COURSES · {courses.reduce((sum, item) => sum + item.sections.length, 0) || 49} CLASSES</p>
            <h1>Choose the course. Then choose the class.</h1>
            <p>Browse the complete teaching plan, compare Class A/B/C/D schedules, and inspect every lecture, venue and final assessment before adding it.</p>
          </div>
          <Button className="plan-button" onClick={() => setTab("planner")}>View my plan <span>{selectedItems.length}</span><ChevronRight size={16} /></Button>
        </div>
        <div className="notice-card"><div className="notice-icon"><Sparkles size={19} /></div><div><strong>Complete class-level timetable</strong><p>Now includes 28 course codes, 30 module offerings and 49 selectable classes.</p></div><button onClick={() => setActiveCode("MSBA7001")}>See an example</button></div>
        <div className="filter-bar">
          <label className="search-box"><Search size={18} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search course, code, or instructor" /></label>
          <div className="filter-chips"><button className={moduleFilter === "all" ? "chip active" : "chip"} onClick={() => setModuleFilter("all")}>All modules</button>{[1,2,3,4,5].map((module) => <button key={module} className={moduleFilter === module ? "chip active" : "chip"} onClick={() => setModuleFilter(module)}>M{module}</button>)}</div>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Course type"><option value="all">All types</option><option>Core</option><option>Elective</option><option>Capstone</option></select>
        </div>
        <div className="course-summary"><span>{filtered.length} courses</span><span>Teaching plan version: Sep 11, 2026</span></div>
        {loading ? <div className="panel empty"><BookOpen size={30} /><h3>Loading the complete timetable…</h3></div> :
        <div className="course-grid">{filtered.map((group) => {
          const wished = wishlist.includes(group.code);
          const current = selected[group.code];
          const sectionCount = group.offerings.reduce((sum, item) => sum + item.sections.length, 0);
          const teachers = Array.from(new Set(group.offerings.flatMap((course) => course.sections.flatMap((section) => section.instructors.map((item) => item.name)))));
          const classes = Array.from(new Set(group.offerings.flatMap((course) => course.sections.map((section) => section.sectionId))));
          return <article className={"course-card accent-" + accentFor(group.code)} key={group.code}>
            <div className="course-card-top"><div className="course-tags"><Pill tone={group.type === "Core" ? "blue" : group.type === "Capstone" ? "purple" : "slate"}>{group.type}</Pill>{group.tags.map((tag) => <Pill tone="green" key={tag}>{tagLabel(tag)}</Pill>)}</div>
              <button className={wished ? "heart active" : "heart"} onClick={() => toggleWishlist(group.code)} aria-label="Toggle wishlist"><Heart size={18} fill={wished ? "currentColor" : "none"} /></button>
            </div>
            <p className="course-code">{group.code} · {group.offerings.map((item) => "MODULE " + item.module).join(" / ")}</p>
            <h2>{group.title}</h2><p className="teacher">{teachers.slice(0, 2).join(" / ")}{teachers.length > 2 ? " +" + (teachers.length - 2) : ""}</p>
            <div className="schedule-box"><span><Users size={16} />{sectionCount} {sectionCount === 1 ? "class" : "classes"}</span><span><CalendarDays size={16} />{classes.map((item) => "Class " + item).join(", ")}</span></div>
            <div className="course-meta"><span>{group.offerings.map((item) => "M" + item.module).join(", ")}</span><span>{moduleDates[group.offerings[0].module]}</span>{current && <span className="selected-class">Selected: M{current.module} Class {current.sectionId}</span>}</div>
            <Button variant={current ? "outline" : "default"} className={current ? "course-action selected" : "course-action"} onClick={() => setActiveCode(group.code)}>
              {current ? <><Check size={16} /> Change class</> : "View classes & choose"}
            </Button>
          </article>;
        })}</div>}
      </section>}

      {tab === "planner" && <PlannerView selectedItems={selectedItems} conflicts={conflicts} requirements={requirements} onBrowse={() => setTab("courses")} onRemove={(code) => {
        setSelected((current) => { const next = { ...current }; delete next[code]; return next; });
      }} onOpen={setActiveCode} completion={completion} coreCount={coreCount} electiveCount={electiveCount} capstoneCount={capstoneCount} wishlist={wishlist} catalog={catalog} />}

      {tab === "calendar" && <CalendarView selectedItems={selectedItems} onBrowse={() => setTab("courses")} onOpen={setActiveCode} />}
      {tab === "emails" && <CourseEmails />}
      {tab === "requirements" && <RequirementsView selectedItems={selectedItems} courses={courses} requirements={requirements} />}
    </main>

    <footer><span>Built for HKU MSc(BA) students</span><span>Unofficial planner · Verify selections with official HKU communications</span></footer>
    {activeCode && <CourseDetailModal offerings={activeOfferings} selected={selected} onChoose={chooseSection} onClose={() => setActiveCode(null)} />}
    {notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice(null)}><X size={15} /></button></div>}
  </div>;
}

function CourseDetailModal({ offerings, selected, onChoose, onClose }: {
  offerings: Course[]; selected: Record<string, Selection>;
  onChoose: (course: Course, section: Section) => void; onClose: () => void;
}) {
  if (offerings.length === 0) return null;
  const first = offerings[0];
  const current = selected[first.courseCode];
  return <div className="detail-overlay" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="detail-sheet">
      <div className="detail-top">
        <div><p className="eyebrow">COURSE DETAILS</p><h2>{first.courseCode} {first.courseTitle}</h2><div className="course-tags"><Pill tone={first.courseType === "Core" ? "blue" : first.courseType === "Capstone" ? "purple" : "slate"}>{first.courseType}</Pill>{first.streamTags.map((tag) => <Pill tone="green" key={tag}>{tagLabel(tag)}</Pill>)}</div></div>
        <button className="detail-close" onClick={onClose} aria-label="Close course details"><X size={21} /></button>
      </div>
      <div className="detail-body">
        {offerings.map((course) => <section className="offering" key={course.courseCode + course.module}>
          <div className="offering-head"><div><strong>Module {course.module}</strong><span>{moduleDates[course.module]}</span></div><span>{course.sections.length} {course.sections.length === 1 ? "class" : "classes"}</span></div>
          <div className="section-list">{course.sections.map((section) => {
            const key = selectionKey(course, section);
            const chosen = current?.key === key;
            const lectures = section.meetings.filter((item) => item.sessionType === "lecture");
            const tutorials = section.meetings.filter((item) => item.sessionType === "tutorial");
            const exam = examFor(course, section);
            const outline = section.outlinePdfPath || course.outlinePdfPath;
            return <article className={chosen ? "section-card chosen" : "section-card"} key={key}>
              <div className="section-summary">
                <span className="class-badge">Class {section.sectionId}</span><Pill tone={section.timeBucket === "AM" ? "blue" : section.timeBucket === "PM" ? "purple" : "slate"}>{section.timeBucket}</Pill>
                <div className="section-main"><strong>{section.dayPattern}</strong><span>{instructorNames(section)}</span></div>
                <Button variant={chosen ? "outline" : "default"} onClick={() => onChoose(course, section)}>{chosen ? <><Check size={15} /> Selected</> : "Choose this class"}</Button>
              </div>
              <div className="section-facts">
                <span><CalendarDays size={15} />{lectures.length} lectures{tutorials.length ? " + " + tutorials.length + " tutorials" : ""}</span>
                <span><Clock3 size={15} />{lectures[0] ? lectures[0].startTime + "–" + lectures[0].endTime : section.dayPattern}</span>
                <span><Users size={15} />{lectures[0]?.venue || "Venue TBA"}</span>
              </div>
              <details className="sessions">
                <summary>View all dates, venues and assessment <ChevronRight size={15} /></summary>
                <div className="session-table-wrap"><table className="session-table"><thead><tr><th>Date</th><th>Time</th><th>Venue</th><th>Type</th><th>Instructor</th></tr></thead><tbody>
                  {section.meetings.map((meeting, index) => <tr key={meeting.date + meeting.startTime + index}><td>{meeting.date}</td><td>{meeting.startTime}–{meeting.endTime}</td><td>{meeting.venue}</td><td><span className={"session-type " + meeting.sessionType}>{meeting.sessionType === "lecture" ? "LEC" : "TUT"}</span></td><td>{meeting.instructors?.join(" / ") || instructorNames(section)}</td></tr>)}
                  {exam && <tr className="exam-row"><td>{exam.date || "TBA"}</td><td>{exam.startTime && exam.endTime ? exam.startTime + "–" + exam.endTime : "TBA"}</td><td>{exam.venue || "TBA"}</td><td><span className="session-type exam">{exam.kind.toUpperCase()}</span></td><td>—</td></tr>}
                </tbody></table></div>
                {outline && <a className="outline-link" href={"https://gingerbreap.github.io/HKUBS_BA_CourseList/" + outline} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open course outline</a>}
              </details>
            </article>;
          })}</div>
        </section>)}
      </div>
    </div>
  </div>;
}

function PlannerView({ selectedItems, conflicts, requirements, onBrowse, onRemove, onOpen, completion, coreCount, electiveCount, capstoneCount, wishlist, catalog }: {
  selectedItems: { course: Course; section: Section; selection: Selection }[];
  conflicts: Set<string>; requirements: Requirements | null; onBrowse: () => void;
  onRemove: (code: string) => void; onOpen: (code: string) => void; completion: number;
  coreCount: number; electiveCount: number; capstoneCount: number; wishlist: string[];
  catalog: { code: string; title: string; type: string; tags: string[]; offerings: Course[] }[];
}) {
  const total = requirements?.totalCourses || 10;
  return <section>
    <div className="page-heading compact"><div><p className="eyebrow">PERSONAL WORKSPACE</p><h1>My course plan</h1><p>Each selection records the exact module and Class A/B/C/D. Choosing another class replaces the previous one for that course.</p></div><Button onClick={onBrowse}>Browse courses</Button></div>
    <div className="stat-grid">{[
      { label: "Selected", value: selectedItems.length, target: total },
      { label: "Core", value: coreCount, target: 4 },
      { label: "Electives", value: electiveCount, target: requirements?.electiveCount || 5 },
      { label: "Capstone", value: capstoneCount, target: 1 }
    ].map((item) => <div className="stat-card" key={item.label}><span>{item.label}</span><strong>{item.value}<small>/{item.target}</small></strong><Progress value={Math.min(100, item.value / item.target * 100)} /></div>)}</div>
    <div className="planner-layout"><div className="panel selected-panel"><div className="panel-head"><div><h2>Selected classes</h2><p>{selectedItems.length * (requirements?.creditsPerCourse || 6)} credits · {conflicts.size} classes affected by conflicts</p></div></div>
      {selectedItems.length === 0 ? <div className="empty"><BookOpen size={30} /><h3>No classes selected yet</h3><p>Open a course and choose a specific class.</p><Button onClick={onBrowse}>Browse & choose</Button></div> :
      [...selectedItems].sort((a, b) => a.course.module - b.course.module).map(({ course, section, selection }) => <div className="plan-row" key={selection.key}>
        <span className={"course-dot bg-" + accentFor(course.courseCode)} />
        <div className="plan-info" onClick={() => onOpen(course.courseCode)} role="button"><strong>{course.courseCode}</strong><span>{course.courseTitle}</span><small>Module {course.module} · Class {section.sectionId} · {section.dayPattern}</small>{conflicts.has(selection.key) && <em><CircleAlert size={13} /> Exact-date time conflict detected</em>}</div>
        <button onClick={() => onRemove(course.courseCode)} aria-label={"Remove " + course.courseCode}><Trash2 size={17} /></button>
      </div>)}
    </div>
    <aside className="panel requirement-panel"><div className="completion-ring" style={{ "--progress": completion * 3.6 + "deg" } as React.CSSProperties}><div><strong>{completion}%</strong><span>complete</span></div></div><h2>Degree progress</h2>
      <RequirementRow label={total + " courses selected"} done={selectedItems.length >= total} detail={selectedItems.length + "/" + total} />
      <RequirementRow label="4 core courses" done={coreCount >= 4} detail={coreCount + "/4"} />
      <RequirementRow label={(requirements?.electiveCount || 5) + " electives"} done={electiveCount >= (requirements?.electiveCount || 5)} detail={electiveCount + "/" + (requirements?.electiveCount || 5)} />
      <RequirementRow label="1 capstone" done={capstoneCount >= 1} detail={capstoneCount + "/1"} />
    </aside></div>
    {wishlist.length > 0 && <div className="panel wishlist"><div className="panel-head"><div><h2>Wishlist</h2><p>Open a course to compare its classes.</p></div></div><div className="wishlist-list">{wishlist.map((code) => {
      const item = catalog.find((group) => group.code === code);
      return item ? <button key={code} onClick={() => onOpen(code)}><Heart size={15} fill="currentColor" /><span><strong>{code}</strong>{item.title}</span><ChevronRight size={16} /></button> : null;
    })}</div></div>}
  </section>;
}

function RequirementRow({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return <div className="requirement-row"><span className={done ? "check done" : "check"}>{done && <Check size={13} />}</span><span>{label}</span><strong>{detail}</strong></div>;
}

function CalendarView({ selectedItems, onBrowse, onOpen }: {
  selectedItems: { course: Course; section: Section; selection: Selection }[];
  onBrowse: () => void; onOpen: (code: string) => void;
}) {
  const [activeModule, setActiveModule] = useState(() => selectedItems[0]?.course.module || 1);
  const moduleItems = selectedItems.filter((item) => item.course.module === activeModule);
  const moduleCounts = new Map<number, number>();
  selectedItems.forEach((item) => moduleCounts.set(item.course.module, (moduleCounts.get(item.course.module) || 0) + 1));

  const events = moduleItems.flatMap(({ course, section, selection }) => {
    const uniqueMeetings = new Map<string, Meeting>();
    section.meetings.forEach((meeting) => {
      const day = meetingWeekday(meeting.date);
      const key = [meeting.sessionType, day, meeting.startTime, meeting.endTime].join("|");
      if (!uniqueMeetings.has(key)) uniqueMeetings.set(key, meeting);
    });
    return Array.from(uniqueMeetings.values()).map((meeting) => ({
      id: selection.key + "|" + meeting.sessionType + "|" + meetingWeekday(meeting.date) + "|" + meeting.startTime,
      course,
      section,
      meeting,
      day: meetingWeekday(meeting.date),
      start: timeToMinutes(meeting.startTime),
      end: timeToMinutes(meeting.endTime),
    }));
  });

  const positionedEvents = events.map((event) => {
    const overlapping = events
      .filter((candidate) => candidate.day === event.day && candidate.start < event.end && event.start < candidate.end)
      .sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
    return { ...event, lane: overlapping.findIndex((candidate) => candidate.id === event.id), laneCount: overlapping.length };
  });
  const hourMarks = Array.from(
    { length: (calendarEndMinutes - calendarStartMinutes) / 60 + 1 },
    (_, index) => calendarStartMinutes / 60 + index
  );
  const calendarHeight = ((calendarEndMinutes - calendarStartMinutes) / 60) * calendarHourHeight;

  return <section>
    <div className="page-heading compact"><div><p className="eyebrow">ACADEMIC YEAR 2026–27</p><h1>Weekly calendar</h1><p>Monday to Sunday across a full teaching day. Switch modules to see where every selected class lands.</p></div></div>
    {selectedItems.length === 0 ? <div className="panel empty calendar-empty"><CalendarDays size={34} /><h3>Your calendar is empty</h3><p>Choose classes to place them on the weekly timetable.</p><Button onClick={onBrowse}>Browse courses</Button></div> : <>
      <div className="calendar-toolbar" aria-label="Choose teaching module">
        <div className="calendar-module-tabs">{[1,2,3,4,5].map((module) => <button key={module} className={activeModule === module ? "calendar-module active" : "calendar-module"} onClick={() => setActiveModule(module)}>
          <span>Module {module}</span><small>{moduleCounts.get(module) || 0} selected</small>
        </button>)}</div>
        <div className="calendar-module-period"><CalendarDays size={16} /><span>{moduleDates[activeModule]}</span></div>
      </div>

      <div className="calendar-key"><span><i className="key-dot lecture" /> Lecture</span><span><i className="key-dot tutorial" /> Tutorial</span><span>Click a card for full dates and venues</span></div>
      <div className="week-calendar-shell">
        <div className="week-calendar" style={{ "--calendar-height": calendarHeight + "px", "--hour-height": calendarHourHeight + "px" } as React.CSSProperties}>
          <div className="week-calendar-header"><div className="week-time-heading">TIME</div>{weekDays.map((item) => <div className={item.day === 0 || item.day === 6 ? "week-day-heading weekend" : "week-day-heading"} key={item.day}><span>{item.short}</span><strong>{item.label}</strong></div>)}</div>
          <div className="week-calendar-body">
            <div className="week-time-axis">{hourMarks.map((hour) => <span key={hour} style={{ top: (hour - calendarStartMinutes / 60) * calendarHourHeight }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
            {weekDays.map((weekday) => <div className={weekday.day === 0 || weekday.day === 6 ? "week-day-column weekend" : "week-day-column"} key={weekday.day}>
              {positionedEvents.filter((event) => event.day === weekday.day).map((event) => {
                const top = ((event.start - calendarStartMinutes) / 60) * calendarHourHeight;
                const height = Math.max(48, ((event.end - event.start) / 60) * calendarHourHeight);
                const width = 100 / event.laneCount;
                return <button
                  className={"week-course-card accent-" + accentFor(event.course.courseCode) + (event.meeting.sessionType === "tutorial" ? " tutorial" : "")}
                  style={{ top, height, left: "calc(" + width * event.lane + "% + 4px)", width: "calc(" + width + "% - 8px)" }}
                  key={event.id}
                  onClick={() => onOpen(event.course.courseCode)}
                  aria-label={event.course.courseCode + " Class " + event.section.sectionId + ", " + event.meeting.startTime + " to " + event.meeting.endTime}
                >
                  <span className="week-course-time">{event.meeting.startTime}–{event.meeting.endTime}</span>
                  <strong>{event.course.courseCode}</strong>
                  <span className="week-course-title">{event.course.courseTitle}</span>
                  <span className="week-course-meta">Class {event.section.sectionId} · {event.meeting.sessionType === "lecture" ? "LEC" : "TUT"}</span>
                  <span className="week-course-venue">{event.meeting.venue}</span>
                </button>;
              })}
            </div>)}
            {moduleItems.length === 0 && <div className="week-calendar-empty"><CalendarDays size={25} /><strong>No classes selected in Module {activeModule}</strong><span>Choose another module or add a course.</span></div>}
          </div>
        </div>
      </div>
      <p className="calendar-note">The grid groups recurring class times by weekday. Open a course card to verify individual teaching dates, holidays, tutorials and assessment arrangements.</p>
    </>}
  </section>;
}

function RequirementsView({ selectedItems, courses, requirements }: {
  selectedItems: { course: Course; section: Section; selection: Selection }[];
  courses: Course[]; requirements: Requirements | null;
}) {
  const selectedCodes = new Set(selectedItems.map((item) => item.course.courseCode));
  if (!requirements) return <div className="panel empty">Loading requirements…</div>;
  const lists = [
    { title: "Core courses", note: "Complete all four", codes: requirements.coreCourses },
    { title: "AI stream · List A", note: "Choose at least one for AI concentration", codes: requirements.streams.AI?.listA?.courses || [] },
    { title: "AI stream · List B", note: "Choose at least one for AI concentration", codes: requirements.streams.AI?.listB?.courses || [] },
    { title: "MC stream · List C", note: "Choose at least one for MC concentration", codes: requirements.streams.MC?.listC?.courses || [] },
    { title: "MC stream · List D", note: "Choose at least one for MC concentration", codes: requirements.streams.MC?.listD?.courses || [] },
    { title: "Capstone", note: "Choose one capstone", codes: requirements.capstoneCourses.map((item) => item.courseCode) }
  ];
  return <section><div className="page-heading compact"><div><p className="eyebrow">PROGRAMME STRUCTURE</p><h1>Graduation requirements</h1><p>Complete {requirements.totalCourses} courses × {requirements.creditsPerCourse} credits: four core, five electives and one capstone.</p></div></div>
    <div className="requirements-grid">{lists.map((group) => <article className="panel rule-card" key={group.title}><div className="panel-head"><div><h2>{group.title}</h2><p>{group.note}</p></div></div>{group.codes.map((code) => {
      const course = courses.find((item) => item.courseCode === code);
      const capstone = requirements.capstoneCourses.find((item) => item.courseCode === code);
      return <div className="rule-course" key={code}><span className={selectedCodes.has(code) ? "check done" : "check"}>{selectedCodes.has(code) && <Check size={13} />}</span><div><strong>{code}</strong><p>{course?.courseTitle || capstone?.courseTitle || "Approved programme course"}</p></div><span>{course ? "M" + course.module : "External"}</span></div>;
    })}</article>)}</div>
    <div className="disclaimer"><CircleAlert size={18} /><p><strong>Planning guidance only.</strong> Timetables and programme rules can change. Verify your final enrollment in HKU SIS and official programme communications.</p></div>
  </section>;
}
