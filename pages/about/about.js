Page({
    /**
     * 页面的初始数据
     */
    data: {
        adLoaded: false,
        adImage: '/images/ad-placeholder.png',
        lastTapTime: 0, // 记录上次点击时间
        showModal: false
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        // 模拟广告加载
        setTimeout(() => {
            this.setData({
                adLoaded: true
            });
        }, 1000);
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {
        return {
            title: 'MiniVerse',
            path: '/pages/about/about'
        }
    },

    /**
     * 标题点击事件处理
     */
    onTitleTap: function (e) {
        const currentTime = new Date().getTime()
        const lastTapTime = this.data.lastTapTime
        
        // 如果两次点击间隔小于300ms，认为是双击
        if (currentTime - lastTapTime < 300) {
            // 进入Tetris游戏
            wx.navigateTo({
                url: '../tetris/tetris'
            })
        }
        
        this.setData({
            lastTapTime: currentTime
        })
    },

    /**
     * 广告点击处理
     */
    onAdTap() {
        wx.showToast({
            title: '感谢支持！跳转中...',
            icon: 'none'
        });
        // 实际项目中这里应该是广告跳转逻辑
    },

    /**
     * 显示参考文献弹窗
     */
    showReferences: function() {
      this.setData({ showModal: true });
    },

    /**
     * 隐藏参考文献弹窗
     */
    hideReferences: function() {
      this.setData({ showModal: false });
    },

    /**
     * 复制链接到剪贴板
     */
    copyUrl: function (e) {
      const url = e.currentTarget.dataset.url;
      wx.setClipboardData({
        data: url,
        success: function () {
          wx.showToast({
            title: '链接已复制',
            icon: 'success',
            duration: 2000
          });
        }
      });
    }
})