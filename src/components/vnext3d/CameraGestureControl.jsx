import { Move3D, Orbit } from 'lucide-react';
import { CAMERA_GESTURE_MODES } from '../../vnext3d/cameraSystem';

const CAMERA_GESTURES = Object.freeze([
  {
    id: CAMERA_GESTURE_MODES.ORBIT,
    label: 'Rotate camera',
    icon: Orbit,
  },
  {
    id: CAMERA_GESTURE_MODES.PAN,
    label: 'Pan camera',
    icon: Move3D,
  },
]);

export default function CameraGestureControl({ mode, onChange }) {
  return (
    <div className="vnext3d-camera-gesture-control" role="group" aria-label="Camera drag mode">
      {CAMERA_GESTURES.map((gesture) => {
        const Icon = gesture.icon;
        return (
          <button
            type="button"
            key={gesture.id}
            className={mode === gesture.id ? 'is-active' : ''}
            aria-label={gesture.label}
            aria-pressed={mode === gesture.id}
            onClick={() => onChange(gesture.id)}
            title={gesture.label}
          >
            <Icon aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
