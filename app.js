// app.js
App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })
  },
  globalData: {
    userInfo: null,
    quotesAuthor: 'Eckhart Tolle',
    allQuotes: [
      'As soon as you honor the present moment, all unhappiness and struggle dissolve.',
      'It is not uncommon for people to spend their whole life waiting to start living.',
      'What the ego sees as weakness is your Being in its purity, innocence.',
      'To complain is always nonacceptance of what is. It invariably carries an unconscious negative charge. When you complain, you make yourself into a victim.',
      'The ego’s needs are endless. It feels vulnerable and threatened and so lives in a state of fear and want.',
      'The intensity of the pain depends on the degree of resistance to the present moment, and this in turn depends on how strongly you are identified with your mind.',
      'In the Now, in the absence of time, all your problems dissolve. Suffering needs time; it cannot survive in the Now.',
      'The mind creates an obsession with the future as an escape from the unsatisfactory present.',
      'The most common ego identifications have to do with possessions, the work you do, social status and recognition, knowledge and education, physical appearance, special abilities, relationships, personal and family history, belief systems, and often also political, nationalistic, racial, religious, and other collective identifications. None of these is you.'
    ]
  }
})
