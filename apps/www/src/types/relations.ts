// apps/www/src/types/relations.ts
// Part B stub — query engine plugs in here
export type RelationMap = Map<string, Set<string>>;

export interface RelationQuery {
  findRefsTo: (id: string) => string[];
  findRefsFrom: (path: string) => string[];
}