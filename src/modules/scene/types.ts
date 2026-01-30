export type SceneStateV1 = {
  version: 1
  canvas: {
    background: string
  }
  logo: {
    seed: number
    variant: string
    strokeCount: number
    pointsPerStroke: number
    color: string
    lineWidth: number
  }
  card: {
    text: string
    templateId: 'center' | 'lowerThird'
    fontFamily: string
    fontSize: number
    textColor: string
  }
}

export type Vec2 = { x: number; y: number }
