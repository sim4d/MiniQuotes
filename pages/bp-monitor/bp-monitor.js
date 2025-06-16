// pages/bp-monitor/bp-monitor.js
import * as echarts from '../../components/ec-canvas/echarts';

const app = getApp();

// 格式化数字，用于补零
function formatNumber(n) {
  n = n.toString();
  return n[1] ? n : '0' + n;
}

// 格式化日期为 YYYY-MM-DD 格式
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return [year, month, day].map(formatNumber).join('-');
}

// 格式化显示日期
function formatDisplayDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  return `${year}年${month}月${day}日 星期${weekDay}`;
}

Page({
  data: {
    currentView: 'day', // day, week, month, year
    currentDate: '',
    displayDate: '',
    bpRecords: [],
    chartData: {},
    ec: {
      lazyLoad: true // 改为延迟加载模式
    },
    showAddDialog: false,
    newRecord: {
      systolic: '',
      diastolic: '',
      heartRate: '',
      time: '',
      date: ''
    },
    forceOldCanvas: true // 暂时强制使用旧版Canvas API来避免节点获取问题
  },

  onLoad: function (options) {
    this.setData({
      currentDate: formatDate(new Date()),
      displayDate: formatDisplayDate(new Date())
    });
    this.loadBPRecords();
  },

  onShow: function () {
    this.loadBPRecords();
    if (this.chart) {
      // 强制调整图表大小并更新数据
      setTimeout(() => {
        this.forceChartResize();
        this.updateChart();
      }, 300);
    } else {
      // 如果图表还未初始化，尝试重新初始化
      console.log('图表未初始化，尝试重新初始化');
      setTimeout(() => {
        this.checkAndInitChart();
      }, 500);
    }
  },

  onResize: function () {
    // 页面尺寸变化时调整图表大小
    if (this.chart) {
      setTimeout(() => {
        this.forceChartResize();
      }, 300);
    }
  },

  onReady: function () {
    // 页面渲染完成后再初始化图表
    console.log('页面onReady，准备初始化图表');

    // 使用更长的延时确保组件已完全渲染
    setTimeout(() => {
      this.initChart();
    }, 500);
  },

  // 初始化图表
  initChart: function () {
    console.log('设置图表初始化回调');

    // 获取组件实例
    const ecComponent = this.selectComponent('#mychart-dom-line');
    console.log('获取到图表组件:', ecComponent);

    if (!ecComponent) {
      console.error('无法获取图表组件，将重试');
      setTimeout(() => this.initChart(), 800);
      return;
    }

    // 设置回调函数并立即初始化
    this.setData({
      ec: {
        onInit: this.initChartComponent.bind(this)
      }
    }, () => {
      // 设置完成后，尝试主动调用组件的init方法
      if (typeof ecComponent.init === 'function') {
        console.log('主动调用组件init方法');
        ecComponent.init((canvas, ctx) => {
          return this.initChartComponent(canvas, ctx);
        });
      }
    });

    console.log('图表初始化回调已设置');
  },

  initChartComponent: function (canvas, ctx, width, height, dpr) {
    console.log('初始化图表组件开始', { canvas: !!canvas, ctx: !!ctx, width, height, dpr });

    if (!canvas) {
      console.error('Canvas对象为空，无法初始化图表');
      return null;
    }

    try {
      // 获取设备信息进行适配
      let systemInfo, windowInfo, deviceInfo;
      try {
        deviceInfo = wx.getDeviceInfo();
        windowInfo = wx.getWindowInfo();
        systemInfo = { ...deviceInfo, ...windowInfo };
      } catch (e) {
        console.warn('获取新版系统信息失败，使用旧版API:', e);
        systemInfo = wx.getSystemInfoSync();
      }

      const isWindows = systemInfo.platform === 'windows' || (systemInfo.system && systemInfo.system.toLowerCase().includes('windows'));
      const isIOS = systemInfo.platform === 'ios';
      const screenWidth = systemInfo.screenWidth;
      const screenHeight = systemInfo.screenHeight;

      console.log('设备信息:', {
        platform: systemInfo.platform,
        system: systemInfo.system,
        isWindows,
        isIOS,
        screenWidth,
        screenHeight
      });

      // 使用传入的参数或默认值
      const canvasWidth = width || 300;
      const canvasHeight = height || 500;
      const pixelRatio = dpr || systemInfo.pixelRatio || 1;

      console.log('使用尺寸:', { canvasWidth, canvasHeight, pixelRatio });

      // 确保canvas上下文存在
      if (!ctx) {
        console.log('没有传入ctx，尝试获取');
        ctx = canvas.getContext('2d');
      }

      if (!ctx) {
        console.error('无法获取canvas上下文');
        return null;
      }

      // 设置canvas尺寸
      if (this.data.forceOldCanvas) {
        // 旧版canvas不需要设置尺寸
        console.log('使用旧版Canvas，不设置像素尺寸');
      } else {
        // 新版canvas需要设置尺寸
        canvas.width = canvasWidth * pixelRatio;
        canvas.height = canvasHeight * pixelRatio;
        ctx.scale(pixelRatio, pixelRatio);
      }

      // 获取容器实际尺寸以确保图表正确缩放
      let containerWidth = canvasWidth;
      let containerHeight = canvasHeight;

      try {
        const query = wx.createSelectorQuery().in(this);
        query.select('.chart-container')
          .boundingClientRect()
          .exec((res) => {
            if (res && res[0]) {
              // 应用更小的尺寸以便图表能够在容器中居中
              containerWidth = Math.floor(res[0].width * 0.9) || canvasWidth; // 使用80%的容器宽度
              containerHeight = Math.floor(res[0].height * 0.9) || canvasHeight; // 使用80%的容器高度
              console.log('容器实际尺寸:', { containerWidth, containerHeight });

              // 重新设置canvas尺寸
              if (!this.data.forceOldCanvas) {
                canvas.width = containerWidth * pixelRatio;
                canvas.height = containerHeight * pixelRatio;
                canvas.style.width = containerWidth + 'px';
                canvas.style.height = containerHeight + 'px';
                ctx.scale(pixelRatio, pixelRatio);
              }

              // 调整后再次初始化图表
              if (this.chart) {
                this.chart.resize({
                  width: containerWidth,
                  height: containerHeight
                });
              }
            }
          });
      } catch (e) {
        console.error('获取容器尺寸失败:', e);
      }

      // 根据设备类型调整缩放比例，确保图表不超出容器
      let scaleFactor = 0.5; // 默认使用85%的容器空间，留出边距
      if (isWindows) {
        scaleFactor = 0.5; // Windows设备稍大一些
      } else if (isIOS) {
        scaleFactor = 0.33; // iOS设备更保守一些
      }

      console.log('使用缩放系数:', scaleFactor, '设备类型:', systemInfo.platform);

      // 使用适当的有效尺寸，确保不超出容器
      const effectiveWidth = containerWidth * scaleFactor;
      const effectiveHeight = containerHeight * scaleFactor;

      const chart = echarts.init(canvas, null, {
        width: effectiveWidth,
        height: effectiveHeight,
        devicePixelRatio: pixelRatio,
        renderer: 'canvas'
      });

      // 根据设备类型调整网格设置，确保图表内容完全显示在容器内
      let gridSettings;
      if (isWindows) {
        // Windows设备使用适中的布局
        gridSettings = {
          left: '10%',
          right: '10%',
          top: '15%',
          bottom: '12%',
          containLabel: true
        };
      } else {
        // 其他设备使用标准布局
        gridSettings = {
          left: '12%',
          right: '12%',
          top: '18%',
          bottom: '15%',
          containLabel: true
        };
      }

      console.log('使用网格设置:', gridSettings);

      chart.setOption({
        animation: false,
        textStyle: {
          fontSize: 12
        },
        backgroundColor: 'transparent',
        grid: gridSettings
      });

      console.log('ECharts初始化结果:', !!chart);

      if (canvas && typeof canvas.setChart === 'function') {
        canvas.setChart(chart);
        console.log('Canvas setChart调用成功');
      }

      this.chart = chart;
      console.log('图表对象已保存到this.chart:', !!this.chart);

      // 立即更新图表数据
      const chartData = this.getChartData();
      const option = this.getChartOption(chartData);

      chart.setOption(option);
      console.log('图表初始化时已设置数据');

      // 确保图表能正确响应容器尺寸变化
      setTimeout(() => {
        if (this.chart) {
          console.log('延迟调整图表大小以适应容器');
          this.forceChartResize();
        }
      }, 500);

      // 如果是旧版Canvas，手动触发绘制
      if (this.data.forceOldCanvas && ctx && typeof ctx.draw === 'function') {
        setTimeout(() => {
          console.log('手动触发Canvas绘制');
          ctx.draw(true);
        }, 100);
      }

      return chart;
    } catch (error) {
      console.error('图表初始化失败:', error);
      this.chart = null;
      return null;
    }
  },

  // 检查并初始化图表
  checkAndInitChart: function () {
    console.log('检查图表初始化状态');
    if (!this.chart) {
      console.log('图表未初始化，重新设置初始化回调');
      this.initChart();
    } else {
      console.log('图表已初始化，更新数据');
      this.updateChart();
    }
  },

  // 强制调整图表大小
  forceChartResize: function () {
    if (!this.chart) {
      console.log('图表未初始化，无法调整大小');
      return;
    }

    try {
      // 获取设备信息进行适配
      let systemInfo;
      try {
        const deviceInfo = wx.getDeviceInfo();
        const windowInfo = wx.getWindowInfo();
        systemInfo = { ...deviceInfo, ...windowInfo };
      } catch (e) {
        console.warn('获取新版系统信息失败，使用旧版API:', e);
        systemInfo = wx.getSystemInfoSync();
      }

      const isWindows = systemInfo.platform === 'windows' || (systemInfo.system && systemInfo.system.toLowerCase().includes('windows'));

      const query = wx.createSelectorQuery().in(this);
      query.select('.chart-container')
        .boundingClientRect()
        .exec((res) => {
          if (res && res[0]) {
            const containerWidth = Math.floor(res[0].width);
            const containerHeight = Math.floor(res[0].height);
            console.log('强制调整图表大小:', { containerWidth, containerHeight });

            // 根据设备类型调整缩放比例，确保不超出容器
            const scaleFactor = isWindows ? 0.5 : 0.33;
            console.log('调整大小时使用缩放系数:', scaleFactor, '设备类型:', systemInfo.platform);

            // 使用适当的有效尺寸，确保不超出容器
            const effectiveWidth = containerWidth * scaleFactor;
            const effectiveHeight = containerHeight * scaleFactor;

            this.chart.resize({
              width: effectiveWidth,
              height: effectiveHeight
            });

            // 重新设置图表选项以确保完整显示
            const chartData = this.getChartData();
            const option = this.getChartOption(chartData);
            this.chart.setOption(option, true);
          }
        });
    } catch (error) {
      console.error('强制调整图表大小失败:', error);
    }
  },

  // 调试方法 - 检查图表状态
  debugChartStatus: function () {
    console.log('=== 图表状态调试信息 ===');
    console.log('this.chart:', !!this.chart);
    console.log('数据记录数量:', this.data.bpRecords.length);
    console.log('当前视图:', this.data.currentView);
    console.log('当前日期:', this.data.currentDate);
    console.log('ec配置:', this.data.ec);
    console.log('========================');
  },

  // 加载血压记录
  loadBPRecords: function () {
    let records = [];

    try {
      records = wx.getStorageSync('bpRecords') || [];
      console.log('从本地存储加载记录，数量:', records.length);
    } catch (e) {
      console.error('加载数据失败:', e);
      records = [];
    }

    // 如果没有数据且未初始化过，创建一些示例数据
    if (records.length === 0 && !wx.getStorageSync('bpInitialized')) {
      console.log('首次使用，创建示例数据');
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

      // 模拟数据
      const mockRecords = [
        {
          id: Date.now() - 1000,
          date: formatDate(today),
          time: '08:30',
          systolic: 120,
          diastolic: 80,
          heartRate: 75,
          timestamp: new Date(`${formatDate(today)} 08:30`).getTime()
        },
        {
          id: Date.now() - 2000,
          date: formatDate(today),
          time: '14:15',
          systolic: 125,
          diastolic: 82,
          heartRate: 78,
          timestamp: new Date(`${formatDate(today)} 14:15`).getTime()
        },
        {
          id: Date.now() - 3000,
          date: formatDate(today),
          time: '20:45',
          systolic: 118,
          diastolic: 79,
          heartRate: 72,
          timestamp: new Date(`${formatDate(today)} 20:45`).getTime()
        },
        {
          id: Date.now() - 4000,
          date: formatDate(yesterday),
          time: '09:00',
          systolic: 130,
          diastolic: 85,
          heartRate: 80,
          timestamp: new Date(`${formatDate(yesterday)} 09:00`).getTime()
        },
        {
          id: Date.now() - 5000,
          date: formatDate(yesterday),
          time: '18:30',
          systolic: 122,
          diastolic: 81,
          heartRate: 76,
          timestamp: new Date(`${formatDate(yesterday)} 18:30`).getTime()
        },
        {
          id: Date.now() - 6000,
          date: formatDate(twoDaysAgo),
          time: '10:15',
          systolic: 115,
          diastolic: 75,
          heartRate: 70,
          timestamp: new Date(`${formatDate(twoDaysAgo)} 10:15`).getTime()
        }
      ];

      // 保存示例数据和初始化标记
      wx.setStorageSync('bpRecords', mockRecords);
      wx.setStorageSync('bpInitialized', true);
      console.log('示例数据已创建并保存');
    }

    this.setData({
      bpRecords: records
    });
  },

  // 保存血压记录
  saveBPRecords: function (records) {
    try {
      wx.setStorageSync('bpRecords', records);
      console.log('数据已保存到本地存储，记录数量:', records.length);
      this.setData({
        bpRecords: records
      });
      console.log('页面数据已更新，当前记录数量:', this.data.bpRecords.length);
    } catch (e) {
      console.error('保存数据失败:', e);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  // 切换视图
  switchView: function (e) {
    const view = e.currentTarget.dataset.view;
    this.setData({
      currentView: view
    });

    // 切换视图时强制调整图表大小并更新数据
    setTimeout(() => {
      if (this.chart) {
        this.forceChartResize();
      }
      this.updateChart();
    }, 100);
  },

  // 前一天/周/月/年
  prevPeriod: function () {
    const currentDate = new Date(this.data.currentDate);
    let newDate;

    switch (this.data.currentView) {
      case 'day':
        newDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        newDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate());
        break;
      case 'year':
        newDate = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), currentDate.getDate());
        break;
    }

    this.setData({
      currentDate: formatDate(newDate),
      displayDate: formatDisplayDate(newDate)
    });
    this.updateChart();
  },

  // 后一天/周/月/年
  nextPeriod: function () {
    const currentDate = new Date(this.data.currentDate);
    let newDate;

    switch (this.data.currentView) {
      case 'day':
        newDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'week':
        newDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
        break;
      case 'year':
        newDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
        break;
    }

    this.setData({
      currentDate: formatDate(newDate),
      displayDate: formatDisplayDate(newDate)
    });
    this.updateChart();
  },

  // 返回今天
  goToToday: function () {
    const today = new Date();
    this.setData({
      currentDate: formatDate(today),
      displayDate: formatDisplayDate(today)
    });
    this.updateChart();
    wx.showToast({
      title: '已返回今天',
      icon: 'none',
      duration: 1000
    });
  },

  // 显示添加记录对话框
  showAddRecord: function () {
    const now = new Date();
    const currentTime = `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`;

    this.setData({
      showAddDialog: true,
      newRecord: {
        systolic: '',
        diastolic: '',
        heartRate: '',
        time: currentTime,
        date: formatDate(now) // 初始化为当前日期
      }
    });
  },

  // 隐藏添加记录对话框
  hideAddRecord: function () {
    console.log('隐藏添加记录对话框');

    this.setData({
      showAddDialog: false
    }, () => {
      console.log('模态框状态已隐藏:', this.data.showAddDialog);

      // 重新调整图表大小
      setTimeout(() => {
        if (this.chart) {
          this.forceChartResize();
        }
      }, 300);
    });
  },

  // 阻止事件冒泡
  stopPropagation: function () {
    // 空函数，用于阻止事件冒泡
  },

  // 输入框变化
  onInputChange: function (e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`newRecord.${field}`]: value
    });
  },

  // 日期选择变化
  onDateChange: function (e) {
    const selectedDate = e.detail.value;
    this.setData({
      currentDate: selectedDate,
      displayDate: this.formatDisplayDate(new Date(selectedDate))
    });
  },

  // 日期选择器改变事件
  onDateChange: function (e) {
    this.setData({
      'newRecord.date': e.detail.value
    });
  },

  // 保存新记录
  saveRecord: function () {
    const { newRecord } = this.data;
    const systolic = parseInt(newRecord.systolic);
    const diastolic = parseInt(newRecord.diastolic);
    const heartRate = parseInt(newRecord.heartRate);
    const time = newRecord.time;
    const date = newRecord.date;

    // 校验时间格式
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      wx.showToast({
        title: '时间格式不正确 (HH:MM)',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 校验血压和心率是否为数字
    if (isNaN(systolic) || isNaN(diastolic) || isNaN(heartRate)) {
      wx.showToast({
        title: '血压和心率必须是有效数字',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 校验高压、低压、心率的正常值范围
    const BP_SYSTOLIC_MIN = 90;
    const BP_SYSTOLIC_MAX = 160;
    const BP_DIASTOLIC_MIN = 50;
    const BP_DIASTOLIC_MAX = 100;
    const HR_MIN = 50;
    const HR_MAX = 100;

    if (systolic < BP_SYSTOLIC_MIN || systolic > BP_SYSTOLIC_MAX) {
      wx.showToast({
        title: `收缩压应在 ${BP_SYSTOLIC_MIN}-${BP_SYSTOLIC_MAX} mmHg 之间`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (diastolic < BP_DIASTOLIC_MIN || diastolic > BP_DIASTOLIC_MAX) {
      wx.showToast({
        title: `舒张压应在 ${BP_DIASTOLIC_MIN}-${BP_DIASTOLIC_MAX} mmHg 之间`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (heartRate < HR_MIN || heartRate > HR_MAX) {
      wx.showToast({
        title: `心率应在 ${HR_MIN}-${HR_MAX} bpm 之间`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 校验高压必须大于低压
    if (systolic <= diastolic) {
      wx.showToast({
        title: '收缩压必须大于舒张压',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const newRecordObj = {
      id: Date.now(),
      date: date, // 使用选择的日期
      time: time,
      systolic: systolic,
      diastolic: diastolic,
      heartRate: heartRate,
      timestamp: new Date(`${date} ${time}`).getTime() // 使用选择的日期和时间计算时间戳
    };

    console.log('新记录:', newRecordObj);

    const records = [...this.data.bpRecords, newRecordObj];
    records.sort((a, b) => b.timestamp - a.timestamp);

    wx.setStorageSync('bpRecords', records);
    this.setData({
      bpRecords: records,
      showAddDialog: false,
      newRecord: { // 重置newRecord
        systolic: '',
        diastolic: '',
        heartRate: '',
        time: '',
        date: ''
      }
    });
    this.updateChart();
  },

  // 重置数据
  resetData: function () {
    wx.showModal({
      title: '确认重置',
      content: '确定要清除所有血压记录吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('bpRecords');
            wx.removeStorageSync('bpInitialized');
            console.log('数据已清除');

            this.setData({
              bpRecords: []
            });

            this.updateChart();
            wx.showToast({
              title: '数据已重置',
              icon: 'success'
            });
          } catch (e) {
            console.error('重置数据失败:', e);
            wx.showToast({
              title: '重置失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 更新图表
  updateChart: function () {
    console.log('开始更新图表');
    this.debugChartStatus();

    if (!this.chart) {
      console.log('图表未初始化，无法更新');
      // 尝试重新初始化图表
      setTimeout(() => {
        this.checkAndInitChart();
      }, 300);
      return;
    }

    const chartData = this.getChartData();
    console.log('获取到的图表数据:', chartData);

    const option = this.getChartOption(chartData);
    console.log('图表配置:', option);

    try {
      this.chart.setOption(option, true);
      console.log('图表更新成功');

      // 对于旧版Canvas，需要手动触发绘制
      setTimeout(() => {
        this.triggerCanvasDraw();

        // 双重保险：尝试重新设置一次图表选项并强制绘制
        setTimeout(() => {
          if (this.chart) {
            console.log('再次尝试刷新图表');
            this.chart.setOption(option, true);

            // 尝试调用resize可能会触发重绘
            try {
              this.forceChartResize();
            } catch (e) {
              console.error('图表resize失败:', e);
            }
          }
        }, 200);
      }, 100);

    } catch (error) {
      console.error('图表更新失败:', error);
      // 如果更新失败，可能是图表对象有问题，尝试重新初始化
      this.chart = null;
      setTimeout(() => {
        this.checkAndInitChart();
      }, 300);
    }
  },

  // 触发Canvas绘制
  triggerCanvasDraw: function () {
    console.log('尝试触发Canvas绘制');
    try {
      // 通过选择器获取ec-canvas组件实例
      const query = this.createSelectorQuery();
      query.select('#mychart-dom-line')
        .fields({
          node: true,
          context: true
        })
        .exec((res) => {
          console.log('获取ec-canvas组件实例:', res);
          if (res && res[0]) {
            // 尝试多种方式获取并调用draw
            if (res[0].context && res[0].context.draw) {
              console.log('调用context.draw()');
              res[0].context.draw(true);
            } else if (res[0].node && res[0].node.getContext) {
              const ctx = res[0].node.getContext('2d');
              if (ctx && ctx.draw) {
                console.log('调用ctx.draw()');
                ctx.draw(true);
              }
            }

            // 尝试直接调用组件方法
            const ecComponent = this.selectComponent('#mychart-dom-line');
            if (ecComponent && ecComponent.chart) {
              console.log('尝试通过组件刷新图表');
              try {
                ecComponent.chart.resize();
              } catch (e) {
                console.error('图表resize失败:', e);
              }
            }
          }
        });
    } catch (error) {
      console.error('触发Canvas绘制失败:', error);
    }
  },

  // 获取图表数据
  getChartData: function () {
    const { currentView, currentDate, bpRecords } = this.data;
    console.log('获取图表数据 - 当前视图:', currentView, '当前日期:', currentDate, '总记录数:', bpRecords.length);

    let filteredRecords = [];

    switch (currentView) {
      case 'day':
        filteredRecords = bpRecords.filter(record => record.date === currentDate);
        console.log('日视图过滤结果:', filteredRecords.length, '条记录');
        break;
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        filteredRecords = bpRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= weekStart && recordDate <= weekEnd;
        });
        console.log('周视图过滤结果:', filteredRecords.length, '条记录');
        break;
      case 'month':
        const currentMonth = new Date(currentDate);
        filteredRecords = bpRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getFullYear() === currentMonth.getFullYear() &&
            recordDate.getMonth() === currentMonth.getMonth();
        });
        console.log('月视图过滤结果:', filteredRecords.length, '条记录');
        break;
      case 'year':
        const currentYear = new Date(currentDate).getFullYear();
        filteredRecords = bpRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getFullYear() === currentYear;
        });
        console.log('年视图过滤结果:', filteredRecords.length, '条记录');
        break;
    }

    console.log('过滤后的记录:', filteredRecords);
    return this.processChartData(filteredRecords, currentView);
  },

  // 处理图表数据
  processChartData: function (records, view) {
    console.log('处理图表数据 - 记录数:', records.length, '视图:', view);

    if (records.length === 0) {
      console.log('没有记录，返回空数据');
      return { xData: [], systolicData: [], diastolicData: [], heartRateData: [] };
    }

    let xData = [];
    let systolicData = [];
    let diastolicData = [];
    let heartRateData = [];

    if (view === 'day') {
      // 确保记录按时间排序
      records.sort((a, b) => a.timestamp - b.timestamp);

      // 如果数据点太多，可能需要进行采样处理
      let recordsToDisplay = records;
      if (records.length > 20) {
        // 对于大量数据，进行简单的降采样
        const samplingInterval = Math.ceil(records.length / 20);
        recordsToDisplay = [];
        for (let i = 0; i < records.length; i += samplingInterval) {
          recordsToDisplay.push(records[i]);
        }
        // 确保最后一个点被包含
        if (recordsToDisplay[recordsToDisplay.length - 1] !== records[records.length - 1]) {
          recordsToDisplay.push(records[records.length - 1]);
        }
      }

      // 处理点数据
      recordsToDisplay.forEach(record => {
        xData.push(record.time);
        systolicData.push(record.systolic);
        diastolicData.push(record.diastolic);
        heartRateData.push(record.heartRate);
      });
      console.log('日视图数据处理完成 - X轴:', xData, '收缩压:', systolicData);
    } else {
      // 按日期分组并计算平均值
      const groupedData = {};
      records.forEach(record => {
        const key = view === 'week' ? record.date :
          view === 'month' ? record.date :
            record.date.substring(0, 7); // 年视图按月分组

        if (!groupedData[key]) {
          groupedData[key] = {
            systolic: [],
            diastolic: [],
            heartRate: []
          };
        }

        groupedData[key].systolic.push(record.systolic);
        groupedData[key].diastolic.push(record.diastolic);
        groupedData[key].heartRate.push(record.heartRate);
      });

      // 格式化显示
      Object.keys(groupedData).sort().forEach(key => {
        const data = groupedData[key];

        // 根据视图类型格式化显示的标签
        let displayKey = key;
        if (view === 'week') {
          // 显示为 'MM-DD'
          const date = new Date(key);
          displayKey = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else if (view === 'month') {
          // 显示为 'DD'
          const date = new Date(key);
          displayKey = String(date.getDate()).padStart(2, '0');
        } else {
          // 年视图，显示为 'YYYY-MM'，取前5个字符
          displayKey = key.substring(5, 7) + '月';
        }

        xData.push(displayKey);
        systolicData.push(Math.round(data.systolic.reduce((a, b) => a + b) / data.systolic.length));
        diastolicData.push(Math.round(data.diastolic.reduce((a, b) => a + b) / data.diastolic.length));
        heartRateData.push(Math.round(data.heartRate.reduce((a, b) => a + b) / data.heartRate.length));
      });
      console.log('非日视图数据处理完成 - X轴:', xData, '收缩压:', systolicData);
    }

    const result = { xData, systolicData, diastolicData, heartRateData };
    console.log('最终处理结果:', result);
    return result;
  },

  // 获取图表配置
  getChartOption: function (data) {
    const { currentView } = this.data;
    const viewNames = {
      day: '日视图',
      week: '周视图',
      month: '月视图',
      year: '年视图'
    };

    // 获取设备信息进行适配
    let systemInfo;
    try {
      const deviceInfo = wx.getDeviceInfo();
      const windowInfo = wx.getWindowInfo();
      systemInfo = { ...deviceInfo, ...windowInfo };
    } catch (e) {
      console.warn('获取新版系统信息失败，使用旧版API:', e);
      systemInfo = wx.getSystemInfoSync();
    }

    const isWindows = systemInfo.platform === 'windows' || (systemInfo.system && systemInfo.system.toLowerCase().includes('windows'));
    const isIOS = systemInfo.platform === 'ios';

    // 根据设备类型调整字体大小和其他参数 - 缩小字体以让图表占用更多空间
    const fontSizes = {
      title: isWindows ? 8 : 7,
      legend: isWindows ? 6 : 5,  // 缩小图例字体
      axis: isWindows ? 5 : 4,    // 缩小坐标轴字体
      tooltip: isWindows ? 5 : 4
    };

    const lineWidths = {
      normal: isWindows ? 1 : 1
    };

    const symbolSizes = {
      normal: isWindows ? 3 : 4  // 增大手机设备上的数据点大小
    };

    // 使用合适的缩放比例
    const scaleFactor = isWindows ? 0.5 : 0.33;

    // 如果没有数据，显示空状态
    if (!data.xData || data.xData.length === 0) {
      return {
        title: {
          text: `${viewNames[currentView]}`,
          left: 'center',
          textStyle: {
            color: '#333',
            fontSize: fontSizes.title
          },
          top: '1%',
          padding: [2, 0, 2, 0]
        },
        xAxis: {
          show: false
        },
        yAxis: {
          show: false
        }
      };
    }

    return {
      title: {
        text: `${viewNames[currentView]}`,
        left: 'center',
        textStyle: {
          color: '#333',
          fontSize: fontSizes.title
        },
        top: '1%',
        padding: [2, 0, 2, 0]
      },
      graphic: {
        elements: [
          {
            type: 'group',
            left: 'center',
            top: 'center',
            children: []
          }
        ]
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            type: 'dashed',
            width: 1
          }
        },
        confine: true,
        position: function (point, params, dom, rect, size) {
          // 确保提示框始终在图表区域内
          return [Math.min(point[0], size.viewSize[0] - dom.offsetWidth - 10), '10%'];
        },
        formatter: function (params) {
          let result = params[0].name + '<br/>';
          params.forEach(function (item) {
            const unit = item.seriesName === '心率' ? ' bpm' : ' mmHg';
            result += item.marker + item.seriesName + ': ' + item.value + unit + '<br/>';
          });
          return result;
        },
        backgroundColor: 'rgba(255,255,255,0.9)',
        textStyle: {
          fontSize: fontSizes.tooltip
        },
        padding: [5, 8]
      },
      legend: {
        data: ['收缩压', '舒张压', '心率'],
        top: isWindows ? '6%' : '6%',  // 减少顶部间距
        itemWidth: isWindows ? 8 : 6,  // 缩小图例图标
        itemHeight: isWindows ? 5 : 4,  // 缩小图例图标
        textStyle: {
          fontSize: fontSizes.legend,
          color: '#666'
        },
        padding: [2, 0, 0, 0],  // 减少内边距
        orient: 'horizontal',
        itemGap: isWindows ? 6 : 0,  // 减少图例间距
        selectedMode: false // 禁用点击切换
      },
      grid: isWindows ? {
        left: '0%',   // 减少左边距
        right: '0%',  // 减少右边距
        bottom: '3%', // 减少底部边距
        top: '13%',   // 减少顶部边距
        containLabel: true
      } : {
        left: '0%',   // 减少左边距
        right: '0%',  // 减少右边距
        bottom: '3%', // 减少底部边距
        top: '13%',   // 减少顶部边距
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.xData,
        axisLabel: {
          rotate: currentView === 'day' ? 0 : 45,
          fontSize: fontSizes.axis,
          interval: 'auto',
          hideOverlap: false,
          margin: 1,  // 减少边距
          showMinLabel: true,
          showMaxLabel: true
        }
      },
      yAxis: [
        {
          type: 'value',
          name: '',
          nameGap: 1,
          position: 'left',
          axisLabel: {
            formatter: '{value}',
            fontSize: fontSizes.axis,
            margin: 1,  // 减少边距
            showMinLabel: false,
            showMaxLabel: false,
            interval: 'auto'
          },
          nameTextStyle: {
            fontSize: fontSizes.axis,
            padding: [0, 0, 0, 0]
          },
          splitNumber: 12,
          scale: true,
          boundaryGap: ['5%', '5%'],
          min: function (value) {
            // 合理的显示范围，确保数据线条清晰可见
            const dataRange = value.max - value.min;
            const padding = Math.max(dataRange * 0.1, 5); // 10%的数据范围作为边距，最小5个单位
            return Math.max(0, value.min - padding);
          },
          max: function (value) {
            // 合理的显示范围，确保数据线条清晰可见
            const dataRange = value.max - value.min;
            const padding = Math.max(dataRange * 0.1, 5); // 10%的数据范围作为边距，最小5个单位
            return value.max + padding;
          }
        },
        {
          type: 'value',
          name: '',
          nameGap: 2,
          position: 'right',
          axisLabel: {
            formatter: '{value}',
            fontSize: fontSizes.axis,
            margin: 3,  // 减少边距
            showMinLabel: false,
            showMaxLabel: false,
            interval: 'auto'
          },
          nameTextStyle: {
            fontSize: fontSizes.axis,
            padding: [0, 0, 0, 0]
          },
          splitNumber: 12,
          scale: true,
          boundaryGap: ['5%', '5%'],
          min: function (value) {
            // 合理的显示范围，确保数据线条清晰可见
            const dataRange = value.max - value.min;
            const padding = Math.max(dataRange * 0.1, 3); // 10%的数据范围作为边距，最小3个单位
            return Math.max(0, value.min - padding);
          },
          max: function (value) {
            // 合理的显示范围，确保数据线条清晰可见
            const dataRange = value.max - value.min;
            const padding = Math.max(dataRange * 0.1, 3); // 10%的数据范围作为边距，最小3个单位
            return value.max + padding;
          }
        }
      ],
      series: [
        {
          name: '收缩压',
          type: 'line',
          data: data.systolicData,
          smooth: true,
          lineStyle: {
            color: '#ff0000',
            width: lineWidths.normal
          },
          itemStyle: {
            color: '#ff0000'
          },
          symbol: 'circle',
          symbolSize: symbolSizes.normal,
          showSymbol: true,
          itemStyle: {
            color: '#ff0000',
            borderWidth: 2,
            borderColor: '#fff'
          }
        },
        {
          name: '舒张压',
          type: 'line',
          data: data.diastolicData,
          smooth: true,
          lineStyle: {
            color: '#00ff00',
            width: lineWidths.normal
          },
          itemStyle: {
            color: '#00ff00',
            borderWidth: 2,
            borderColor: '#fff'
          },
          symbol: 'circle',
          symbolSize: symbolSizes.normal,
          showSymbol: true
        },
        {
          name: '心率',
          type: 'line',
          yAxisIndex: 1,
          data: data.heartRateData,
          smooth: true,
          lineStyle: {
            color: '#0000ff',
            width: lineWidths.normal
          },
          itemStyle: {
            color: '#0000ff',
            borderWidth: 2,
            borderColor: '#fff'
          },
          symbol: 'circle',
          symbolSize: symbolSizes.normal,
          showSymbol: true
        }
      ]
    };
  }
});