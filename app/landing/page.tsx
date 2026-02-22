import type { Metadata } from 'next';
import { LandingPage } from './LandingPage';

export const metadata: Metadata = {
  title: 'DevForge — Build Apps with AI',
};

export default function Landing() {
  return <LandingPage />;
}
