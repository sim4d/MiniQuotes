// quotes.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    frontQuote: "https://www.azquotes.com/picture-quotes/quote-when-you-become-comfortable-with-uncertainty-infinite-possibilities-open-up-in-your-eckhart-tolle-82-43-41.jpg",
    firstPage: true,
    quotesAuthor: null,
    allQuotes: null,
    currentQuote: null,
    quoteItr: 0,
    motto1: '稍等加载 Quotes，点击图片继续',
    motto2: '下拉刷新，点击句子返回'
  },

  bindViewTap() {
    this.setData({
      firstPage: false,
      currentQuote: this.data.allQuotes [this.data.quoteItr]
    })
//    wx.navigateTo({
//      url: '../quotes/quotes'
//    })
  },

bindViewTap2() {
    wx.navigateTo({
      url: '../quotes/quotes'
    })
},

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 页面加载时，获取全局数据
    const appInstance = getApp();
    console.log(appInstance.globalData.allQuotes); // 输出：这是一个全局文本
    // 如果需要将全局数据设置到页面的data中，可以这样做：
    this.setData({
      quotesAuthor: appInstance.globalData.quotesAuthor,
      allQuotes: appInstance.globalData.allQuotes,
      quoteItr: Math.floor(Math.random() * (appInstance.globalData.allQuotes.length))
    });
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
    const appInstance = getApp();
    
    this.setData({
      quoteItr: Math.floor(Math.random() * (appInstance.globalData.allQuotes.length)),
      currentQuote: this.data.allQuotes [this.data.quoteItr]
    });
    wx.stopPullDownRefresh();
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

  }
})