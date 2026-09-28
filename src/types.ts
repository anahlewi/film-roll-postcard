export interface SanityImage {
  /** bare Sanity CDN asset URL — transforms are appended at runtime */
  url: string;
  width: number;
  height: number;
  /** low-quality image placeholder, a tiny data: URI */
  lqip?: string;
}

export interface Frame {
  id: string;
  /** edge-print number, e.g. "24" or "24A" */
  code: string;
  alt: string;
  caption?: string;
  /** free text, e.g. "f/2 · 1/125 · ISO 400" — feeds the rebate markings */
  exposure?: string;
  shotAt?: string;
  image?: SanityImage;
}

export interface Roll {
  number: number;
  title: string;
  /** film-stock name printed along the lower rebate */
  stock: string;
  frames: Frame[];
  /** shared rolls: who it's for / from, and the note tucked in the canister */
  to?: string;
  from?: string;
  note?: string;
}
