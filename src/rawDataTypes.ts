export interface GoAllResponse {
  cpu: GoCPUData;
  memory: GoMemoryData;
  disk: GoDiskData;
  network: GoNetworkData;
  host: GoHostData;
  load: GoLoadData;
}

export interface GoCPUData {
  info: GoCPUInfo[];
  percent: number[];
  times: GoCPUTimes[];
}

export interface GoCPUInfo {
  cpu: number;
  vendorId: string;
  family: string;
  model: string;
  stepping: number;
  physicalId: string;
  coreId: string;
  cores: number;
  modelName: string;
  mhz: number;
  cacheSize: number;
  flags: string[];
  microcode: string;
}

export interface GoCPUTimes {
  cpu: string;
  user: number;
  system: number;
  idle: number;
  nice: number;
  iowait: number;
  irq: number;
  softirq: number;
  steal: number;
  guest: number;
  guestNice: number;
}

export interface GoMemoryData {
  virtual: GoVirtualMemoryStat;
  swap: GoSwapMemoryStat;
}

export interface GoVirtualMemoryStat {
  total: number;
  available: number;
  used: number;
  usedPercent: number;
  free: number;
  active: number;
  inactive: number;
  wired: number;
  laundry: number;
  buffers: number;
  cached: number;
  writeBack: number;
  dirty: number;
  writeBackTmp: number;
  shared: number;
  slab: number;
  sreclaimable: number;
  sunreclaim: number;
  pageTables: number;
  swapCached: number;
}

export interface GoSwapMemoryStat {
  total: number;
  used: number;
  free: number;
  usedPercent: number;
  sin: number;
  sout: number;
}

export interface GoDiskData {
  partitions: GoPartitionStat[];
  usage: GoUsageStat[];
  ioCounters: Record<string, GoDiskIOCountersStat>;
}

export interface GoPartitionStat {
  device: string;
  mountpoint: string;
  fstype: string;
  opts: string[];
}

export interface GoUsageStat {
  path: string;
  fstype: string;
  total: number;
  free: number;
  used: number;
  usedPercent: number;
  inodesTotal: number;
  inodesUsed: number;
  inodesFree: number;
  inodesUsedPercent: number;
}

export interface GoDiskIOCountersStat {
  readCount: number;
  mergedReadCount: number;
  writeCount: number;
  mergedWriteCount: number;
  readBytes: number;
  writeBytes: number;
  readTime: number;
  writeTime: number;
  iopsInProgress: number;
  ioTime: number;
  weightedIO: number;
  name: string;
  serialNumber: string;
  label: string;
}

export interface GoNetworkData {
  ioCounters: GoNetIOCountersStat[];
}

export interface GoNetIOCountersStat {
  name: string;
  bytesSent: number;
  bytesRecv: number;
  packetsSent: number;
  packetsRecv: number;
  errin: number;
  errout: number;
  dropin: number;
  dropout: number;
  fifoin: number;
  fifoout: number;
}

export interface GoHostData {
  info: GoHostInfoStat;
  sensors: GoTemperatureStat[];
}

export interface GoHostInfoStat {
  hostname: string;
  uptime: number;
  bootTime: number;
  procs: number;
  os: string;
  platform: string;
  platformFamily: string;
  platformVersion: string;
  kernelVersion: string;
  kernelArch: string;
  virtualizationSystem: string;
  virtualizationRole: string;
  hostId: string;
}

export interface GoTemperatureStat {
  sensorKey: string;
  temperature: number;
  sensorHigh: number;
  sensorCritical: number;
}

export interface GoLoadData {
  avg: GoLoadAvgStat;
  misc: GoLoadMiscStat;
}

export interface GoLoadAvgStat {
  load1: number;
  load5: number;
  load15: number;
}

export interface GoLoadMiscStat {
  procsTotal: number;
  procsCreated: number;
  procsRunning: number;
  procsBlocked: number;
  ctxt: number;
}
