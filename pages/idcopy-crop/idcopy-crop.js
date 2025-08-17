import WeCropper from '../../components/we-cropper/we-cropper.js';

const device = wx.getSystemInfoSync();
const width = device.windowWidth;
const height = device.windowHeight - 60; // Subtract footer height

Page({
  data: {
    src: '',
    type: '',
    cropperOpt: {
      id: 'cropper',
      width,
      height,
      scale: 2.5,
      zoom: 10,
      minScale: 0.2,
      cut: {
        x: (width - 300) / 2,
        y: (height - 300 / 1.586) / 2,
        width: 300,
        height: 300 / 1.586
      }
    }
  },

  touchStart(e) {
    this.wecropper.touchStart(e);
  },

  touchMove(e) {
    this.wecropper.touchMove(e);
  },

  touchEnd(e) {
    this.wecropper.touchEnd(e);
  },

  onLoad(options) {
    this.setData({
      src: options.src,
      type: options.type
    });

    const { cropperOpt } = this.data;

    this.wecropper = new WeCropper(cropperOpt)
      .on('ready', (ctx) => {
        console.log(`wecropper is ready for work!`);
      })
      .on('beforeImageLoad', (ctx) => {
        wx.showToast({
          title: '上传中',
          icon: 'loading',
          duration: 20000
        });
      })
      .on('imageLoad', (ctx) => {
        wx.hideToast();
      });

    this.wecropper.pushOrign(this.data.src);
  },

  rotate() {
    // Use the library's built-in rotate method.
    // The library's documentation indicates it handles 90-degree rotations.
    this.wecropper.rotate();
  },

  getCropperImage() {
    this.wecropper.getCropperImage((tempFilePath) => {
      if (tempFilePath) {
        const eventChannel = this.getOpenerEventChannel();
        eventChannel.emit('acceptDataFromOpenerPage', { croppedImagePath: tempFilePath, type: this.data.type });
        wx.navigateBack();
      } else {
        console.log('获取图片地址失败，请稍后重试');
      }
    });
  }
});
