Component({
    properties: {
        canvasId: {
            type: String,
            value: 'ec-canvas'
        },

        ec: {
            type: Object,
            value: {},
            observer: function(newVal, oldVal) {
                console.log('ec属性变化:', { newVal, oldVal });
                if (newVal && newVal.onInit && typeof newVal.onInit === 'function') {
                    console.log('检测到onInit回调');
                    // 如果组件已经ready，立即初始化
                    if (this.data.isCanvasReady) {
                        console.log('组件已ready，开始初始化');
                        this.tryInitChart();
                    } else {
                        console.log('组件未ready，等待ready后初始化');
                    }
                }
            }
        },

        forceUseOldCanvas: {
            type: Boolean,
            value: false
        }
    },

    data: {
        isUseNewCanvas: false,
        isCanvasReady: false,
        ctx: null,
        canvas: null,
        canvasDpr: 1,
        initTries: 0
    },

    lifetimes: {
        attached: function () {
            // 在组件实例进入页面节点树时执行
            // 检查是否可以使用新Canvas API
            try {
                let systemInfo;
                try {
                    systemInfo = wx.getAppBaseInfo();
                } catch (e) {
                    console.warn('获取新版系统信息失败，使用旧版API:', e);
                    systemInfo = wx.getSystemInfoSync();
                }
                const version = systemInfo.SDKVersion || '2.0.0';
                const canUseNewCanvas = compareVersion(version, '2.9.0') >= 0;
                this.setData({ isUseNewCanvas: canUseNewCanvas && !this.properties.forceUseOldCanvas });
            } catch (e) {
                console.warn('获取系统信息失败，使用默认配置', e);
                this.setData({ isUseNewCanvas: false });
            }
        },
        ready: function () {
            // 组件在视图层布局完成后执行
            console.log('ec-canvas组件ready');
            this.setData({ isCanvasReady: true });
            
            // 如果已经有onInit回调，立即初始化
            if (this.properties.ec && this.properties.ec.onInit) {
                console.log('组件ready时发现onInit回调，开始初始化');
                this.tryInitChart();
            }
        },
        detached: function () {
            // 在组件实例被从页面节点树移除时执行
            if (this.chart) {
                this.chart.dispose();
                this.chart = null;
            }
        },
    },

    methods: {
        tryInitChart: function() {
            console.log('尝试初始化图表');
            if (!this.properties.ec || !this.properties.ec.onInit) {
                console.log('没有onInit回调，跳过初始化');
                return;
            }
            
            if (this.data.initTries >= 5) {
                console.error('初始化重试次数过多，停止尝试');
                return;
            }
            
            this.setData({
                initTries: this.data.initTries + 1
            });
            
            console.log('开始初始化，第', this.data.initTries, '次尝试');
            
            // 增加延迟时间，确保DOM完全渲染
            const delay = this.data.initTries * 300; // 递增延迟
            setTimeout(() => {
                this.init((canvas, ctx) => {
                    console.log('Canvas初始化完成，调用onInit回调');
                    
                    // 获取实际尺寸
                    let width, height;
                    if (this.data.isUseNewCanvas) {
                        // 新版Canvas使用实际像素尺寸
                        width = canvas.clientWidth || canvas.offsetWidth || 300;
                        height = canvas.clientHeight || canvas.offsetHeight || 500;  // 使用更大的默认高度
                    } else {
                        // 旧版Canvas使用设置的尺寸
                        width = canvas.width || 300;
                        height = canvas.height || 500;  // 使用更大的默认高度
                    }
                    
                    let dpr = 1;
                    try {
                        let windowInfo;
                        try {
                            windowInfo = wx.getWindowInfo();
                        } catch (e) {
                            console.warn('获取新版窗口信息失败，使用旧版API:', e);
                            windowInfo = wx.getSystemInfoSync();
                        }
                        dpr = windowInfo.pixelRatio || 1;
                    } catch (e) {
                        console.warn('获取像素比失败:', e);
                        dpr = 1;
                    }
                    
                    console.log('调用onInit回调，参数:', { width, height, dpr });
                    
                    try {
                        this.properties.ec.onInit(canvas, ctx, width, height, dpr);
                        console.log('onInit回调执行成功');
                    } catch (error) {
                        console.error('onInit回调执行失败:', error);
                        // 如果初始化失败，可以尝试重新初始化
                        if (this.data.initTries < 5) {
                            console.log('onInit失败，将重新尝试初始化');
                            setTimeout(() => {
                                this.tryInitChart();
                            }, 1000);
                        }
                    }
                }, (error) => {
                    console.error('Canvas初始化失败:', error);
                    // 如果Canvas初始化失败，尝试重新初始化
                    if (this.data.initTries < 5) {
                        console.log('Canvas初始化失败，将重新尝试');
                        setTimeout(() => {
                            this.tryInitChart();
                        }, 1000);
                    }
                });
            }, delay);
        },

        init: function (callback, errorCallback) {
            try {
                let systemInfo;
                try {
                    systemInfo = wx.getAppBaseInfo();
                } catch (e) {
                    console.warn('获取新版系统信息失败，使用旧版API:', e);
                    systemInfo = wx.getSystemInfoSync();
                }
                const version = systemInfo.SDKVersion || '2.0.0';
                const canUseNewCanvas = compareVersion(version, '2.9.0') >= 0;
                console.log('当前基础库版本:', version, '是否可用新Canvas:', canUseNewCanvas);

                // 使用data中的isUseNewCanvas来决定使用哪种Canvas API
                if (!this.data.isUseNewCanvas) {
                    console.log('使用旧版Canvas API');
                    this._initOldCanvas(callback, errorCallback);
                } else {
                    // 使用新版Canvas API
                    console.log('使用新版Canvas API');
                    this._initNewCanvas(callback, errorCallback);
                }
            } catch (e) {
                console.warn('获取系统信息失败，使用旧版Canvas API', e);
                this._initOldCanvas(callback, errorCallback);
            }
        },

        _initNewCanvas: function (callback, errorCallback) {
            // 使用新的接口
            const componentInstance = this;

            // 尝试获取节点的函数
            const tryGetCanvas = (retryCount = 0) => {
                console.log('尝试获取Canvas节点，第', retryCount + 1, '次尝试');

                // 使用多种选择器方式尝试
                const queries = [
                    // 方式1: 使用class选择器
                    () => {
                        const query = wx.createSelectorQuery().in(this);
                        return query.select('.ec-canvas').fields({ node: true, size: true });
                    },
                    // 方式2: 使用id选择器
                    () => {
                        const query = wx.createSelectorQuery().in(this);
                        return query.select(`#${this.data.canvasId}`).fields({ node: true, size: true });
                    },
                    // 方式3: 使用canvas标签选择器
                    () => {
                        const query = wx.createSelectorQuery().in(this);
                        return query.select('canvas').fields({ node: true, size: true });
                    }
                ];

                const tryQuery = (queryIndex = 0) => {
                    if (queryIndex >= queries.length) {
                        // 所有查询方式都失败了
                        if (retryCount < 3) {
                            console.log('所有查询方式失败，将在500ms后重试');
                            setTimeout(() => {
                                tryGetCanvas(retryCount + 1);
                            }, 500);
                        } else {
                            console.error('重试3次后仍然失败，尝试使用旧的Canvas API');
                            componentInstance._initOldCanvas(callback, errorCallback);
                        }
                        return;
                    }

                    const queryBuilder = queries[queryIndex];
                    const query = queryBuilder();
                    
                    query.exec((res) => {
                        console.log(`查询方式${queryIndex + 1}结果:`, res);

                        if (!res || !res[0] || !res[0].node) {
                            console.warn(`查询方式${queryIndex + 1}失败，尝试下一种方式`);
                            // 尝试下一种查询方式
                            setTimeout(() => {
                                tryQuery(queryIndex + 1);
                            }, 100);
                            return;
                        }

                        const canvas = res[0].node;
                        console.log('成功获取Canvas节点:', canvas);

                        try {
                            // 验证canvas节点的有效性
                            if (!canvas || typeof canvas.getContext !== 'function') {
                                console.error('Canvas节点无效，尝试下一种查询方式');
                                setTimeout(() => {
                                    tryQuery(queryIndex + 1);
                                }, 100);
                                return;
                            }

                            // 获取上下文
                            const ctx = canvas.getContext('2d');
                            if (!ctx) {
                                console.error('获取Canvas上下文失败，尝试下一种查询方式');
                                setTimeout(() => {
                                    tryQuery(queryIndex + 1);
                                }, 100);
                                return;
                            }

                            console.log('成功获取Canvas上下文:', ctx);

                            // 设置分辨率
                            let dpr = 1;
                            try {
                                let windowInfo;
                                try {
                                    windowInfo = wx.getWindowInfo();
                                } catch (e) {
                                    console.warn('获取新版窗口信息失败，使用旧版API:', e);
                                    windowInfo = wx.getSystemInfoSync();
                                }
                                dpr = windowInfo.pixelRatio || 1;
                            } catch (e) {
                                console.warn('获取像素比失败，使用默认值', e);
                                dpr = 1;
                            }

                            // 确保尺寸有效
                            const width = res[0].width || 300;
                            const height = res[0].height || 500;  // 使用更大的默认高度
                            
                            canvas.width = width * dpr;
                            canvas.height = height * dpr;
                            ctx.scale(dpr, dpr);

                            // 保存canvas和ctx到data中
                            componentInstance.setData({
                                canvas: canvas,
                                ctx: ctx,
                                canvasDpr: dpr,
                                isCanvasReady: true
                            });

                            // 为echarts提供setChart方法
                            canvas.setChart = (chart) => {
                                componentInstance.chart = chart;
                            };

                            // 为echarts提供getContext方法（保持原有功能）
                            const originalGetContext = canvas.getContext;
                            canvas.getContext = (type) => {
                                if (type === '2d') {
                                    return ctx;
                                }
                                return originalGetContext ? originalGetContext.call(canvas, type) : null;
                            };

                            // 为echarts提供canvas属性
                            canvas.getBoundingClientRect = () => {
                                return {
                                    top: 0,
                                    left: 0,
                                    width: width,
                                    height: height
                                };
                            };

                            // 为canvas添加事件监听方法
                            if (!canvas.addEventListener) {
                                canvas.addEventListener = function (type, listener) {
                                    console.log('模拟添加事件监听:', type);
                                    // 小程序不支持addEventListener，这里只是为了避免报错
                                };
                            }

                            if (!canvas.removeEventListener) {
                                canvas.removeEventListener = function (type, listener) {
                                    console.log('模拟移除事件监听:', type);
                                    // 小程序不支持removeEventListener，这里只是为了避免报错
                                };
                            }

                            // 添加其他可能需要的DOM属性和方法
                            canvas.className = 'ec-canvas';
                            canvas.setAttribute = function (name, value) {
                                console.log('模拟setAttribute:', name, value);
                            };

                            canvas.style = canvas.style || {};

                            // 添加更多DOM兼容属性
                            canvas.clientWidth = width;
                            canvas.clientHeight = height;
                            canvas.offsetWidth = width;
                            canvas.offsetHeight = height;

                            console.log('新版Canvas初始化完成');
                            if (typeof callback === 'function') {
                                callback(canvas, ctx);
                            }
                        } catch (error) {
                            console.error('初始化Canvas时出错:', error);
                            // 尝试下一种查询方式
                            setTimeout(() => {
                                tryQuery(queryIndex + 1);
                            }, 100);
                        }
                    });
                };

                // 开始尝试第一种查询方式
                tryQuery();
            };

            // 延迟一段时间再开始获取节点，确保DOM已经渲染完成
            setTimeout(() => {
                tryGetCanvas();
            }, 100);
        },

        _initOldCanvas: function (callback, errorCallback) {
            console.log('初始化旧版Canvas');
            const componentInstance = this;
            
            // 先获取容器尺寸
            const query = wx.createSelectorQuery().in(this);
            query.select('.ec-canvas')
                .boundingClientRect()
                .exec((res) => {
                    console.log('获取容器尺寸:', res);
                    
                    let containerWidth = 300;
                    let containerHeight = 500;  // 使用更大的默认高度
                    
                    if (res && res[0]) {
                        containerWidth = res[0].width || 300;
                        containerHeight = res[0].height || 500;  // 确保有足够的高度
                    }
                    
                    console.log('使用容器尺寸:', { containerWidth, containerHeight });
                    
                    // 使用旧的接口
                    const canvasId = componentInstance.data.canvasId;
                    const originalCtx = wx.createCanvasContext(canvasId, componentInstance);
                    
                    // 检查上下文是否有效
                    if (!originalCtx) {
                        console.error('创建Canvas上下文失败');
                        if (typeof errorCallback === 'function') {
                            errorCallback(new Error('创建Canvas上下文失败'));
                        }
                        return;
                    }

                    // 确保有绘制的内容，以便于调试
                    originalCtx.setFillStyle('#f6f6f6');
                    originalCtx.fillRect(0, 0, containerWidth, containerHeight);
                    originalCtx.setFillStyle('#333333');
                    originalCtx.setFontSize(14);
                    originalCtx.fillText('Canvas已初始化', 10, 20);
                    originalCtx.draw(true);
                    
                    // 包装ctx，在关键方法调用后自动draw
                    const ctx = originalCtx;

                    // 为旧版Canvas提供getContext方法
                    const canvas = {
                        getContext: function () {
                            return ctx;
                        },
                        setChart: function (chart) {
                            componentInstance.chart = chart;
                        },
                        attachEvent: function () { },
                        detachEvent: function () { },
                        
                        // 添加draw方法供ECharts调用
                        draw: function() {
                            console.log('Canvas draw方法被调用');
                            ctx.draw(true);
                        },

                        // 添加事件监听方法
                        addEventListener: function (type, listener) {
                            console.log('旧版Canvas模拟添加事件监听:', type);
                        },
                        removeEventListener: function (type, listener) {
                            console.log('旧版Canvas模拟移除事件监听:', type);
                        },

                        // 添加其他可能需要的DOM属性和方法
                        className: 'ec-canvas',
                        setAttribute: function (name, value) {
                            console.log('旧版Canvas模拟setAttribute:', name, value);
                        },
                        style: {},

                        // 使用实际容器尺寸
                        width: containerWidth,
                        height: containerHeight,
                        clientWidth: containerWidth,
                        clientHeight: containerHeight,
                        offsetWidth: containerWidth,
                        offsetHeight: containerHeight,
                        canvasId: canvasId,

                        // 添加getBoundingClientRect方法
                        getBoundingClientRect: function () {
                            return {
                                top: 0,
                                left: 0,
                                width: containerWidth,
                                height: containerHeight
                            };
                        }
                    };

                    // 保存canvas和ctx到data中
                    componentInstance.setData({
                        canvas: canvas,
                        ctx: ctx,
                        isCanvasReady: true
                    });

                    console.log('旧版Canvas初始化完成');
                    if (typeof callback === 'function') {
                        try {
                            callback(canvas, ctx);
                        } catch (e) {
                            console.error('Canvas回调执行失败:', e);
                            if (typeof errorCallback === 'function') {
                                errorCallback(e);
                            }
                        }
                        
                        // 对于旧版Canvas，需要调用draw()来实际渲染内容
                        setTimeout(() => {
                            console.log('调用ctx.draw()渲染Canvas内容');
                            ctx.draw(true);
                        }, 500);
                    }
                });
        },

        canvasToTempFilePath: function (opt) {
            let canUseNewCanvas = false;
            try {
                let systemInfo;
                try {
                    systemInfo = wx.getAppBaseInfo();
                } catch (e) {
                    console.warn('获取新版系统信息失败，使用旧版API:', e);
                    systemInfo = wx.getSystemInfoSync();
                }
                const version = systemInfo.SDKVersion || '2.0.0';
                canUseNewCanvas = compareVersion(version, '2.9.0') >= 0;
            } catch (e) {
                console.warn('获取系统信息失败，使用旧版Canvas API', e);
                canUseNewCanvas = false;
            }

            if (canUseNewCanvas && !this.properties.forceUseOldCanvas) {
                // 新版Canvas
                const canvas = this.data.canvas;
                if (!canvas) {
                    console.error('Canvas还未初始化');
                    return;
                }

                wx.canvasToTempFilePath({
                    canvas: canvas,
                    ...opt
                });
            } else {
                // 旧版Canvas
                wx.canvasToTempFilePath({
                    canvasId: this.data.canvasId,
                    ...opt,
                    success: opt.success,
                    fail: opt.fail
                }, this);
            }
        },

        touchStart: function (e) {
            if (this.chart && e.touches.length > 0) {
                const touch = e.touches[0];
                const handler = this.chart.getZr().handler;
                handler.dispatch('mousedown', {
                    zrX: touch.x,
                    zrY: touch.y
                });
                handler.dispatch('mousemove', {
                    zrX: touch.x,
                    zrY: touch.y
                });
                handler.processGesture(e, 'start');
            }
        },

        touchMove: function (e) {
            if (this.chart && e.touches.length > 0) {
                const touch = e.touches[0];
                const handler = this.chart.getZr().handler;
                handler.dispatch('mousemove', {
                    zrX: touch.x,
                    zrY: touch.y
                });
                handler.processGesture(e, 'change');
            }
        },

        touchEnd: function (e) {
            if (this.chart) {
                const touch = e.changedTouches ? e.changedTouches[0] : {};
                const handler = this.chart.getZr().handler;
                handler.dispatch('mouseup', {
                    zrX: touch.x,
                    zrY: touch.y
                });
                handler.dispatch('click', {
                    zrX: touch.x,
                    zrY: touch.y
                });
                handler.processGesture(e, 'end');
            }
        },

        setStyle: function (styles) {
            // 动态设置canvas的样式
            if (!styles) return;

            const query = wx.createSelectorQuery().in(this);
            query.select('.ec-canvas')
                .fields({ node: true, size: true })
                .exec((res) => {
                    if (res && res[0] && res[0].node) {
                        const canvas = res[0].node;
                        for (let key in styles) {
                            if (styles.hasOwnProperty(key)) {
                                canvas.style[key] = styles[key];
                            }
                        }
                        console.log('Canvas样式已更新:', styles);
                    }
                });
        }
    }
});

// 版本比较函数
function compareVersion(v1, v2) {
    v1 = v1.split('.');
    v2 = v2.split('.');
    const len = Math.max(v1.length, v2.length);

    while (v1.length < len) {
        v1.push('0');
    }
    while (v2.length < len) {
        v2.push('0');
    }

    for (let i = 0; i < len; i++) {
        const num1 = parseInt(v1[i]);
        const num2 = parseInt(v2[i]);

        if (num1 > num2) {
            return 1;
        } else if (num1 < num2) {
            return -1;
        }
    }

    return 0;
} 