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
    },

    // 导航到 Tetris 游戏页面
    navigateToTetris: function () {
        wx.navigateTo({
            url: '../tetris/tetris'
        })
    },

    // 导航到血压监测页面
    navigateToBP: function () {
        wx.navigateTo({
            url: '../bp-monitor/bp-monitor'
        })
    }
})