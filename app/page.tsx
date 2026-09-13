"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, GraduationCap, Heart, LayoutDashboard, Menu, Search, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type Course = {
  code: string; name: string; module: number; type: "Core" | "Elective" | "Capstone";
  stream?: "AI · List A" | "AI · List B" | "MC · List C" | "MC · List D";
  teacher: string; days: string; time: string; slot: string; className: string;
  assessment: "Exam" | "Presentation" | "Project"; accent: string;
};

const courses: Course[] = [
  { code: "MSBA7001", name: "Python for Data Analytics", module: 1, type: "Core", teacher: "Prof. Chao Ding", days: "Wed & Sat", time: "09:30–12:30", slot: "wed-am", className: "Class A", assessment: "Exam", accent: "blue" },
  { code: "MSBA7003", name: "Decision Analytics", module: 1, type: "Core", teacher: "Prof. Wei Zhang", days: "Tue & Fri", time: "14:00–17:00", slot: "tue-pm", className: "Class B", assessment: "Exam", accent: "cyan" },
  { code: "MSBA7002", name: "Business Statistics", module: 2, type: "Core", teacher: "Prof. Zhanrui Cai", days: "Mon & Thu", time: "09:30–12:30", slot: "mon-am", className: "Class A", assessment: "Exam", accent: "violet" },
  { code: "MSBA7004", name: "Operations Analytics", module: 2, type: "Core", teacher: "Prof. Huiyin Ouyang", days: "Wed & Sat", time: "14:00–17:00", slot: "wed-pm", className: "Class C", assessment: "Exam", accent: "indigo" },
  { code: "MSBA7013", name: "Forecasting and Predictive Analytics", module: 3, type: "Elective", stream: "AI · List A", teacher: "Prof. Xinghao Qiao", days: "Mon & Thu", time: "09:30–12:30", slot: "mon-am", className: "Class A", assessment: "Project", accent: "emerald" },
  { code: "MSBA7014", name: "Business Simulation", module: 3, type: "Elective", stream: "MC · List C", teacher: "Prof. S. Panchanatham", days: "Wed & Sat", time: "18:30–21:30", slot: "wed-night", className: "Class A", assessment: "Presentation", accent: "amber" },
  { code: "MSBA7024", name: "Database Design and Management", module: 3, type: "Elective", stream: "MC · List C", teacher: "Prof. Michael Chau", days: "Tue & Fri", time: "14:00–17:00", slot: "tue-pm", className: "Class C", assessment: "Exam", accent: "rose" },
  { code: "MSBA7027", name: "Machine Learning", module: 3, type: "Elective", stream: "AI · List A", teacher: "Prof. Zhengli Wang", days: "Mon & Thu", time: "18:30–21:30", slot: "mon-night", className: "Class A", assessment: "Exam", accent: "blue" },
  { code: "MSBA7033", name: "Generative Artificial Intelligence", module: 3, type: "Elective", stream: "AI · List B", teacher: "Prof. Yifan Yu", days: "Tue & Fri", time: "09:30–12:30", slot: "tue-am", className: "Class A", assessment: "Exam", accent: "violet" },
  { code: "MSBA7012", name: "Social Media & Digital Marketing Analytics", module: 4, type: "Elective", stream: "MC · List D", teacher: "Prof. Hailiang Chen", days: "Mon & Thu", time: "09:30–12:30", slot: "mon-am", className: "Class A", assessment: "Presentation", accent: "rose" },
  { code: "MSBA7025", name: "Digital Experimentation Methods", module: 4, type: "Elective", stream: "MC · List C", teacher: "Prof. Jing Ouyang", days: "Wed & Sat", time: "14:00–17:00", slot: "wed-pm", className: "Class A", assessment: "Presentation", accent: "cyan" },
  { code: "MSBA7026", name: "Big Data Analytics on the Cloud", module: 4, type: "Elective", stream: "AI · List B", teacher: "Prof. Zhepeng Li", days: "Tue & Fri", time: "14:00–17:00", slot: "tue-pm", className: "Class A", assessment: "Project", accent: "indigo" },
  { code: "MSBA7028", name: "Deep Learning", module: 4, type: "Elective", stream: "AI · List A", teacher: "Prof. Xiao Lei", days: "Tue & Fri", time: "18:30–21:30", slot: "tue-night", className: "Class A", assessment: "Presentation", accent: "emerald" },
  { code: "MSBA7029", name: "Storytelling with Data", module: 4, type: "Elective", stream: "MC · List C", teacher: "Prof. Xin Tong", days: "Mon & Thu", time: "18:30–21:30", slot: "mon-night", className: "Class A", assessment: "Presentation", accent: "amber" },
  { code: "MSBA7035", name: "Applied Large Language Models", module: 4, type: "Elective", stream: "AI · List B", teacher: "Prof. Hailiang Chen", days: "Mon & Thu", time: "14:00–17:00", slot: "mon-pm", className: "Class A", assessment: "Presentation", accent: "blue" },
  { code: "MSBA7036", name: "Ethics in Artificial Intelligence", module: 4, type: "Elective", stream: "AI · List B", teacher: "Prof. Rachel Sterken", days: "Mon & Thu", time: "14:00–17:00", slot: "mon-pm", className: "Class A", assessment: "Project", accent: "violet" },
  { code: "MSBA7005", name: "Business Analytics Capstone", module: 5, type: "Capstone", teacher: "Prof. Jack Jiang", days: "Tue & Fri", time: "09:30–12:30", slot: "tue-am", className: "Class A", assessment: "Project", accent: "cyan" },
  { code: "MSBA7016", name: "Supply Chain and Logistics Management", module: 5, type: "Elective", stream: "MC · List D", teacher: "Prof. Benjamin Yen", days: "Tue & Fri", time: "18:30–21:30", slot: "tue-night", className: "Class A", assessment: "Presentation", accent: "rose" },
];

const moduleDates = ["", "Sep 5 – Oct 21", "Oct 22 – Nov 30", "Dec 1 – Jan 21", "Jan 22 – Mar 10", "Mar 18 – May 4"];
const nav = [
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "planner", label: "My Plan", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "requirements", label: "Requirements", icon: GraduationCap },
] as const;
type Tab = (typeof nav)[number]["id"];

declare global { interface Document { modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> } } }

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("courses");
  const [selected, setSelected] = useState<string[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<number | "all">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("hku-ba-plan");
    if (saved) try { const parsed = JSON.parse(saved); setSelected(Array.isArray(parsed.selected) ? parsed.selected : []); setWishlist(Array.isArray(parsed.wishlist) ? parsed.wishlist : []); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem("hku-ba-plan", JSON.stringify({ selected, wishlist })); }, [selected, wishlist]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const add = (code: string) => { if (!courses.some((c) => c.code === code)) throw new Error("Unknown course code"); setSelected((v) => v.includes(code) ? v : [...v, code]); setWishlist((v) => v.filter((x) => x !== code)); return { added: code }; };
    void Promise.resolve(context.registerTool({ name: "add_course_to_plan", title: "Add course to plan", description: "Add one HKU MSc(BA) course to the visible study plan.", inputSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input: unknown) => add((input as { code: string }).code) }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({ name: "read_course_plan", title: "Read course plan", description: "Return the course codes currently selected in the planner.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ selected }) }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [selected]);

  const selectedCourses = useMemo(() => courses.filter((c) => selected.includes(c.code)), [selected]);
  const conflicts = useMemo(() => { const result = new Set<string>(); selectedCourses.forEach((c, i) => selectedCourses.slice(i + 1).forEach((o) => { if (c.module === o.module && c.slot === o.slot) { result.add(c.code); result.add(o.code); } })); return result; }, [selectedCourses]);
  const coreCount = selectedCourses.filter((c) => c.type === "Core").length;
  const electiveCount = selectedCourses.filter((c) => c.type === "Elective").length;
  const capstoneCount = selectedCourses.filter((c) => c.type === "Capstone").length;
  const aiA = selectedCourses.some((c) => c.stream === "AI · List A");
  const aiB = selectedCourses.some((c) => c.stream === "AI · List B");
  const completion = Math.min(100, Math.round((selected.length / 10) * 100));
  const filtered = courses.filter((c) => `${c.code} ${c.name} ${c.teacher}`.toLowerCase().includes(query.toLowerCase()) && (moduleFilter === "all" || c.module === moduleFilter) && (typeFilter === "all" || c.type === typeFilter));

  const toggleCourse = (course: Course) => {
    if (selected.includes(course.code)) { setSelected(selected.filter((x) => x !== course.code)); setNotice(`${course.code} removed from your plan`); }
    else { setSelected([...selected, course.code]); setWishlist(wishlist.filter((x) => x !== course.code)); setNotice(`${course.code} · ${course.className} added`); }
    setTimeout(() => setNotice(null), 2400);
  };
  const toggleWishlist = (code: string) => setWishlist(wishlist.includes(code) ? wishlist.filter((x) => x !== code) : [...wishlist, code]);

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setTab("courses")} aria-label="Go to courses"><span className="brand-mark"><GraduationCap size={22} /></span><span><strong>HKU</strong> MSc(BA) Planner</span></button>
      <nav className="desktop-nav" aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "nav-item active" : "nav-item"} onClick={() => setTab(id)}><Icon size={17} />{label}{id === "planner" && selected.length > 0 && <span className="nav-count">{selected.length}</span>}</button>)}</nav>
      <div className="top-actions"><Pill tone="green">AY 2026–27</Pill><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu"><Menu size={21} /></button></div>
    </header>
    {mobileOpen && <nav className="mobile-nav">{nav.map(({ id, label }) => <button key={id} onClick={() => { setTab(id); setMobileOpen(false); }}>{label}</button>)}</nav>}

    <main className="page-wrap">
      {tab === "courses" && <section>
        <div className="page-heading"><div><p className="eyebrow">AY 2026–27 · 18 COURSES</p><h1>Build a course plan that works.</h1><p>Browse every available class, spot conflicts early, and keep your graduation requirements on track.</p></div><Button className="plan-button" onClick={() => setTab("planner")}>View my plan <span>{selected.length}</span><ChevronRight size={16} /></Button></div>
        <div className="notice-card"><div className="notice-icon"><Sparkles size={19} /></div><div><strong>Teaching plan updated</strong><p>MSBA7003 Class C & D schedules were revised on Sep 11.</p></div><button>Review update</button></div>
        <div className="filter-bar"><label className="search-box"><Search size={18} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search course, code, or instructor" /></label><div className="filter-chips"><button className={moduleFilter === "all" ? "chip active" : "chip"} onClick={() => setModuleFilter("all")}>All modules</button>{[1,2,3,4,5].map((m) => <button key={m} className={moduleFilter === m ? "chip active" : "chip"} onClick={() => setModuleFilter(m)}>M{m}</button>)}</div><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Course type"><option value="all">All types</option><option>Core</option><option>Elective</option><option>Capstone</option></select></div>
        <div className="course-summary"><span>{filtered.length} classes</span><span>Updated Sep 11, 2026</span></div>
        <div className="course-grid">{filtered.map((course) => { const isSelected = selected.includes(course.code); const wished = wishlist.includes(course.code); return <article className={`course-card accent-${course.accent}`} key={course.code}>
          <div className="course-card-top"><div className="course-tags"><Pill tone={course.type === "Core" ? "blue" : course.type === "Capstone" ? "purple" : "slate"}>{course.type}</Pill>{course.stream && <Pill tone="green">{course.stream}</Pill>}</div><button className={wished ? "heart active" : "heart"} onClick={() => toggleWishlist(course.code)} aria-label={`${wished ? "Remove" : "Add"} ${course.code} wishlist`}><Heart size={18} fill={wished ? "currentColor" : "none"} /></button></div>
          <p className="course-code">{course.code} · MODULE {course.module}</p><h2>{course.name}</h2><p className="teacher">{course.teacher}</p>
          <div className="schedule-box"><span><CalendarDays size={16} />{course.days}</span><span><Clock3 size={16} />{course.time}</span></div><div className="course-meta"><span>{course.className}</span><span>{course.assessment}</span><span>{moduleDates[course.module]}</span></div>
          <Button variant={isSelected ? "outline" : "default"} className={isSelected ? "course-action selected" : "course-action"} onClick={() => toggleCourse(course)}>{isSelected ? <><Check size={16} /> Added to plan</> : "Add to plan"}</Button>
        </article>; })}</div>
      </section>}

      {tab === "planner" && <section>
        <div className="page-heading compact"><div><p className="eyebrow">PERSONAL WORKSPACE</p><h1>My course plan</h1><p>Your selections are saved automatically on this device.</p></div><Button onClick={() => setTab("courses")}>Browse courses</Button></div>
        <div className="stat-grid">{[{ label: "Selected", value: selected.length, target: 10 }, { label: "Core", value: coreCount, target: 4 }, { label: "Electives", value: electiveCount, target: 5 }, { label: "Capstone", value: capstoneCount, target: 1 }].map((item) => <div className="stat-card" key={item.label}><span>{item.label}</span><strong>{item.value}<small>/{item.target}</small></strong><Progress value={Math.min(100, item.value / item.target * 100)} /></div>)}</div>
        <div className="planner-layout"><div className="panel selected-panel"><div className="panel-head"><div><h2>Selected courses</h2><p>{selected.length * 6} credits · {conflicts.size} conflicts</p></div></div>
          {selectedCourses.length === 0 ? <div className="empty"><BookOpen size={30} /><h3>No courses selected yet</h3><p>Browse the catalogue and add your first class.</p><Button onClick={() => setTab("courses")}>Browse & add</Button></div> : selectedCourses.map((course) => <div className="plan-row" key={course.code}><span className={`course-dot bg-${course.accent}`} /><div className="plan-info"><strong>{course.code}</strong><span>{course.name}</span><small>{course.days} · {course.time} · Module {course.module}</small>{conflicts.has(course.code) && <em><CircleAlert size={13} /> Time conflict in Module {course.module}</em>}</div><button onClick={() => toggleCourse(course)} aria-label={`Remove ${course.code}`}><Trash2 size={17} /></button></div>)}
        </div><aside className="panel requirement-panel"><div className="completion-ring" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}><div><strong>{completion}%</strong><span>complete</span></div></div><h2>Degree progress</h2><RequirementRow label="10 courses selected" done={selected.length >= 10} detail={`${selected.length}/10`} /><RequirementRow label="4 core courses" done={coreCount >= 4} detail={`${coreCount}/4`} /><RequirementRow label="5 electives" done={electiveCount >= 5} detail={`${electiveCount}/5`} /><RequirementRow label="1 capstone" done={capstoneCount >= 1} detail={`${capstoneCount}/1`} /><div className="stream-box"><strong>AI stream</strong><span className={aiA ? "done" : ""}>{aiA ? "✓" : "○"} List A</span><span className={aiB ? "done" : ""}>{aiB ? "✓" : "○"} List B</span></div></aside></div>
        {wishlist.length > 0 && <div className="panel wishlist"><div className="panel-head"><div><h2>Wishlist</h2><p>Courses you are still considering.</p></div></div><div className="wishlist-list">{wishlist.map((code) => { const course = courses.find((c) => c.code === code)!; return <button key={code} onClick={() => toggleCourse(course)}><Heart size={15} fill="currentColor" /><span><strong>{code}</strong>{course.name}</span><ChevronRight size={16} /></button>; })}</div></div>}
      </section>}
      {tab === "calendar" && <CalendarView selectedCourses={selectedCourses} onBrowse={() => setTab("courses")} />}
      {tab === "requirements" && <RequirementsView selectedCourses={selectedCourses} />}
    </main>
    <footer><span>Built for HKU MSc(BA) students</span><span>Unofficial planner · Always verify with HKU</span></footer>
    {notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice(null)}><X size={15} /></button></div>}
  </div>;
}

function RequirementRow({ label, done, detail }: { label: string; done: boolean; detail: string }) { return <div className="requirement-row"><span className={done ? "check done" : "check"}>{done && <Check size={13} />}</span><span>{label}</span><strong>{detail}</strong></div>; }

function CalendarView({ selectedCourses, onBrowse }: { selectedCourses: Course[]; onBrowse: () => void }) {
  return <section><div className="page-heading compact"><div><p className="eyebrow">ACADEMIC YEAR 2026–27</p><h1>Course calendar</h1><p>A clear view of your selected classes across five teaching modules.</p></div></div>{selectedCourses.length === 0 ? <div className="panel empty calendar-empty"><CalendarDays size={34} /><h3>Your calendar is empty</h3><p>Add courses to see your teaching schedule.</p><Button onClick={onBrowse}>Browse courses</Button></div> : <div className="timeline">{[1,2,3,4,5].map((module) => <div className="timeline-module" key={module}><div className="module-label"><strong>Module {module}</strong><span>{moduleDates[module]}</span></div><div className="module-events">{selectedCourses.filter((c) => c.module === module).length === 0 ? <span className="no-events">No selected classes</span> : selectedCourses.filter((c) => c.module === module).map((course) => <div className={`calendar-event accent-${course.accent}`} key={course.code}><span>{course.time}</span><strong>{course.code}</strong><p>{course.name}</p><small>{course.days} · {course.className}</small></div>)}</div></div>)}</div>}</section>;
}

function RequirementsView({ selectedCourses }: { selectedCourses: Course[] }) {
  const selectedCodes = new Set(selectedCourses.map((c) => c.code));
  const groups = [{ title: "Core courses", note: "Complete all four", courses: courses.filter((c) => c.type === "Core") }, { title: "AI stream · List A", note: "Choose at least one", courses: courses.filter((c) => c.stream === "AI · List A") }, { title: "AI stream · List B", note: "Choose at least one", courses: courses.filter((c) => c.stream === "AI · List B") }, { title: "Capstone", note: "Choose one", courses: courses.filter((c) => c.type === "Capstone") }];
  return <section><div className="page-heading compact"><div><p className="eyebrow">PROGRAMME STRUCTURE</p><h1>Graduation requirements</h1><p>Complete 10 courses × 6 credits: four core, five electives, and one capstone.</p></div></div><div className="requirements-grid">{groups.map((group) => <article className="panel rule-card" key={group.title}><div className="panel-head"><div><h2>{group.title}</h2><p>{group.note}</p></div></div>{group.courses.map((course) => <div className="rule-course" key={course.code}><span className={selectedCodes.has(course.code) ? "check done" : "check"}>{selectedCodes.has(course.code) && <Check size={13} />}</span><div><strong>{course.code}</strong><p>{course.name}</p></div><span>M{course.module}</span></div>)}</article>)}</div><div className="disclaimer"><CircleAlert size={18} /><p><strong>Planning guidance only.</strong> Course availability and programme rules may change. Verify your final selection with official HKU communications.</p></div></section>;
}
