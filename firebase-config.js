// Firebase web config (public by design: access is controlled by the Firestore rules).
// Umi shares the project "spanish-shelf" with Spanish Shelf and Life Dashboard; its data lives in umi/{uid}.
// siteHost = the live site, where sign-in runs through our own domain (see vercel.json).
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAWZAOK24ufgVlRy4aZb6nE-8rv_HIt8jA",
  authDomain: "spanish-shelf.firebaseapp.com",
  projectId: "spanish-shelf",
  storageBucket: "spanish-shelf.firebasestorage.app",
  messagingSenderId: "764012002336",
  appId: "1:764012002336:web:3f4fa7d2f0b2da0209d045",
  siteHost: "umi-ten.vercel.app",
};
