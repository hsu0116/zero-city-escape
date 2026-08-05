export type Direction = "N" | "E" | "S" | "W";
export type Turn = "left" | "straight" | "right";

export type Receipt = {
  id: string;
  stationId: string;
  station: string;
  timeLabel: string;
  minutesFromBell: number;
  seal: string;
};

export type MapNode = {
  id: string;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
  kind: "start" | "station" | "decoy";
};

export type MapEdge = { from: string; to: string; blocked?: boolean };

export const RECEIPTS: Receipt[] = [
  { id: "r-cloud", stationId: "cloud", station: "구름 정거장", timeLabel: "종 후 11분", minutesFromBell: 11, seal: "구름" },
  { id: "r-camellia", stationId: "camellia", station: "동백 시장", timeLabel: "종 전 18분", minutesFromBell: -18, seal: "꽃" },
  { id: "r-bank", stationId: "bank", station: "중앙은행", timeLabel: "종 후 17분", minutesFromBell: 17, seal: "왕관" },
  { id: "r-clock", stationId: "clock", station: "시계 광장", timeLabel: "종 전 6분", minutesFromBell: -6, seal: "시계" },
  { id: "r-harbor", stationId: "harbor", station: "항만 창고", timeLabel: "종 후 3분", minutesFromBell: 3, seal: "닻" },
];

export const CORRECT_RECEIPT_ORDER = [...RECEIPTS]
  .sort((a, b) => a.minutesFromBell - b.minutesFromBell)
  .map((receipt) => receipt.id);

export const MAP_NODES: MapNode[] = [
  { id: "impound", label: "압류역", shortLabel: "출발", x: 4, y: 4, kind: "start" },
  { id: "camellia", label: "동백 시장", shortLabel: "동백", x: 3, y: 4, kind: "station" },
  { id: "clock", label: "시계 광장", shortLabel: "시계", x: 2, y: 4, kind: "station" },
  { id: "harbor", label: "항만 창고", shortLabel: "항만", x: 2, y: 3, kind: "station" },
  { id: "cloud", label: "구름 정거장", shortLabel: "구름", x: 1, y: 3, kind: "station" },
  { id: "bank", label: "중앙은행", shortLabel: "은행", x: 1, y: 2, kind: "station" },
  { id: "tax", label: "세금 골목", shortLabel: "세금", x: 4, y: 3, kind: "decoy" },
  { id: "hotel", label: "호텔 거리", shortLabel: "호텔", x: 3, y: 3, kind: "decoy" },
  { id: "park", label: "공원 지구", shortLabel: "공원", x: 3, y: 2, kind: "decoy" },
];

export const MAP_EDGES: MapEdge[] = [
  { from: "impound", to: "camellia" },
  { from: "camellia", to: "clock" },
  { from: "clock", to: "harbor" },
  { from: "harbor", to: "cloud" },
  { from: "cloud", to: "bank" },
  { from: "impound", to: "tax", blocked: true },
  { from: "camellia", to: "hotel", blocked: true },
  { from: "clock", to: "hotel", blocked: true },
  { from: "harbor", to: "hotel", blocked: true },
  { from: "hotel", to: "park", blocked: true },
  { from: "park", to: "bank", blocked: true },
];

export const CORRECT_ROUTE = ["impound", "camellia", "clock", "harbor", "cloud", "bank"];

export const GATE_STEPS: Array<{ station: string; incoming: Direction; outgoing: Direction; answer: Turn }> = [
  { station: "동백 시장", incoming: "N", outgoing: "W", answer: "left" },
  { station: "시계 광장", incoming: "W", outgoing: "W", answer: "straight" },
  { station: "항만 창고", incoming: "W", outgoing: "N", answer: "right" },
  { station: "구름 정거장", incoming: "N", outgoing: "W", answer: "left" },
  { station: "중앙은행", incoming: "W", outgoing: "N", answer: "right" },
];

const DIRECTION_ANGLE: Record<Direction, number> = { N: 0, E: 90, S: 180, W: 270 };

export function directionAngle(direction: Direction): number {
  return DIRECTION_ANGLE[direction];
}

export function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

export function requiredMapRotation(incoming: Direction): number {
  return normalizeRotation(360 - directionAngle(incoming));
}

export function relativeTurn(incoming: Direction, outgoing: Direction): Turn | "back" {
  const delta = normalizeRotation(directionAngle(outgoing) - directionAngle(incoming));
  if (delta === 270) return "left";
  if (delta === 0) return "straight";
  if (delta === 90) return "right";
  return "back";
}

export function isCorrectReceiptOrder(ids: string[]): boolean {
  return ids.length === CORRECT_RECEIPT_ORDER.length && ids.every((id, index) => id === CORRECT_RECEIPT_ORDER[index]);
}

export function isOpenEdge(from: string, to: string): boolean {
  return MAP_EDGES.some((edge) => !edge.blocked && ((edge.from === from && edge.to === to) || (edge.from === to && edge.to === from)));
}

export function canExtendRoute(route: string[], next: string): boolean {
  const current = route[route.length - 1];
  return Boolean(current && !route.includes(next) && isOpenEdge(current, next));
}

export function isCorrectRoute(route: string[]): boolean {
  return route.length === CORRECT_ROUTE.length && route.every((id, index) => id === CORRECT_ROUTE[index]);
}
