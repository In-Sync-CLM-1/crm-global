import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Sparkles,
  Building2,
  Upload,
  MessageSquare,
  Users,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  X,
  Mail,
  Phone,
  Image,
  Contact,
  BarChart3,
  Target,
  Loader2,
  FileSpreadsheet,
  UserPlus,
} from "lucide-react";

// ── Types ──

type StepId = "welcome" | "profile" | "import" | "channels" | "invite" | "launch";

interface StepDef {
  id: StepId;
  label: string;
  icon: React.ElementType;
}

interface ManualContact {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
}

interface InviteEntry {
  email: string;
  role: string;
}

// ── Constants ──

const STEPS: StepDef[] = [
  { id: "welcome", label: "Welcome", icon: Sparkles },
  { id: "profile", label: "Profile", icon: Building2 },
  { id: "import", label: "Import", icon: Upload },
  { id: "channels", label: "Channels", icon: MessageSquare },
  { id: "invite", label: "Team", icon: Users },
  { id: "launch", label: "Launch", icon: Rocket },
];

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Education",
  "Real Estate",
  "E-Commerce",
  "Finance",
  "Manufacturing",
  "Consulting",
  "Media",
  "Other",
];

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "sales_agent", label: "Sales Agent" },
];

const EMPTY_CONTACT: ManualContact = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company: "",
};

const EMPTY_INVITE: InviteEntry = { email: "", role: "sales_agent" };

// ── Animation variants ──

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

// ── Component ──

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const notify = useNotification();
  const queryClient = useQueryClient();

  // Step navigation
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);

  // User & org data
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [initializing, setInitializing] = useState(true);

  // Step 1: Business Profile
  const [orgName, setOrgName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Import Contacts
  const [importMode, setImportMode] = useState<"none" | "csv" | "manual">("none");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([{ ...EMPTY_CONTACT }]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Channels
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelWhatsApp, setChannelWhatsApp] = useState(false);
  const [channelCalling, setChannelCalling] = useState(false);

  // Step 4: Invite Team
  const [invites, setInvites] = useState<InviteEntry[]>([{ ...EMPTY_INVITE }]);

  // Completion tracking
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    profile: false,
    import: false,
    channels: false,
    invite: false,
  });

  // ── Initialize: fetch user and org ──

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate("/login");
          return;
        }

        setUserId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profile) {
          setFirstName(profile.first_name || "");
          setOrgId(profile.org_id);

          // Pre-fill org data
          if (profile.org_id) {
            const { data: org } = await supabase
              .from("organizations")
              .select("*")
              .eq("id", profile.org_id)
              .single();

            if (org) {
              setOrgName(org.name || "");
              setWebsite(org.website || "");
              setIndustry(org.industry || "");
              if (org.logo_url) setLogoPreview(org.logo_url);
            }
          }
        }
      } catch (err) {
        console.error("Failed to initialize onboarding:", err);
        notify.error("Failed to load profile", err);
      } finally {
        setInitializing(false);
      }
    };

    init();
  }, []);

  // ── Navigation ──

  const handleNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const currentStepId = STEPS[step]?.id;

  // ── Logo handling ──

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify.error("File too large", "Logo must be under 5MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      notify.error("Invalid format", "Please upload a PNG, JPG, or WebP image.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify.error("File too large", "Logo must be under 5MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      notify.error("Invalid format", "Please upload a PNG, JPG, or WebP image.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !orgId) return logoPreview;
    setUploadingLogo(true);
    const ext = logoFile.name.split(".").pop() || "png";
    const path = `${orgId}/logo.${ext}`;
    const { error } = await supabase.storage.from("org-logos").upload(path, logoFile, { upsert: true });
    setUploadingLogo(false);
    if (error) {
      notify.error("Logo upload failed", error.message);
      return null;
    }
    const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
    return urlData.publicUrl;
  };

  // ── Save business profile ──

  const handleSaveProfile = async () => {
    if (!orgName.trim()) {
      notify.error("Validation", "Organization name is required.");
      return;
    }
    if (!orgId) return;

    setLoading(true);
    try {
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadLogo();
        if (!logoUrl) {
          setLoading(false);
          return;
        }
      }

      const updatePayload: Record<string, string | null> = {
        name: orgName.trim(),
      };
      if (website.trim()) updatePayload.website = website.trim();
      if (industry) updatePayload.industry = industry;
      if (logoUrl) updatePayload.logo_url = logoUrl;

      const { error } = await supabase
        .from("organizations")
        .update(updatePayload)
        .eq("id", orgId);

      if (error) throw error;

      setCompletedSteps((prev) => ({ ...prev, profile: true }));
      notify.success("Profile saved");
      handleNext();
    } catch (err: any) {
      notify.error("Error saving profile", err);
    }
    setLoading(false);
  };

  // ── CSV preview ──

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length > 0) {
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
        setCsvHeaders(headers);
        const rows = lines.slice(1, 4).map((line) =>
          line.split(",").map((cell) => cell.trim().replace(/"/g, ""))
        );
        setCsvPreviewRows(rows);
      }
    };
    reader.readAsText(file);
  };

  // ── Manual contacts ──

  const updateManualContact = (index: number, field: keyof ManualContact, value: string) => {
    setManualContacts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addManualContact = () => {
    if (manualContacts.length < 3) {
      setManualContacts((prev) => [...prev, { ...EMPTY_CONTACT }]);
    }
  };

  const removeManualContact = (index: number) => {
    if (manualContacts.length > 1) {
      setManualContacts((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleImportContinue = () => {
    if (importMode === "csv") {
      setCompletedSteps((prev) => ({ ...prev, import: true }));
      notify.info("Import contacts", "You can import contacts from the Contacts page.");
      handleNext();
    } else if (importMode === "manual") {
      const validContacts = manualContacts.filter(
        (c) => c.first_name.trim() || c.email.trim()
      );
      if (validContacts.length > 0) {
        setCompletedSteps((prev) => ({ ...prev, import: true }));
      }
      handleNext();
    } else {
      handleNext();
    }
  };

  // ── Channels ──

  const handleChannelsContinue = () => {
    setCompletedSteps((prev) => ({ ...prev, channels: true }));
    handleNext();
  };

  // ── Invite Team ──

  const updateInvite = (index: number, field: keyof InviteEntry, value: string) => {
    setInvites((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addInvite = () => {
    if (invites.length < 3) {
      setInvites((prev) => [...prev, { ...EMPTY_INVITE }]);
    }
  };

  const removeInvite = (index: number) => {
    if (invites.length > 1) {
      setInvites((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSendInvites = async () => {
    const validInvites = invites.filter((inv) => inv.email.trim());
    if (validInvites.length === 0) {
      handleNext();
      return;
    }

    if (!orgId || !userId) return;

    setLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const records = validInvites.map((inv) => ({
        org_id: orgId,
        email: inv.email.trim().toLowerCase(),
        role: inv.role,
        invited_by: userId,
        invite_code: crypto.randomUUID(),
        expires_at: expiresAt.toISOString(),
      }));

      const { error } = await supabase.from("org_invites").insert(records);
      if (error) throw error;

      setCompletedSteps((prev) => ({ ...prev, invite: true }));
      notify.success("Invitations sent!", `${validInvites.length} team member${validInvites.length > 1 ? "s" : ""} invited.`);
      handleNext();
    } catch (err: any) {
      notify.error("Failed to send invites", err);
    }
    setLoading(false);
  };

  // ── Complete onboarding ──

  const handleLaunchDashboard = async () => {
    setLoading(true);
    try {
      if (userId) {
        await supabase
          .from("profiles")
          .update({ onboarding_completed: true })
          .eq("id", userId);
      }

      // Fire confetti
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 100, spread: 100, origin: { y: 0.5 } }), 300);
      setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 } }), 600);

      notify.success("Welcome aboard!", "Your workspace is ready.");
      await queryClient.invalidateQueries({ queryKey: ["user-profile-onboarding"] });
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: any) {
      notify.error("Error", err);
      navigate("/dashboard");
    }
    setLoading(false);
  };

  // ── Loading state ──

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/5" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-3xl" />

      {/* Progress stepper */}
      <div className="relative z-10 mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isCompleted = i < step;
          const isCurrent = i === step;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                  animate={{ scale: isCurrent ? 1.15 : 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </motion.div>
                <span
                  className={`hidden text-[10px] font-medium sm:block ${
                    isCurrent
                      ? "text-primary"
                      : isCompleted
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-6 transition-colors sm:w-8 ${
                    isCompleted ? "bg-green-500" : "bg-muted"
                  } mb-5 sm:mb-5`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Main card */}
      <Card className="relative z-10 w-full max-w-2xl border-border shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">
            {currentStepId === "welcome" && "Welcome to In-Sync CRM!"}
            {currentStepId === "profile" && "Business Profile"}
            {currentStepId === "import" && "Bring Your Contacts"}
            {currentStepId === "channels" && "Set Up Your Channels"}
            {currentStepId === "invite" && "Invite Your Team"}
            {currentStepId === "launch" && "You're All Set!"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* ══════════════════════════════════════════════════
                  STEP 0: WELCOME
                 ══════════════════════════════════════════════════ */}
              {currentStepId === "welcome" && (
                <div className="space-y-6 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
                  >
                    <Sparkles className="h-8 w-8 text-primary" />
                  </motion.div>

                  {firstName && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-lg text-muted-foreground"
                    >
                      Hi, <span className="font-semibold text-foreground">{firstName}</span>!
                    </motion.p>
                  )}

                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm text-muted-foreground"
                  >
                    Let's set up your workspace in a few quick steps.
                  </motion.p>

                  {/* Feature cards grid */}
                  <motion.div
                    className="grid grid-cols-2 gap-3 pt-2"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {[
                      { icon: Contact, label: "Contacts", color: "text-blue-500", bg: "bg-blue-500/10" },
                      { icon: Target, label: "Pipeline", color: "text-green-500", bg: "bg-green-500/10" },
                      { icon: Mail, label: "Campaigns", color: "text-purple-500", bg: "bg-purple-500/10" },
                      { icon: BarChart3, label: "Reports", color: "text-orange-500", bg: "bg-orange-500/10" },
                    ].map((feat) => (
                      <motion.div
                        key={feat.label}
                        variants={staggerItem}
                        className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-4"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${feat.bg}`}>
                          <feat.icon className={`h-5 w-5 ${feat.color}`} />
                        </div>
                        <span className="text-sm font-medium">{feat.label}</span>
                      </motion.div>
                    ))}
                  </motion.div>

                  <div className="pt-4">
                    <Button onClick={handleNext} size="lg" className="gap-2 px-8">
                      Let's Go <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════
                  STEP 1: BUSINESS PROFILE
                 ══════════════════════════════════════════════════ */}
              {currentStepId === "profile" && (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground text-center">
                    Tell us about your organization to personalize your workspace.
                  </p>

                  {/* Logo upload */}
                  <div className="flex flex-col items-center gap-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleLogoDrop}
                      className="group relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/50 transition-colors hover:border-primary/50 hover:bg-muted overflow-hidden"
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <Image className="h-6 w-6" />
                          <span className="text-[10px]">Add Logo</span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleLogoSelect}
                    />
                    <p className="text-xs text-muted-foreground">PNG, JPG or WebP, max 5MB</p>
                  </div>

                  {/* Organization Name */}
                  <div className="space-y-2">
                    <Label>Organization Name *</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <Label>Website URL</Label>
                    <Input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                      type="url"
                    />
                  </div>

                  {/* Industry */}
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((ind) => (
                          <SelectItem key={ind} value={ind}>
                            {ind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={handleBack} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={loading || uploadingLogo} className="gap-2">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          Save & Continue <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════
                  STEP 2: IMPORT CONTACTS
                 ══════════════════════════════════════════════════ */}
              {currentStepId === "import" && (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground text-center">
                    Start building your contact database. Choose how you'd like to add contacts.
                  </p>

                  {importMode === "none" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* CSV Upload Card */}
                      <button
                        onClick={() => setImportMode("csv")}
                        className="group flex flex-col items-center gap-3 rounded-lg border-2 border-muted p-6 text-center transition-all hover:border-primary hover:bg-primary/5"
                      >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
                          <FileSpreadsheet className="h-7 w-7" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Upload CSV</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Import contacts from a spreadsheet file
                          </p>
                        </div>
                      </button>

                      {/* Manual Add Card */}
                      <button
                        onClick={() => setImportMode("manual")}
                        className="group flex flex-col items-center gap-3 rounded-lg border-2 border-muted p-6 text-center transition-all hover:border-primary hover:bg-primary/5"
                      >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-green-500 transition-transform group-hover:scale-110">
                          <UserPlus className="h-7 w-7" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Add Manually</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Quickly add a few contacts by hand
                          </p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* CSV Mode */}
                  {importMode === "csv" && (
                    <div className="space-y-4">
                      <div
                        onClick={() => csvInputRef.current?.click()}
                        className="cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
                      >
                        {csvFile ? (
                          <div className="space-y-1">
                            <FileSpreadsheet className="mx-auto h-8 w-8 text-green-500" />
                            <p className="text-sm font-medium">{csvFile.name}</p>
                            <p className="text-xs text-muted-foreground">Click to choose a different file</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="text-sm font-medium">Click to upload a CSV file</p>
                            <p className="text-xs text-muted-foreground">Supports .csv files</p>
                          </div>
                        )}
                      </div>
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleCsvSelect}
                      />

                      {/* CSV Preview */}
                      {csvHeaders.length > 0 && csvPreviewRows.length > 0 && (
                        <div className="rounded-lg border border-border overflow-hidden">
                          <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                            Preview (first {csvPreviewRows.length} rows)
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border bg-muted/30">
                                  {csvHeaders.map((h, i) => (
                                    <th key={i} className="px-3 py-2 text-left font-medium">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {csvPreviewRows.map((row, ri) => (
                                  <tr key={ri} className="border-b border-border/50 last:border-0">
                                    {row.map((cell, ci) => (
                                      <td key={ci} className="px-3 py-2 text-muted-foreground">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setImportMode("none");
                          setCsvFile(null);
                          setCsvHeaders([]);
                          setCsvPreviewRows([]);
                        }}
                        className="text-xs text-muted-foreground"
                      >
                        Choose a different method
                      </Button>
                    </div>
                  )}

                  {/* Manual Mode */}
                  {importMode === "manual" && (
                    <div className="space-y-4">
                      {manualContacts.map((contact, index) => (
                        <div key={index} className="space-y-3 rounded-lg border border-border p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              Contact {index + 1}
                            </span>
                            {manualContacts.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeManualContact(index)}
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="First name"
                              value={contact.first_name}
                              onChange={(e) => updateManualContact(index, "first_name", e.target.value)}
                            />
                            <Input
                              placeholder="Last name"
                              value={contact.last_name}
                              onChange={(e) => updateManualContact(index, "last_name", e.target.value)}
                            />
                          </div>
                          <Input
                            placeholder="Email"
                            type="email"
                            value={contact.email}
                            onChange={(e) => updateManualContact(index, "email", e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Phone"
                              value={contact.phone}
                              onChange={(e) => updateManualContact(index, "phone", e.target.value)}
                            />
                            <Input
                              placeholder="Company"
                              value={contact.company}
                              onChange={(e) => updateManualContact(index, "company", e.target.value)}
                            />
                          </div>
                        </div>
                      ))}

                      {manualContacts.length < 3 && (
                        <Button variant="outline" size="sm" onClick={addManualContact} className="gap-2">
                          <Plus className="h-3 w-3" /> Add another contact
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setImportMode("none");
                          setManualContacts([{ ...EMPTY_CONTACT }]);
                        }}
                        className="text-xs text-muted-foreground"
                      >
                        Choose a different method
                      </Button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={handleBack} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <div className="flex gap-2">
                      {importMode === "none" && (
                        <Button variant="ghost" onClick={handleNext} className="text-muted-foreground">
                          Skip for now
                        </Button>
                      )}
                      {importMode !== "none" && (
                        <Button onClick={handleImportContinue} className="gap-2">
                          Continue <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════
                  STEP 3: COMMUNICATION CHANNELS
                 ══════════════════════════════════════════════════ */}
              {currentStepId === "channels" && (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground text-center">
                    Choose which communication channels you'd like to use. You can always configure these later in Settings.
                  </p>

                  <div className="space-y-3">
                    {/* Email Channel */}
                    <div
                      className={`flex items-center justify-between rounded-lg border-2 p-4 transition-colors ${
                        channelEmail ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            channelEmail ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Mail className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">Email</h4>
                          <p className="text-xs text-muted-foreground">Send bulk email campaigns</p>
                        </div>
                      </div>
                      <Switch checked={channelEmail} onCheckedChange={setChannelEmail} />
                    </div>

                    {/* WhatsApp Channel */}
                    <div
                      className={`flex items-center justify-between rounded-lg border-2 p-4 transition-colors ${
                        channelWhatsApp ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            channelWhatsApp ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">WhatsApp</h4>
                          <p className="text-xs text-muted-foreground">Reach customers on WhatsApp</p>
                        </div>
                      </div>
                      <Switch checked={channelWhatsApp} onCheckedChange={setChannelWhatsApp} />
                    </div>

                    {/* Calling Channel */}
                    <div
                      className={`flex items-center justify-between rounded-lg border-2 p-4 transition-colors ${
                        channelCalling ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            channelCalling ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Phone className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">Calling</h4>
                          <p className="text-xs text-muted-foreground">Integrated cloud calling</p>
                        </div>
                      </div>
                      <Switch checked={channelCalling} onCheckedChange={setChannelCalling} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={handleBack} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleChannelsContinue} className="gap-2">
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════
                  STEP 4: INVITE TEAM
                 ══════════════════════════════════════════════════ */}
              {currentStepId === "invite" && (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground text-center">
                    Collaborate with your team. Invite up to 3 members to get started.
                  </p>

                  <div className="space-y-3">
                    {invites.map((inv, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="colleague@company.com"
                          type="email"
                          value={inv.email}
                          onChange={(e) => updateInvite(index, "email", e.target.value)}
                          className="flex-1"
                        />
                        <Select value={inv.role} onValueChange={(val) => updateInvite(index, "role", val)}>
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {invites.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInvite(index)}
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {invites.length < 3 && (
                    <Button variant="outline" size="sm" onClick={addInvite} className="gap-2">
                      <Plus className="h-3 w-3" /> Add another
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Invitations will be saved. Team members can sign up using the invite link.
                  </p>

                  {/* Actions */}
                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={handleBack} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={handleNext} className="text-muted-foreground">
                        Skip for now
                      </Button>
                      <Button onClick={handleSendInvites} disabled={loading} className="gap-2">
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                          </>
                        ) : (
                          <>
                            Invite & Continue <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════
                  STEP 5: LAUNCH
                 ══════════════════════════════════════════════════ */}
              {currentStepId === "launch" && (
                <div className="space-y-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
                  >
                    <Rocket className="h-10 w-10 text-primary" />
                  </motion.div>

                  <div>
                    <h3 className="text-lg font-bold">You're all set!</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your workspace is configured and ready to go.
                    </p>
                  </div>

                  {/* Completion checklist */}
                  <div className="mx-auto max-w-xs space-y-2 text-left">
                    {[
                      { label: "Organization created", done: true },
                      { label: "Profile configured", done: completedSteps.profile },
                      { label: "Contacts imported", done: completedSteps.import },
                      { label: "Channels configured", done: completedSteps.channels },
                      { label: "Team invited", done: completedSteps.invite },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            item.done
                              ? "bg-green-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.done ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <span className="text-[10px]">--</span>
                          )}
                        </div>
                        <span
                          className={`text-sm ${
                            item.done ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {item.label}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="outline" onClick={handleBack} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleLaunchDashboard} disabled={loading} size="lg" className="gap-2">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Launching...
                        </>
                      ) : (
                        <>
                          Launch Dashboard <Rocket className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
