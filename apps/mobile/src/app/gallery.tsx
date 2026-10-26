import { Redirect, router } from 'expo-router';
import ScorerGallery from '../../scorer-gallery';

export default function GalleryRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ScorerGallery onExit={() => router.replace('/')} />;
}
