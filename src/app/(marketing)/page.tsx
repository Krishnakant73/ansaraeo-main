import Navbar from "@/components/navigation/Navbar";
import Hero from "@/components/hero/Hero";
import LogoCloud from "@/components/shared/LogoCloud";
import FeatureSection from "@/components/cards/FeatureSection";
import Metrics from "@/components/analytics/Metrics";
import CTABanner from "@/components/shared/CTABanner";
import AISearch from "@/components/analytics/AISearch";
import AnalyticsTable from "@/components/analytics/AnalyticsTable";
import Testimonials from "@/components/testimonials/Testimonials";
import Integrations from "@/components/cards/Integrations";
import FAQ from "@/components/faq/FAQ";
import FinalCTA from "@/components/shared/FinalCTA";
import Footer from "@/components/footer/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <LogoCloud />
        <FeatureSection />
        <Metrics />
        <CTABanner />
        <AISearch />
        <AnalyticsTable />
        <Testimonials />
        <Integrations />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
