function getPngDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 24) {
    return { width: 0, height: 0 };
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export { getPngDimensions };
