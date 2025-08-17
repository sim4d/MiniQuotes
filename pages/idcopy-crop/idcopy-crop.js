import WeCropper from '../../components/we-cropper/we-cropper.js';

const device = wx.getSystemInfoSync();
const width = device.windowWidth;
const height = device.windowHeight - 60; // Subtract footer height

Page({
  data: {
    src: '', // The current image being displayed
    type: '',
    isProcessingRotation: false,
    tempCanvasStyle: '',
    cropperOpt: {
      id: 'cropper',
      width,
      height,
      scale: 2.5,
      zoom: 10,
      minScale: 0.2,
      cut: {
        x: (width - 300) / 2,
        y: (height - (300 / 1.586)) / 2,
        width: 300,
        height: 300 / 1.586
      }
    }
  },

  touchStart(e) { if (this.wecropper) this.wecropper.touchStart(e); },
  touchMove(e) { if (this.wecropper) this.wecropper.touchMove(e); },
  touchEnd(e) { if (this.wecropper) this.wecropper.touchEnd(e); },

  onLoad(options) {
    this.rotation = 0;
    this.setData({ type: options.type });

    const { cropperOpt } = this.data;
    this.wecropper = new WeCropper(cropperOpt)
      .on('ready', (ctx, instance) => {})
      .on('beforeImageLoad', (ctx, instance) => {
        wx.showLoading({ title: '图片加载中...', mask: true });
      })
      .on('imageLoad', (ctx, instance) => {
        wx.hideLoading();
        this.setData({ isProcessingRotation: false });

        if (this.targetScaleOnLoad) {
          this.wecropper.newScale = this.targetScaleOnLoad;
          this.wecropper.oldScale = this.targetScaleOnLoad;
          this.wecropper.scaleWidth = Math.round(this.wecropper.baseWidth * this.targetScaleOnLoad);
          this.wecropper.scaleHeight = Math.round(this.wecropper.baseHeight * this.targetScaleOnLoad);
          
          const oldScaleWidth = this.wecropper.baseWidth;
          const oldScaleHeight = this.wecropper.baseHeight;
          const newScaleWidth = this.wecropper.scaleWidth;
          const newScaleHeight = this.wecropper.scaleHeight;

          this.wecropper.imgLeft = this.wecropper.imgLeft - (newScaleWidth - oldScaleWidth) / 2;
          this.wecropper.imgTop = this.wecropper.imgTop - (newScaleHeight - oldScaleHeight) / 2;
          
          this.wecropper.rectX = this.wecropper.imgLeft;
          this.wecropper.rectY = this.wecropper.imgTop;

          this.wecropper.outsideBound(this.wecropper.imgLeft, this.wecropper.imgTop);

          this.wecropper.updateCanvas();
          this.targetScaleOnLoad = null;
        }
      });
    
    // Normalize the image to fix orientation issues before loading into cropper
    this.normalizeImage(options.src, (normalizedSrc) => {
      this.normalizedSrc = normalizedSrc; // This is the correctly oriented, 0-degree image
      this.setData({ src: normalizedSrc });
      this.wecropper.pushOrign(normalizedSrc);
    });
  },

  normalizeImage(src, callback) {
    wx.showLoading({ title: '校正图片方向...', mask: true });
    const canvas = wx.createCanvasContext('tempCanvas');

    wx.getImageInfo({
      src: src,
      success: (res) => {
        const { width, height } = res;
        this.setData({ tempCanvasStyle: `width:${width}px; height:${height}px;` }, () => {
          canvas.drawImage(src, 0, 0, width, height);
          canvas.draw(false, () => {
            wx.canvasToTempFilePath({
              canvasId: 'tempCanvas',
              fileType: 'jpg',
              quality: 1.0,
              success: (tempRes) => {
                wx.hideLoading();
                if (callback) callback(tempRes.tempFilePath);
              },
              fail: () => {
                wx.hideLoading();
                wx.showToast({ title: '图片校正失败', icon: 'none' });
              }
            }, this);
          });
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '获取图片信息失败', icon: 'none' });
      }
    });
  },

  rotate() {
    if (this.data.isProcessingRotation || !this.normalizedSrc) return;

    this.setData({ isProcessingRotation: true });
    wx.showLoading({ title: '旋转中...', mask: true });

    this.targetScaleOnLoad = this.wecropper.oldScale;
    this.rotation = (this.rotation - 90 + 360) % 360;

    const canvas = wx.createCanvasContext('tempCanvas');
    
    wx.getImageInfo({
      src: this.normalizedSrc, // Always use the normalized image as the source for rotation
      success: (res) => {
        const { width, height } = res;
        
        const MAX_DIMENSION = 1024;
        let scaledWidth = width;
        let scaledHeight = height;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            scaledWidth = MAX_DIMENSION;
            scaledHeight = Math.round(MAX_DIMENSION * (height / width));
          } else {
            scaledHeight = MAX_DIMENSION;
            scaledWidth = Math.round(MAX_DIMENSION * (width / height));
          }
        }

        const canvasWidth = this.rotation % 180 !== 0 ? scaledHeight : scaledWidth;
        const canvasHeight = this.rotation % 180 !== 0 ? scaledWidth : scaledHeight;

        this.setData({ tempCanvasStyle: `width:${canvasWidth}px; height:${canvasHeight}px;` }, () => {
          canvas.translate(canvasWidth / 2, canvasHeight / 2);
          canvas.rotate(this.rotation * Math.PI / 180);
          canvas.drawImage(this.normalizedSrc, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
          
          canvas.draw(false, () => {
            wx.canvasToTempFilePath({
              canvasId: 'tempCanvas',
              fileType: 'jpg',
              quality: 0.9,
              success: (tempRes) => {
                const newSrc = tempRes.tempFilePath;
                this.setData({ src: newSrc });
                this.wecropper.pushOrign(newSrc);
              },
              fail: () => {
                wx.hideLoading();
                this.setData({ isProcessingRotation: false });
                this.targetScaleOnLoad = null;
                wx.showToast({ title: '旋转失败', icon: 'none' });
              }
            }, this);
          });
        });
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ isProcessingRotation: false });
        this.targetScaleOnLoad = null;
        wx.showToast({ title: '获取图片信息失败', icon: 'none' });
      }
    });
  },

  getCropperImage() {
    this.wecropper.getCropperImage((tempFilePath) => {
      if (tempFilePath) {
        const eventChannel = this.getOpenerEventChannel();
        eventChannel.emit('acceptDataFromOpenerPage', { croppedImagePath: tempFilePath, type: this.data.type });
        wx.navigateBack();
      } else {
        wx.showToast({
          title: '获取裁剪图片失败',
          icon: 'none'
        });
      }
    });
  }
});
