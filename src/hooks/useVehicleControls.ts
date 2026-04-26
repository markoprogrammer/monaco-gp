import { useEffect, useRef } from "react";

export interface VehicleInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  reset: boolean;
}

// Shared input — keyboard + touch UI both mutate this object.
const sharedInput: VehicleInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  reset: false,
};

export function setVehicleInput<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
  sharedInput[key] = value;
}

export function useVehicleControls() {
  const input = useRef<VehicleInput>(sharedInput);

  useEffect(() => {
    const keyMap: Record<string, keyof VehicleInput> = {
      KeyW: "forward",
      ArrowUp: "forward",
      KeyS: "backward",
      ArrowDown: "backward",
      KeyA: "left",
      ArrowLeft: "left",
      KeyD: "right",
      ArrowRight: "right",
      Space: "handbrake",
      KeyR: "reset",
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const action = keyMap[e.code];
      if (action) {
        e.preventDefault();
        input.current[action] = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const action = keyMap[e.code];
      if (action) {
        input.current[action] = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return input;
}
