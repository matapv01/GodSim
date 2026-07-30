import config from './route-config.json'

export type RouteSceneId = 'town' | 'office'

export type RouteNode = {
  x: number
  z: number
  neighbors: string[]
}

type RouteConfigSchema = {
  citizenDestinationPoints: Array<{ id: string; x: number; z: number }>
  routeGraphs: Record<RouteSceneId, Record<string, RouteNode>>
}

const typed = config as RouteConfigSchema

export const CITIZEN_DESTINATION_POINTS = typed.citizenDestinationPoints
export const ROUTE_GRAPHS = typed.routeGraphs
