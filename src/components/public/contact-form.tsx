"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COUPLE } from "@/lib/site-config";

interface FormState {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  /** Honeypot — only bots fill this. */
  website: string;
}

const blank: FormState = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  website: "",
};

export function ContactForm() {
  const [state, setState] = useState<FormState>(blank);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const send = useMutation(api.messages.send);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = state.name.trim();
    const email = state.email.trim();
    const subject = state.subject.trim();
    const message = state.message.trim();
    if (!name || !email || !subject || !message) {
      toast.error("Name, email, subject, and message are all required.");
      return;
    }
    startTransition(async () => {
      try {
        await send({
          name,
          email,
          subject,
          message,
          phoneRaw: state.phone.trim() || undefined,
          website: state.website,
        });
        setState(blank);
        setSent(true);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't send your message.",
        );
      }
    });
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 sm:px-10 sm:py-12 text-center">
        <div
          className="mx-auto mb-5 flex items-center justify-center gap-3 text-blush"
          aria-hidden
        >
          <span className="block h-px w-10 bg-blush/40" />
          <span className="text-lg leading-none">♥</span>
          <span className="block h-px w-10 bg-blush/40" />
        </div>
        <p className="font-sans tracking-[0.4em] uppercase text-xs text-charcoal/60 mb-3">
          Thank you
        </p>
        <h3 className="font-heading text-2xl sm:text-3xl mb-3">
          Got it — we&apos;ll be in touch.
        </h3>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Your message is on its way to {COUPLE.groom}. We&apos;ll reply at the
          email you provided.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-xs tracking-[0.3em] uppercase text-muted-foreground hover:text-charcoal transition-colors"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-10 space-y-4"
    >
      <div className="text-center mb-6">
        <p className="font-sans tracking-[0.4em] uppercase text-[10px] sm:text-xs text-blush mb-3">
          Drop us a line
        </p>
        <h2 className="font-heading text-3xl sm:text-4xl leading-none">
          Have a question?
        </h2>
        <div className="mx-auto mt-4 h-px w-16 bg-blush/40" aria-hidden />
        <p className="text-sm text-muted-foreground mt-4 max-w-md mx-auto">
          Logistics, dietary needs, dress code — anything at all. We read every
          message.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <FieldStack>
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
            value={state.name}
            onChange={(e) => update("name", e.target.value)}
            autoComplete="name"
            maxLength={120}
            required
          />
        </FieldStack>
        <FieldStack>
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={state.email}
            onChange={(e) => update("email", e.target.value)}
            autoComplete="email"
            maxLength={254}
            required
          />
        </FieldStack>
      </div>

      <FieldStack>
        <Label htmlFor="contact-phone">
          Phone <span className="text-muted-foreground/70 font-normal">(optional)</span>
        </Label>
        <Input
          id="contact-phone"
          type="tel"
          value={state.phone}
          onChange={(e) => update("phone", e.target.value)}
          autoComplete="tel"
          maxLength={40}
          placeholder="(415) 555-1212"
        />
      </FieldStack>

      <FieldStack>
        <Label htmlFor="contact-subject">Subject</Label>
        <Input
          id="contact-subject"
          value={state.subject}
          onChange={(e) => update("subject", e.target.value)}
          maxLength={200}
          required
        />
      </FieldStack>

      <FieldStack>
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          rows={5}
          value={state.message}
          onChange={(e) => update("message", e.target.value)}
          maxLength={4000}
          required
        />
      </FieldStack>

      {/* Honeypot — visually hidden but reachable by bots scraping form
          fields. Real users never see or fill this. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "-9999px",
          height: 0,
          width: 0,
          overflow: "hidden",
        }}
      >
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={state.website}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>

      <Button
        type="submit"
        disabled={pending}
        // Optical centering: trailing letter-spacing pushes text left of
        // the geometric center, so add 0.3em of left padding to compensate.
        style={{ paddingLeft: "calc(0.625rem + 0.3em)", paddingRight: "0.625rem" }}
        className="w-full h-12 text-sm tracking-[0.3em] uppercase mt-2"
      >
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

function FieldStack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}
