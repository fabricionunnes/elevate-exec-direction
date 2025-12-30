import { useParams, Navigate } from "react-router-dom";
import { getOnboardingByProductId } from "@/data/onboardingContent";
import { OnboardingSlideViewer } from "@/components/onboarding/OnboardingSlideViewer";

const OnboardingProductPage = () => {
  const { productId } = useParams<{ productId: string }>();
  
  if (!productId) {
    return <Navigate to="/onboarding" replace />;
  }

  const onboarding = getOnboardingByProductId(productId);

  if (!onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <OnboardingSlideViewer onboarding={onboarding} />;
};

export default OnboardingProductPage;
