import { CountdownHero } from "@/components/admin/landing/countdown-hero";
import { QuickActions } from "@/components/admin/landing/quick-actions";
import { GuestsCard } from "@/components/admin/landing/guests-card";
import { MoneyCard } from "@/components/admin/landing/money-card";
import { ChecklistCard } from "@/components/admin/landing/checklist-card";
import { UpcomingAppointmentsCard } from "@/components/admin/landing/upcoming-appointments-card";

export default function AdminLandingPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <CountdownHero />
      <QuickActions />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        <GuestsCard />
        <MoneyCard />
      </div>
      <ChecklistCard />
      <UpcomingAppointmentsCard />
    </div>
  );
}
