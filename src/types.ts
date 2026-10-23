export type DeviceModel = 'mcb' | 'tm' | 'etu' | 'idmt' | 'rcd' | 'custom';
export type DeviceCategory = 'MCB' | 'MCCB' | 'ACB' | 'RCBO' | 'RELAY' | 'FUSE' | 'DAMAGE' | 'EARTH' | 'OTHER';

export interface CurvePoint {
  I: number;
  t: number;
  t2?: number;
}

export interface CurveBreak {
  lo: (I: number) => number;
  hi: (I: number) => number;
  nom?: ((I: number) => number) | null;
  breaks: number[];
  pickup: number;
  summary: string;
  settingsText: string;
  isRelay?: boolean;
  none?: boolean;
}

export interface DeviceSource {
  title: string;
  publisher: string;
  url: string;
  accessed: string;
}

export interface BreakingCapacityOption {
  code: string;
  icu?: number;
  ics?: number;
  basis?: string;
  note?: string;
  icuBy?: [number, number][];
}

export interface DeviceDef {
  id: string;
  category: string;
  manufacturer: string;
  series: string;
  model: DeviceModel;
  standard?: string;
  refTempC?: number;
  ratings?: number[];
  ratingsByCurve?: Record<string, number[]>;
  curves?: Record<string, any>;
  thermal?: any;
  thermalByCurve?: Record<string, any>;
  ir?: any;
  ii?: any;
  L?: any;
  S?: any;
  I?: any;
  G?: any;
  rcd?: any;
  plug?: any;
  tms?: any;
  ctSec?: number[];
  highset?: any;
  tol?: number;
  start?: number;
  mMax?: number;
  instTimes?: { clearMin: number; tripMax: number };
  tolBasis?: string;
  notes?: string;
  breaking?: string;
  bc?: {
    options: BreakingCapacityOption[];
    [key: string]: any;
  };
  sources: string[];
  // For custom curve:
  mode?: 'line' | 'band';
  unit?: 'A' | 'x';
  base?: number;
  kV?: number;
  extend?: boolean;
  points?: CurvePoint[];
  saved?: boolean;
}

export interface StudyItemCable {
  on: boolean;
  mat: 'Cu' | 'Al';
  ins: 'PVC' | 'XLPE';
  method: string;
  S: number;
  Spe: number;
  L: number;
  n: number;
  ph: 1 | 3;
  Ib: number;
  pf: number;
  amb: number;
  kf: number;
  kind: 'auto' | 'final' | 'distribution';
  Iz: string | number;
}

export interface StudyItem {
  uid: number;
  deviceId: string;
  kV: number;
  visible: boolean;
  label: string;
  color: string;
  downOf: number | null;
  curve?: string;
  In?: number;
  irX?: number;
  Ii?: number;
  IiX?: number;
  io?: number;
  fine?: number;
  Ir?: number;
  tr?: number;
  isd?: number;
  tsd?: number;
  i2t?: boolean;
  ctPri?: number;
  ctSec?: number;
  plugRange?: string;
  plug?: number;
  tms?: number;
  hs?: boolean;
  hsX?: number;
  hsT?: number;
  fn?: 'phase' | 'earth';
  idn?: number;
  rcdType?: string;
  rcdClass?: string;
  dt?: number;
  ig?: number;
  tg?: number;
  gi2t?: boolean;
  kI?: number;
  kT?: number;
  base?: number;
  bcCode?: string;
  icuUser?: number | string;
  cab?: Partial<StudyItemCable>;
  [key: string]: any;
}

export interface NetworkConfig {
  src: 'tx' | 'supply';
  kVA: number;
  uk: number;
  pk: string | number;
  txType: 'oil' | 'resin';
  mva: number;
  Un: number;
  ik3: number;
  xr: number;
  ze: string | number;
  earthing: 'TN' | 'TT';
  raRb: number;
  tol: '6' | '10';
  vdLimit: number;
  mark: boolean;
}

export interface ControlDef {
  key: string;
  label: string;
  kind: 'select' | 'range' | 'fixed' | 'toggle' | 'number';
  values?: any[];
  min?: number;
  max?: number;
  step?: number | string;
  unit?: string;
  value?: any;
  fmt?: (v: any) => string;
}

export interface DatabaseData {
  meta: {
    version: string;
    built: string;
    disclaimer: string;
    basisLegend: Record<string, string>;
  };
  sources: Record<string, DeviceSource>;
  devices: DeviceDef[];
  network: any;
}
