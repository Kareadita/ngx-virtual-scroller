export interface DemoItem {
  /** Stable id, also rendered as `data-index` so e2e can follow an item across frames */
  id: number;
  name: string;
}

const FIRST = [
  'Amber',
  'Basil',
  'Cedar',
  'Dune',
  'Ember',
  'Fern',
  'Garnet',
  'Hazel',
  'Iris',
  'Juniper',
];
const LAST = ['Archive', 'Ballad', 'Chronicle', 'Dispatch', 'Epilogue', 'Folio', 'Gazette'];

/** Deterministic items, so every page renders the same content on every run */
export function makeItems(count: number, firstId = 0): DemoItem[] {
  return Array.from({ length: count }, (_, i) => {
    const id = firstId + i;
    const n = Math.abs(id);
    return { id, name: `${FIRST[n % FIRST.length]} ${LAST[(n * 3) % LAST.length]}` };
  });
}

/** Cover image for an item; the images are tiny local SVGs */
export function coverUrl(id: number): string {
  return `covers/cover-${Math.abs(id) % 6}.svg`;
}
