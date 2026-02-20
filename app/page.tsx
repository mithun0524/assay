import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Home() {
  return (
    <ErrorBoundary>
      <WorkspaceLayout />
    </ErrorBoundary>
  );
}