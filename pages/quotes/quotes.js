// quotes.js
Page({
  data: {
    quotesAuthor: null,
    allQuotes: null,
    currentQuote: null,
    quoteItr: 0
  },
  /** 生命周期函数--监听页面加载 */
  onLoad(options) {
    const appInstance = getApp();
    this.setData({
      allQuotes: appInstance.globalData.allQuotes,
      quotesAuthor: appInstance.globalData.quotesAuthor,
      currentQuote: appInstance.globalData.allQuotes[0]
    });
  },
  // 刷新 quote，随机选择一句新的
  refreshQuote() {
    const quotes = this.data.allQuotes;
    if (!quotes || quotes.length === 0) return;

    // 生成一个不同于当前的随机索引
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * quotes.length);
    } while (quotes[randomIndex] === this.data.currentQuote && quotes.length > 1);

    this.setData({
      currentQuote: quotes[randomIndex]
    });
  },
  // 复制当前 quote
  copyQuote() {
    const textToCopy = `${this.data.currentQuote} — ${this.data.quotesAuthor}`;
    wx.setClipboardData({
      data: textToCopy,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success',
          duration: 2000
        });
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshQuote();
    wx.stopPullDownRefresh();
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: `${this.data.currentQuote.substring(0, 30)}...`,
      path: '/pages/quotes/quotes',
      imageUrl: '/images/share-image.png' // 如果有分享图片可以添加
    }
  }
})