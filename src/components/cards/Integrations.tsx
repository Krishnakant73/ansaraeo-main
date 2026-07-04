import { BarChart3, CreditCard, Globe, LayoutTemplate, MessageCircle, ShoppingBag, ShoppingCart, Slack } from "lucide-react";
import SectionWrapper from "@/components/layout/SectionWrapper";

const APPS = [
  { icon: ShoppingBag, name: "Shopify" },
  { icon: Globe, name: "WordPress" },
  { icon: ShoppingCart, name: "WooCommerce" },
  { icon: BarChart3, name: "GA4" },
  { icon: CreditCard, name: "Razorpay" },
  { icon: MessageCircle, name: "WhatsApp" },
  { icon: Slack, name: "Slack" },
  { icon: LayoutTemplate, name: "Webflow" },
];

export default function Integrations() {
  return (
    <SectionWrapper className="bg-surface py-24 md:py-36">
      <div className="container-x text-center">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">Plays well with your stack.</h2>
        <p className="mx-auto mt-5 max-w-xl text-muted md:text-lg">
          One-click fixes deploy straight to your CMS. Alerts land where your team already lives.
        </p>
        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {APPS.map((app) => (
            <div key={app.name} className="card group flex flex-col items-center gap-3 p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface text-muted transition-colors duration-300 group-hover:bg-accent/10 group-hover:text-accent">
                <app.icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="text-sm font-semibold">{app.name}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
