import type { Metadata } from "next";
import { VessylExperience } from "./components/VessylExperience";

export const metadata: Metadata = {
  title: "The Dome — Immersive Wellness in Arenal, Costa Rica",
  description:
    "Enter The Dome at The Vessyl: an immersive resort experience shaped by nature, spatial sound, vibration, light, and deep restorative rest in Arenal, Costa Rica.",
};

export default function Home() {
  return <VessylExperience />;
}
