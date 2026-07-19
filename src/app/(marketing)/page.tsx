import Navbar from "@/components/navigation/Navbar";
import InsightHero from "@/components/hero/InsightHero";
import LogoCloud from "@/components/shared/LogoCloud";
import EngineCoverage from "@/components/analytics/EngineCoverage";
import ProblemStatement from "@/components/cards/ProblemStatement";
import HowItWorks from "@/components/cards/HowItWorks";
import DashboardShowcase from "@/components/dashboard/DashboardShowcase";
import CTABanner from "@/components/shared/CTABanner";
import FeatureSection from "@/components/cards/FeatureSection";
import Metrics from "@/components/analytics/Metrics";
import AISearch from "@/components/analytics/AISearch";
import Integrations from "@/components/cards/Integrations";
import CompetitiveEdge from "@/components/cards/CompetitiveEdge";
import Testimonials from "@/components/testimonials/Testimonials";
import PricingPreview from "@/components/pricing/PricingPreview";
import FAQ from "@/components/faq/FAQ";
import FinalCTA from "@/components/shared/FinalCTA";
import Footer from "@/components/footer/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main">
        {/* 1. Hero — one input, one CTA: the whole first screen is "scan your brand". */}
        <InsightHero />
        {/* Trust strip */}
        <LogoCloud />
        {/* 2. AI engines trust section — who/why different */}
        <EngineCoverage />
        {/* 3. Problem statement — the shift from search to answers */}
        <ProblemStatement />
        {/* 4. How it works — the mental model */}
        <HowItWorks />
        {/* 5. Interactive dashboard preview */}
        <DashboardShowcase />
        {/* Mid-funnel nudge */}
        <CTABanner />
        {/* 6. Outcome-based feature groups */}
        <FeatureSection />
        <Metrics />
        <AISearch />
        <Integrations />
        {/* 7. Competitive differentiation */}
        <CompetitiveEdge />
        {/* 8. Customer success stories */}
        <Testimonials />
        {/* 9. Pricing preview */}
        <PricingPreview />
        {/* 10. FAQ */}
        <FAQ />
        {/* 11. Final CTA */}
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
