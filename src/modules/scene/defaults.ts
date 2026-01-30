import type { SceneStateV1 } from './types'

export const defaultSceneState: SceneStateV1 = {
  version: 1,
  canvas: {
    background: '#0b0f1a',
  },
  logo: {
    seed: 20260128,
    variant: 'a',
    strokeCount: 28,
    pointsPerStroke: 48,
    color: '#e6f2ff',
    lineWidth: 2,
  },
  card: {
    text: '新春快乐\n愿你我奔赴热爱',
    templateId: 'center',
    fontFamily: 'system-ui',
    fontSize: 56,
    textColor: '#ffffff',
  },
}
