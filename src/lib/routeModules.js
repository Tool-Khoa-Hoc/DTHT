export const routeModuleLoaders = {
  RootLayout: () => import('../components/RootLayout'),
  Home: () => import('../pages/Home'),
  GPACalculator: () => import('../pages/GPACalculator'),
  Library: () => import('../pages/Library'),
  Profile: () => import('../pages/Profile'),
  Roadmap: () => import('../pages/Roadmap'),
  Admin: () => import('../pages/Admin'),
  AdmissionCalculator: () => import('../pages/AdmissionCalculator'),
  SchoolFinder: () => import('../pages/SchoolFinder'),
  StudyArena: () => import('../pages/StudyArena'),
  Collaborator: () => import('../pages/Collaborator'),
  UserProfile: () => import('../pages/UserProfile'),
  OnlineLearning: () => import('../pages/OnlineLearning'),
  Notes: () => import('../pages/Notes'),
  CourseComboHs12: () => import('../pages/CourseComboHs12'),
};

const preloadCache = new Map();

export function shouldPrefetchModules() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const connection = navigator.connection;
  const effectiveType = connection?.effectiveType ?? '';
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4;
  const limitedCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency < 6;

  return !(
    connection?.saveData ||
    ['slow-2g', '2g', '3g'].includes(effectiveType) ||
    lowMemory ||
    limitedCpu
  );
}

export function preloadRouteModule(key) {
  if (!shouldPrefetchModules()) {
    return Promise.resolve(null);
  }

  if (!routeModuleLoaders[key]) {
    return Promise.resolve(null);
  }

  if (!preloadCache.has(key)) {
    preloadCache.set(
      key,
      routeModuleLoaders[key]().catch((error) => {
        preloadCache.delete(key);
        throw error;
      }),
    );
  }

  return preloadCache.get(key);
}
