import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function AppPage() {
  return (
    <ErrorBoundary>
      <WorkspaceLayout />
    </ErrorBoundary>
  );
}
