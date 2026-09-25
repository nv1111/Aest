"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, ChevronRight, ReceiptIndianRupee } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/i18n";
import { authService } from "@/services/auth";
import { profileService } from "@/services/profiles";
import { useMe, useRefreshMe } from "@/hooks/useSession";
import { trackEvent } from "@/lib/analytics";
import { http } from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { PlaceSearch } from "./PlaceSearch";
import type { Place } from "@/lib/cities";
import { errorMessage } from "@/lib/http";
import { Splash } from "@/components/app/Splash";

type Step = "welcome" | "promises" | "phone" | "otp" | "name" | "birth" | "ready";

/**
 * Onboarding — short, honest, ChatGPT-simple. Welcome → why we exist →
 * privacy → account → birth details → home.
 */
export function OnboardingFlow() {
  const me = useMe();
  const refreshMe = useRefreshMe();
  const [step, setStep] = useState<Step>("welcome");
  const [phone, setPhone] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Returning user without a completed profile resumes the flow at the
  // right step (name if missing, otherwise birth details)
  useEffect(() => {
    if (me.data?.user && step === "welcome") {
      const u = me.data.user;
      setName(u.name ?? "");
      if (me.data.profiles.length === 0) {
        setStep(u.name ? "birth" : u.phone ? "name" : "phone");
      }
    }
  }, [me.data, step]);

  const goToApp = async () => {
    await refreshMe();
  };

  const requestOtp = async () => {
    setLoading(true);
    try {
      const res = await authService.requestOtp(phone);
      setDemoOtp(res.demoOtp);
      setStep("otp");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (code: string) => {
    setLoading(true);
    try {
      const res = await authService.verifyOtp(phone, code, name || undefined);
      await refreshMe();
      if (!res.user.name) {
        setStep("name");
      } else {
        setStep("birth");
      }
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setLoading(false);
    }
    return true;
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {step === "welcome" && <WelcomeStep onNext={() => setStep("promises")} />}
          {step === "promises" && <PromisesStep onNext={() => setStep("phone")} />}
          {step === "phone" && (
            <PhoneStep
              phone={phone}
              setPhone={setPhone}
              loading={loading}
              onSubmit={requestOtp}
            />
          )}
          {step === "otp" && (
            <OtpStep
              phone={phone}
              demoOtp={demoOtp}
              loading={loading}
              onVerify={verifyOtp}
              onResend={requestOtp}
            />
          )}
          {step === "name" && (
            <NameStep
              name={name}
              setName={setName}
              onSubmit={async () => {
                // persist the name so the app can greet the user personally
                try {
                  await http.post("/api/user", { name: name.trim() });
                } catch {
                  // non-blocking: the chart profile carries its own name
                  toast("We couldn't save your name — you can add it later in Profile.");
                }
                setStep("birth");
              }}
            />
          )}
          {step === "birth" && (
            <BirthStep
              name={name}
              onCreated={async () => {
                trackEvent("birth_profile_created");
                trackEvent("onboarding_completed");
                // Show the "chart is ready" celebration first; the me query
                // refresh (which reveals the main app) happens on its CTA.
                setStep("ready");
              }}
            />
          )}
          {step === "ready" && (
            <ReadyStep name={name || (me.data?.user.name ?? "")} onOpen={goToApp} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ shell

function OnboardingShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col px-6 pb-8 pt-14">
      <div className="flex-1">{children}</div>
      {footer ? <div className="pt-8">{footer}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------------ welcome

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <OnboardingShell
      footer={
        <div className="space-y-3">
          <Button onClick={onNext} className="h-13 w-full rounded-full text-[15px] font-semibold press" size="lg">
            {t("onboarding.welcomeStart")}
            <ChevronRight className="ml-1 h-4.5 w-4.5" />
          </Button>
          <p className="text-center text-[11.5px] text-muted-foreground">
            By continuing you agree to our Terms & Privacy Policy
          </p>
        </div>
      }
    >
      <div className="tara-hero -mx-6 -mt-14 px-6 pb-8 pt-10">
        <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Sparkles className="h-6 w-6" strokeWidth={1.75} />
        </div>
      </div>
      <h1 className="font-display text-[30px] font-semibold leading-[1.15] tracking-tight">
        {t("onboarding.welcomeTitle")}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        {t("onboarding.welcomeBody")}
      </p>
      <div className="mt-8 flex items-start gap-3 rounded-2xl bg-secondary/60 px-4 py-3.5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={1.75} />
        <p className="text-[13px] leading-relaxed text-secondary-foreground">
          <span className="font-semibold text-foreground">{t("onboarding.welcomePrivacyTitle")} — </span>
          {t("onboarding.welcomePrivacyBody")}
        </p>
      </div>
    </OnboardingShell>
  );
}

// ------------------------------------------------------------------ promises

function PromisesStep({ onNext }: { onNext: () => void }) {
  const promises = [
    {
      icon: Sparkles,
      title: t("onboarding.promiseOneTitle"),
      body: t("onboarding.promiseOneBody"),
    },
    {
      icon: ReceiptIndianRupee,
      title: t("onboarding.promiseTwoTitle"),
      body: t("onboarding.promiseTwoBody"),
    },
    {
      icon: ShieldCheck,
      title: t("onboarding.promiseThreeTitle"),
      body: t("onboarding.promiseThreeBody"),
    },
  ];
  return (
    <OnboardingShell
      footer={
        <Button onClick={onNext} className="h-13 w-full rounded-full text-[15px] font-semibold press" size="lg">
          {t("onboarding.accept")}
        </Button>
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{t("onboarding.privacyTitle")}</p>
      <h1 className="mt-2 font-display text-[28px] font-semibold leading-[1.15] tracking-tight">
        Three promises we make to you
      </h1>
      <div className="mt-8 space-y-5">
        {promises.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12, duration: 0.35 }}
            className="flex items-start gap-4"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <p.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-[15.5px] font-semibold leading-tight">{p.title}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </OnboardingShell>
  );
}

// ------------------------------------------------------------------ phone

function PhoneStep({
  phone,
  setPhone,
  loading,
  onSubmit,
}: {
  phone: string;
  setPhone: (v: string) => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  const valid = /^[6-9]\d{9}$/.test(phone);
  return (
    <OnboardingShell
      footer={
        <Button
          onClick={onSubmit}
          disabled={!valid || loading}
          className="h-13 w-full rounded-full text-[15px] font-semibold press"
          size="lg"
        >
          {loading ? "Sending…" : t("onboarding.phoneSend")}
        </Button>
      }
    >
      <h1 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight">
        {t("onboarding.phoneTitle")}
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
        {t("onboarding.phoneBody")}
      </p>
      <div className="mt-8">
        <label htmlFor="phone" className="mb-2 block text-[13px] font-medium text-foreground">
          {t("onboarding.phoneLabel")}
        </label>
        <div className="flex items-center gap-2">
          <span className="flex h-12 items-center rounded-2xl border bg-secondary px-4 text-[15px] font-medium text-secondary-foreground">
            +91
          </span>
          <Input
            id="phone"
            inputMode="numeric"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="98765 43210"
            className="h-12 rounded-2xl text-[15px] tracking-wide"
            aria-invalid={phone.length > 0 && !valid}
          />
        </div>
        {phone.length > 0 && !valid ? (
          <p className="mt-2 text-[12.5px] text-destructive">{t("onboarding.phoneInvalid")}</p>
        ) : null}
      </div>
    </OnboardingShell>
  );
}

// ------------------------------------------------------------------ otp

function OtpStep({
  phone,
  demoOtp,
  loading,
  onVerify,
  onResend,
}: {
  phone: string;
  demoOtp: string | null;
  loading: boolean;
  onVerify: (code: string) => Promise<boolean>;
  onResend: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (value: string) => {
    if (value.length !== 6 || loading) return;
    setError(null);
    const okResult = await onVerify(value);
    if (!okResult) setError(t("onboarding.otpWrong"));
  };

  return (
    <OnboardingShell
      footer={
        <div className="space-y-4">
          {demoOtp ? (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-center">
              <p className="text-[12px] font-medium text-warning-foreground">{t("onboarding.demoOtpNote")}</p>
              <p className="mt-1 font-mono text-[22px] font-bold tracking-[0.3em] text-foreground">{demoOtp}</p>
            </div>
          ) : null}
          <Button
            onClick={() => handleVerify(code)}
            disabled={code.length !== 6 || loading}
            className="h-13 w-full rounded-full text-[15px] font-semibold press"
            size="lg"
          >
            {loading ? "Verifying…" : t("onboarding.otpVerify")}
          </Button>
          <button
            type="button"
            onClick={onResend}
            className="w-full text-center text-[13px] font-medium text-primary press"
          >
            {t("onboarding.otpResend")}
          </button>
        </div>
      }
    >
      <h1 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight">
        {t("onboarding.otpTitle")}
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
        {t("onboarding.otpSentTo", { phone })}
      </p>
      <div className="mt-8 flex justify-center">
        <InputOTP maxLength={6} value={code} onChange={setCode} disabled={loading}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      {error ? <p className="mt-4 text-center text-[12.5px] text-destructive">{error}</p> : null}
    </OnboardingShell>
  );
}

// ------------------------------------------------------------------ name

function NameStep({
  name,
  setName,
  onSubmit,
}: {
  name: string;
  setName: (v: string) => void;
  onSubmit: () => void;
}) {
  const valid = name.trim().length >= 1;
  return (
    <OnboardingShell
      footer={
        <Button
          onClick={onSubmit}
          disabled={!valid}
          className="h-13 w-full rounded-full text-[15px] font-semibold press"
          size="lg"
        >
          {t("onboarding.nameContinue")}
        </Button>
      }
    >
      <h1 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight">
        {t("onboarding.nameTitle")}
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
        We&apos;ll use it to personalise your readings. You can change it anytime.
      </p>
      <div className="mt-8">
        <label htmlFor="name" className="mb-2 block text-[13px] font-medium text-foreground">
          {t("onboarding.nameLabel")}
        </label>
        <Input
          id="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("onboarding.namePlaceholder")}
          className="h-12 rounded-2xl text-[15px]"
        />
      </div>
    </OnboardingShell>
  );
}

// ------------------------------------------------------------------ birth

function BirthStep({ name, onCreated }: { name: string; onCreated: () => void }) {
  const [profileName, setProfileName] = useState(name);
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [accuracy, setAccuracy] = useState<"exact" | "approximate" | "unknown">("exact");
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const valid =
    profileName.trim().length >= 1 &&
    /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
    dob <= today &&
    (accuracy === "unknown" || /^([01]\d|2[0-3]):[0-5]\d$/.test(tob)) &&
    place !== null;

  const submit = async () => {
    if (!valid || !place || loading) return;
    setLoading(true);
    try {
      await profileService.create({
        name: profileName.trim(),
        relation: "self",
        dateOfBirth: dob,
        timeOfBirth: accuracy === "unknown" ? null : tob,
        timeAccuracy: accuracy,
        placeName: place.name,
        placeCountry: place.country,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone,
      });
      onCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const accuracyOptions: { value: typeof accuracy; label: string }[] = [
    { value: "exact", label: t("onboarding.timeAccuracyExact") },
    { value: "approximate", label: t("onboarding.timeAccuracyApproximate") },
    { value: "unknown", label: t("onboarding.timeAccuracyUnknown") },
  ];

  return (
    <OnboardingShell
      footer={
        <Button
          onClick={submit}
          disabled={!valid || loading}
          className="h-13 w-full rounded-full text-[15px] font-semibold press"
          size="lg"
        >
          {loading ? t("onboarding.creatingChart") : t("onboarding.createChart")}
        </Button>
      }
    >
      <h1 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight">
        {t("onboarding.birthTitle")}
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
        {t("onboarding.birthBody")}
      </p>

      <div className="mt-7 space-y-4">
        <div>
          <label htmlFor="profileName" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("onboarding.birthName")}
          </label>
          <Input
            id="profileName"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            className="h-12 rounded-2xl text-[15px]"
          />
        </div>

        <div>
          <label htmlFor="dob" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("onboarding.birthDate")}
          </label>
          <Input
            id="dob"
            type="date"
            max={today}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="h-12 rounded-2xl text-[15px]"
          />
        </div>

        <div>
          <label htmlFor="tob" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("onboarding.birthTime")}
          </label>
          <Input
            id="tob"
            type="time"
            disabled={accuracy === "unknown"}
            value={tob}
            onChange={(e) => setTob(e.target.value)}
            className="h-12 rounded-2xl text-[15px] disabled:opacity-50"
          />
          <div className="mt-2.5 flex gap-1.5" role="radiogroup" aria-label="Time accuracy">
            {accuracyOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={accuracy === o.value}
                onClick={() => setAccuracy(o.value)}
                className={`press flex-1 rounded-xl border px-3 py-2 text-[12.5px] font-medium transition-colors ${
                  accuracy === o.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {accuracy === "unknown" ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {t("onboarding.timeUnknownNote")}
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">{t("onboarding.birthTimeHint")}</p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-medium text-foreground">
            {t("onboarding.birthPlace")}
          </label>
          <PlaceSearch value={place} onChange={setPlace} />
        </div>
      </div>
    </OnboardingShell>
  );
}

// ------------------------------------------------------------------ ready

function ReadyStep({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <OnboardingShell
      footer={
        <Button onClick={onOpen} className="h-13 w-full rounded-full text-[15px] font-semibold press" size="lg">
          {t("onboarding.readyOpen")}
        </Button>
      }
    >
      <div className="tara-paper -mx-6 -mt-14 flex min-h-[300px] flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xl shadow-primary/25"
        >
          <Sparkles className="h-9 w-9" strokeWidth={1.5} />
        </motion.div>
        <h1 className="mt-6 text-center font-display text-[26px] font-semibold leading-[1.15] tracking-tight">
          {t("onboarding.readyTitle", { name: name || "there" })}
        </h1>
        <p className="mt-2 text-center text-[14.5px] text-muted-foreground">{t("onboarding.readyBody")}</p>
      </div>
    </OnboardingShell>
  );
}
