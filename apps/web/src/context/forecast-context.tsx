"use client";

/**
 * Re-exports ForecastProvider and useForecast from @moat/features so that all
 * web app imports resolve to the same React context object as the provider
 * injected in dashboard-providers.tsx.
 *
 * Do NOT redefine the context here — two separate createContext() calls with
 * the same shape produce different objects, which breaks the provider/consumer
 * relationship at runtime.
 */
export { ForecastProvider, useForecast } from "@moat/features";
