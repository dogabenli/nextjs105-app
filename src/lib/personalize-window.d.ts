declare global {
  interface Window {
    Engage?: {
      triggerExperiences?: () => void;
      settings?: unknown;
    };
  }
}

export {};
