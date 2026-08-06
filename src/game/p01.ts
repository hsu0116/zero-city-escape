export type Direction = "N" | "E" | "S" | "W";

export type Receipt = {
  id: string;
  label: string;
  amount: number;
  entryMark: string;
  exitMark: string;
  print: string;
};

export type Property = {
  id: string;
  name: string;
  shortName: string;
  tariffs: [number, number, number];
  buildings: 0 | 1 | 2;
  mortgaged: boolean;
  incoming: Direction;
  district: string;
};

export type ScanSlot = {
  receiptId: string;
  propertyId: string;
  rotation: number;
};

export type ScanValidation = {
  solved: boolean;
  chain: boolean;
  rents: boolean;
  orientations: boolean;
};

export const RECEIPTS: Receipt[] = [
  { id: "r-b", label: "영수증 B", amount: 42, entryMark: "□", exitMark: "✕", print: "사각 파임 / 교차 절취" },
  { id: "r-d", label: "영수증 D", amount: 18, entryMark: "✕", exitMark: "◆", print: "교차 파임 / 검표 마감" },
  { id: "r-a", label: "영수증 A", amount: 22, entryMark: "○", exitMark: "≋", print: "원형 파임 / 물결 절취" },
  { id: "r-c", label: "영수증 C", amount: 30, entryMark: "▲", exitMark: "○", print: "삼각 파임 / 원형 절취" },
  { id: "r-e", label: "영수증 E", amount: 7, entryMark: "≋", exitMark: "□", print: "물결 파임 / 사각 절취" },
];

export const PROPERTIES: Property[] = [
  { id: "camellia", name: "동백 시장", shortName: "동백", tariffs: [10, 18, 30], buildings: 2, mortgaged: false, incoming: "E", district: "꽃잎 구역" },
  { id: "clock", name: "시계 광장", shortName: "시계", tariffs: [12, 22, 36], buildings: 1, mortgaged: false, incoming: "N", district: "톱니 구역" },
  { id: "harbor", name: "항만 창고", shortName: "항만", tariffs: [14, 26, 42], buildings: 0, mortgaged: true, incoming: "W", district: "파도 구역" },
  { id: "cloud", name: "구름 정거장", shortName: "구름", tariffs: [10, 22, 42], buildings: 2, mortgaged: false, incoming: "S", district: "점선 구역" },
  { id: "bank", name: "중앙은행", shortName: "은행", tariffs: [14, 18, 36], buildings: 1, mortgaged: false, incoming: "E", district: "격자 구역" },
  { id: "relay", name: "전파 교환소", shortName: "전파", tariffs: [12, 26, 30], buildings: 0, mortgaged: false, incoming: "N", district: "안테나 구역" },
];

export const START_MARK = "▲";
export const END_MARK = "◆";
export const WORD_ANSWER = "무소유";

export const SOLUTION: ScanSlot[] = [
  { receiptId: "r-c", propertyId: "camellia", rotation: 90 },
  { receiptId: "r-a", propertyId: "clock", rotation: 0 },
  { receiptId: "r-e", propertyId: "harbor", rotation: 270 },
  { receiptId: "r-b", propertyId: "cloud", rotation: 180 },
  { receiptId: "r-d", propertyId: "bank", rotation: 90 },
];

export const EMPTY_SCAN_SLOTS: ScanSlot[] = Array.from({ length: 5 }, () => ({
  receiptId: "",
  propertyId: "",
  rotation: 0,
}));

export function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

export function currentRent(property: Property): number {
  const regular = property.tariffs[property.buildings];
  return property.mortgaged ? regular / 2 : regular;
}

export function validateReceiptChain(slots: ScanSlot[]): boolean {
  if (slots.length !== SOLUTION.length) return false;
  let expected = START_MARK;
  for (const slot of slots) {
    const receipt = RECEIPTS.find((item) => item.id === slot.receiptId);
    if (!receipt || receipt.entryMark !== expected) return false;
    expected = receipt.exitMark;
  }
  return expected === END_MARK && new Set(slots.map((slot) => slot.receiptId)).size === slots.length;
}

export function validateRentAssignments(slots: ScanSlot[]): boolean {
  if (slots.length !== SOLUTION.length) return false;
  if (new Set(slots.map((slot) => slot.propertyId)).size !== slots.length) return false;
  return slots.every((slot) => {
    const receipt = RECEIPTS.find((item) => item.id === slot.receiptId);
    const property = PROPERTIES.find((item) => item.id === slot.propertyId);
    return Boolean(receipt && property && receipt.amount === currentRent(property));
  });
}

export function validateOrientations(slots: ScanSlot[]): boolean {
  if (slots.length !== SOLUTION.length) return false;
  return slots.every((slot, index) => {
    const expected = SOLUTION[index];
    return slot.receiptId === expected.receiptId
      && slot.propertyId === expected.propertyId
      && normalizeRotation(slot.rotation) === expected.rotation;
  });
}

export function validateScan(slots: ScanSlot[]): ScanValidation {
  const chain = validateReceiptChain(slots);
  const rents = validateRentAssignments(slots);
  const orientations = chain && rents && validateOrientations(slots);
  return { solved: chain && rents && orientations, chain, rents, orientations };
}

export function normalizeWord(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

export function isCorrectWord(value: string): boolean {
  return normalizeWord(value) === WORD_ANSWER;
}
