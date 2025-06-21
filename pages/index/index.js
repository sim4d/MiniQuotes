// index.js
Page({
    data: {
        // 页面的初始数据
        lastTapTime: 0 // 记录上次点击时间
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

    // Tetris区域点击处理，用于检测双击
    onTetrisAreaTap: function (e) {
        const currentTime = new Date().getTime()
        const lastTapTime = this.data.lastTapTime
        
        // 如果两次点击间隔小于300ms，认为是双击
        if (currentTime - lastTapTime < 300) {
            this.navigateToTetris()
        }
        
        this.setData({
            lastTapTime: currentTime
        })
    },

    // 导航到血压监测页面
    navigateToBP: function () {
        wx.navigateTo({
            url: '../bp-monitor/bp-monitor'
        })
    },

    // 导航到超慢跑页面
    navigateToSuperjog: function () {
        wx.navigateTo({
            url: '../superjog/superjog'
        })
    }
})