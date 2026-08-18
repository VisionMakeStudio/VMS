import { useEffect, useMemo, useRef, useState } from "react";
import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login as identityLogin,
  logout as identityLogout,
  requestPasswordRecovery,
  updateUser,
} from "@netlify/identity";
import {
  ArrowRight,
  Browser,
  CaretDown,
  Check,
  CheckCircle,
  EnvelopeSimple,
  FileText,
  GearSix,
  LinkSimple,
  List,
  MagnifyingGlass,
  MapPin,
  Monitor,
  PaperPlaneTilt,
  QrCode,
  RocketLaunch,
  ShieldCheck,
  Sparkle,
  Star,
  TrendUp,
  Wrench,
  X,
} from "@phosphor-icons/react";

const PHRASES = ["grow stronger.", "look better.", "work smarter."];
const CONTACT_EMAIL = "info@visionmakestudio.com";

const IMPROVEMENTS = [
  {
    id: "website",
    label: "Website",
    icon: Browser,
    score: 63,
    findingTitle: "Solid start—let’s turn more visitors into customers.",
    finding: "Your site looks good, but clearer messaging and stronger calls-to-action could drive more leads.",
    recommendation: "Tighten the mobile experience, clarify the next step, and make the first impression feel current.",
    service: "Website Revamp",
    related: ["Mobile polish", "Clearer calls to action", "Faster first impression"],
  },
  {
    id: "found",
    label: "Get Found",
    icon: MapPin,
    score: 72,
    findingTitle: "You’re visible—now let’s make every listing feel consistent.",
    finding: "People can find you, but your local presence is not yet telling one clear, consistent story.",
    recommendation: "Align the details customers see across search, maps, your website, and your shared links.",
    service: "Local Presence",
    related: ["Listing consistency", "Map-ready details", "Local discovery"],
  },
  {
    id: "reviews",
    label: "More Reviews",
    icon: Star,
    score: 81,
    findingTitle: "Strong trust signals—let’s make review growth more consistent.",
    finding: "You already have a strong foundation. The opportunity is making review requests easier and more regular.",
    recommendation: "Create a simple review path customers can reach by QR, LinkHub, or follow-up message.",
    service: "Review Growth",
    related: ["Simple review flow", "Smart QR access", "Trust signals"],
  },
  {
    id: "systems",
    label: "Simpler Systems",
    icon: GearSix,
    score: 42,
    findingTitle: "Too many moving pieces—let’s bring the experience together.",
    finding: "Customers have too many places to look, and routine updates are taking more effort than they should.",
    recommendation: "Bring your links, QR destinations, files, and customer actions into one manageable system.",
    service: "VMS LinkHub + Smart QR",
    related: ["One smart destination", "Editable QR links", "Fewer repeated tasks"],
  },
];

const SERVICES = [
  {
    title: "Website Revamp",
    kicker: "Look current",
    icon: Monitor,
    description: "Refresh the pages you already have so your business feels clearer, stronger, and easier to use on every screen.",
    details: ["Mobile-first cleanup", "Sharper messaging", "Conversion-focused page flow"],
  },
  {
    title: "Local Presence",
    kicker: "Get found",
    icon: MapPin,
    description: "Make the information customers see across your website, maps, and shared links feel consistent and dependable.",
    details: ["Local information review", "Search and map readiness", "Consistent business details"],
  },
  {
    title: "Review Growth",
    kicker: "Build trust",
    icon: TrendUp,
    description: "Give happy customers a direct, low-friction way to leave a review and help new customers feel confident.",
    details: ["Review-ready destinations", "QR and LinkHub connection", "Easy customer prompts"],
  },
  {
    title: "VMS Smart QR",
    kicker: "Stay flexible",
    icon: QrCode,
    description: "Use a QR code you can keep after printing, while changing where it leads as your business needs evolve.",
    details: ["Editable destination", "Scan visibility", "Campaign-ready links"],
  },
  {
    title: "VMS LinkHub",
    kicker: "Share one link",
    icon: LinkSimple,
    description: "Give customers one branded destination for your services, contact details, social links, directions, menu, and more.",
    details: ["Branded smart business card", "Optional business sections", "Client-managed updates"],
  },
  {
    title: "Website Care & Systems",
    kicker: "Work smarter",
    icon: Wrench,
    description: "Keep the practical pieces running with ongoing updates, organized files, and simple systems built around your workflow.",
    details: ["Ongoing website care", "Organized business assets", "Practical workflow support"],
  },
];

const PROCESS = [
  {
    number: "01",
    title: "Start with a Checkup",
    description: "We look at the customer-facing pieces of your business and identify what is helping, what is unclear, and what deserves attention first.",
    icon: MagnifyingGlass,
  },
  {
    number: "02",
    title: "Get a Clear Plan",
    description: "You receive focused findings and practical recommendations—without a long list of disconnected fixes.",
    icon: FileText,
  },
  {
    number: "03",
    title: "Build the Right Upgrade",
    description: "Choose the VMS services that fit your priorities, and we turn the plan into a cleaner, easier business experience.",
    icon: RocketLaunch,
  },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const isLocalPreview = () => (
  window.location.protocol === "file:"
  || ["localhost", "127.0.0.1", "terminal.local"].includes(window.location.hostname)
);

const hasAdminRole = (user) => {
  const roles = user?.roles || user?.appMetadata?.roles || [];
  return user?.role === "admin" || roles.includes("admin");
};

async function readApiError(response, fallback) {
  try {
    const data = await response.json();
    return data?.message || data?.error || fallback;
  } catch {
    return fallback;
  }
}

function AdminLogin() {
  const [mode, setMode] = useState("loading");
  const [inviteToken, setInviteToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const prepareLogin = async () => {
      try {
        const callback = await handleAuthCallback();
        if (!active) return;
        if (callback?.type === "invite" && callback.token) {
          setInviteToken(callback.token);
          setMode("set-password");
          return;
        }
        if (callback?.type === "recovery") {
          setMode("reset-password");
          return;
        }

        const currentUser = await getUser();
        if (!active) return;
        if (hasAdminRole(currentUser)) {
          window.location.replace("/admin/");
          return;
        }
        if (currentUser) await identityLogout();
        setMode("login");
      } catch (authError) {
        if (!active) return;
        setMode("login");
        if (isLocalPreview()) {
          setMessage("Admin authentication activates on the Netlify preview after Identity is enabled.");
        } else {
          setError(authError?.message || "The secure login service could not be reached.");
        }
      }
    };
    prepareLogin();
    return () => { active = false; };
  }, []);

  const clearNotices = () => {
    setMessage("");
    setError("");
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const user = await identityLogin(String(form.get("email") || "").trim(), String(form.get("password") || ""));
      if (!hasAdminRole(user)) {
        await identityLogout();
        throw new Error("This account does not have VMS Admin access.");
      }
      window.location.assign("/admin/");
    } catch (authError) {
      setError(isLocalPreview()
        ? "This preview is ready, but Admin login only becomes active after the Netlify site is connected and Identity is enabled."
        : (authError?.message || "Email or password was not accepted."));
    } finally {
      setBusy(false);
    }
  };

  const handleRecovery = async (event) => {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await requestPasswordRecovery(String(form.get("email") || "").trim());
      setMessage("Check your inbox for the secure password-reset link.");
    } catch (authError) {
      setError(isLocalPreview()
        ? "Password recovery activates after Netlify Identity is enabled."
        : (authError?.message || "We could not send the reset email."));
    } finally {
      setBusy(false);
    }
  };

  const handleSetPassword = async (event) => {
    event.preventDefault();
    clearNotices();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("passwordConfirmation") || "");
    if (password.length < 10 || password !== confirmation) {
      setBusy(false);
      setError(password.length < 10 ? "Use at least 10 characters." : "The passwords do not match.");
      return;
    }
    try {
      const user = mode === "set-password"
        ? await acceptInvite(inviteToken, password)
        : await updateUser({ password });
      if (!hasAdminRole(user)) {
        await identityLogout();
        throw new Error("Your account is active, but the Admin role still needs to be assigned in Netlify.");
      }
      window.location.assign("/admin/");
    } catch (authError) {
      setError(authError?.message || "The password could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login-page">
      <a className="admin-login-home" href="/" aria-label="Back to Vision Make Studio">
        <img src="/assets/vms-logo.png" alt="Vision Make Studio" />
      </a>
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <span className="modal-mark"><ShieldCheck size={30} weight="duotone" /></span>
        <p className="eyebrow">VMS secure access</p>
        <h1 id="admin-login-title">
          {mode === "forgot" ? "Reset your password." : mode.includes("password") ? "Create your secure password." : "VMS Admin sign in."}
        </h1>
        <p>
          {mode === "forgot"
            ? "Enter the owner email and we’ll send the official recovery link."
            : mode.includes("password")
              ? "Finish setting up the owner account, then continue to the protected dashboard."
              : "For the Vision Make Studio owner and authorized staff only."}
        </p>

        {mode === "loading" ? (
          <div className="auth-loading" role="status">Checking secure access…</div>
        ) : mode === "forgot" ? (
          <form className="admin-login-form" onSubmit={handleRecovery}>
            <label>Email address<input name="email" type="email" autoComplete="email" required placeholder={CONTACT_EMAIL} /></label>
            <button className="button button-red button-wide" type="submit" disabled={busy}>{busy ? "Sending…" : "Send Reset Link"}</button>
            <button className="auth-text-button" type="button" onClick={() => { clearNotices(); setMode("login"); }}>Back to sign in</button>
          </form>
        ) : mode === "set-password" || mode === "reset-password" ? (
          <form className="admin-login-form" onSubmit={handleSetPassword}>
            <label>New password<input name="password" type="password" autoComplete="new-password" minLength="10" required /></label>
            <label>Confirm password<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength="10" required /></label>
            <button className="button button-red button-wide" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Password & Continue"}</button>
          </form>
        ) : (
          <form className="admin-login-form" onSubmit={handleLogin}>
            <label>Email address<input name="email" type="email" autoComplete="username" required placeholder={CONTACT_EMAIL} /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="button button-red button-wide" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign In to VMS Admin"}</button>
            <button className="auth-text-button" type="button" onClick={() => { clearNotices(); setMode("forgot"); }}>Forgot password?</button>
          </form>
        )}

        {message && <p className="form-notice is-success" role="status">{message}</p>}
        {error && <p className="form-notice is-error" role="alert">{error}</p>}
        <a className="admin-back-link" href="/">← Back to the public website</a>
      </section>
    </main>
  );
}

function Modal({ open, onClose, label, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={label}>
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close dialog">
          <X size={22} weight="bold" />
        </button>
        {children}
      </section>
    </div>
  );
}

function PublicWebsite() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [activeImprovementId, setActiveImprovementId] = useState("website");
  const [scoreShift, setScoreShift] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalSent, setPortalSent] = useState(false);
  const [portalSending, setPortalSending] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [activeService, setActiveService] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState("Website Revamp");
  const [checkupSubmitted, setCheckupSubmitted] = useState(false);
  const [checkupSending, setCheckupSending] = useState(false);
  const [checkupMessage, setCheckupMessage] = useState("");
  const [checkupError, setCheckupError] = useState("");
  const scorePanelRef = useRef(null);

  const activeImprovement = useMemo(
    () => IMPROVEMENTS.find((item) => item.id === activeImprovementId) ?? IMPROVEMENTS[0],
    [activeImprovementId],
  );
  const score = clamp(activeImprovement.score + scoreShift, 0, 100);
  const scoreColor = score < 50 ? "#c1121f" : score < 75 ? "#669bbc" : "#2f8b64";

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || new URLSearchParams(window.location.search).has("qa")) return undefined;
    const timer = window.setInterval(() => setPhraseIndex((index) => (index + 1) % PHRASES.length), 2600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#member-portal") return;
    setPortalOpen(true);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    const revealNodes = document.querySelectorAll("[data-reveal]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const qaMode = new URLSearchParams(window.location.search).has("qa");
    if (reducedMotion || qaMode || !("IntersectionObserver" in window)) {
      revealNodes.forEach((node) => node.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );
    revealNodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let ticking = false;
    const updateScrollEffects = () => {
      const scrollMax = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      document.documentElement.style.setProperty("--page-progress", String(window.scrollY / scrollMax));

      if (scorePanelRef.current) {
        const rect = scorePanelRef.current.getBoundingClientRect();
        const focusPoint = window.innerHeight * 0.55;
        const normalized = clamp((focusPoint - rect.top) / Math.max(rect.height, 1), 0, 1);
        setScoreShift(Math.round((normalized - 0.5) * 12));
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollEffects);
        ticking = true;
      }
    };
    updateScrollEffects();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    setScoreShift(0);
  }, [activeImprovementId]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const requestService = (serviceTitle) => {
    setSelectedGoal(serviceTitle);
    setActiveService(null);
    window.setTimeout(() => document.querySelector("#checkup")?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  const handleCheckupSubmit = async (event) => {
    event.preventDefault();
    setCheckupError("");
    setCheckupSending(true);
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const request = {
      businessName: form.get("businessName"),
      contactName: form.get("contactName"),
      email: form.get("email"),
      phone: form.get("phone"),
      website: form.get("website"),
      goal: form.get("goal"),
      message: form.get("message"),
      companyWebsite: form.get("companyWebsite"),
    };

    try {
      const response = await fetch("/api/checkups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "The request could not be sent."));
      }
      const result = await response.json();
      setCheckupMessage(result.emailSent
        ? `Your request was saved and ${CONTACT_EMAIL} was notified.`
        : `Your request was saved. Email notifications will begin after the sending domain is connected.`);
      setCheckupSubmitted(true);
      formElement.reset();
    } catch (submitError) {
      if (isLocalPreview()) {
        try {
          const key = "vms_preview_checkup_requests_v1";
          const existing = JSON.parse(window.localStorage.getItem(key) || "[]");
          window.localStorage.setItem(key, JSON.stringify([{
            ...request,
            id: `preview-checkup-${Date.now()}`,
            submittedAt: new Date().toISOString(),
          }, ...existing]));
        } catch {
          // The visual preview can continue even if local storage is unavailable.
        }
        setCheckupMessage("Preview confirmed: validation, button behavior, and the request flow work. Live delivery activates with the Netlify environment settings.");
        setCheckupSubmitted(true);
        formElement.reset();
      } else {
        setCheckupError(submitError?.message || `We could not send this request. Please email ${CONTACT_EMAIL}.`);
      }
    } finally {
      setCheckupSending(false);
    }
  };

  const handlePortalSubmit = async (event) => {
    event.preventDefault();
    setPortalError("");
    setPortalSending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/client-login-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("portalEmail"),
          companyWebsite: form.get("companyWebsite"),
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "The secure sign-in email could not be sent."));
      setPortalSent(true);
    } catch (submitError) {
      setPortalError(isLocalPreview()
        ? "The form and button are ready. Secure email delivery activates after Netlify and Supabase are connected."
        : (submitError?.message || `Please contact ${CONTACT_EMAIL} for portal access.`));
    } finally {
      setPortalSending(false);
    }
  };

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="page-progress" aria-hidden="true" />
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="Vision Make Studio home" onClick={closeMobileMenu}>
            <img src="/assets/vms-logo.png" alt="Vision Make Studio" />
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            <a href="#services">Services</a>
            <a href="#checkup">Business Checkup</a>
            <a href="#process">How it works</a>
          </nav>
          <div className="header-actions">
            <button className="text-button desktop-only" type="button" onClick={() => setPortalOpen(true)}>
              Member Portal
            </button>
            <a className="button button-small button-red desktop-only" href="#checkup">
              Free Checkup
            </a>
            <button
              className="icon-button menu-button"
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X size={22} weight="bold" /> : <List size={24} weight="bold" />}
            </button>
          </div>
        </div>
        <nav id="mobile-navigation" className={`mobile-nav ${mobileMenuOpen ? "is-open" : ""}`} aria-label="Mobile navigation">
          <a href="#services" onClick={closeMobileMenu}>Services</a>
          <a href="#process" onClick={closeMobileMenu}>How it works</a>
          <a href="#checkup" onClick={closeMobileMenu}>Business Checkup</a>
          <button type="button" onClick={() => { setPortalOpen(true); closeMobileMenu(); }}>Member Portal</button>
        </nav>
      </header>

      <main id="top">
        <section className="hero section-pad">
          <div className="hero-motif" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy" data-reveal>
              <p className="eyebrow">Design <span>•</span> Growth <span>•</span> Systems</p>
              <h1>
                Make your business
                <span className="phrase" key={PHRASES[phraseIndex]}>{PHRASES[phraseIndex]}</span>
              </h1>
              <p className="hero-lead">Websites, visibility and smarter systems built for growing businesses.</p>
              <div className="hero-actions">
                <a className="button button-red" href="#checkup">Get a Free Business Checkup</a>
                <a className="link-arrow" href="#services">See what VMS can do <ArrowRight size={18} weight="bold" /></a>
              </div>
            </div>
          </div>
        </section>

        <section id="scorecard" className="guided section-pad">
          <div className="container">
            <p className="eyebrow selector-label" data-reveal>What do you want to improve?</p>

            <div className="improvement-tabs" role="tablist" aria-label="Business goals" data-reveal>
              {IMPROVEMENTS.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeImprovementId;
                return (
                  <button
                    key={item.id}
                    className={active ? "is-active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveImprovementId(item.id)}
                  >
                    <Icon size={22} weight={active ? "fill" : "regular"} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="score-panel" ref={scorePanelRef} data-reveal>
              <div className="score-summary">
                <p className="score-label">Your VMS score</p>
                <div className="score-ring" style={{ "--score": score, "--score-color": scoreColor }} aria-label={`Example score ${score} out of 100`}>
                  <div className="score-ring-inner">
                    <span className="score-number">{score}</span>
                    <span>/100</span>
                  </div>
                </div>
                <div>
                  <p className="eyebrow">Example VMS score</p>
                  <h3>{activeImprovement.label}</h3>
                  <p className="score-caption">The score responds as this section moves through view, just like the VMS checkup experience.</p>
                </div>
              </div>

              <div className="score-findings" aria-live="polite">
                <p className="eyebrow">{activeImprovement.label}</p>
                <h3>{activeImprovement.findingTitle}</h3>
                <p className="score-body">{activeImprovement.finding}</p>
                <button className="recommendation-card" type="button" onClick={() => requestService(activeImprovement.service)}>
                  <span><small>Recommended next step</small><strong>{activeImprovement.service}</strong></span>
                  <ArrowRight size={19} weight="bold" />
                </button>
              </div>

              <div className="service-match">
                <p className="eyebrow">VMS tools</p>
                {[
                  { title: "Website Revamp", copy: "Modern, clear and built to convert.", icon: Monitor },
                  { title: "VMS Smart QR", copy: "Connect people to what matters.", icon: QrCode },
                  { title: "VMS LinkHub", copy: "All your links. One smart destination.", icon: LinkSimple },
                  { title: "Review Growth", copy: "More reviews. More trust.", icon: Star },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.title} type="button" className={activeImprovement.service.includes(item.title.replace("VMS ", "")) ? "is-matched" : ""} onClick={() => requestService(item.title)}>
                      <span className="service-rail-icon"><Icon size={20} weight="duotone" /></span>
                      <span><strong>{item.title}</strong><small>{item.copy}</small></span>
                      <span className="match-dot" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="process" className="process section-pad">
          <div className="process-orbit orbit-one" aria-hidden="true" />
          <div className="process-orbit orbit-two" aria-hidden="true" />
          <div className="container">
            <div className="section-heading process-heading" data-reveal>
              <p className="eyebrow eyebrow-light">How VMS works</p>
              <h2>From score to solution.</h2>
              <p>Simple enough to understand. Thoughtful enough to make a real difference.</p>
            </div>
            <div className="process-grid">
              {PROCESS.map((step) => {
                const Icon = step.icon;
                return (
                  <article className="process-step" key={step.number} data-reveal>
                    <div className="step-top">
                      <span className="step-number">{step.number}</span>
                      <span className="step-icon"><Icon size={25} weight="duotone" /></span>
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="clarity-strip">
          <div className="container clarity-inner" data-reveal>
            <div>
              <p className="eyebrow">Not sure what you need?</p>
              <h2>Start with clarity—not a shopping cart.</h2>
            </div>
            <a className="button button-navy" href="#checkup">Get Your Free Business Checkup <ArrowRight size={18} weight="bold" /></a>
          </div>
        </section>

        <section id="services" className="services section-pad">
          <div className="container">
            <div className="section-heading split-heading" data-reveal>
              <div>
                <p className="eyebrow">VMS services</p>
                <h2>Tools that work better together.</h2>
              </div>
              <p>Choose a focused upgrade or connect several tools into one practical system. We’ll help you make the right call after the checkup.</p>
            </div>
            <div className="service-grid">
              {SERVICES.map((service) => {
                const Icon = service.icon;
                return (
                  <article className="service-card" key={service.title} data-reveal>
                    <div className="service-icon"><Icon size={27} weight="duotone" /></div>
                    <p className="eyebrow">{service.kicker}</p>
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>
                    <button className="link-arrow" type="button" onClick={() => setActiveService(service)}>
                      See what’s included <ArrowRight size={17} weight="bold" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="checkup" className="checkup section-pad">
          <div className="container checkup-grid">
            <div className="checkup-copy" data-reveal>
              <p className="eyebrow eyebrow-light">Free VMS Business Checkup</p>
              <h2>Tell us where you feel stuck.</h2>
              <p>Share a few details and VMS will review the customer-facing experience around your selected goal. You’ll get a clearer picture of what to improve first.</p>
              <ul className="checkup-points">
                <li><CheckCircle size={21} weight="fill" /> A focused outside perspective</li>
                <li><CheckCircle size={21} weight="fill" /> Clear findings in plain language</li>
                <li><CheckCircle size={21} weight="fill" /> A recommended VMS next step</li>
              </ul>
              <p className="privacy-note"><ShieldCheck size={18} weight="duotone" /> Your details stay with Vision Make Studio.</p>
            </div>

            <div className="checkup-form-card" data-reveal>
              {checkupSubmitted ? (
                <div className="success-state" role="status">
                  <span><CheckCircle size={42} weight="fill" /></span>
                  <p className="eyebrow">Request received</p>
                  <h3>Your Business Checkup is in the VMS queue.</h3>
                  <p>{checkupMessage}</p>
                  <button className="button button-navy" type="button" onClick={() => { setCheckupSubmitted(false); setCheckupMessage(""); }}>Send another request</button>
                </div>
              ) : (
                <form onSubmit={handleCheckupSubmit}>
                  <div className="form-heading">
                    <p className="eyebrow">Start here</p>
                    <h3>Request your free checkup</h3>
                  </div>
                  <div className="form-grid">
                    <label>Business name<input name="businessName" required placeholder="Your business" /></label>
                    <label>Your name<input name="contactName" required placeholder="Your name" /></label>
                    <label>Email<input name="email" type="email" required placeholder="you@business.com" /></label>
                    <label>Phone <span>(optional)</span><input name="phone" type="tel" placeholder="(000) 000-0000" /></label>
                    <label className="full-field">Website or business link <span>(optional)</span><input name="website" type="url" placeholder="https://" /></label>
                    <label className="full-field">What do you want to improve?
                      <select name="goal" value={selectedGoal} onChange={(event) => setSelectedGoal(event.target.value)}>
                        {SERVICES.map((service) => <option key={service.title}>{service.title}</option>)}
                        <option>Not sure yet</option>
                      </select>
                    </label>
                    <label className="full-field">Anything else we should know? <span>(optional)</span><textarea name="message" rows="4" placeholder="Tell us what feels difficult or what you want customers to do more easily." /></label>
                    <label className="form-trap" aria-hidden="true">Leave this field empty<input name="companyWebsite" tabIndex="-1" autoComplete="off" /></label>
                  </div>
                  <button className="button button-red button-wide" type="submit" disabled={checkupSending}>
                    {checkupSending ? "Sending…" : "Send My Checkup Request"}
                    {!checkupSending && <PaperPlaneTilt size={19} weight="fill" />}
                  </button>
                  {checkupError && <p className="form-notice is-error" role="alert">{checkupError}</p>}
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="final-cta section-pad">
          <div className="container final-cta-inner" data-reveal>
            <div>
              <p className="eyebrow eyebrow-light">Look better. Work smarter. Grow stronger.</p>
              <h2>Your next upgrade should feel clear.</h2>
            </div>
            <a className="button button-cream" href="#checkup">Start With the Free Checkup <ArrowRight size={18} weight="bold" /></a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <img src="/assets/vms-logo.png" alt="Vision Make Studio" />
            <p>Practical digital tools and thoughtful upgrades for small businesses.</p>
          </div>
          <div>
            <p className="footer-title">Explore</p>
            <a href="#services">Services</a>
            <a href="#process">How it works</a>
            <a href="#checkup">Business Checkup</a>
          </div>
          <div>
            <p className="footer-title">Clients</p>
            <button type="button" onClick={() => setPortalOpen(true)}>Member Portal</button>
            <a href="#checkup">Request support</a>
          </div>
          <div>
            <p className="footer-title">Vision Make Studio</p>
            <p>Built to help your business look better, work smarter, and grow stronger.</p>
            <a className="footer-email" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <a href="/staff-login/">VMS Admin Login</a>
          </div>
        </div>
        <div className="container footer-bottom"><span>© 2026 Vision Make Studio</span><span>VMS</span></div>
      </footer>

      <Modal open={portalOpen} onClose={() => { setPortalOpen(false); setPortalSent(false); setPortalError(""); }} label="VMS Member Portal">
        {portalSent ? (
          <div className="modal-success" role="status">
            <span><EnvelopeSimple size={40} weight="duotone" /></span>
            <p className="eyebrow">Check your inbox</p>
            <h2>Your secure sign-in link is on its way.</h2>
            <p>If the email belongs to an active VMS client account, the secure link will arrive shortly.</p>
            <button className="button button-navy button-wide" type="button" onClick={() => { setPortalOpen(false); setPortalSent(false); setPortalError(""); }}>Done</button>
          </div>
        ) : (
          <form className="portal-form" onSubmit={handlePortalSubmit}>
            <span className="modal-mark"><ShieldCheck size={29} weight="duotone" /></span>
            <p className="eyebrow">VMS Client Portal</p>
            <h2>Sign in with your email.</h2>
            <p>We’ll send a secure sign-in link to the email connected to your VMS client account.</p>
            <label>Email address<input name="portalEmail" type="email" required autoFocus placeholder="you@business.com" /></label>
            <label className="form-trap" aria-hidden="true">Leave this field empty<input name="companyWebsite" tabIndex="-1" autoComplete="off" /></label>
            <button className="button button-red button-wide" type="submit" disabled={portalSending}>
              {portalSending ? "Sending Secure Link…" : "Email My Sign-In Link"}
              {!portalSending && <ArrowRight size={18} weight="bold" />}
            </button>
            {portalError && <p className="form-notice is-error" role="alert">{portalError}</p>}
            <small>Client accounts are created by Vision Make Studio after services are confirmed.</small>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(activeService)} onClose={() => setActiveService(null)} label={activeService?.title || "Service details"}>
        {activeService && (
          <div className="service-modal">
            <span className="modal-mark">{(() => { const Icon = activeService.icon; return <Icon size={30} weight="duotone" />; })()}</span>
            <p className="eyebrow">{activeService.kicker}</p>
            <h2>{activeService.title}</h2>
            <p>{activeService.description}</p>
            <ul>
              {activeService.details.map((detail) => <li key={detail}><CheckCircle size={19} weight="fill" /> {detail}</li>)}
            </ul>
            <button className="button button-red button-wide" type="button" onClick={() => requestService(activeService.title)}>
              Request This Service <ArrowRight size={18} weight="bold" />
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function App() {
  return window.location.pathname.startsWith("/staff-login") ? <AdminLogin /> : <PublicWebsite />;
}
