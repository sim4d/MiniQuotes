Page({
  data: {
    idCardFront: '',
    idCardBack: ''
  },

  chooseImage: function(e) {
    const type = e.currentTarget.dataset.type;
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        console.log('[idcopy.js] Image chosen, temporary path:', tempFilePath); // Add log
        wx.navigateTo({
          url: `../idcopy-crop/idcopy-crop?src=${tempFilePath}&type=${type}`,
          events: {
            acceptDataFromOpenerPage: (data) => {
              if (data.type === 'front') {
                this.setData({
                  idCardFront: data.croppedImagePath
                });
              } else if (data.type === 'back') {
                this.setData({
                  idCardBack: data.croppedImagePath
                });
              }
            }
          }
        });
      }
    });
  },

  onLoad: function() {
  },

  createCopy: function() {
    if (this.data.idCardFront && this.data.idCardBack) {
      wx.navigateTo({
        url: `../idcopy-preview/idcopy-preview?front=${this.data.idCardFront}&back=${this.data.idCardBack}`
      });
    } else {
      wx.showToast({
        title: '请选择正反面照片',
        icon: 'none'
      });
    }
  }
});