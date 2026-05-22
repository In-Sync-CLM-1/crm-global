import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Mail,
  MessageCircle,
  Phone,
  CalendarDays,
  BarChart3,
  Zap,
  Settings,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  ArrowRight,
  Search,
  Filter,
  MoreHorizontal,
  Clock,
  UserPlus,
  Building2,
  Send,
  Eye,
  MousePointerClick,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Timer,
  Plus,
  GripVertical,
  Sparkles,
  Shield,
  Workflow,
  ChevronRight,
  Target,
  DollarSign,
  Activity,
  PieChart,
} from "lucide-react";

/* ── Timing ───────────────────────────────────────────── */

const SCENES = [
  { id: "intro", label: "Intro", duration: 5000 },
  { id: "dashboard", label: "Dashboard", duration: 12000 },
  { id: "contacts", label: "Contacts", duration: 11000 },
  { id: "pipeline", label: "Pipeline", duration: 12000 },
  { id: "email-campaigns", label: "Email", duration: 11000 },
  { id: "whatsapp", label: "WhatsApp", duration: 11000 },
  { id: "calling", label: "Calling", duration: 11000 },
  { id: "calendar", label: "Calendar", duration: 10000 },
  { id: "reports", label: "Reports", duration: 11000 },
  { id: "automations", label: "Automations", duration: 10000 },
  { id: "admin", label: "Admin", duration: 10000 },
  { id: "outro", label: "Summary", duration: 5000 },
] as const;

const TOTAL = SCENES.reduce((s, sc) => s + sc.duration, 0);

type SceneId = (typeof SCENES)[number]["id"];

/* ── Helpers ──────────────────────────────────────────── */

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.6 },
};

const slideUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, delay } },
});

const slideLeft = (delay = 0) => ({
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, delay } },
});

const slideRight = (delay = 0) => ({
  initial: { opacity: 0, x: -40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, delay } },
});

/* ── Simulated sidebar ────────────────────────────────── */

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", sceneId: "dashboard" },
  { icon: Users, label: "Contacts", sceneId: "contacts" },
  { icon: Kanban, label: "Pipeline", sceneId: "pipeline" },
  { icon: Mail, label: "Campaigns", sceneId: "email-campaigns" },
  { icon: Phone, label: "Calling", sceneId: "calling" },
  { icon: CalendarDays, label: "Calendar", sceneId: "calendar" },
  { icon: BarChart3, label: "Reports", sceneId: "reports" },
  { icon: Settings, label: "Settings", sceneId: "admin" },
];

function MockSidebar({ active }: { active: string }) {
  return (
    <motion.div
      {...slideRight()}
      className="hidden w-56 shrink-0 flex-col border-r border-border/60 bg-slate-900 sm:flex"
    >
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Target className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-bold tracking-tight text-white">In-Sync CRM</span>
      </div>
      <div className="border-b border-white/10 px-4 py-2">
        <div className="rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400">
          Acme Corp
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {navItems.map((item) => {
          const isActive = item.label === active;
          return (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary/20 text-primary"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-3">
        <p className="truncate text-[10px] text-slate-500">admin@acmecorp.com</p>
      </div>
    </motion.div>
  );
}

/* ── KPI Card ─────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  change,
  color,
  icon: Icon,
  delay,
}: {
  label: string;
  value: string;
  change: string;
  color: string;
  icon: any;
  delay: number;
}) {
  return (
    <motion.div
      {...slideUp(delay)}
      className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-4"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <AnimatedValue value={value} delay={delay + 0.3} />
        </div>
        <div className="rounded-lg bg-muted/50 p-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: delay + 0.8 } }}
        className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600"
      >
        <TrendingUp className="h-3 w-3" /> {change}
      </motion.div>
    </motion.div>
  );
}

function AnimatedValue({ value, delay }: { value: string; delay: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <p className="mt-1 text-2xl font-bold text-foreground">{show ? value : "\u2014"}</p>
  );
}

/* ── Animated bar chart ───────────────────────────────── */

function MiniBarChart() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const data = [
    { leads: 85, deals: 52, revenue: 40 },
    { leads: 70, deals: 40, revenue: 32 },
    { leads: 95, deals: 68, revenue: 55 },
    { leads: 60, deals: 35, revenue: 28 },
    { leads: 110, deals: 80, revenue: 65 },
    { leads: 45, deals: 28, revenue: 20 },
    { leads: 80, deals: 55, revenue: 45 },
  ];
  const max = 110;
  return (
    <motion.div
      {...slideUp(0.6)}
      className="overflow-hidden rounded-xl border border-border/60 bg-card p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Weekly Pipeline Activity</p>
        <div className="flex gap-3 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Leads
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Deals
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-violet-500" /> Revenue
          </span>
        </div>
      </div>
      <div className="flex items-end gap-2" style={{ height: 100 }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-px">
            <div className="flex w-full items-end gap-px" style={{ height: 80 }}>
              {[
                { val: d.leads, color: "bg-sky-500" },
                { val: d.deals, color: "bg-emerald-500" },
                { val: d.revenue, color: "bg-violet-500" },
              ].map((bar, j) => (
                <motion.div
                  key={j}
                  className={`flex-1 rounded-t ${bar.color}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${(bar.val / max) * 100}%` }}
                  transition={{
                    duration: 0.8,
                    delay: 1.0 + i * 0.1 + j * 0.05,
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>
            <span className="mt-1 text-[9px] text-muted-foreground">{days[i]}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Activity Chart Placeholder ───────────────────────── */

function ActivityChart() {
  return (
    <motion.div
      {...slideUp(1.0)}
      className="overflow-hidden rounded-xl border border-border/60 bg-card p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Activity Overview</span>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[9px] font-semibold text-primary">
          Live
        </span>
      </div>
      <div className="flex items-end gap-1" style={{ height: 60 }}>
        {Array.from({ length: 24 }, (_, i) => {
          const h = Math.random() * 80 + 20;
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-t bg-primary/30"
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ duration: 0.6, delay: 1.2 + i * 0.04, ease: "easeOut" }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[8px] text-muted-foreground">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>Now</span>
      </div>
    </motion.div>
  );
}

/* ── Scene: Intro ─────────────────────────────────────── */

function SceneIntro() {
  return (
    <motion.div
      {...fade}
      className="flex h-full flex-col items-center justify-center bg-background"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 h-[300px] w-[300px] rounded-full bg-emerald-500/8 blur-[100px]" />
      </div>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary shadow-2xl shadow-primary/30"
      >
        <Target className="h-12 w-12 text-primary-foreground" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative text-5xl font-extrabold tracking-tight text-foreground"
      >
        In-Sync CRM
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="relative mt-3 text-lg text-muted-foreground"
      >
        Finally, A CRM that fits.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="relative mt-8 flex flex-wrap items-center justify-center gap-3"
      >
        {[
          { icon: Users, label: "Contacts" },
          { icon: Kanban, label: "Pipeline" },
          { icon: Mail, label: "Campaigns" },
          { icon: Phone, label: "Calling" },
          { icon: Sparkles, label: "AI Insights" },
          { icon: BarChart3, label: "Reports" },
        ].map((p, i) => (
          <motion.div
            key={p.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 + i * 0.15 }}
            className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary"
          >
            <p.icon className="h-3 w-3" /> {p.label}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ── Scene: Dashboard ─────────────────────────────────── */

function SceneDashboard() {
  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Dashboard" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
            <p className="text-xs text-muted-foreground">
              Your CRM command centre at a glance
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-semibold text-primary"
          >
            <Sparkles className="h-3 w-3" /> AI-Enhanced Analytics
          </motion.div>
        </motion.div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          <KpiCard
            label="Total Contacts"
            value="2,847"
            change="+186 this month"
            color="from-sky-500 to-blue-600"
            icon={Users}
            delay={0.15}
          />
          <KpiCard
            label="Pipeline Value"
            value={"\u20B924.5L"}
            change="+12% vs last month"
            color="from-emerald-500 to-green-600"
            icon={DollarSign}
            delay={0.25}
          />
          <KpiCard
            label="Campaigns Active"
            value="12"
            change="+3 new this week"
            color="from-violet-500 to-purple-600"
            icon={Mail}
            delay={0.35}
          />
          <KpiCard
            label="Deals Won"
            value="8"
            change="+3 this month"
            color="from-amber-500 to-orange-600"
            icon={TrendingUp}
            delay={0.45}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <MiniBarChart />
          </div>
          <ActivityChart />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Scene: Contacts ──────────────────────────────────── */

function SceneContacts() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 3500),
      setTimeout(() => setStep(3), 5500),
      setTimeout(() => setStep(4), 7500),
      setTimeout(() => setStep(5), 9000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const allContacts = [
    { name: "Amit Sharma", company: "TechCorp", email: "amit@techcorp.in", phone: "+91 97XX XXX 680", status: "Active" },
    { name: "Priya Patel", company: "DesignLab", email: "priya@designlab.io", phone: "+91 98XX XXX 412", status: "Active" },
    { name: "Raj Kumar", company: "BuildRight", email: "raj@buildright.com", phone: "+91 87XX XXX 901", status: "New" },
    { name: "Sneha Iyer", company: "MediaWorks", email: "sneha@mediaworks.in", phone: "+91 96XX XXX 234", status: "Active" },
    { name: "Vikram Desai", company: "CloudNine", email: "vikram@cloudnine.io", phone: "+91 99XX XXX 567", status: "Inactive" },
  ];

  const contacts = step >= 2 ? allContacts.filter((c) => c.status === "Active") : allContacts;

  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Contacts" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Contacts</h2>
            <p className="text-xs text-muted-foreground">
              Manage your entire contact database
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.div
              {...slideLeft(0.3)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[10px] text-muted-foreground"
            >
              <Search className="h-3 w-3" /> Search contacts...
            </motion.div>
            <motion.div
              {...slideLeft(0.4)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground"
            >
              <UserPlus className="h-3 w-3" /> Add Contact
            </motion.div>
          </div>
        </motion.div>

        {/* Filter row */}
        <motion.div {...slideUp(0.15)} className="mt-3 flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] transition-colors ${
              step >= 2
                ? "border-primary/50 bg-primary/5 font-medium text-primary"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            <Filter className="h-3 w-3" /> {step >= 2 ? "Status: Active" : "Filter by Status"}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] text-muted-foreground">
            <Building2 className="h-3 w-3" /> Company: All
          </div>
          {step >= 2 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[9px] font-medium text-primary"
            >
              {contacts.length} matches
            </motion.span>
          )}
        </motion.div>

        {/* Contact table */}
        <motion.div
          {...slideUp(0.25)}
          className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card"
        >
          <div className="flex items-center border-b border-border/40 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {step >= 5 && <div className="w-6 shrink-0" />}
            <div className="flex-[2]">Name</div>
            <div className="flex-[2]">Company</div>
            <div className="flex-[2]">Email</div>
            <div className="flex-[1.5]">Phone</div>
            <div className="flex-1">Status</div>
          </div>
          <div className="divide-y divide-border/30">
            {contacts.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0, transition: { delay: 0.35 + i * 0.08 } }}
                className="flex items-center px-4 py-2"
              >
                {step >= 5 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-6 shrink-0"
                  >
                    <div className="h-3.5 w-3.5 rounded border-2 border-primary bg-primary/20" />
                  </motion.div>
                )}
                <div className="flex flex-[2] items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                    {c.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <span className="text-xs font-medium text-foreground">{c.name}</span>
                </div>
                <span className="flex-[2] text-xs text-muted-foreground">{c.company}</span>
                <span className="flex-[2] text-xs text-muted-foreground">{c.email}</span>
                <span className="flex-[1.5] text-xs text-muted-foreground">{c.phone}</span>
                <span className="flex-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[8px] font-medium ${
                      c.status === "Active"
                        ? "bg-emerald-100 text-emerald-700"
                        : c.status === "New"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.status}
                  </span>
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bulk actions */}
        <AnimatePresence>
          {step >= 5 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center justify-between rounded-xl border-2 border-primary/30 bg-primary/5 p-3"
            >
              <span className="text-xs text-muted-foreground">
                <strong className="text-foreground">{contacts.length}</strong> contacts
                selected
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[10px] font-medium text-foreground">
                  <Mail className="h-3 w-3" /> Email All
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground">
                  <Send className="h-3 w-3" /> Add to Campaign
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── Scene: Pipeline ──────────────────────────────────── */

function ScenePipeline() {
  const columns = [
    {
      title: "New",
      color: "bg-blue-500",
      deals: [
        { name: "TechCorp Upgrade", value: "\u20B92.5L", contact: "Amit S." },
        { name: "DesignLab Contract", value: "\u20B91.8L", contact: "Priya P." },
      ],
    },
    {
      title: "Contacted",
      color: "bg-cyan-500",
      deals: [
        { name: "BuildRight Suite", value: "\u20B93.2L", contact: "Raj K." },
        { name: "MediaWorks Plan", value: "\u20B91.2L", contact: "Sneha I." },
        { name: "StartupX Deal", value: "\u20B90.8L", contact: "Kiran M." },
      ],
    },
    {
      title: "Qualified",
      color: "bg-amber-500",
      deals: [
        { name: "CloudNine Enterprise", value: "\u20B95.0L", contact: "Vikram D." },
        { name: "FinServe Premium", value: "\u20B94.2L", contact: "Neha R." },
      ],
    },
    {
      title: "Proposal",
      color: "bg-violet-500",
      deals: [
        { name: "RetailMax Bundle", value: "\u20B93.8L", contact: "Arun G." },
        { name: "EduTech License", value: "\u20B92.1L", contact: "Meera S." },
      ],
    },
    {
      title: "Won",
      color: "bg-emerald-500",
      deals: [
        { name: "HealthPlus Annual", value: "\u20B96.0L", contact: "Deepak T." },
        { name: "LogiPro Renewal", value: "\u20B92.4L", contact: "Anjali K." },
        { name: "GreenCo Upgrade", value: "\u20B91.5L", contact: "Suresh B." },
      ],
    },
  ];

  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Pipeline" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Sales Pipeline</h2>
            <p className="text-xs text-muted-foreground">
              Drag deals between stages to update progress
            </p>
          </div>
          <motion.div
            {...slideLeft(0.3)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> New Deal
          </motion.div>
        </motion.div>

        <div className="mt-4 flex gap-3 overflow-x-auto">
          {columns.map((col, colIdx) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { delay: 0.2 + colIdx * 0.1 },
              }}
              className="w-48 shrink-0 rounded-xl border border-border/60 bg-muted/20"
            >
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                  <span className="text-xs font-semibold text-foreground">{col.title}</span>
                </div>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  {col.deals.length}
                </span>
              </div>
              <div className="space-y-2 p-2">
                {col.deals.map((deal, dealIdx) => (
                  <motion.div
                    key={deal.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      transition: { delay: 0.4 + colIdx * 0.1 + dealIdx * 0.08 },
                    }}
                    className="rounded-lg border border-border/40 bg-card p-2.5 shadow-sm"
                  >
                    <p className="text-[11px] font-semibold text-foreground">{deal.name}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-primary">{deal.value}</span>
                      <span className="text-[9px] text-muted-foreground">{deal.contact}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Scene: Email Campaigns ───────────────────────────── */

function SceneEmailCampaigns() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 4000),
      setTimeout(() => setStep(3), 6500),
      setTimeout(() => setStep(4), 9000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const campaigns = [
    {
      name: "March Product Launch",
      status: "Active",
      sent: 1240,
      opened: 856,
      clicked: 234,
    },
    {
      name: "Weekly Newsletter #42",
      status: "Completed",
      sent: 2100,
      opened: 1470,
      clicked: 380,
    },
    {
      name: "Re-engagement Series",
      status: "Draft",
      sent: 0,
      opened: 0,
      clicked: 0,
    },
  ];

  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Campaigns" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Email Campaigns</h2>
            <p className="text-xs text-muted-foreground">
              Create, send, and track email campaigns
            </p>
          </div>
          <motion.div
            {...slideLeft(0.3)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> Create Campaign
          </motion.div>
        </motion.div>

        {/* Campaign list */}
        <div className="mt-4 space-y-3">
          {campaigns.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.2 + i * 0.15 } }}
              className="rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{c.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          c.status === "Active"
                            ? "bg-emerald-100 text-emerald-700"
                            : c.status === "Completed"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Send className="h-3 w-3" /> {c.sent.toLocaleString()} sent
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {c.opened.toLocaleString()} opened
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" /> {c.clicked.toLocaleString()}{" "}
                        clicked
                      </span>
                    </div>
                  </div>
                </div>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Stats bars for active campaign */}
              <AnimatePresence>
                {step >= 1 && c.status === "Active" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 grid grid-cols-3 gap-3 border-t border-border/40 pt-3"
                  >
                    {[
                      {
                        label: "Open Rate",
                        value: "69%",
                        bar: 69,
                        color: "bg-emerald-500",
                      },
                      {
                        label: "Click Rate",
                        value: "18.9%",
                        bar: 19,
                        color: "bg-blue-500",
                      },
                      {
                        label: "Bounce Rate",
                        value: "2.1%",
                        bar: 2,
                        color: "bg-red-400",
                      },
                    ].map((stat, si) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: 1,
                          transition: { delay: si * 0.15 },
                        }}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">{stat.label}</span>
                          <span className="font-semibold text-foreground">{stat.value}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className={`h-full rounded-full ${stat.color}`}
                            initial={{ width: "0%" }}
                            animate={{ width: `${stat.bar}%` }}
                            transition={{ duration: 1, delay: 0.3 + si * 0.15, ease: "easeOut" }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Scene: WhatsApp ──────────────────────────────────── */

function SceneWhatsApp() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 3500),
      setTimeout(() => setStep(3), 6000),
      setTimeout(() => setStep(4), 8500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Campaigns" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">WhatsApp Campaigns</h2>
            <p className="text-xs text-muted-foreground">
              Broadcast messages via WhatsApp Business API
            </p>
          </div>
          <motion.div
            {...slideLeft(0.3)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-semibold text-white"
          >
            <MessageCircle className="h-3 w-3" /> New Broadcast
          </motion.div>
        </motion.div>

        <div className="mt-4 flex gap-4">
          {/* Left: Campaign details */}
          <div className="flex-1 space-y-3">
            <motion.div
              {...slideUp(0.2)}
              className="rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground">
                    March Promo Blast
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                      Sending
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Template: promo_march_offer
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Delivery stats */}
            <AnimatePresence>
              {step >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-4 gap-2"
                >
                  {[
                    { label: "Sent", value: "847", color: "text-blue-600" },
                    { label: "Delivered", value: "812", color: "text-emerald-600" },
                    { label: "Read", value: "634", color: "text-violet-600" },
                    { label: "Failed", value: "12", color: "text-red-500" },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.08 } }}
                      className="rounded-lg border border-border/40 bg-background p-2.5 text-center"
                    >
                      <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-[8px] text-muted-foreground">{stat.label}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recipient list */}
            <AnimatePresence>
              {step >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border/60 bg-card p-3"
                >
                  <p className="mb-2 text-xs font-semibold text-foreground">Recipients</p>
                  <div className="space-y-1.5">
                    {[
                      { name: "Amit Sharma", status: "Read", time: "10:32 AM" },
                      { name: "Priya Patel", status: "Delivered", time: "10:30 AM" },
                      { name: "Raj Kumar", status: "Read", time: "10:35 AM" },
                      { name: "Sneha Iyer", status: "Sent", time: "10:31 AM" },
                    ].map((r, i) => (
                      <motion.div
                        key={r.name}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: i * 0.1 } }}
                        className="flex items-center justify-between rounded-lg bg-background px-3 py-1.5"
                      >
                        <span className="text-[10px] font-medium text-foreground">{r.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground">{r.time}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[8px] font-medium ${
                              r.status === "Read"
                                ? "bg-violet-100 text-violet-700"
                                : r.status === "Delivered"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: WhatsApp preview */}
          <motion.div {...slideLeft(0.4)} className="w-52 shrink-0">
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Template Preview</p>
              <div className="rounded-lg bg-[#e5ddd5] p-2.5">
                <div className="rounded-lg rounded-tl-none bg-white p-2 shadow-sm">
                  <div className="mb-1.5 flex aspect-video items-center justify-center overflow-hidden rounded bg-gradient-to-br from-emerald-500/20 to-primary/20">
                    <span className="text-[8px] font-medium text-emerald-600">
                      Promo Banner
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-gray-900">
                    Hi <strong>{"{{name}}"}</strong>! {"\n\n"}
                    Get <strong>20% OFF</strong> on all plans this March! {"\n\n"}
                    Code: <strong>MARCH20</strong>
                    {"\n"}
                    Valid till 31st March.
                  </p>
                  <p className="mt-1 text-right text-[8px] text-gray-400">10:30 AM</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Scene: Calling ───────────────────────────────────── */

function SceneCalling() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 3500),
      setTimeout(() => setStep(3), 6000),
      setTimeout(() => setStep(4), 8500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Calling" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Calling Dashboard</h2>
            <p className="text-xs text-muted-foreground">
              Monitor agent performance and call activity
            </p>
          </div>
        </motion.div>

        {/* Agent stats */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { label: "Calls Today", value: "47", icon: PhoneCall, color: "text-blue-600" },
            { label: "Avg Duration", value: "4m 32s", icon: Timer, color: "text-emerald-600" },
            { label: "Inbound", value: "18", icon: PhoneIncoming, color: "text-violet-600" },
            { label: "Missed", value: "3", icon: PhoneMissed, color: "text-red-500" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              {...slideUp(0.15 + i * 0.1)}
              className="rounded-xl border border-border/60 bg-card p-3"
            >
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-muted/50 p-1.5">
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </span>
              </div>
              <p className={`mt-2 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Disposition chart */}
        <AnimatePresence>
          {step >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 grid grid-cols-3 gap-3"
            >
              <div className="col-span-1 rounded-xl border border-border/60 bg-card p-4">
                <p className="mb-3 text-xs font-semibold text-foreground">Dispositions</p>
                <div className="space-y-2">
                  {[
                    { label: "Interested", pct: 42, color: "bg-emerald-500" },
                    { label: "Callback", pct: 28, color: "bg-blue-500" },
                    { label: "Not Interested", pct: 18, color: "bg-red-400" },
                    { label: "No Answer", pct: 12, color: "bg-muted-foreground" },
                  ].map((d, i) => (
                    <div key={d.label}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="font-medium text-foreground">{d.pct}%</span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className={`h-full rounded-full ${d.color}`}
                          initial={{ width: "0%" }}
                          animate={{ width: `${d.pct}%` }}
                          transition={{
                            duration: 0.8,
                            delay: 0.3 + i * 0.15,
                            ease: "easeOut",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call log table */}
              <div className="col-span-2 rounded-xl border border-border/60 bg-card p-4">
                <p className="mb-3 text-xs font-semibold text-foreground">Recent Calls</p>
                <div className="space-y-1.5">
                  {[
                    {
                      name: "Amit Sharma",
                      type: "Outbound",
                      duration: "5:12",
                      disposition: "Interested",
                      time: "2 min ago",
                    },
                    {
                      name: "Priya Patel",
                      type: "Inbound",
                      duration: "3:45",
                      disposition: "Callback",
                      time: "15 min ago",
                    },
                    {
                      name: "Raj Kumar",
                      type: "Outbound",
                      duration: "1:20",
                      disposition: "No Answer",
                      time: "28 min ago",
                    },
                    {
                      name: "Sneha Iyer",
                      type: "Outbound",
                      duration: "8:03",
                      disposition: "Interested",
                      time: "45 min ago",
                    },
                    {
                      name: "Vikram Desai",
                      type: "Inbound",
                      duration: "2:15",
                      disposition: "Not Interested",
                      time: "1 hr ago",
                    },
                  ].map((call, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        transition: { delay: 0.4 + i * 0.1 },
                      }}
                      className="flex items-center justify-between rounded-lg bg-background px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        {call.type === "Outbound" ? (
                          <PhoneOutgoing className="h-3 w-3 text-blue-500" />
                        ) : (
                          <PhoneIncoming className="h-3 w-3 text-emerald-500" />
                        )}
                        <span className="text-[10px] font-medium text-foreground">
                          {call.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                        <span>{call.duration}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                            call.disposition === "Interested"
                              ? "bg-emerald-100 text-emerald-700"
                              : call.disposition === "Callback"
                              ? "bg-blue-100 text-blue-700"
                              : call.disposition === "Not Interested"
                              ? "bg-red-100 text-red-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {call.disposition}
                        </span>
                        <span>{call.time}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── Scene: Calendar ──────────────────────────────────── */

function SceneCalendar() {
  const today = 20;
  const daysInMonth = 31;
  const startDay = 0; // March 2026 starts on Sunday
  const eventDays: Record<number, string[]> = {
    3: ["bg-blue-500"],
    5: ["bg-emerald-500", "bg-violet-500"],
    8: ["bg-amber-500"],
    10: ["bg-blue-500"],
    12: ["bg-red-400"],
    15: ["bg-emerald-500"],
    18: ["bg-violet-500", "bg-blue-500"],
    20: ["bg-primary", "bg-emerald-500", "bg-amber-500"],
    22: ["bg-blue-500"],
    25: ["bg-emerald-500"],
    27: ["bg-violet-500"],
    29: ["bg-amber-500", "bg-blue-500"],
  };

  const upcoming = [
    { time: "10:00 AM", title: "Call with Amit Sharma", type: "Call", color: "bg-blue-500" },
    { time: "11:30 AM", title: "Pipeline Review Meeting", type: "Meeting", color: "bg-emerald-500" },
    { time: "2:00 PM", title: "Demo for CloudNine", type: "Demo", color: "bg-violet-500" },
    { time: "3:30 PM", title: "Follow up: FinServe", type: "Follow-up", color: "bg-amber-500" },
    { time: "5:00 PM", title: "Weekly team standup", type: "Meeting", color: "bg-emerald-500" },
  ];

  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Calendar" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Calendar</h2>
            <p className="text-xs text-muted-foreground">March 2026</p>
          </div>
          <motion.div
            {...slideLeft(0.3)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> New Event
          </motion.div>
        </motion.div>

        <div className="mt-4 flex gap-4">
          {/* Calendar grid */}
          <motion.div
            {...slideUp(0.2)}
            className="flex-1 rounded-xl border border-border/60 bg-card p-4"
          >
            {/* Day headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startDay }, (_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const isToday = day === today;
                const dots = eventDays[day] || [];
                return (
                  <motion.div
                    key={day}
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: { delay: 0.3 + i * 0.015 },
                    }}
                    className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[10px] ${
                      isToday
                        ? "bg-primary font-bold text-primary-foreground"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {day}
                    {dots.length > 0 && (
                      <div className="mt-0.5 flex gap-0.5">
                        {dots.map((c, di) => (
                          <span
                            key={di}
                            className={`h-1 w-1 rounded-full ${isToday ? "bg-primary-foreground/70" : c}`}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Upcoming activities */}
          <motion.div
            {...slideLeft(0.4)}
            className="w-64 shrink-0 rounded-xl border border-border/60 bg-card p-4"
          >
            <p className="mb-3 text-xs font-semibold text-foreground">Today's Activities</p>
            <div className="space-y-2">
              {upcoming.map((event, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: { delay: 0.6 + i * 0.12 },
                  }}
                  className="flex items-start gap-2.5 rounded-lg bg-background p-2"
                >
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${event.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-foreground">{event.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span>{event.time}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[8px]">
                        {event.type}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Scene: Reports ───────────────────────────────────── */

function SceneReports() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 3500),
      setTimeout(() => setStep(3), 6000),
      setTimeout(() => setStep(4), 8500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const fields = [
    { label: "Deal Value", type: "Metric" },
    { label: "Stage", type: "Dimension" },
    { label: "Owner", type: "Dimension" },
    { label: "Close Date", type: "Date" },
    { label: "Source", type: "Dimension" },
    { label: "Win Rate", type: "Metric" },
  ];

  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Reports" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Report Builder</h2>
            <p className="text-xs text-muted-foreground">
              Drag fields to build custom reports
            </p>
          </div>
          <motion.div
            {...slideLeft(0.3)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground"
          >
            <BarChart3 className="h-3 w-3" /> Save Report
          </motion.div>
        </motion.div>

        <div className="mt-4 flex gap-4">
          {/* Fields panel */}
          <motion.div
            {...slideRight(0.1)}
            className="w-44 shrink-0 rounded-xl border border-border/60 bg-card p-3"
          >
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Available Fields
            </p>
            <div className="space-y-1">
              {fields.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: { delay: 0.2 + i * 0.06 },
                  }}
                  className="flex cursor-grab items-center gap-1.5 rounded-md border border-border/40 bg-background px-2 py-1.5 text-[10px] font-medium text-foreground"
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  {f.label}
                  <span className="ml-auto rounded bg-muted px-1 py-0.5 text-[7px] text-muted-foreground">
                    {f.type}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Chart preview */}
          <div className="flex-1 space-y-3">
            {/* Config bar */}
            <AnimatePresence>
              {step >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2"
                >
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    Rows:
                  </span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                    Stage
                  </span>
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    Values:
                  </span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-medium text-emerald-700">
                    Deal Value (Sum)
                  </span>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[9px] font-medium text-blue-700">
                    Win Rate (Avg)
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bar chart preview */}
            <AnimatePresence>
              {step >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border/60 bg-card p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      Pipeline Value by Stage
                    </p>
                    <div className="flex gap-3 text-[9px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary" /> Deal Value
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Win Rate
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end gap-4" style={{ height: 140 }}>
                    {[
                      { label: "New", value: 65, win: 15 },
                      { label: "Contacted", value: 80, win: 25 },
                      { label: "Qualified", value: 95, win: 45 },
                      { label: "Proposal", value: 70, win: 60 },
                      { label: "Won", value: 100, win: 100 },
                    ].map((bar, i) => (
                      <div
                        key={bar.label}
                        className="flex flex-1 flex-col items-center"
                      >
                        <div
                          className="flex w-full items-end gap-1"
                          style={{ height: 110 }}
                        >
                          <motion.div
                            className="flex-1 rounded-t bg-primary"
                            initial={{ height: 0 }}
                            animate={{ height: `${bar.value}%` }}
                            transition={{
                              duration: 0.8,
                              delay: 0.3 + i * 0.15,
                              ease: "easeOut",
                            }}
                          />
                          <motion.div
                            className="flex-1 rounded-t bg-emerald-500"
                            initial={{ height: 0 }}
                            animate={{ height: `${bar.win}%` }}
                            transition={{
                              duration: 0.8,
                              delay: 0.4 + i * 0.15,
                              ease: "easeOut",
                            }}
                          />
                        </div>
                        <span className="mt-1.5 text-[9px] text-muted-foreground">
                          {bar.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Scene: Automations ───────────────────────────────── */

function SceneAutomations() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1200),
      setTimeout(() => setStep(2), 3000),
      setTimeout(() => setStep(3), 5000),
      setTimeout(() => setStep(4), 7000),
      setTimeout(() => setStep(5), 8500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const rules = [
    {
      name: "New Lead Assignment",
      trigger: "Contact Created",
      condition: "Source = Website",
      action: "Assign to Sales Team A",
      status: "Active",
    },
    {
      name: "Deal Stage Notification",
      trigger: "Deal Moved to Proposal",
      condition: "Value > \u20B92L",
      action: "Notify Manager + Send Email",
      status: "Active",
    },
    {
      name: "Follow-up Reminder",
      trigger: "No Activity for 7 Days",
      condition: "Status = Active",
      action: "Send Alert + Notify Owner",
      status: "Draft",
    },
  ];

  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Settings" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)} className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Automations</h2>
            <p className="text-xs text-muted-foreground">
              Automate workflows with triggers, conditions, and actions
            </p>
          </div>
          <motion.div
            {...slideLeft(0.3)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground"
          >
            <Zap className="h-3 w-3" /> New Automation
          </motion.div>
        </motion.div>

        <div className="mt-4 space-y-3">
          {rules.map((rule, ruleIdx) => (
            <motion.div
              key={rule.name}
              initial={{ opacity: 0, y: 15 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { delay: 0.2 + ruleIdx * 0.15 },
              }}
              className="rounded-xl border border-border/60 bg-card overflow-hidden"
            >
              <div className="flex items-center gap-4 p-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    rule.status === "Active" ? "bg-primary/10" : "bg-muted/50"
                  }`}
                >
                  <Workflow
                    className={`h-5 w-5 ${
                      rule.status === "Active" ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{rule.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                        rule.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {rule.status}
                    </span>
                  </div>
                </div>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Flow card steps */}
              <AnimatePresence>
                {step >= ruleIdx + 1 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-t border-border/40 bg-muted/20 px-5 py-3"
                  >
                    <div className="flex items-center gap-2">
                      {/* Trigger */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1, transition: { delay: 0.1 } }}
                        className="flex items-center gap-1.5 rounded-lg border-2 border-blue-200 bg-blue-50 px-3 py-1.5"
                      >
                        <Zap className="h-3 w-3 text-blue-600" />
                        <div>
                          <p className="text-[8px] font-semibold uppercase text-blue-600">
                            Trigger
                          </p>
                          <p className="text-[10px] font-medium text-foreground">
                            {rule.trigger}
                          </p>
                        </div>
                      </motion.div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground" />

                      {/* Condition */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          transition: { delay: 0.25 },
                        }}
                        className="flex items-center gap-1.5 rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-1.5"
                      >
                        <Filter className="h-3 w-3 text-amber-600" />
                        <div>
                          <p className="text-[8px] font-semibold uppercase text-amber-600">
                            Condition
                          </p>
                          <p className="text-[10px] font-medium text-foreground">
                            {rule.condition}
                          </p>
                        </div>
                      </motion.div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground" />

                      {/* Action */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          transition: { delay: 0.4 },
                        }}
                        className="flex items-center gap-1.5 rounded-lg border-2 border-emerald-200 bg-emerald-50 px-3 py-1.5"
                      >
                        <Play className="h-3 w-3 text-emerald-600" />
                        <div>
                          <p className="text-[8px] font-semibold uppercase text-emerald-600">
                            Action
                          </p>
                          <p className="text-[10px] font-medium text-foreground">
                            {rule.action}
                          </p>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Scene: Admin ─────────────────────────────────────── */

function SceneAdmin() {
  const cards = [
    {
      icon: Users,
      title: "Users & Teams",
      desc: "Manage team members, roles, and permissions",
      badge: "5 users",
    },
    {
      icon: Kanban,
      title: "Pipeline Stages",
      desc: "Customize deal stages and win probabilities",
      badge: "5 stages",
    },
    {
      icon: MessageCircle,
      title: "Communication Settings",
      desc: "Email, WhatsApp, and calling configuration",
      badge: "3 channels",
    },
    {
      icon: Shield,
      title: "Data & Privacy",
      desc: "Export data and manage privacy settings",
      badge: "Compliant",
    },
    {
      icon: Shield,
      title: "Security",
      desc: "Two-factor authentication and session management",
      badge: "Enabled",
    },
    {
      icon: Workflow,
      title: "Automation Rules",
      desc: "Configure triggers, conditions, and actions",
      badge: "3 active",
    },
  ];

  return (
    <motion.div {...fade} className="flex h-full">
      <MockSidebar active="Settings" />
      <div className="flex-1 overflow-hidden p-5">
        <motion.div {...slideUp(0)}>
          <h2 className="text-xl font-bold text-foreground">Admin Settings</h2>
          <p className="text-xs text-muted-foreground">
            Configure your CRM to match your workflow
          </p>
        </motion.div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { delay: 0.2 + i * 0.1 },
              }}
              className="group rounded-xl border border-border/60 bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                  {card.badge}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{card.title}</h3>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                {card.desc}
              </p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.6 + i * 0.1 } }}
                className="mt-3 flex items-center gap-1 text-[10px] font-medium text-primary"
              >
                Configure <ArrowRight className="h-3 w-3" />
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Scene: Outro ─────────────────────────────────────── */

function SceneOutro() {
  return (
    <motion.div
      {...fade}
      className="flex h-full flex-col items-center justify-center bg-background"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/3 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-2xl shadow-primary/30"
      >
        <Target className="h-10 w-10 text-primary-foreground" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative text-4xl font-extrabold tracking-tight text-foreground"
      >
        In-Sync CRM
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative mt-2 text-lg text-muted-foreground"
      >
        Everything you need to grow.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="relative mt-8 grid grid-cols-4 gap-3"
      >
        {[
          {
            icon: Users,
            title: "Contacts",
            desc: "Unified contact database with smart segmentation",
          },
          {
            icon: Kanban,
            title: "Pipeline",
            desc: "Visual Kanban boards to track every deal",
          },
          {
            icon: Mail,
            title: "Campaigns",
            desc: "Email and WhatsApp campaigns with analytics",
          },
          {
            icon: Phone,
            title: "Calling",
            desc: "Built-in calling with dispositions and logging",
          },
          {
            icon: CalendarDays,
            title: "Calendar",
            desc: "Schedule meetings, calls, and follow-ups",
          },
          {
            icon: BarChart3,
            title: "Reports",
            desc: "Custom report builder with drag-and-drop fields",
          },
          {
            icon: Zap,
            title: "Automations",
            desc: "Workflow automation with triggers and actions",
          },
          {
            icon: Sparkles,
            title: "AI Insights",
            desc: "AI-powered analytics and recommendations",
          },
        ].map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 + i * 0.1 }}
            className="relative rounded-xl border border-border/60 bg-card p-4 text-center"
          >
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <p.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-bold text-foreground">{p.title}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{p.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.0 }}
        className="relative mt-8"
      >
        <Button size="lg" className="px-8 text-base shadow-xl shadow-primary/25" asChild>
          <Link to="/signup">
            Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Demo Page ───────────────────────────────────── */

export default function Demo() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const currentScene = SCENES[sceneIndex];

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (sceneIndex < SCENES.length - 1) {
        setSceneIndex((i) => i + 1);
      } else {
        setPlaying(false);
      }
    }, currentScene.duration);
    return () => clearTimeout(timer);
  }, [sceneIndex, playing, currentScene.duration]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setElapsed((e) => e + 100);
    }, 100);
    return () => clearInterval(interval);
  }, [playing]);

  useEffect(() => {
    setElapsed(0);
  }, [sceneIndex]);

  const totalElapsed =
    SCENES.slice(0, sceneIndex).reduce((s, sc) => s + sc.duration, 0) + elapsed;
  const progress = Math.min((totalElapsed / TOTAL) * 100, 100);

  const restart = useCallback(() => {
    setSceneIndex(0);
    setElapsed(0);
    setPlaying(true);
  }, []);

  const renderScene = () => {
    switch (currentScene.id) {
      case "intro":
        return <SceneIntro />;
      case "dashboard":
        return <SceneDashboard />;
      case "contacts":
        return <SceneContacts />;
      case "pipeline":
        return <ScenePipeline />;
      case "email-campaigns":
        return <SceneEmailCampaigns />;
      case "whatsapp":
        return <SceneWhatsApp />;
      case "calling":
        return <SceneCalling />;
      case "calendar":
        return <SceneCalendar />;
      case "reports":
        return <SceneReports />;
      case "automations":
        return <SceneAutomations />;
      case "admin":
        return <SceneAdmin />;
      case "outro":
        return <SceneOutro />;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black px-4 py-2">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80"
        >
          <Target className="h-4 w-4" />
          <span className="font-medium">In-Sync CRM Demo</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="mr-4 hidden items-center gap-1 sm:flex">
            {SCENES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  setSceneIndex(i);
                  setElapsed(0);
                  setPlaying(true);
                }}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                  i === sceneIndex
                    ? "bg-primary text-primary-foreground"
                    : i < sceneIndex
                    ? "bg-white/20 text-white/60"
                    : "bg-white/5 text-white/30"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPlaying(!playing)}
            className="rounded-lg bg-white/10 p-1.5 text-white/60 hover:bg-white/20 hover:text-white"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={restart}
            className="rounded-lg bg-white/10 p-1.5 text-white/60 hover:bg-white/20 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <motion.div
          className="h-full bg-primary"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Scene viewport */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-6xl">
          <AnimatePresence mode="wait">
            <motion.div key={currentScene.id} className="h-full">
              {renderScene()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
