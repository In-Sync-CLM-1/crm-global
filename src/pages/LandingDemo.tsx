import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
  MessageSquare,
  BarChart3,
  Target,
  Brain,
  Rocket,
  Zap,
  CheckCircle,
  GripVertical,
  Send,
  PhoneCall,
  PhoneOff,
  Clock,
  Star,
} from "lucide-react";

/* ── Timing ───────────────────────────────────────────── */

const SCENES = [
  { id: "intro", label: "Intro", duration: 4000 },
  { id: "dashboard", label: "Dashboard", duration: 12000 },
  { id: "pipeline", label: "Pipeline", duration: 12000 },
  { id: "campaigns", label: "Campaigns", duration: 12000 },
  { id: "calling", label: "Calling", duration: 12000 },
  { id: "ai-insights", label: "AI", duration: 12000 },
  { id: "outro", label: "Get Started", duration: 4000 },
] as const;

type SceneId = (typeof SCENES)[number]["id"];

/* ── Animation helpers ────────────────────────────────── */

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.4 },
};

const slideUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay } },
});

const slideLeft = (delay = 0) => ({
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, delay } },
});

/* ── SVG Chart Components ─────────────────────────────── */

function RevenueChart() {
  const points: [number, number][] = [
    [0, 70], [43, 50], [86, 58], [129, 35], [172, 25], [215, 30], [258, 12], [300, 8],
  ];
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = line + " L300,90 L0,90 Z";
  return (
    <svg viewBox="0 0 300 90" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(20,184,166)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(20,184,166)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[22, 45, 67].map((y) => (
        <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="currentColor" strokeOpacity="0.07" />
      ))}
      <motion.path
        d={area}
        fill="url(#areaGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="rgb(20,184,166)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
      />
      {points.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r="3"
          fill="rgb(20,184,166)"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 + i * 0.12 }}
        />
      ))}
    </svg>
  );
}

function DonutChart({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const off = circ - (pct / 100) * circ;
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="7" />
      <motion.circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={circ}
        strokeLinecap="round"
        style={{ rotate: "-90deg", transformOrigin: "center" }}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: off }}
        transition={{ duration: 1.2, delay: 0.6, ease: "easeOut" }}
      />
      <text x="50" y="45" textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="700" fill="currentColor">
        {pct}%
      </text>
      <text x="50" y="60" textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="500" fill="currentColor" opacity="0.5">
        {label}
      </text>
    </svg>
  );
}

function ScoreBar({ name, score, delay }: { name: string; score: number; delay: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground">{name}</span>
        <span className="font-bold text-teal-600">{score}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${score >= 80 ? "bg-teal-500" : score >= 60 ? "bg-amber-500" : "bg-red-400"}`}
          initial={{ width: "0%" }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/* ── Typewriter hook ──────────────────────────────────── */

function useTypewriter(text: string, speed = 30, startDelay = 800) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);
  return displayed;
}

/* ── Scenes ───────────────────────────────────────────── */

/* Scene 1: Intro */
function IntroScene() {
  const pills = [
    { icon: LayoutDashboard, text: "Smart Dashboard" },
    { icon: Target, text: "Pipeline Tracking" },
    { icon: Mail, text: "Multi-Channel Campaigns" },
    { icon: Phone, text: "Built-in Calling" },
    { icon: Brain, text: "AI Lead Scoring" },
  ];
  return (
    <motion.div {...fade} className="flex flex-col items-center justify-center h-full text-center gap-5 px-4">
      <motion.div {...slideUp(0)}>
        <Rocket className="h-10 w-10 text-teal-500 mx-auto mb-3" />
      </motion.div>
      <motion.h2 {...slideUp(0.1)} className="text-2xl font-bold text-foreground">
        Your Sales Command Center
      </motion.h2>
      <motion.p {...slideUp(0.2)} className="text-sm text-muted-foreground max-w-sm">
        Everything your team needs to capture leads, close deals, and grow revenue — in one platform.
      </motion.p>
      <motion.div {...slideUp(0.3)} className="flex flex-wrap justify-center gap-2 mt-2 max-w-md">
        {pills.map((p, i) => (
          <motion.span
            key={p.text}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 300 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/10 text-teal-600 text-xs font-medium"
          >
            <p.icon className="h-3.5 w-3.5" />
            {p.text}
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* Scene 2: Dashboard */
function DashboardScene() {
  const kpis = [
    { label: "Revenue", value: "$284K", change: "+18%", icon: DollarSign, up: true },
    { label: "New Leads", value: "1,247", change: "+24%", icon: Users, up: true },
    { label: "Won Deals", value: "89", change: "+12%", icon: TrendingUp, up: true },
    { label: "Conv. Rate", value: "32%", change: "+5%", icon: Target, up: true },
  ];
  const activities = [
    { text: "Sarah closed Acme Corp — $42,000", time: "2m ago", color: "bg-teal-500" },
    { text: "New lead: John from TechStart", time: "8m ago", color: "bg-blue-500" },
    { text: "Follow-up call scheduled with FinServ", time: "15m ago", color: "bg-amber-500" },
  ];
  return (
    <motion.div {...fade} className="h-full flex flex-col gap-3">
      {/* Header */}
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">Every number that matters</h2>
        <p className="text-sm text-muted-foreground">See your whole business at a glance</p>
      </motion.div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            {...slideUp(0.1 + i * 0.08)}
            className="rounded-xl border bg-card p-2.5 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <k.icon className="h-4 w-4 text-teal-500" />
              <span className="text-[11px] font-semibold text-teal-600">{k.change}</span>
            </div>
            <span className="text-2xl font-bold text-foreground leading-tight">{k.value}</span>
            <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-5 gap-2 flex-1 min-h-0">
        {/* Area chart */}
        <motion.div {...slideUp(0.4)} className="col-span-3 rounded-xl border bg-card p-3 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-foreground">Revenue Trend</span>
            <span className="text-[11px] text-muted-foreground">Last 7 days</span>
          </div>
          <div className="flex-1 min-h-0">
            <RevenueChart />
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div {...slideUp(0.5)} className="col-span-2 rounded-xl border bg-card p-3 flex flex-col">
          <span className="text-sm font-semibold text-foreground mb-2">Live Activity</span>
          <div className="space-y-2.5 flex-1">
            {activities.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.25 }}
                className="flex items-start gap-2"
              >
                <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${a.color}`} />
                <div>
                  <p className="text-xs font-medium text-foreground leading-snug">{a.text}</p>
                  <p className="text-[11px] text-muted-foreground">{a.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* Scene 3: Pipeline */
function PipelineScene() {
  const columns = [
    {
      title: "Qualified",
      color: "bg-blue-500",
      count: 12,
      deals: [
        { name: "CloudSync Inc.", value: "$18,500", tag: "SaaS", hot: false },
        { name: "RetailMax Ltd.", value: "$24,000", tag: "Retail", hot: true },
      ],
    },
    {
      title: "Proposal",
      color: "bg-amber-500",
      count: 8,
      deals: [
        { name: "Acme Corp", value: "$42,000", tag: "Enterprise", hot: true },
        { name: "DataFlow.io", value: "$15,800", tag: "SaaS", hot: false },
      ],
    },
    {
      title: "Negotiation",
      color: "bg-purple-500",
      count: 5,
      deals: [
        { name: "FinServ Global", value: "$67,000", tag: "Finance", hot: true },
        { name: "HealthPlus", value: "$31,200", tag: "Health", hot: false },
      ],
    },
    {
      title: "Won",
      color: "bg-teal-500",
      count: 24,
      deals: [{ name: "TechStart AI", value: "$28,400", tag: "AI/ML", hot: false }],
    },
  ];

  return (
    <motion.div {...fade} className="h-full flex flex-col gap-3">
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">Watch deals flow to close</h2>
        <p className="text-sm text-muted-foreground">Never lose track of a deal again</p>
      </motion.div>

      {/* Kanban board */}
      <div className="grid grid-cols-4 gap-2 flex-1 min-h-0">
        {columns.map((col, ci) => (
          <motion.div
            key={col.title}
            {...slideUp(0.1 + ci * 0.1)}
            className="rounded-xl border bg-muted/30 p-2 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
              <span className="text-sm font-semibold text-foreground">{col.title}</span>
              <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                {col.count}
              </span>
            </div>
            <div className="space-y-2 flex-1">
              {col.deals.map((deal, di) => (
                <motion.div
                  key={deal.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + ci * 0.12 + di * 0.1 }}
                  className="rounded-lg border bg-card p-2.5 space-y-1.5 cursor-grab"
                >
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-sm font-medium text-foreground truncate">{deal.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-teal-600">{deal.value}</span>
                    {deal.hot && (
                      <span className="text-[11px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 rounded px-1.5 py-0.5">
                        Hot
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{deal.tag}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Animated drag indicator */}
      <motion.div
        className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <motion.div
          animate={{ x: [0, 40, 40, 0] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
        >
          <ArrowRight className="h-3.5 w-3.5 text-teal-500" />
        </motion.div>
        <span>Drag deals across stages to update</span>
      </motion.div>
    </motion.div>
  );
}

/* Scene 4: Campaigns */
function CampaignsScene() {
  const campaigns = [
    {
      title: "Spring Launch Offer",
      channel: "Email",
      icon: Mail,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      sent: "12,450",
      donutPct: 67,
      donutColor: "rgb(59,130,246)",
      donutLabel: "Opened",
      clicks: "2,890",
      status: "Active",
    },
    {
      title: "Re-engage Lost Leads",
      channel: "WhatsApp",
      icon: MessageSquare,
      iconColor: "text-green-500",
      bgColor: "bg-green-500/10",
      sent: "8,200",
      donutPct: 74,
      donutColor: "rgb(34,197,94)",
      donutLabel: "Read",
      clicks: "3,120",
      status: "Active",
    },
  ];

  return (
    <motion.div {...fade} className="h-full flex flex-col gap-3">
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">Reach thousands in one click</h2>
        <p className="text-sm text-muted-foreground">Dedicated campaign platforms with real-time analytics</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {campaigns.map((c, i) => (
          <motion.div
            key={c.title}
            {...slideUp(0.15 + i * 0.15)}
            className="rounded-xl border bg-card p-4 flex flex-col"
          >
            {/* Campaign header */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-lg ${c.bgColor}`}>
                <c.icon className={`h-4 w-4 ${c.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                <p className="text-[11px] text-muted-foreground">{c.channel} Campaign</p>
              </div>
              <span className="text-[11px] font-medium text-teal-600 bg-teal-500/10 rounded-full px-2 py-0.5">
                {c.status}
              </span>
            </div>

            {/* Donut + Stats */}
            <div className="flex items-center gap-4 flex-1">
              <DonutChart pct={c.donutPct} color={c.donutColor} label={c.donutLabel} />
              <div className="space-y-3 flex-1">
                <div>
                  <p className="text-[11px] text-muted-foreground">Sent</p>
                  <p className="text-sm font-bold text-foreground">{c.sent}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Clicks</p>
                  <p className="text-sm font-bold text-foreground">{c.clicks}</p>
                </div>
              </div>
            </div>

            {/* Send animation */}
            <motion.div
              className="flex items-center gap-1.5 mt-3 text-[11px] text-teal-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 + i * 0.3 }}
            >
              <motion.div
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Send className="h-3 w-3" />
              </motion.div>
              <span>Delivering messages...</span>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Bottom stats bar */}
      <motion.div
        {...slideUp(0.6)}
        className="rounded-xl border bg-card px-4 py-2.5 flex items-center justify-between"
      >
        {[
          { label: "Total Reached", value: "20,650" },
          { label: "Avg. Response", value: "4.2 min" },
          { label: "Conversions", value: "1,840" },
          { label: "ROI", value: "340%" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-sm font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* Scene 5: Calling */
function CallingScene() {
  const agents = [
    { name: "Sarah K.", calls: 47, duration: "3h 12m", conv: "38%", status: "On Call" },
    { name: "Mike R.", calls: 42, duration: "2h 58m", conv: "34%", status: "Available" },
    { name: "Lisa T.", calls: 35, duration: "2h 24m", conv: "41%", status: "On Call" },
  ];
  const callLog = [
    { contact: "David Chen", company: "Apex Corp", duration: "4:32", outcome: "Meeting Set", icon: CheckCircle, color: "text-teal-500" },
    { contact: "Maria Gonzalez", company: "Nova Ltd", duration: "2:15", outcome: "Call Back", icon: Clock, color: "text-amber-500" },
    { contact: "James Wilson", company: "Peak AI", duration: "6:18", outcome: "Qualified", icon: Star, color: "text-blue-500" },
  ];

  return (
    <motion.div {...fade} className="h-full flex flex-col gap-3">
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">Every conversation counts</h2>
        <p className="text-sm text-muted-foreground">Built-in calling that logs everything automatically</p>
      </motion.div>

      <div className="grid grid-cols-5 gap-2 flex-1 min-h-0">
        {/* Agent performance */}
        <motion.div {...slideUp(0.15)} className="col-span-2 rounded-xl border bg-card p-3 flex flex-col">
          <span className="text-sm font-semibold text-foreground mb-2">Agent Performance</span>
          <div className="space-y-2 flex-1">
            {agents.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="flex items-center gap-2 rounded-lg bg-muted/40 p-2"
              >
                <div className="h-8 w-8 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0">
                  <Phone className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{a.name}</span>
                    <span
                      className={`text-[11px] font-medium rounded-full px-1.5 py-0.5 ${
                        a.status === "On Call"
                          ? "text-teal-600 bg-teal-500/10"
                          : "text-muted-foreground bg-muted"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
                    <span>{a.calls} calls</span>
                    <span>{a.duration}</span>
                    <span className="font-medium text-teal-600">{a.conv}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Call log */}
        <motion.div {...slideUp(0.25)} className="col-span-3 rounded-xl border bg-card p-3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Recent Calls</span>
            {/* Live call pulse */}
            <motion.div
              className="flex items-center gap-1.5 text-[11px] font-medium text-teal-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <motion.div
                className="h-2 w-2 rounded-full bg-teal-500"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              2 live calls
            </motion.div>
          </div>
          <div className="space-y-2 flex-1">
            {callLog.map((c, i) => (
              <motion.div
                key={c.contact}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.2 }}
                className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5"
              >
                <div className="h-9 w-9 rounded-full bg-card border flex items-center justify-center shrink-0">
                  {i === 0 ? (
                    <PhoneCall className="h-4 w-4 text-teal-500" />
                  ) : i === 1 ? (
                    <Clock className="h-4 w-4 text-amber-500" />
                  ) : (
                    <PhoneOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{c.contact}</span>
                    <span className="text-[11px] text-muted-foreground">{c.duration}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[11px] text-muted-foreground">{c.company}</span>
                    <span className={`text-[11px] font-medium ${c.color}`}>{c.outcome}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Summary bar */}
      <motion.div
        {...slideUp(0.6)}
        className="rounded-xl border bg-card px-4 py-2.5 flex items-center justify-between"
      >
        {[
          { label: "Calls Today", value: "124" },
          { label: "Avg Duration", value: "3:45" },
          { label: "Connect Rate", value: "68%" },
          { label: "Meetings Set", value: "18" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-sm font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* Scene 6: AI Insights */
function AIInsightsScene() {
  const aiText = useTypewriter(
    "Based on engagement patterns, I recommend prioritizing Apex Corp — they've opened 3 emails this week and visited pricing twice. Schedule a call with David Chen before end of day for highest conversion probability.",
    25,
    1200,
  );

  const leads = [
    { name: "Apex Corp — David Chen", score: 92, delay: 0.4 },
    { name: "Nova Systems — Lisa Park", score: 78, delay: 0.6 },
    { name: "CloudNet — James Wright", score: 65, delay: 0.8 },
    { name: "SmallBiz Inc — Tom Hall", score: 41, delay: 1.0 },
  ];

  return (
    <motion.div {...fade} className="h-full flex flex-col gap-3">
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">AI that works while you sleep</h2>
        <p className="text-sm text-muted-foreground">AI tells you exactly what to do next</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {/* Lead scores */}
        <motion.div {...slideUp(0.15)} className="rounded-xl border bg-card p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-teal-500" />
            <span className="text-sm font-semibold text-foreground">Lead Scores</span>
          </div>
          <div className="space-y-3 flex-1">
            {leads.map((l) => (
              <ScoreBar key={l.name} name={l.name} score={l.score} delay={l.delay} />
            ))}
          </div>
        </motion.div>

        {/* AI Recommendation */}
        <motion.div {...slideUp(0.25)} className="rounded-xl border bg-card p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Brain className="h-4 w-4 text-teal-500" />
            </motion.div>
            <span className="text-sm font-semibold text-foreground">AI Recommendation</span>
          </div>
          <div className="rounded-lg bg-teal-500/5 border border-teal-500/20 p-3 flex-1">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">
                {aiText}
                <motion.span
                  className="inline-block w-0.5 h-4 bg-teal-500 ml-0.5 align-middle"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* AI Actions */}
      <motion.div {...slideUp(0.5)} className="rounded-xl border bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">Auto Actions Taken Today</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Leads Scored", value: "342", icon: Target },
            { label: "Follow-ups Queued", value: "28", icon: Send },
            { label: "Insights Generated", value: "15", icon: Sparkles },
          ].map((a, i) => (
            <motion.div
              key={a.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0 + i * 0.15 }}
              className="flex items-center gap-2 rounded-lg bg-muted/40 p-2"
            >
              <a.icon className="h-3.5 w-3.5 text-teal-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">{a.value}</p>
                <p className="text-[11px] text-muted-foreground">{a.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* Scene 7: Outro */
function OutroScene() {
  const features = [
    { icon: LayoutDashboard, label: "Dashboard" },
    { icon: Target, label: "Pipeline" },
    { icon: Mail, label: "Campaigns" },
    { icon: Phone, label: "Calling" },
    { icon: Brain, label: "AI Insights" },
    { icon: BarChart3, label: "Analytics" },
  ];
  return (
    <motion.div {...fade} className="flex flex-col items-center justify-center h-full text-center gap-5 px-4">
      <motion.div {...slideUp(0)}>
        <Zap className="h-10 w-10 text-teal-500 mx-auto mb-2" />
      </motion.div>
      <motion.h2 {...slideUp(0.1)} className="text-2xl font-bold text-foreground">
        Ready to 3x your close rate?
      </motion.h2>
      <motion.p {...slideUp(0.2)} className="text-sm text-muted-foreground max-w-xs">
        Join 2,000+ sales teams already closing more deals with less effort.
      </motion.p>
      <motion.div {...slideUp(0.25)} className="flex flex-wrap justify-center gap-3 mt-1">
        {features.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.08 }}
            className="flex flex-col items-center gap-1"
          >
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
              <f.icon className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">{f.label}</span>
          </motion.div>
        ))}
      </motion.div>
      <motion.div {...slideUp(0.5)}>
        <Link to="/signup">
          <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white gap-2 text-sm px-6">
            Start Free Trial
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </motion.div>
  );
}

/* ── Scene router ─────────────────────────────────────── */

function SceneContent({ id }: { id: SceneId }) {
  switch (id) {
    case "intro":
      return <IntroScene />;
    case "dashboard":
      return <DashboardScene />;
    case "pipeline":
      return <PipelineScene />;
    case "campaigns":
      return <CampaignsScene />;
    case "calling":
      return <CallingScene />;
    case "ai-insights":
      return <AIInsightsScene />;
    case "outro":
      return <OutroScene />;
  }
}

/* ── Main Component ───────────────────────────────────── */

export default function LandingDemo() {
  const [step, setStep] = useState(0);
  const sceneIndex = step % SCENES.length;
  const scene = SCENES[sceneIndex];

  const advance = useCallback(() => setStep((s) => s + 1), []);

  /* Auto-advance */
  useEffect(() => {
    const timer = setTimeout(advance, scene.duration);
    return () => clearTimeout(timer);
  }, [step, scene.duration, advance]);

  /* Progress fraction for current scene */
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / scene.duration, 1));
      if (elapsed < scene.duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, scene.duration]);

  return (
    <div className="w-full h-full max-h-[540px] flex flex-col bg-background text-foreground overflow-hidden rounded-2xl">
      {/* Content area */}
      <div className="flex-1 min-h-0 p-6 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="h-full"
          >
            <SceneContent id={scene.id} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar + dots */}
      <div className="px-6 pb-3 pt-1 flex flex-col gap-2">
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            key={step}
            className="h-full bg-teal-500 rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Scene dots */}
        <div className="flex items-center justify-center gap-2">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep((prev) => prev - (prev % SCENES.length) + i)}
              className="group flex items-center gap-1"
            >
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === sceneIndex ? "w-5 bg-teal-500" : "w-1.5 bg-muted-foreground/25 group-hover:bg-muted-foreground/50"
                }`}
              />
              {i === sceneIndex && (
                <span className="text-[11px] font-medium text-teal-600">{s.label}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
