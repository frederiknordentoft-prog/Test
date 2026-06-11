import { create } from 'zustand'

interface WheelState {
  /** Rotor rotation.y in radians. Set directly by the debug tool for now. */
  rotorAngle: number
  setRotorAngle: (rotorAngle: number) => void
}

export const useWheelStore = create<WheelState>((set) => ({
  rotorAngle: 0,
  setRotorAngle: (rotorAngle) => set({ rotorAngle }),
}))
