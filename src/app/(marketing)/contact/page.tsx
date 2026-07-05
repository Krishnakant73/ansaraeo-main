import type { Metadata } from "next";
import { Mail } from "lucide-react";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/footer/Footer";
import SectionWrapper from "@/components/layout/SectionWrapper";
import ContactForm from "@/components/shared/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the AnsarAEO team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main>
        <SectionWrapper className="relative overflow-hidden pb-16 pt-36 md:pb-20 md:pt-44">
          <div aria-hidden className="absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="container-x relative mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Contact</p>
            <h1 className="mx-auto mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              Let&apos;s talk.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-muted md:text-lg">
              Questions about pricing, a demo request, or something else — we usually reply within 1-2 business
              days.
            </p>
          </div>
        </SectionWrapper>

        <SectionWrapper className="pb-24 md:pb-36">
          <div className="container-x mx-auto grid max-w-4xl gap-10 md:grid-cols-[1fr,1.3fr]">
            <div>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">Email us</p>
                  <a href="mailto:admin@ansaraeo.com" className="text-sm text-muted hover:text-accent">
                    admin@ansaraeo.com
                  </a>
                </div>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-muted">
                For support requests, mention your account email so we can look into it faster. For agency/white-
                label pilot inquiries, tell us how many clients you manage.
              </p>
            </div>
            <ContactForm />
          </div>
        </SectionWrapper>
      </main>
      <Footer />
    </>
  );
}
