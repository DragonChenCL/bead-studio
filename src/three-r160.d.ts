import 'three/examples/jsm/controls/OrbitControls.js';

declare module 'three/examples/jsm/controls/OrbitControls.js' {
  interface OrbitControls {
    update(deltaTime?: number): boolean;
  }
}
