export class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(dataOrWidth: any, widthOrHeight?: number, height?: number) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight!;
      this.height = height!;
    } else {
      this.width = dataOrWidth;
      this.height = widthOrHeight!;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
}

export class MockOffscreenCanvas {
  width: number;
  height: number;
  ctx: any;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ctx = {
      fillStyle: '',
      filter: 'none',
      fillRect: () => {},
      drawImage: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4).fill(200)
      }),
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4)
      }),
      putImageData: () => {}
    };
  }

  getContext(id: string) {
    if (id === '2d') return this.ctx;
    return null;
  }
}

(globalThis as any).ImageData = MockImageData;
if (typeof self !== 'undefined') {
  (self as any).ImageData = MockImageData;
  (self as any).OffscreenCanvas = MockOffscreenCanvas;
}
(globalThis as any).OffscreenCanvas = MockOffscreenCanvas;
(globalThis as any).createImageBitmap = async (canvas: any) => ({
  width: canvas?.width || 0,
  height: canvas?.height || 0,
  close: () => {}
});
