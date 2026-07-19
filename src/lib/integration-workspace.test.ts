import { describe, it, expect } from "vitest";
import { providerLabel, statusTone, providerHelpUrl } from "./integration-workspace";

describe("integration-workspace helpers", () => {
  describe("providerLabel", () => {
    it("humanizes known providers", () => {
      expect(providerLabel("ga4")).toBe("Google Analytics 4");
      expect(providerLabel("shopify")).toBe("Shopify");
      expect(providerLabel("gsc")).toBe("Google Search Console");
    });
    it("returns the raw string for unknown providers", () => {
      expect(providerLabel("bing_webmaster")).toBe("bing_webmaster");
      expect(providerLabel("")).toBe("");
    });
  });

  describe("statusTone", () => {
    it("returns positive for connected", () => {
      expect(statusTone("connected")).toBe("positive");
    });
    it("returns negative for error/revoked", () => {
      expect(statusTone("error")).toBe("negative");
      expect(statusTone("revoked")).toBe("negative");
    });
    it("returns neutral for anything else", () => {
      expect(statusTone("paused")).toBe("neutral");
      expect(statusTone("unknown")).toBe("neutral");
    });
  });

  describe("providerHelpUrl", () => {
    it("routes GA4 + Shopify to /settings/analytics", () => {
      expect(providerHelpUrl("ga4", "acme")).toBe("/dashboard/b/acme/settings/analytics");
      expect(providerHelpUrl("shopify", "acme")).toBe("/dashboard/b/acme/settings/analytics");
    });
    it("routes GSC to its own page", () => {
      expect(providerHelpUrl("gsc", "acme")).toBe("/dashboard/b/acme/gsc");
    });
    it("falls back to the org integrations page", () => {
      expect(providerHelpUrl("bing", "acme")).toBe("/dashboard/settings/integrations");
    });
  });
});
