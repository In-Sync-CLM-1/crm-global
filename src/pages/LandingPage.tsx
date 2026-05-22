import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import logo from "@/assets/logo.png";
import {
  Users,
  Kanban,
  Mail,
  MessageSquare,
  Phone,
  Brain,
  CalendarDays,
  BarChart3,
  UserPlus,
  Upload,
  Send,
  Target,
  ArrowRight,
  CheckCircle,
  Check,
  Sparkles,
  Play,
  Zap,
  Clock,
  CreditCard,
  Building2,
  ExternalLink,
  Shield,
} from "lucide-react";

/* ── data ─────────────────────────────────────────────── */

const features = [
  {
    icon: Users,
    title: "Contact Management",
    description:
      "Never lose track of a lead. Organize thousands of contacts with smart filters, tags, and one-click bulk actions.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-500",
  },
  {
    icon: Kanban,
    title: "Sales Pipeline",
    description:
      "See every deal at a glance. Drag-and-drop Kanban boards that show you exactly where your revenue stands.",
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-500",
  },
  {
    icon: Mail,
    title: "Email Campaigns",
    description:
      "Send 10,000 emails in minutes via our dedicated email platform. Beautiful templates, A/B testing, and real-time open tracking.",
    gradient: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-500",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Campaigns",
    description:
      "Reach customers where they actually read messages. 90%+ open rates via our dedicated WhatsApp platform.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-500",
  },
  {
    icon: Phone,
    title: "Calling System",
    description:
      "Auto-dial, record, and log every call. Your reps spend time selling, not switching between apps.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-500",
  },
  {
    icon: Brain,
    title: "AI Insights",
    description:
      "AI tells you which leads to call first, which campaigns to pause, and where your pipeline is stuck.",
    gradient: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-500",
  },
  {
    icon: CalendarDays,
    title: "Calendar & Follow-ups",
    description:
      "No follow-up falls through the cracks. Shared calendars and automated reminders keep your team in sync.",
    gradient: "from-sky-500/20 to-blue-500/20",
    iconColor: "text-sky-500",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description:
      "Know what's working in seconds. Drag-and-drop report builder with the metrics that matter to your business.",
    gradient: "from-teal-500/20 to-cyan-500/20",
    iconColor: "text-teal-500",
  },
];

const steps = [
  {
    icon: UserPlus,
    title: "Sign Up",
    description: "Create your workspace and invite your team. Takes 30 seconds, not 30 days.",
  },
  {
    icon: Upload,
    title: "Import Contacts",
    description: "Drop a CSV or connect your existing tools. We handle the rest automatically.",
  },
  {
    icon: Send,
    title: "Launch Campaigns",
    description: "Hit send on email, WhatsApp, and call campaigns to thousands at once.",
  },
  {
    icon: Target,
    title: "Close Deals",
    description: "Watch your pipeline fill up, track every deal, and grow revenue on autopilot.",
  },
];

const stats = [
  { value: 25, suffix: "+", label: "Organizations Live" },
  { value: 50, suffix: "K+", label: "Contacts Managed" },
  { value: 99.9, suffix: "%", label: "Uptime" },
  { value: 8, suffix: "+", label: "Industries Served" },
];

const pricingPlans = [
  {
    name: "14-Day Trial",
    price: "Free",
    period: "",
    billing: "",
    description: "Full access to every feature. No credit card required.",
    features: [
      "Unlimited users for 14 days",
      "All campaign channels",
      "AI insights & lead scoring",
      "Built-in calling",
      "Custom reports & dashboards",
    ],
    cta: "Start 14-Day Trial",
    ctaLink: "/signup",
    popular: false,
    footnote: "",
  },
  {
    name: "Professional",
    price: "\u20B9799",
    period: "/user/mo",
    billing: "Billed quarterly",
    description: "Everything your sales team needs to close more deals.",
    features: [
      "Unlimited contacts",
      "Pipeline management & forecasting",
      "WhatsApp & email campaigns",
      "Built-in calling with auto-dial",
      "AI lead scoring & insights",
      "Custom reports & dashboards",
      "Calendar & follow-up reminders",
    ],
    cta: "Start 14-Day Trial",
    ctaLink: "/signup",
    popular: true,
    footnote: "WhatsApp messages: \u20B90.20/msg, min recharge \u20B9500. Fallback to email included.",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    billing: "",
    description: "For large teams with custom integration needs.",
    features: [
      "Everything in Professional",
      "Dedicated account manager",
      "Custom integrations & API access",
      "SSO & advanced security",
      "SLA guarantee",
      "Volume WhatsApp pricing",
    ],
    cta: "Contact Sales",
    ctaLink: "/signup",
    popular: false,
    footnote: "",
  },
];

/* ── animation helpers ────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Animated counter ─────────────────────────────────── */

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const increment = value / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(
          value % 1 !== 0 ? parseFloat(start.toFixed(1)) : Math.floor(start)
        );
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

/* ── Floating particles for hero ──────────────────────── */

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-primary/10"
          style={{
            width: 6 + i * 10,
            height: 6 + i * 10,
            left: `${10 + i * 11}%`,
            top: `${15 + (i % 4) * 20}%`,
          }}
          animate={{
            y: [0, -25, 0],
            x: [0, 12 * (i % 2 === 0 ? 1 : -1), 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 4 + i * 0.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.4,
          }}
        />
      ))}
    </div>
  );
}

/* ── Scroll-to helper ─────────────────────────────────── */

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

/* ── Main component ───────────────────────────────────── */

export default function LandingPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Already signed in → jump straight to the app so the back button doesn't
  // strand authenticated users on the marketing page (which looks like being logged out).
  // Render nothing while auth is resolving to prevent a flash of the marketing page.
  if (authLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative min-h-screen bg-background">
      {/* ── Global subtle background ─────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {/* Warm gradient wash */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,_hsl(var(--primary)/0.06),_transparent)]" />
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.12) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>
      {/* ── Sticky Header ──────────────────────────── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`sticky top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-border/50 bg-background/90 backdrop-blur-xl shadow-sm"
            : "border-transparent bg-slate-900/80 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="In-Sync CRM" className="h-[54px] w-[54px] rounded-xl" />
            <span className={`text-lg font-bold tracking-tight transition-colors ${scrolled ? "text-foreground" : "text-white"}`}>
              In-Sync CRM
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Button
              variant="ghost"
              className={`text-sm ${scrolled ? "" : "text-slate-200 hover:text-white hover:bg-white/10"}`}
              onClick={() => scrollToId("features")}
            >
              Features
            </Button>
            <Button
              variant="ghost"
              className={`text-sm ${scrolled ? "" : "text-slate-200 hover:text-white hover:bg-white/10"}`}
              onClick={() => scrollToId("how-it-works")}
            >
              How It Works
            </Button>
            <Button
              variant="ghost"
              className={`text-sm ${scrolled ? "" : "text-slate-200 hover:text-white hover:bg-white/10"}`}
              onClick={() => scrollToId("pricing")}
            >
              Pricing
            </Button>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="outline" className={scrolled ? "" : "border-white/30 text-white bg-white/10 hover:bg-white/20 hover:text-white"} asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild className="shadow-lg shadow-teal-500/25 bg-teal-500 hover:bg-teal-600 text-white">
              <Link to="/signup">
                Start Trial
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </motion.header>

      {/* ── Hero Section ───────────────────────────── */}
      <section ref={heroRef} className="relative z-0 overflow-hidden bg-slate-900">
        {/* Grid lines */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        {/* Small dot accents at intersections */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-[18%] left-[22%] h-2 w-2 rounded-full bg-teal-400/40" />
          <div className="absolute top-[35%] right-[20%] h-1.5 w-1.5 rounded-full bg-violet-400/35" />
          <div className="absolute bottom-[25%] left-[35%] h-2.5 w-2.5 rounded-full bg-teal-400/30" />
          <div className="absolute top-[55%] right-[30%] h-2 w-2 rounded-full bg-white/20" />
          <div className="absolute bottom-[40%] right-[12%] h-1.5 w-1.5 rounded-full bg-teal-400/25" />
        </div>
        {/* Glow accents — stronger */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/25 blur-[130px]" />
          <div className="absolute bottom-0 right-1/4 h-[450px] w-[450px] rounded-full bg-violet-500/15 blur-[120px]" />
          <div className="absolute top-1/3 left-1/2 h-[350px] w-[350px] -translate-x-1/2 rounded-full bg-teal-400/10 blur-[100px]" />
        </div>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-28 lg:pt-36"
        >
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-5 py-2 text-sm font-medium text-teal-300 backdrop-blur-sm"
            >
              <CreditCard className="h-3.5 w-3.5" />
              14-day full-access trial &bull; No credit card
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl"
            >
              Stop losing deals.{" "}
              <br className="hidden sm:block" />
              Start{" "}
              <span className="relative">
                <span className="text-teal-400">
                  closing
                </span>
                <motion.span
                  className="absolute -bottom-2 left-0 h-1 rounded-full bg-teal-400"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                />
              </span>{" "}
              them.
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl"
            >
              Pipeline, campaigns, calling, and AI lead scoring &mdash;
              built for sales teams that need every lead tracked and
              every deal closed.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button
                size="lg"
                className="group relative overflow-hidden text-base px-8 shadow-xl shadow-teal-500/25 transition-shadow hover:shadow-2xl hover:shadow-teal-500/30 bg-teal-500 hover:bg-teal-600 text-white"
                asChild
              >
                <Link to="/signup">
                  Start 14-Day Trial
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="group text-base px-8 border-white/30 text-white bg-white/10 hover:bg-white/20 hover:text-white backdrop-blur-sm"
                asChild
              >
                <Link to="/demo">
                  <Play className="mr-2 h-4 w-4" />
                  Watch Demo
                </Link>
              </Button>
            </motion.div>

            {/* Trust signals */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400"
            >
              {[
                "14-day full-access trial",
                "Setup in 2 minutes",
                "No credit card required",
              ].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-teal-400" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* ── Product Demo Embed ─────────────────────── */}
        <motion.div
          id="demo"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6 sm:pb-28"
        >
          <div className="relative rounded-2xl border border-border/60 bg-black shadow-2xl shadow-primary/10 overflow-hidden">
            {/* Browser-style top bar */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-black/80 px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <div className="ml-3 flex-1 rounded-md bg-white/10 px-3 py-1 text-[11px] text-white/40">
                app.insynccrm.com/dashboard
              </div>
            </div>
            <iframe
              src="/landing-demo"
              title="In-Sync CRM Product Demo"
              className="w-full border-0"
              style={{ height: "min(70vh, 540px)" }}
              loading="eager"
            />
          </div>
        </motion.div>
      </section>

      {/* ── Client Logos Marquee ─────────────────── */}
      <section className="relative z-10 border-t border-border/50 bg-muted/40 py-14 sm:py-16">
        <AnimatedSection className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.p
            variants={fadeUp}
            className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Trusted by NBFCs, DSA networks, and sales teams across India
          </motion.p>
        </AnimatedSection>

        <div className="space-y-5 overflow-hidden">
          {[0, 1].map((row) => {
            const allLogos = [
              { src: "/logos/quess.png", alt: "Quess Corp" },
              { src: "/logos/motherson.jpg", alt: "Motherson" },
              { src: "/logos/hiranandani.png", alt: "Hiranandani" },
              { src: "/logos/audi.png", alt: "Audi" },
              { src: "/logos/college-dekho.jpg", alt: "College Dekho" },
              { src: "/logos/zolve.webp", alt: "Zolve" },
              { src: "/logos/capital-india.webp", alt: "Capital India" },
              { src: "/logos/ecofy.png", alt: "Ecofy" },
              { src: "/logos/zopper.png", alt: "Zopper" },
              { src: "/logos/alice-blue.png", alt: "Alice Blue" },
              { src: "/logos/ezeepay.png", alt: "Ezeepay" },
              { src: "/logos/incred.png", alt: "InCred" },
              { src: "/logos/seeds.png", alt: "Seeds" },
              { src: "/logos/growthvine.png", alt: "GrowthVine" },
              { src: "/logos/uhc.png", alt: "UHC" },
              { src: "/logos/car-trends.webp", alt: "Car Trends" },
              { src: "/logos/legitquest.png", alt: "LegitQuest" },
              { src: "/logos/evco.jpg", alt: "EV Co" },
              { src: "/logos/bluspring.png", alt: "BluSpring" },
              { src: "/logos/cubit.jpeg", alt: "Cubit" },
              { src: "/logos/smb-connect.jpg", alt: "SMB Connect" },
              { src: "/logos/rb.jpg", alt: "RB" },
              { src: "/logos/paisaasaarthi.jpeg", alt: "PaisaaSaarthi" },
              { src: "/logos/rmpl.png", alt: "RMPL" },
            ];
            const half = Math.ceil(allLogos.length / 2);
            const rowLogos = row === 0 ? allLogos.slice(0, half) : allLogos.slice(half);
            const doubled = [...rowLogos, ...rowLogos];
            return (
              <div key={row} className="relative flex overflow-hidden">
                <div
                  className={`flex shrink-0 items-center gap-8 ${
                    row === 0 ? "animate-marquee" : "animate-marquee-reverse"
                  }`}
                >
                  {doubled.map((logo, i) => (
                    <div
                      key={`${row}-${i}`}
                      className="flex h-14 w-32 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background/80 px-4 py-2 grayscale opacity-50 transition-all duration-300 hover:border-border hover:opacity-100 hover:grayscale-0 hover:shadow-md"
                    >
                      <img
                        src={logo.src}
                        alt={logo.alt}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Feature Cards ──────────────────────────── */}
      <section
        id="features"
        className="relative z-10 overflow-hidden border-t border-border/50"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/[0.03] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Zap className="h-3.5 w-3.5" />
              Features
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              One platform.{" "}
              <span className="text-primary">Every tool you need.</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-5 text-lg text-muted-foreground"
            >
              Replace your spreadsheets, disconnected apps, and guesswork with
              a single platform that does it all.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-7 backdrop-blur-sm transition-colors hover:border-primary/30"
              >
                {/* Gradient hover glow */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />

                <div className="relative">
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} ring-1 ring-border/50`}
                  >
                    <f.icon className={`h-6 w-6 ${f.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────── */}
      <section
        id="how-it-works"
        className="relative z-10 border-t border-border/50 bg-muted/50"
      >
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Clock className="h-3.5 w-3.5" />
              How It Works
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Up and running in{" "}
              <span className="text-primary">minutes</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-5 text-lg text-muted-foreground"
            >
              Four simple steps from sign-up to closing deals
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="relative mt-20">
            {/* Connecting line - horizontal on desktop */}
            <div className="pointer-events-none absolute top-14 left-[12%] right-[12%] hidden h-px border-t-2 border-dashed border-border lg:block" />

            {/* Connecting line - vertical on mobile */}
            <div className="pointer-events-none absolute top-0 bottom-0 left-[39px] w-px border-l-2 border-dashed border-border sm:left-1/2 sm:-translate-x-px lg:hidden" />

            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  variants={fadeUp}
                  className="relative pl-20 text-left sm:pl-0 sm:text-center"
                >
                  {/* Step number ring */}
                  <div className="absolute left-0 top-0 sm:relative sm:left-auto sm:top-auto sm:mx-auto mb-6 flex h-28 w-28 items-center justify-center max-sm:h-20 max-sm:w-20">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20" />
                    <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25">
                      {i + 1}
                    </div>
                    <step.icon className="h-8 w-8 text-primary sm:h-10 sm:w-10" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mx-auto mt-2 max-w-[240px] text-sm leading-relaxed text-muted-foreground max-sm:mx-0">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Stats Section ──────────────────────────── */}
      <section className="relative z-10 border-t border-border/50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center mb-16">
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Built for{" "}
              <span className="text-primary">NBFCs, DSAs & financial services</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-4 text-lg text-muted-foreground"
            >
              Trusted by lending companies, DSA networks, real estate firms, and sales teams across India
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
            {stats.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className="group rounded-2xl border border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <p className="text-4xl font-extrabold text-primary sm:text-5xl">
                  <Counter value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  {s.label}
                </p>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── AI Edge Section ─────────────────────────── */}
      <section className="relative z-10 border-t border-white/10 overflow-hidden bg-slate-900">
        {/* Accent glow behind the section */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/15 blur-[140px]" />
          <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-teal-500/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          {/* Header with team image */}
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <AnimatedSection>
              <motion.div
                variants={fadeUp}
                className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-400/15 px-4 py-1.5 text-sm font-medium text-violet-300"
              >
                <Brain className="h-3.5 w-3.5" />
                AI-Powered
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-3xl font-bold tracking-tight text-white sm:text-5xl"
              >
                Your unfair advantage:{" "}
                <span className="text-violet-400">built-in AI</span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="mt-5 text-lg text-slate-300"
              >
                While others guess, you act on data. AI runs in the background
                across every feature &mdash; scoring leads, writing copy, and
                predicting outcomes.
              </motion.p>
            </AnimatedSection>

            <AnimatedSection className="hidden lg:block">
              <motion.div
                variants={fadeUp}
                className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50 shadow-2xl p-6"
              >
                {/* Live AI dashboard preview */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="h-5 w-5 text-violet-400" />
                    <span className="text-sm font-semibold text-white">AI Dashboard</span>
                    <span className="ml-auto text-[11px] text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5">Live</span>
                  </div>
                  {/* Lead scores */}
                  {[
                    { name: "Capital India Finance", score: 94, color: "bg-emerald-500" },
                    { name: "PaisaSaarthi NBFC", score: 82, color: "bg-teal-500" },
                    { name: "SKYRISE Credit Ltd", score: 67, color: "bg-amber-500" },
                    { name: "BluSpring Lending", score: 43, color: "bg-red-400" },
                  ].map((lead) => (
                    <div key={lead.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">{lead.name}</span>
                        <span className="font-bold text-white">{lead.score}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${lead.color}`}
                          initial={{ width: "0%" }}
                          whileInView={{ width: `${lead.score}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: 0.3 }}
                        />
                      </div>
                    </div>
                  ))}
                  {/* AI recommendation */}
                  <div className="mt-4 rounded-lg border border-violet-400/20 bg-violet-400/[0.06] p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Capital India Finance opened 4 emails this week and viewed pricing twice.
                        Recommend scheduling a call with the CFO before end of day.
                      </p>
                    </div>
                  </div>
                  {/* Auto actions */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: "Leads Scored", value: "342" },
                      { label: "Follow-ups Queued", value: "28" },
                      { label: "Insights Today", value: "15" },
                    ].map((a) => (
                      <div key={a.label} className="rounded-lg bg-white/5 p-2 text-center">
                        <p className="text-sm font-bold text-white">{a.value}</p>
                        <p className="text-[10px] text-slate-400">{a.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatedSection>
          </div>

          <AnimatedSection className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Target,
                title: "Smart Lead Scoring",
                description:
                  "AI ranks every lead by conversion likelihood so your reps always call the hottest prospects first.",
                stat: "92%",
                statLabel: "prediction accuracy",
                color: "bg-emerald-400/15 text-emerald-400",
                border: "border-emerald-400/20",
              },
              {
                icon: BarChart3,
                title: "Campaign Optimizer",
                description:
                  "Automatically A/B tests subject lines, predicts open rates, and tells you when to pause underperformers.",
                stat: "2.4x",
                statLabel: "higher engagement",
                color: "bg-blue-400/15 text-blue-400",
                border: "border-blue-400/20",
              },
              {
                icon: Brain,
                title: "Pipeline Forecasting",
                description:
                  "AI analyzes deal velocity, rep activity, and historical patterns to predict your quarterly revenue.",
                stat: "±5%",
                statLabel: "forecast accuracy",
                color: "bg-violet-400/15 text-violet-400",
                border: "border-violet-400/20",
              },
            ].map((ai) => (
              <motion.div
                key={ai.title}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`group relative overflow-hidden rounded-2xl border ${ai.border} bg-white/5 p-7 backdrop-blur-sm`}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${ai.color}`}
                  >
                    <ai.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {ai.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">
                  {ai.description}
                </p>
                <div className="mt-5 flex items-baseline gap-2 border-t border-white/10 pt-4">
                  <span className="text-2xl font-extrabold text-white">
                    {ai.stat}
                  </span>
                  <span className="text-sm text-slate-400">
                    {ai.statLabel}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatedSection>

          {/* AI quote / social proof */}
          <AnimatedSection className="mt-12">
            <motion.div
              variants={fadeUp}
              className="mx-auto max-w-3xl rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] px-8 py-6 text-center backdrop-blur-sm"
            >
              <p className="text-base italic leading-relaxed text-slate-200">
                &ldquo;The AI told us to focus on 12 specific leads last
                quarter. We closed 9 of them. That&rsquo;s a pipeline we
                never would have prioritized on gut feel alone.&rdquo;
              </p>
              <p className="mt-3 text-sm font-medium text-slate-400">
                &mdash; Sales Director, Series B SaaS Company
              </p>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Case Study Section ─────────────────────── */}
      <section className="relative z-10 border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Building2 className="h-3.5 w-3.5" />
              Case Study
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              We run our own business{" "}
              <span className="text-primary">on this</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-5 text-lg text-muted-foreground"
            >
              ECR Technical Innovations runs its entire sales operation on In-Sync CRM.
              Not a demo — our real business, our real numbers.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="mt-16">
            <motion.div
              variants={fadeUp}
              className="mx-auto max-w-4xl rounded-2xl border border-border/60 bg-card/80 p-8 sm:p-10 backdrop-blur-sm"
            >
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {[
                  { value: "10K+", label: "Leads Managed", icon: Users },
                  { value: "500+", label: "Deals Closed", icon: Target },
                  { value: "25+", label: "Active Clients", icon: Building2 },
                  { value: "100%", label: "On In-Sync", icon: Shield },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <s.icon className="h-5 w-5 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-extrabold text-foreground">{s.value}</p>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  <strong className="text-foreground">Pipeline to closure, all tracked.</strong>{" "}
                  Every lead from Redefine Marcom, PaisaSaarthi, Capital India, and SKYRISE Credit
                  is managed through In-Sync — from first contact through deal closure
                  and client conversion.
                </p>
                <p>
                  <strong className="text-foreground">Real clients, real modules.</strong>{" "}
                  Contacts, Pipeline, Calling, WhatsApp Campaigns, Email Broadcasts,
                  and AI Lead Scoring — all live in production. Every feature you see
                  on this page is one we use daily.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live clients:</span>
                {[
                  { src: "/logos/capital-india.webp", alt: "Capital India" },
                  { src: "/logos/paisaasaarthi.jpeg", alt: "PaisaSaarthi" },
                  { src: "/logos/bluspring.png", alt: "BluSpring" },
                  { src: "/logos/rmpl.png", alt: "RMPL" },
                ].map((c) => (
                  <img
                    key={c.alt}
                    src={c.src}
                    alt={c.alt}
                    className="h-8 w-auto object-contain opacity-70 grayscale transition-all hover:opacity-100 hover:grayscale-0"
                  />
                ))}
              </div>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Pricing Section ────────────────────────── */}
      <section
        id="pricing"
        className="relative z-10 border-t border-border/50 bg-muted/50"
      >
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Pricing
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Simple, transparent{" "}
              <span className="text-primary">pricing</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-5 text-lg text-muted-foreground"
            >
              Start with a 14-day full-access trial. No credit card required.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`relative ${plan.popular ? "lg:scale-105" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <Card
                  className={`relative flex h-full flex-col overflow-hidden ${
                    plan.popular
                      ? "ring-2 ring-primary shadow-xl shadow-primary/10"
                      : ""
                  }`}
                >
                  <CardHeader className="p-6 pb-0">
                    <CardTitle className="text-xl font-bold">
                      {plan.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                    <div className="mt-5">
                      <span className="text-4xl font-extrabold text-foreground">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-sm text-muted-foreground">
                          {plan.period}
                        </span>
                      )}
                    </div>
                    {plan.billing && (
                      <p className="mt-1.5 text-xs font-medium text-primary">
                        {plan.billing}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 p-6">
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 text-sm text-muted-foreground"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {plan.footnote && (
                      <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                        {plan.footnote}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Button
                      className="w-full shadow-lg shadow-primary/20"
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                      asChild
                    >
                      <Link to={plan.ctaLink}>
                        {plan.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────── */}
      <section className="relative z-10 border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection>
            <motion.div
              variants={fadeUp}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-emerald-600 px-6 py-20 text-center sm:px-16"
            >
              {/* Decorative blurred circles */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-2xl" />
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                    backgroundSize: "40px 40px",
                  }}
                />
              </div>

              <div className="relative">
                <h2 className="text-3xl font-bold text-primary-foreground sm:text-5xl">
                  One platform. Your pipeline, campaigns,
                  <br className="hidden sm:block" />
                  calls, and AI &mdash; all in sync.
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg text-primary-foreground/80">
                  Built-in calling, WhatsApp campaigns, AI lead scoring, and
                  smart automation. Everything your sales team needs &mdash; set
                  up in 2 minutes.
                </p>
                <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="group text-base px-8 shadow-xl bg-white text-primary hover:bg-white/90"
                    asChild
                  >
                    <Link to="/signup">
                      Start 14-Day Trial
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-base px-8 border-white/30 text-primary-foreground bg-transparent hover:bg-white/10 hover:text-primary-foreground"
                    asChild
                  >
                    <Link to="/signup">Talk to Sales</Link>
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/70">
                  {[
                    "14-day full-access trial",
                    "No credit card required",
                    "Cancel anytime",
                  ].map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" /> {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border/50 bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img
                src={logo}
                alt="In-Sync CRM"
                className="h-7 w-7 rounded-lg"
              />
              <span className="font-semibold text-foreground">
                In-Sync CRM
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="transition-colors hover:text-foreground"
              >
                Terms of Service
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} In-Sync. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
