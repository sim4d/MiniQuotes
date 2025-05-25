// index.js
Page({
    data: {
        // 页面的初始数据
    },

    // 导航到 Quotes 页面
    navigateToQuotes: function () {
        wx.navigateTo({
            url: '../quotes/quotes'
        })
    }
})